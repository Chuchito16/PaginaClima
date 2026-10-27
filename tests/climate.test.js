import test from 'node:test';
import assert from 'node:assert/strict';
import {mean,compareWindows,referenceOffset,rollingMean,temperatureColor} from '../src/climate.js';

test('baseline conversion positions Paris thresholds on NASA reference', () => {
  const baseline = -0.24;
  assert.equal(referenceOffset(baseline,'preindustrial'),0.24);
  assert.equal(referenceOffset(baseline,'nasa'),0);
  assert.ok(Math.abs((1.5+baseline)-baseline-1.5)<1e-12);
});
test('short ranges adapt equal endpoint windows without overlap', () => {
  const rows = Array.from({length:25},(_,i)=>({anomaly:i}));
  const c = compareWindows(rows,120);
  assert.equal(c.size,12); assert.equal(c.shortened,true);
  assert.equal(c.first.at(-1).anomaly,11); assert.equal(c.last[0].anomaly,13);
  assert.equal(c.delta,13);
  assert.equal(compareWindows(rows.slice(0,23)),null);
});
test('120-month endpoint means compare decades instead of individual extremes', () => {
  const rows=Array.from({length:240},(_,i)=>({anomaly:i<120?0:1}));
  rows[0].anomaly=-12; rows.at(-1).anomaly=13;
  const c=compareWindows(rows,120);
  assert.ok(Math.abs(c.delta-1.2)<1e-12); assert.equal(c.shortened,false);
});
test('missing measurements do not become zero', () => {
  assert.equal(mean([null,NaN]),null); assert.equal(mean([null,1,3]),2);
  assert.equal(compareWindows(Array.from({length:24},()=>({anomaly:null}))).delta,null);
  assert.equal(rollingMean(Array.from({length:12},()=>({anomaly:1})),11),1);
  assert.equal(rollingMean([{anomaly:1}],0),null);
});
test('diverging temperature palette clamps and distinguishes missing',()=>{
  assert.equal(temperatureColor(-9),'#377da7');
  assert.equal(temperatureColor(10),'#a72f39');
  assert.equal(temperatureColor(null),'#495a54');
});
test('comparison windows require at least half their monthly observations',()=>{
  const rows=Array.from({length:24},(_,i)=>({anomaly:i<5?1:i<12?null:2}));
  const comparison=compareWindows(rows,12);
  assert.equal(comparison.firstValid,5);assert.equal(comparison.firstMean,null);
  assert.equal(comparison.lastMean,2);assert.equal(comparison.delta,null);
});
