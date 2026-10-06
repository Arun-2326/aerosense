const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const prediction=require('../prediction.js');
globalThis.AeroSensePrediction=prediction;
const intelligence=require('../intelligence.js');

test('why engine explains rising and falling PM2.5 observations',()=>{
 assert.equal(intelligence.explain({history:[10,12,16,20]}).find(x=>x.label==='PM2.5 trend').status,'rising');
 assert.equal(intelligence.explain({history:[20,16,12,10]}).find(x=>x.label==='PM2.5 trend').status,'falling');
});
test('why engine contextualizes weak and stronger wind',()=>{
 assert.match(intelligence.explain({weather:{windKmh:3}})[0].explanation,/weak winds/i);
 assert.match(intelligence.explain({weather:{windKmh:19}})[0].explanation,/higher wind speeds/i);
});
test('why engine reports humid and rainy measurements',()=>{
 const labels=intelligence.explain({weather:{humidityPct:82,precipMm:1}}).map(x=>x.label);
 assert.ok(labels.includes('Humidity'));assert.ok(labels.includes('Rainfall'));
});
test('why engine omits missing measurements and avoids causal claims',()=>{
 const output=intelligence.explain({weather:{windKmh:null,humidityPct:null,precipMm:null}});
 assert.equal(output.length,0);assert.doesNotMatch(output.map(x=>x.explanation).join(' '),/caused|causes/i);
});
for(const [name,values,expected] of [
 ['rising',[10,12,14,20],'rising'],['falling',[20,18,16,10],'falling'],['stable',[10,10.1,9.9,10],'stable'],['mixed',[10,20,10,20],'mixed']
])test('trend classification: '+name,()=>assert.equal(intelligence.classify(values),expected));
const hours=values=>values.map((value,i)=>({timestamp:`2026-10-06T${String(i+10).padStart(2,'0')}:00:00+05:30`,value}));
test('advisor identifies best and worst forecast windows',()=>{
 const result=intelligence.advise({points:hours([28,12,35]),profile:'general',status:'live'});
 assert.equal(result.best.value,12);assert.equal(result.worst.value,35);assert.equal(result.provenance,'PROVIDER FORECAST');
});
test('advisor handles insufficient forecast and profile sensitivity',()=>{
 assert.equal(intelligence.advise({points:hours([10]),status:'live'}).best,null);
 const general=intelligence.advise({points:hours([20,28]),profile:'general',status:'live'});
 const sensitive=intelligence.advise({points:hours([20,28]),profile:'sensitive',status:'live'});
 assert.equal(general.profile,'General public');assert.equal(sensitive.profile,'Sensitive groups');assert.ok(sensitive.best.score<general.best.score);
});
test('advisor labels demo forecast and does not invent flat windows',()=>{
 const flat=intelligence.advise({points:hours([20,20.2]),profile:'walking',status:'demo'});
 assert.equal(flat.provenance,'DEMO FORECAST');assert.equal(flat.best,null);assert.match(flat.message,/nearly flat/);
});
test('provenance labels live, stale, demo and unavailable sources',()=>{
 assert.equal(intelligence.provenance('live'),'LIVE MODEL DATA');
 assert.equal(intelligence.provenance('stale'),'STALE DATA');
 assert.equal(intelligence.provenance('demo'),'DEMO DATA');
 assert.equal(intelligence.provenance('unavailable','ml'),'ML UNAVAILABLE');
 assert.equal(intelligence.provenance('demo','ml'),'DEMO ML ESTIMATE');
 assert.equal(intelligence.provenance('live','provider'),'PROVIDER FORECAST');
});
test('activity advisor fetches PM2.5 context independently of chart pollutant',()=>{
 const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
 assert.match(app,/loadPrediction\(selectedCity,"PM2\.5",options\)/);
 assert.match(app,/else refreshAdvisorPM25\(ticket,selectedCity\)/);
});
