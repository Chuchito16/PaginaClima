#!/usr/bin/env python3
"""Create real country/continent masks for NASA's native 2° grid.

python -m pip install -r scripts/requirements-data.txt
python scripts/build_country_areas.py [--cache]

Boundary source: Natural Earth's official vector repository, public domain.
Country weights are intersected area in km², never nearest-country assignments.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from math import pi
from pathlib import Path
from urllib.request import Request, urlopen

import numpy as np
import shapely
from shapely.geometry import shape, mapping


ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "public" / "data"
ASSETS = ROOT / "public" / "assets"
CACHE = ROOT / "work" / "nasa"
SOURCE_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson"
SOURCE_PAGE = "https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-countries-2/"
RADIUS_KM = 6371.0088
CONTINENTS = {
    "Africa": ("region-africa", "África", [2, 21]),
    "Asia": ("region-asia", "Asia", [36, 95]),
    "Europe": ("region-europe", "Europa", [51, 18]),
    "North America": ("region-north-america", "América del Norte y Central", [40, -100]),
    "South America": ("region-south-america", "América del Sur", [-15, -60]),
    "Oceania": ("region-oceania", "Oceanía", [-25, 135]),
    "Antarctica": ("region-antarctica", "Antártida", [-80, 0]),
}
RESOLUTION_NOTE = (
    "Estimación espacial a partir de celdas NASA de 2° y suavizado de 1200 km; "
    "no es una serie meteorológica oficial del país ni de una ciudad. Los países pequeños "
    "pueden compartir una misma observación regional. Los pesos respetan la fracción de celda dentro del área."
)


def equal_area(x, y, z=None):
    """Spherical cylindrical equal-area coordinates in unit-sphere units."""
    return np.deg2rad(x), np.sin(np.deg2rad(y))


def json_write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


def round_coordinates(value):
    if isinstance(value, (list, tuple)):
        return [round_coordinates(item) for item in value]
    return round(value, 5) if isinstance(value, (float, np.floating)) else value


def display_geometry(geometry):
    # Simplification is only for the rendered outline. Masks use unsimplified
    # Natural Earth boundaries, densified before the equal-area projection.
    # Retain microstate/island outlines exactly: a fixed angular tolerance can
    # move most of a tiny polygon despite preserving its topology.
    simple = geometry if geometry.area < 0.1 else geometry.simplify(0.015, preserve_topology=True)
    result = mapping(simple)
    return {"type": result["type"], "coordinates": round_coordinates(result["coordinates"])}


def area_cells(geometry, boxes, tree):
    dense = shapely.segmentize(geometry, max_segment_length=0.2)
    projected = shapely.transform(dense, equal_area, interleaved=False)
    if not projected.is_valid:
        projected = shapely.make_valid(projected)
    candidates = np.sort(tree.query(projected, predicate="intersects"))
    intersections = shapely.intersection(boxes[candidates], projected)
    weights = shapely.area(intersections) * RADIUS_KM**2
    positive = weights > 1e-8
    cells = candidates[positive].tolist()
    weights = weights[positive]
    assert cells, "Every country/region must intersect at least one NASA cell"
    assert np.all(weights > 0)
    total = float(weights.sum())
    # Conservation detects date-line artifacts, missed tiny islands and cell
    # indexing errors independently of the visualization.
    expected = projected.area * RADIUS_KM**2
    assert abs(total - expected) <= max(1e-5, expected * 1e-8), f"Area conservation failed: {total} vs {expected}"
    return cells, [round(float(v), 8) for v in weights], round(total, 6)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", action="store_true")
    args = parser.parse_args()
    CACHE.mkdir(parents=True, exist_ok=True)
    ASSETS.mkdir(parents=True, exist_ok=True)
    source_file = CACHE / "countries-50m-source.json"
    if not args.cache or not source_file.exists():
        request = Request(SOURCE_URL, headers={"User-Agent": "TermometroDeLaTierra/1.0"})
        with urlopen(request, timeout=120) as response:
            source_file.write_bytes(response.read())
    source = json.loads(source_file.read_text(encoding="utf-8"))
    meta = json.loads((DATA / "grid-meta.json").read_text(encoding="utf-8"))
    assert meta["rows"] == 90 and meta["cols"] == 180 and meta["stepLat"] == 2

    # Index order exactly matches the binary NASA array: south→north, west→east.
    latitudes = np.repeat(np.asarray(meta["latitudes"]), 180)
    longitudes = np.tile(np.asarray(meta["longitudes"]), 90)
    boxes = shapely.box(
        np.deg2rad(longitudes - 1), np.sin(np.deg2rad(latitudes - 1)),
        np.deg2rad(longitudes + 1), np.sin(np.deg2rad(latitudes + 1)),
    )
    tree = shapely.STRtree(boxes)
    areas = []
    features = []
    by_continent = {key: [] for key in CONTINENTS}
    for feature in source["features"]:
        properties = feature["properties"]
        country_id = properties.get("ISO_A3")
        if not country_id or country_id == "-99":
            country_id = properties["ADM0_A3"]
        iso_a3 = properties.get("ISO_A3")
        if not iso_a3 or iso_a3 == "-99":
            iso_a3 = properties.get("ISO_A3_EH")
        iso_a2 = properties.get("ISO_A2")
        if not iso_a2 or iso_a2 == "-99":
            iso_a2 = properties.get("ISO_A2_EH")
        name = properties.get("NAME_ES") or properties.get("NAME_EN") or properties["ADMIN"]
        geom = shape(feature["geometry"])
        if not geom.is_valid:
            geom = shapely.make_valid(geom)
        continent = properties.get("CONTINENT", "")
        if continent in by_continent:
            by_continent[continent].append(geom)
        cells, weights, area = area_cells(geom, boxes, tree)
        center = [float(properties["LABEL_Y"]), float(properties["LABEL_X"])]
        area_item = {
            "id": country_id, "name": name, "type": "country",
            "isoA3": iso_a3 if iso_a3 != "-99" else None,
            "isoA2": iso_a2 if iso_a2 != "-99" else None,
            "nameEn": properties.get("NAME_EN", properties["ADMIN"]),
            "continent": CONTINENTS.get(continent, (None, "Islas oceánicas", None))[1],
            "continentId": CONTINENTS.get(continent, (None, None, None))[0],
            "bbox": [round(float(v), 5) for v in geom.bounds], "center": center,
            "cells": cells, "weights": weights, "areaKm2": area,
            "resolutionNote": RESOLUTION_NOTE,
        }
        areas.append(area_item)
        features.append({
            "type": "Feature", "id": country_id,
            "properties": {"id": country_id, "name": name, "type": "country", "isoA3": area_item["isoA3"]},
            "geometry": display_geometry(geom),
        })

    for continent, (region_id, name, center) in CONTINENTS.items():
        if not by_continent[continent]:
            continue
        geometry = shapely.union_all(by_continent[continent])
        cells, weights, area = area_cells(geometry, boxes, tree)
        areas.append({
            "id": region_id, "name": name, "type": "region",
            "bbox": [round(float(v), 5) for v in geometry.bounds], "center": center,
            "cells": cells, "weights": weights, "areaKm2": area,
            "landOnly": True,
            "resolutionNote": "Continente terrestre según Natural Earth; excluye océanos. " + RESOLUTION_NOTE,
        })
        features.append({
            "type": "Feature", "id": region_id,
            "properties": {"id": region_id, "name": name, "type": "region"},
            "geometry": display_geometry(geometry),
        })

    ids = [item["id"] for item in areas]
    assert len(ids) == len(set(ids)), "Country/region IDs must be unique"
    areas.sort(key=lambda a: (a["type"] == "country", a["name"].casefold()))
    common = {
        "source": SOURCE_PAGE, "sourceFile": SOURCE_URL,
        "sourceSha256": hashlib.sha256(source_file.read_bytes()).hexdigest(),
        "accessedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "license": "Natural Earth public domain",
    }
    json_write(DATA / "areas.json", {
        **common, "gridRows": 90, "gridCols": 180,
        "gridResolutionDegrees": 2, "referencePeriod": [1951, 1980],
        "weightUnits": "km²", "earthRadiusKm": RADIUS_KM,
        "recommendedMinimumCoverage": 0.5,
        "method": "Natural Earth 1:50m country polygons intersected with native NASA 2° cells in spherical equal-area coordinates x=longitude radians, y=sin(latitude), after boundary densification to at most 0.2°. Weights are overlapping spherical area in km². Country masks retain tiny countries, holes and date-line pieces. Display outlines alone are simplified to 0.015°, except tiny polygons of area below 0.1 square degrees, which retain original vertices; masks use original boundaries. Continents unite countries by Natural Earth's CONTINENT field and include land only.",
        "aggregation": "For each month, omit missing cells. anomaly = sum(rawValue × gridScale × weight) / sum(valid weights). coverage = sum(valid weights) / sum(all area weights). Return null if no valid weight; recommended display cutoff is coverage >= 0.5. Never replace missing cells with zero or normalize against full area when observations are missing.",
        "interpretation": RESOLUTION_NOTE,
        "boundariesNote": "Países y territorios según Natural Earth, con límites de facto de su cartografía. No implica reconocimiento de soberanía. Las fronteras actuales se aplican a toda la serie histórica.",
        "areas": areas,
    })
    json_write(ASSETS / "countries-50m.json", {"type": "FeatureCollection", "metadata": common, "features": features})
    print(json.dumps({
        "countries": sum(a["type"] == "country" for a in areas),
        "regions": sum(a["type"] == "region" for a in areas),
        "areaMaskBytes": (DATA / "areas.json").stat().st_size,
        "geometryBytes": (ASSETS / "countries-50m.json").stat().st_size,
        "smallest": sorted(({"name": a["name"], "cells": len(a["cells"]), "km2": a["areaKm2"]} for a in areas if a["type"] == "country"), key=lambda a: a["km2"])[:4],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
