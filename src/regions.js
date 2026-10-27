const R = 6371.0088;
const RAD = Math.PI / 180;
export const MIN_REGIONAL_COVERAGE = 0.5;

/** Regional indices are derived from native NASA cells, never the global mean. */
export function regionalSeries(values, meta, area) {
  const total = area.weights.reduce((sum,w)=>sum+w,0);
  const stride=meta.rows*meta.cols;
  return meta.frames.map((frame,f)=>{
    let numerator=0,available=0;
    const start=f*stride;
    for(let i=0;i<area.cells.length;i++) {
      const raw=values[start+area.cells[i]],weight=area.weights[i];
      if(raw===meta.missing||!Number.isFinite(raw))continue;
      numerator+=raw*meta.scale*weight;available+=weight;
    }
    const coverage=total>0?available/total:0;
    return {...frame,anomaly:available>0&&coverage>=MIN_REGIONAL_COVERAGE?numerator/available:null,coverage};
  });
}

function insideRing(lon,lat,ring) {
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const [xi,yi]=ring[i],[xj,yj]=ring[j];
    if(((yi>lat)!==(yj>lat))&&(lon<(xj-xi)*(lat-yi)/(yj-yi)+xi)) inside=!inside;
  }
  return inside;
}
export function pointInGeometry(longitude,latitude,geometry) {
  if(!geometry)return false;
  const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.type==='MultiPolygon'?geometry.coordinates:[];
  return polygons.some(p=>insideRing(longitude,latitude,p[0])&&!p.slice(1).some(h=>insideRing(longitude,latitude,h)));
}

export function findCountry(features,longitude,latitude) {
  return features.find(f=>pointInGeometry(longitude,latitude,f.geometry))||null;
}

/** A snapped geographic sector. Spherical rectangle areas include land and ocean. */
export function createSector(latitude,longitude,degrees,meta) {
  const row=Math.max(0,Math.min(meta.rows-1,Math.round((latitude-meta.latitudes[0])/meta.stepLat)));
  const col=((Math.round((longitude-meta.longitudes[0])/meta.stepLon)%meta.cols)+meta.cols)%meta.cols;
  const lat=meta.latitudes[row],lon=meta.longitudes[col];
  const south=Math.max(-90,lat-degrees/2),north=Math.min(90,lat+degrees/2);
  let west=lon-degrees/2,east=lon+degrees/2;
  const intervals=west< -180?[[west+360,180],[-180,east]]:east>180?[[west,180],[-180,east-360]]:[[west,east]];
  const cells=[],weights=[];
  for(let r=0;r<meta.rows;r++) {
    const s=Math.max(south,meta.latitudes[r]-meta.stepLat/2),n=Math.min(north,meta.latitudes[r]+meta.stepLat/2);
    if(n<=s)continue;
    for(let c=0;c<meta.cols;c++) {
      const w=meta.longitudes[c]-meta.stepLon/2,e=meta.longitudes[c]+meta.stepLon/2;
      const overlap=intervals.reduce((sum,[a,b])=>sum+Math.max(0,Math.min(b,e)-Math.max(a,w)),0);
      if(overlap>0){cells.push(r*meta.cols+c);weights.push(R*R*overlap*RAD*(Math.sin(n*RAD)-Math.sin(s*RAD)));}
    }
  }
  const rings=intervals.map(([w,e])=>[[w,south],[e,south],[e,north],[w,north],[w,south]]);
  return {
    id:`sector-${row}-${col}-${degrees}`,type:'sector',
    name:`Sector ${Math.abs(lat)}° ${lat>=0?'N':'S'}, ${Math.abs(lon)}° ${lon>=0?'E':'O'}`,
    cells,weights,center:[lat,lon],bbox:[intervals[0][0],south,intervals.at(-1)[1],north],
    areaKm2:weights.reduce((sum,w)=>sum+w,0),degrees,
    geometry:rings.length===1?{type:'Polygon',coordinates:[rings[0]]}:{type:'MultiPolygon',coordinates:rings.map(r=>[r])},
  };
}

export function yearDetails(series,row) {
  const months=Array.from({length:12},(_,i)=>series.find(r=>r.year===row.year&&r.month===i+1)||{year:row.year,month:i+1,anomaly:null,coverage:0});
  const previous=series.find(r=>r.year===row.year-1&&r.month===row.month);
  const currentYear=months.filter(r=>r.month<=row.month&&Number.isFinite(r.anomaly));
  return {months,previous,yearMean:currentYear.length?currentYear.reduce((sum,r)=>sum+r.anomaly,0)/currentYear.length:null,yearCount:currentYear.length};
}
