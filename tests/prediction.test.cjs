const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const prediction=require('../prediction.js');
const base=Date.parse('2026-10-05T00:00:00Z');
const points=values=>values.map((value,i)=>({timestamp:new Date(base+(i+1)*3600000).toISOString(),value}));
const omTimes=count=>Array.from({length:count},(_,i)=>new Date(base+(i+1)*3600000+330*60000).toISOString().slice(0,16));
function normalized(values,now=base){return prediction.normalize({location:'Chennai',pollutant:'PM2.5',source:'Test provider',status:'live',values},{now})}

test('normalizes only valid future observations and caps output at six hours',()=>{
 const result=normalized(points([10,11,12,13,14,15,16]));
 assert.equal(result.horizonHours,6);assert.equal(result.values[0].timestampMs,base+3600000);assert.equal(result.values.at(-1).timestampMs,base+6*3600000);
 const filtered=normalized([{timestamp:new Date(base).toISOString(),value:5},{timestamp:new Date(base+3600000).toISOString(),value:NaN},...points([21,22])]);
 assert.equal(filtered.horizonHours,2);assert(filtered.values.every(p=>p.timestampMs>base));
});
test('retains an incomplete future horizon without filling missing hours',()=>{const r=normalized(points([10,12,14,16]));assert.equal(r.horizonHours,4);assert.equal(r.values.length,4)});
test('classifies rising, falling, stable, and mixed forecast series',()=>{
 assert.equal(prediction.classifyTrend([10,12,14,18,20,22]).trend,'rising');
 assert.equal(prediction.classifyTrend([22,20,18,14,12,10]).trend,'falling');
 assert.equal(prediction.classifyTrend([10,10.1,9.9,10,10.1,9.9]).trend,'stable');
 assert.equal(prediction.classifyTrend([10,14,9,13,8,12]).trend,'mixed');
});

function serviceContext(){
 const ctx={URLSearchParams,AbortSignal,Date,Promise,Number,Math,Map,Error,fetch:async()=>{throw Error('offline')}};ctx.window=ctx;vm.createContext(ctx);
 for(const file of ['data.js','prediction.js','services.js'])vm.runInContext(fs.readFileSync(file,'utf8'),ctx,{filename:file});
 return ctx;
}
test('per-city Demo Forecast fixtures are deterministic, separate by pollutant, and carry no confidence',async()=>{
 const ctx=serviceContext(),svc=ctx.AeroSenseServices,now=base;
 for(const city of ['Chennai','Bengaluru','Hyderabad','Delhi','Mumbai']){
  const first=await svc.loadPrediction(city,'PM2.5',{mode:'demo',now}),again=await svc.loadPrediction(city,'PM2.5',{mode:'demo',now}),pm10=await svc.loadPrediction(city,'PM10',{mode:'demo',now});
  assert.equal(first.status,'demo');assert.equal(first.source,'DEMO FORECAST · Deterministic city fixture');assert.deepEqual(first.values.map(v=>v.value),again.values.map(v=>v.value));assert.notDeepEqual(first.values.map(v=>v.value),pm10.values.map(v=>v.value));assert.equal(first.uncertainty,null);assert.equal('confidence' in first,false);assert.equal(first.horizonHours,6);
 }
 const unavailable=await svc.loadPrediction('Delhi','O3',{mode:'demo',now});assert.equal(unavailable.status,'unavailable');
});
test('provider forecast keeps pollutant, future timestamps, and matching weather context',async()=>{
 const ctx=serviceContext(),svc=ctx.AeroSenseServices,now=base,t=omTimes(6);
 const payload={status:'live',hourly:t.map((time,i)=>({time,pm25:20+i,pm10:40+i*2,no2:4+i})),weatherHourly:t.map((time,i)=>({time,temperatureC:25+i,humidityPct:50+i,windKmh:8+i,pressureHpa:1000+i}))};
 const pm25=await svc.loadPrediction('Chennai','PM2.5',{dataStatus:'live',payload,now}),pm10=await svc.loadPrediction('Chennai','PM10',{dataStatus:'live',payload,now});
 assert.equal(pm25.status,'live');assert.equal(pm25.source,'Open-Meteo atmospheric model');assert.equal(pm25.horizonHours,6);assert(pm25.values.every(v=>v.timestampMs>now));assert.deepEqual(Array.from(pm25.values,v=>v.value),[20,21,22,23,24,25]);assert.deepEqual(Array.from(pm10.values,v=>v.value),[40,42,44,46,48,50]);assert.equal(pm25.values[0].weather.temperatureC,25);assert.equal(pm25.uncertainty,null);
});
test('stale provider output is explicitly stale and expires when no future samples remain',async()=>{
 const ctx=serviceContext(),svc=ctx.AeroSenseServices,now=base,t=omTimes(4),payload={status:'live',hourly:t.map((time,i)=>({time,pm25:30+i}))};
 const fresh=await svc.loadPrediction('Mumbai','PM2.5',{dataStatus:'live',payload,now});assert.equal(fresh.status,'live');
 const stale=await svc.loadPrediction('Mumbai','PM2.5',{dataStatus:'stale',payload:{status:'stale',hourly:[]},now});assert.equal(stale.status,'stale');assert.equal(stale.horizonHours,4);assert(stale.source.includes('STALE FORECAST'));
 const expired=await svc.loadPrediction('Mumbai','PM2.5',{dataStatus:'stale',payload:{status:'stale',hourly:[]},now:base+10*3600000});assert.equal(expired.status,'demo');
});
test('provider outage falls back to labelled Demo Forecast when no cache exists',async()=>{
 const svc=serviceContext().AeroSenseServices;const payload=await svc.load('Hyderabad');assert.equal(payload.status,'demo');const f=await svc.loadPrediction('Hyderabad','PM2.5',{dataStatus:payload.status,payload,now:base});assert.equal(f.status,'demo');assert.equal(f.source,'DEMO FORECAST · Deterministic city fixture');
});
test('ML inference requires live observations, shapes seven past hourly values, and preserves API failures for UI fallback',async()=>{
 const ctx=serviceContext(),svc=ctx.AeroSenseServices;let request;
 const points=omTimes(10).map((time,i)=>({time,pm25:20+i}));
 const payload={status:'live',coordinates:{latitude:13.08,longitude:80.27},hourly:points};
 ctx.fetch=async(url,options)=>{request={url,options,body:JSON.parse(options.body)};return{ok:true,json:async()=>({value:31.2,model_name:'Random Forest'})}};
 const result=await svc.loadAeroSenseML('Chennai',payload);assert.equal(result.value,31.2);assert.match(request.url,/127\.0\.0\.1:8002\/api\/prediction/);assert.equal(request.body.history.length,7);assert.equal(request.body.history.at(-1).pm25,29);assert.match(request.body.history[0].time,/\+05:30$/);
 const short={...payload,hourly:points.slice(-6)};let called=false;ctx.fetch=async()=>{called=true;throw Error('should not be called')};await assert.rejects(()=>svc.loadAeroSenseML('Chennai',short),/Not enough recent hourly PM2.5 observations/i);assert.equal(called,false);
 await assert.rejects(()=>svc.loadAeroSenseML('Chennai',{...payload,status:'demo'}),/requires current provider observations/);
 ctx.fetch=async()=>{throw Error('offline')};await assert.rejects(()=>svc.loadAeroSenseML('Chennai',payload),/offline/);
 const provider=await svc.loadPrediction('Chennai','PM2.5',{dataStatus:'live',payload,now:base});assert.equal(provider.status,'live');assert.equal(provider.source,'Open-Meteo atmospheric model');
 const app=fs.readFileSync('app.js','utf8'),services=fs.readFileSync('services.js','utf8');assert.match(app,/provider forecast remains displayed/);assert.match(app,/AEROSENSE ML UNAVAILABLE/);assert.match(app,/Random Forest v.*1-hour ahead/);assert.match(app,/AeroSense ML request failed/);assert.match(services,/AbortSignal\.timeout\(15000\)/);
});
test('dashboard forecast wiring updates on city and pollutant changes and labels transition',()=>{
 const app=fs.readFileSync('app.js','utf8'),html=fs.readFileSync('index.html','utf8');
 assert.match(app,/loadPrediction\(selectedCity,pollutant/);assert.match(app,/pollutantSelect.*forecast\(d\)/);assert.match(app,/selectedCity!==city/);assert.match(app,/Forecast begins here/);assert.doesNotMatch(app,/demoPrediction\(city\)|Predicted peak/);assert.match(html,/forecastSource/);assert.match(html,/forecastStatus/);assert.match(html,/forecastTransitionLabel/);assert.doesNotMatch(html,/confidence/i);
});
