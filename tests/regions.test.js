import test from 'node:test';
import assert from 'node:assert/strict';
import {regionalSeries,pointInGeometry,createSector} from '../src/regions.js';

test('regional averages weight intersected area and report missing coverage',()=>{
  const meta={rows:1,cols:3,frames:[{year:2000,month:1},{year:2000,month:2}],scale:.01,missing:-32768};
  const values=new Int16Array([100,300,-32768,-32768,-32768,-32768]);
  const result=regionalSeries(values,meta,{cells:[0,1,2],weights:[1,3,4]});
  assert.equal(result[0].anomaly,2.5);assert.equal(result[0].coverage,.5);
  assert.equal(result[1].anomaly,null);assert.equal(result[1].coverage,0);
  const scarce=regionalSeries(new Int16Array([100,-32768,-32768]),{...meta,frames:[meta.frames[0]]},{cells:[0,1,2],weights:[1,3,4]})[0];
  assert.equal(scarce.coverage,.125);assert.equal(scarce.anomaly,null);
});
test('country selection respects polygon holes and multipolygons',()=>{
  const geometry={type:'Polygon',coordinates:[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[4,4],[6,4],[6,6],[4,6],[4,4]]]};
  assert.equal(pointInGeometry(2,2,geometry),true);assert.equal(pointInGeometry(5,5,geometry),false);
  assert.equal(pointInGeometry(20,2,geometry),false);
  assert.equal(pointInGeometry(2,2,{type:'MultiPolygon',coordinates:[geometry.coordinates]}),true);
});
const native={rows:90,cols:180,stepLat:2,stepLon:2,latitudes:Array.from({length:90},(_,i)=>-89+2*i),longitudes:Array.from({length:180},(_,i)=>-179+2*i)};
test('2degree and6degree sectors contain actual native cells',()=>{
  assert.equal(createSector(5,-75,2,native).cells.length,1);
  assert.equal(createSector(5,-75,6,native).cells.length,9);
});
test('sectors wrap at antimeridian without selecting the whole globe',()=>{
  const sector=createSector(1,179,6,native);
  assert.equal(sector.cells.length,9);assert.equal(sector.geometry.type,'MultiPolygon');
  assert.ok(sector.weights.every(w=>w>0));
  assert.ok(sector.areaKm2<500000);
});
