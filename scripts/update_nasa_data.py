#!/usr/bin/env python3
"""Download NASA GISTEMP v4 and generate the browser's real monthly datasets.

Install prerequisites: python -m pip install -r scripts/requirements-data.txt
Run from anywhere: python scripts/update_nasa_data.py
The optional --cache argument reuses downloaded source files for offline rebuilds.
"""

from __future__ import annotations

import argparse
import csv
from datetime import datetime, timedelta, timezone
import gzip
import hashlib
import io
import json
from pathlib import Path
import shutil
from urllib.request import Request, urlopen

import numpy as np
from scipy.io import netcdf_file


PROJECT = Path(__file__).resolve().parent.parent
DATA = PROJECT / "public" / "data"
CSV_URL = "https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts%2BdSST.csv"
GRID_URL = "https://data.giss.nasa.gov/pub/gistemp/gistemp1200_GHCNv4_ERSSTv5.nc.gz"
SOURCE = "https://data.giss.nasa.gov/gistemp/"
REFERENCE = "https://doi.org/10.1029/2023JD040179"
MISSING = -32768


def download(url: str, destination: Path, reuse: bool) -> None:
    if reuse and destination.exists():
        return
    print(f"Downloading {url}", flush=True)
    request = Request(url, headers={"User-Agent": "TermometroDeLaTierra/1.0 (educational visualization)"})
    with urlopen(request, timeout=120) as response, destination.open("wb") as output:
        shutil.copyfileobj(response, output)


def save_json(name: str, value: dict) -> None:
    (DATA / name).write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", action="store_true", help="Reuse existing downloaded sources in work/nasa")
    args = parser.parse_args()
    cache = PROJECT / "work" / "nasa"
    cache.mkdir(parents=True, exist_ok=True)
    DATA.mkdir(parents=True, exist_ok=True)
    csv_path = DATA / "GLB.Ts+dSST.csv"
    gzip_path = cache / "gistemp.nc.gz"
    nc_path = cache / "gistemp.nc"
    download(CSV_URL, csv_path, args.cache)
    download(GRID_URL, gzip_path, args.cache)
    with gzip.open(gzip_path, "rb") as compressed, nc_path.open("wb") as expanded:
        shutil.copyfileobj(compressed, expanded)

    rows = csv.reader(io.StringIO(csv_path.read_text(encoding="utf-8-sig")))
    next(rows)  # Descriptive title, not the CSV header.
    header = next(rows)
    assert header[:4] == ["Year", "Jan", "Feb", "Mar"], "Unexpected NASA CSV schema"
    months = []
    for row in rows:
        if not row or not row[0].isdigit():
            continue
        year = int(row[0])
        for month, value in enumerate(row[1:13], 1):
            if value.strip() in {"***", "", "NA"}:
                continue
            months.append({"year": year, "month": month, "anomaly": float(value)})
    assert months and months[0]["year"] == 1880
    base = [row["anomaly"] for row in months if 1880 <= row["year"] <= 1900]
    assert len(base) == 21 * 12, "The 1880–1900 reference must contain all 252 months"
    baseline = sum(base) / len(base)
    generated = datetime.now(timezone.utc).isoformat(timespec="seconds")
    save_json("global-monthly.json", {
        "dataset": "NASA GISTEMP v4 Land-Ocean Temperature Index (L-OTI)",
        "source": SOURCE,
        "sourceFile": CSV_URL,
        "publication": REFERENCE,
        "accessedAt": generated,
        "referencePeriod": [1951, 1980],
        "units": "°C",
        "baselinePeriod": [1880, 1900],
        "baseline1880To1900": baseline,
        "baselineMonthCount": len(base),
        "baselineMethod": "Arithmetic mean of all 252 published monthly global anomalies from January 1880 through December 1900, inclusive.",
        "parisApproximation": "For educational context only: anomaly vs approximate 1880–1900 baseline = original global anomaly − baseline1880To1900. This is not the exact 1850–1900 baseline or a determination that the Paris Agreement's long-term threshold has been crossed.",
        "visibleStartYear": 1926,
        "latest": months[-1],
        "months": months,
    })

    with netcdf_file(nc_path, "r", mmap=False, maskandscale=False) as ds:
        latitudes = ds.variables["lat"].data.copy().astype(float)
        longitudes = ds.variables["lon"].data.copy().astype(float)
        variable = ds.variables["tempanomaly"]
        raw = variable.data.copy()
        input_missing = int(variable._FillValue)
        scale = float(variable.scale_factor)
        times = ds.variables["time"].data.copy()
        epoch = datetime(1800, 1, 1)
        dates = [epoch + timedelta(days=int(t)) for t in times]
        history = ds.history.decode("utf-8")

    assert raw.shape[1:] == (90, 180), "Expected NASA's regular 2° grid"
    assert np.allclose(np.diff(latitudes), 2) and np.allclose(np.diff(longitudes), 2)
    assert np.allclose(latitudes[[0, -1]], [-89, 89])
    assert np.allclose(longitudes[[0, -1]], [-179, 179])
    valid_global = {(r["year"], r["month"]) for r in months}
    selected = [(i, date) for i, date in enumerate(dates) if date.year >= 1926 and (date.year, date.month) in valid_global]
    assert selected, "No gridded months overlap the global series after 1926"
    assert [(d.year, d.month) for _, d in selected] == [
        (r["year"], r["month"]) for r in months if r["year"] >= 1926
    ], "Grid and global series must have exactly the same monthly coverage"
    frames = []
    all_frames = []
    coverage = []
    for index, date in selected:
        frame = raw[index]
        valid = frame != input_missing
        output = np.full((90, 180), MISSING, dtype="<i2")
        # Preserve every original NASA 2° cell, without downsampling or
        # interpolation. Only convert its scale and the missing-value sentinel.
        output[valid] = np.rint(frame[valid].astype(float) * scale / 0.01).astype(np.int16)
        all_frames.append(output)
        frames.append({"year": date.year, "month": date.month})
        coverage.append(round(float(np.count_nonzero(valid) / valid.size), 4))
    result = np.stack(all_frames)
    binary_bytes = result.tobytes(order="C")
    (DATA / "grid-monthly.bin").write_bytes(binary_bytes)
    # Deterministic transport asset. Keep the original binary for browsers that
    # cannot decompress gzip and for independent integrity verification.
    compressed_bytes = gzip.compress(binary_bytes, compresslevel=9, mtime=0)
    (DATA / "grid-monthly.bin.gz").write_bytes(compressed_bytes)
    grid_meta = {
        "dataset": "NASA GISTEMP v4 L-OTI, ERSSTv5, 1200 km smoothing",
        "source": SOURCE,
        "sourceFile": GRID_URL,
        "publication": REFERENCE,
        "accessedAt": generated,
        "netcdfHistory": history,
        "referencePeriod": [1951, 1980],
        "units": "°C",
        "rows": 90,
        "cols": 180,
        "stepLat": 2,
        "stepLon": 2,
        "latitudes": latitudes.tolist(),
        "longitudes": longitudes.tolist(),
        "startYear": frames[0]["year"],
        "startMonth": frames[0]["month"],
        "months": len(frames),
        "scale": 0.01,
        "missing": MISSING,
        "format": "int16-le",
        "layout": "frame-major, latitude-major south-to-north, longitude-minor west-to-east",
        "binaryFile": "grid-monthly.bin",
        "bytes": int(result.nbytes),
        "frames": frames,
        "coverage": coverage,
        "processing": "Native NASA 2° × 2° cells are preserved at their original 0.01 °C precision. No spatial downsampling, interpolation, extrapolation or fabricated observations. NASA's original missing sentinel is remapped to -32768, never zero.",
        "interpretation": "Colors and radial relief represent regional temperature anomalies relative to 1951–1980; relief is an artistic encoding, not geographical elevation. Do not apply the global preindustrial offset to regional cells.",
    }
    save_json("grid-meta.json", grid_meta)
    save_json("provenance.json", {
        "credit": "NASA GISS/GISTEMP",
        "citation": "GISTEMP Team, 2026: GISS Surface Temperature Analysis (GISTEMP), version 4. NASA Goddard Institute for Space Studies.",
        "publication": "Lenssen et al. (2024), A GISTEMPv4 observational uncertainty ensemble, Journal of Geophysical Research: Atmospheres, 129, e2023JD040179. DOI: 10.1029/2023JD040179.",
        "source": SOURCE,
        "downloadPage": "https://data.giss.nasa.gov/gistemp/data_v4.html",
        "accessedAt": generated,
        "sourceChecksums": {
            "GLB.Ts+dSST.csv": hashlib.sha256(csv_path.read_bytes()).hexdigest(),
            "gistemp1200_GHCNv4_ERSSTv5.nc.gz": hashlib.sha256(gzip_path.read_bytes()).hexdigest(),
        },
        "reuse": "NASA data, provided with attribution. No NASA endorsement implied. Application visualizations are original derived works.",
        "mediaGuidance": "https://www.nasa.gov/nasa-brand-center/images-and-media/",
        "snapshot": f"{months[0]['year']}-01 through {months[-1]['year']}-{months[-1]['month']:02d}",
        "spatialSnapshot": f"1926-01 through {frames[-1]['year']}-{frames[-1]['month']:02d}",
    })
    print(json.dumps({
        "globalMonths": len(months), "visibleMonths": len(frames),
        "baseline1880To1900": baseline, "latest": months[-1],
        "gridBytes": result.nbytes, "gridMin": int(result[result != MISSING].min()) / 100,
        "gridGzipBytes": len(compressed_bytes),
        "gridMax": int(result[result != MISSING].max()) / 100,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
