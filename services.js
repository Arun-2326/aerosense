/* Provider boundary: Open-Meteo live feeds with explicit deterministic demo fallback. */
window.AeroSenseServices=(()=>{
 const fixtures=window.AeroSenseData;
 const config=window.AEROSENSE_CONFIG||{};
 const cache=new Map();
 const historyCache=new Map();
 const predictionCache=new Map();
 const city=name=>fixtures.cities[name];
 const finite=v=>Number.isFinite(v)?v:null;
 const query=(base,params)=>base+"?"+new URLSearchParams(params).toString();
 const endpoints={
  air:config.openMeteoAirBaseUrl||"https://air-quality-api.open-meteo.com/v1/air-quality",
  weather:config.openMeteoWeatherBaseUrl||"https://api.open-meteo.com/v1/forecast"
 };
 const mlApiBase=config.mlApiBaseUrl||"http://127.0.0.1:8002";
 async function fetchJson(url){
  const response=await fetch(url,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(9000),cache:"no-store"});
  if(!response.ok)throw Error("Provider returned HTTP "+response.status);
  const body=await response.json();
  if(body.error)throw Error(body.reason||"Provider returned an error");
  return body;
 }
 function demo(name,reason){
  const d=city(name);
  return {city:name,coordinates:{latitude:d.latitude,longitude:d.longitude},status:"demo",source:"DEMO DATA",timestamp:null,stale:false,error:reason||null,
   air:{aqi:d.aqi,pm25:d.pm,pm10:d.pm10,no2:d.no2,so2:d.so2,o3:d.o3,source:"DEMO DATA",timestamp:null},
   weather:{...d.weather,source:"DEMO DATA",timestamp:null},hourly:d.series.map((v,i)=>({time:null,pm25:v,pm10:finite(v*1.55),no2:finite(v*.48),so2:finite(v*.15),o3:finite(v*.42),aqi:finite(v*1.55)})),
   mode:"demo"};
 }
 function nearestIndex(times){
  const now=Date.now();
  let best=-1,distance=Infinity;
  times.forEach((time,index)=>{
   if(!time)return;
   const ms=Date.parse(time+"+05:30");
   if(!Number.isFinite(ms))return;
   const delta=ms<=now?now-ms:(ms-now)+3600000;
   if(delta<distance){distance=delta;best=index}
  });
  return best;
 }
 function mapHourly(hourly){
  const times=hourly.time||[];
  return times.map((time,i)=>({time,pm25:finite(hourly.pm2_5?.[i]),pm10:finite(hourly.pm10?.[i]),no2:finite(hourly.nitrogen_dioxide?.[i]),so2:finite(hourly.sulphur_dioxide?.[i]),o3:finite(hourly.ozone?.[i]),aqi:finite(hourly.us_aqi?.[i])}));
 }
 function weatherSummary(code){
  if(code===0)return "Clear";
  if([1,2,3].includes(code))return "Partly cloudy";
  if([45,48].includes(code))return "Foggy";
  if(code>=51&&code<=67)return "Drizzle / rain";
  if(code>=71&&code<=77)return "Snow";
  if(code>=80&&code<=82)return "Rain showers";
  if(code>=95)return "Thunderstorm";
  return "Current conditions";
 }
 async function getLive(name){
  const d=city(name),params={latitude:d.latitude,longitude:d.longitude,timezone:"Asia/Kolkata",past_hours:24,forecast_hours:24,hourly:"pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi"};
  const results=await Promise.allSettled([
   fetchJson(query(endpoints.air,params)),
   fetchJson(query(endpoints.weather,{latitude:d.latitude,longitude:d.longitude,timezone:"Asia/Kolkata",forecast_hours:24,current:"temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure",hourly:"temperature_2m,relative_humidity_2m,wind_speed_10m,surface_pressure"}))
  ]);
  const airResult=results[0].status==="fulfilled"?results[0].value:null;
  const weatherResult=results[1].status==="fulfilled"?results[1].value:null;
  if(!airResult?.hourly?.time?.length)throw Error(results[0].reason?.message||"Air-quality data is unavailable");
  const hourly=mapHourly(airResult.hourly).filter(p=>p.aqi!==null||p.pm25!==null||p.pm10!==null||p.no2!==null||p.so2!==null||p.o3!==null);
  const index=nearestIndex(airResult.hourly.time);
  const at=(key)=>finite(airResult.hourly[key]?.[index]);
  const currentTime=airResult.hourly.time[index]||null;
  const air={aqi:at("us_aqi"),pm25:at("pm2_5"),pm10:at("pm10"),no2:at("nitrogen_dioxide"),so2:at("sulphur_dioxide"),o3:at("ozone"),source:"Open-Meteo · CAMS forecast",timestamp:currentTime};
  if(air.aqi===null&&!Object.values(air).some(v=>typeof v==="number"))throw Error("Air-quality response has no usable current readings");
  let weather={...d.weather,source:"DEMO DATA",timestamp:null};
  if(weatherResult?.current){const c=weatherResult.current;weather={tempC:finite(c.temperature_2m),windKmh:finite(c.wind_speed_10m),humidityPct:finite(c.relative_humidity_2m),precipMm:finite(c.precipitation),windDirection:finite(c.wind_direction_10m),summary:weatherSummary(c.weather_code),source:"Open-Meteo weather forecast",timestamp:c.time||null};}
  const weatherHourly=(weatherResult?.hourly?.time||[]).map((time,i)=>({time,temperatureC:finite(weatherResult.hourly.temperature_2m?.[i]),humidityPct:finite(weatherResult.hourly.relative_humidity_2m?.[i]),windKmh:finite(weatherResult.hourly.wind_speed_10m?.[i]),pressureHpa:finite(weatherResult.hourly.surface_pressure?.[i])}));
  const missingAirFields=Object.values(air).filter(v=>typeof v==="number").length<6;
  const state=weatherResult&&!missingAirFields?"live":"partial";
  const payload={city:name,coordinates:{latitude:airResult.latitude||d.latitude,longitude:airResult.longitude||d.longitude},status:state,source:state==="live"?"Open-Meteo":"Open-Meteo air quality · weather fallback",timestamp:currentTime,stale:false,error:weatherResult?null:(results[1].reason?.message||"Weather feed unavailable"),air,weather,hourly,weatherHourly,mode:"live",timezone:airResult.timezone||"Asia/Kolkata"};
  cache.set(name,payload);
  return payload;
 }
 async function load(name,options={}){
  if(!city(name))throw Error("Unsupported city: "+name);
  if(options.mode==="demo")return demo(name);
  try{return await getLive(name)}catch(error){
   const prior=cache.get(name);
   if(prior){const stale={...prior,status:"stale",stale:true,error:error.message,source:"STALE LIVE DATA · Open-Meteo"};cache.set(name,stale);return stale}
   return demo(name,error.message||"Live data unavailable");
  }
 }
 const predictionFields={"PM2.5":"pm25",PM10:"pm10",NO2:"no2",SO2:"so2",O3:"o3"};
 function unavailablePrediction(name,pollutant,error){return {location:name,pollutant,generatedAt:new Date().toISOString(),horizonHours:0,source:"Open-Meteo atmospheric model",status:"unavailable",values:[],trend:"unavailable",trendChange:null,trendSummary:null,uncertainty:null,error:error||"Forecast unavailable for this pollutant."};}
 function demoForecastProvider(name,pollutant,options={}){
  const key=predictionFields[pollutant],d=city(name),fixture=key&&d.predictions?.[key];
  if(!Array.isArray(fixture)||!fixture.length)return unavailablePrediction(name,pollutant,"Forecast unavailable for this pollutant.");
  const current=options.currentValue??({pm25:d.pm,pm10:d.pm10,no2:d.no2,so2:d.so2,o3:d.o3}[key]);
  return window.AeroSensePrediction.demoForecast(name,pollutant,current,fixture,{now:options.now,timezoneOffset:"+05:30"});
 }
 function openMeteoForecastProvider(name,pollutant,options={}){
  const key=predictionFields[pollutant],payload=options.payload||cache.get(name);
  if(!key||!payload?.hourly)return unavailablePrediction(name,pollutant,"Forecast unavailable for this pollutant.");
  const now=options.now??Date.now(),weatherByTime=new Map((payload.weatherHourly||[]).map(row=>[row.time,row]));
  const values=payload.hourly.map(point=>({
   timestamp:point.time,value:point[key],weather:weatherByTime.get(point.time)||null
  })).filter(point=>point.timestamp&&Number.isFinite(point.value)&&window.AeroSensePrediction.timestampMs(point.timestamp,"+05:30")>now).slice(0,6);
  if(!values.length)return unavailablePrediction(name,pollutant,"Forecast unavailable for this pollutant.");
  const status=options.dataStatus==="stale"||payload.status==="stale"?"stale":"live";
  return window.AeroSensePrediction.normalize({location:name,pollutant,generatedAt:new Date(now).toISOString(),horizonHours:6,source:"Open-Meteo atmospheric model",status,values},{now,timezoneOffset:"+05:30"});
 }
 const predictionProviders={demo:{load:demoForecastProvider},openMeteo:{load:openMeteoForecastProvider},aerosenseML:null};
 async function loadPrediction(name,pollutant="PM2.5",options={}){
  if(!city(name))throw Error("Unsupported city: "+name);
  if(!predictionFields[pollutant])return unavailablePrediction(name,pollutant,"Forecast unavailable for this pollutant.");
  const dataStatus=options.dataStatus||cache.get(name)?.status||"demo",key=name+"|"+pollutant,now=options.now??Date.now();
  if(options.mode==="demo"||dataStatus==="demo")return predictionProviders.demo.load(name,pollutant,{...options,now});
  const providerPayload=options.payload||cache.get(name);
  const result=predictionProviders.openMeteo.load(name,pollutant,{...options,payload:providerPayload,dataStatus,now});
  if(result.status==="live"||result.status==="stale"){
   predictionCache.set(key,result);
   return result;
  }
  const saved=predictionCache.get(key);
  if(saved){
   const stale=window.AeroSensePrediction.normalize({...saved,status:"stale",source:"STALE FORECAST · Last valid Open-Meteo model output",values:saved.values},{now,timezoneOffset:"+05:30"});
   if(stale.values.length){predictionCache.set(key,stale);return stale}
  }
  if(dataStatus==="stale"||result.status==="unavailable")return predictionProviders.demo.load(name,pollutant,{...options,now});
  return result;
 }
 async function loadAeroSenseML(name,payload){
  if(!city(name))throw Error("Unsupported city: "+name);
  if(!payload||!["live","partial"].includes(payload.status))throw Error("ML inference requires current provider observations");
  const now=Date.now();
  const history=(payload.hourly||[]).filter(point=>point.time&&Number.isFinite(point.pm25)&&window.AeroSensePrediction.timestampMs(point.time,"+05:30")<=now)
   .slice(-7).map(point=>({time:point.time+"+05:30",pm25:point.pm25}));
  if(history.length<7)throw Error("Not enough recent hourly PM2.5 observations for the trained model");
  const response=await fetch(mlApiBase+"/api/prediction",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},signal:AbortSignal.timeout(15000),body:JSON.stringify({city:name,latitude:payload.coordinates.latitude,longitude:payload.coordinates.longitude,history,input_source:"Open-Meteo historical air-quality model series"})});
  if(!response.ok){let reason="ML service returned HTTP "+response.status;try{reason=(await response.json()).detail||reason}catch{}throw Error(reason)}
  return response.json();
 }
 function liveOptions(payload){
  const points=payload.hourly;
  const currentIndex=nearestIndex(points.map(p=>p.time));
  const current=points[Math.max(0,currentIndex)]||{};
  const prior=points.slice(0,Math.max(0,currentIndex)).reverse().find(p=>p.aqi!==null);
  const pm=payload.air.pm25;
  const pmSeries=points.map(p=>p.pm25).filter(v=>v!==null);
  const delta=prior?.aqi&&current.aqi!==null?Math.round((current.aqi-prior.aqi)/prior.aqi*100):0;
  return {aqi:payload.air.aqi,pm,pm10:payload.air.pm10,no2:payload.air.no2,so2:payload.air.so2,o3:payload.air.o3,delta,series:pmSeries.length?pmSeries:[pm||0],hourly:points,
   wind:payload.weather.windKmh===null?"Unavailable":payload.weather.windKmh<7?"Low":payload.weather.windKmh<18?"Moderate":"High",
   humidity:payload.weather.humidityPct===null?"Unavailable":payload.weather.humidityPct<35?"Low":payload.weather.humidityPct>70?"High":"Moderate",
   temperature:payload.weather.tempC===null?"Unavailable":payload.weather.tempC>32?"High":"Moderate",
   rain:payload.weather.precipMm===null?"Unavailable":payload.weather.precipMm===0?"None":payload.weather.precipMm<2?"Low":"Moderate",
   rise:Math.abs(delta),weather:payload.weather};
 }
 const historyKeys={pm25:"pm25",pm10:"pm10",no2:"no2",so2:"so2",o3:"o3"};
 const historyTtl={"24h":10*60*1000,"7d":60*60*1000,"30d":3*60*60*1000};
 const localDate=ms=>new Date(ms+330*60000).toISOString().slice(0,10);
 const epochForLocal=time=>Date.parse(time+"+05:30");
 function historyPoints(hourly,period){
  const now=Date.now(),span=period==="24h"?86400000:(period==="7d"?7:30)*86400000,start=now-span;
  const filtered=hourly.filter(p=>p.time&&epochForLocal(p.time)>=start&&epochForLocal(p.time)<=now);
  if(period==="24h")return filtered;
  const byDay=new Map;
  filtered.forEach(point=>{const day=point.time.slice(0,10);if(!byDay.has(day))byDay.set(day,[]);byDay.get(day).push(point)});
  return [...byDay].map(([day,rows])=>{
   const summary={time:day,sampleCount:rows.length};
   Object.keys(historyKeys).forEach(key=>{
    const values=rows.map(row=>row[key]).filter(Number.isFinite);
    summary[key]=values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
    summary[key+"_max"]=values.length?Math.max(...values):null;
    summary[key+"_samples"]=values.length;
   });
   return summary;
  });
 }
 function buildHistory(name,period,hourly,status,options={}){
  const points=historyPoints(hourly,period),values=points.flatMap(point=>Object.keys(historyKeys).map(key=>point[key])).filter(Number.isFinite);
  if(!values.length)throw Error("Provider returned no pollutant values for this period");
  const first=points.find(point=>Object.keys(historyKeys).some(key=>Number.isFinite(point[key])));
  const last=points.slice().reverse().find(point=>Object.keys(historyKeys).some(key=>Number.isFinite(point[key])));
  return {city:name,range:period,status,source:status==="stale"?"STALE MODEL DATA · Open-Meteo CAMS": "Open-Meteo · CAMS archived model output",
   aggregation:period==="24h"?"Hourly values":"Daily average",points,periodStart:first?.time||null,periodEnd:last?.time||null,
   fetchedAt:options.fetchedAt||Date.now(),timeKey:localDate(Date.now()),stale:status==="stale"};
 }
 function demoHistoryPayload(name,period){
  const d=city(name),seed=Object.keys(fixtures.cities).indexOf(name)+1,now=Date.now(),count=period==="24h"?24:period==="7d"?7:30;
  const points=[];
  for(let index=count-1;index>=0;index--){
   const hourIndex=count-index-1,day=localDate(now-index*86400000),row={time:period==="24h"?new Date(now-index*3600000).toISOString().slice(0,13)+":00":day};
   Object.keys(historyKeys).forEach(key=>{
    const base=key==="pm25"?d.pm:key==="pm10"?d.pm10:d[key];
    const wave=((hourIndex*17+seed*11)%19),cycle=(hourIndex%7);
    const factor=period==="24h"?.78+(wave%13)*.025+(hourIndex%6)*.012:.82+wave*.012+cycle*.009;
    row[key]=Number.isFinite(base)?Math.max(0,Math.round(base*factor*10)/10):null;
   });
   points.push(row);
  }
  return {city:name,range:period,status:"demo",source:"DEMO DATA · Deterministic historical demonstration dataset",
   aggregation:period==="24h"?"Hourly demonstration values":"Daily average demonstration values",points,
   periodStart:points[0]?.time||null,periodEnd:points[points.length-1]?.time||null,fetchedAt:now,timeKey:localDate(now),stale:false};
 }
 async function loadHistory(name,period="24h",options={}){
  if(!city(name))throw Error("Unsupported city: "+name);
  if(!["24h","7d","30d"].includes(period))throw Error("Unsupported historical range: "+period);
  if(options.mode==="demo")return demoHistoryPayload(name,period);
  const key=endpoints.air+"|"+name+"|"+period,now=Date.now(),day=localDate(now),saved=historyCache.get(key);
  if(!options.force&&saved&&saved.timeKey===day&&now-saved.fetchedAt<historyTtl[period])return saved;
  try{
   let source;
   if(period==="24h"){
    const current=cache.get(name);
    if(current?.hourly?.length)source=current;
   }
   if(!source){
    const d=city(name),params={latitude:d.latitude,longitude:d.longitude,timezone:"Asia/Kolkata",hourly:"pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi"};
    if(period==="24h")params.past_hours=24;else params.past_days=period==="7d"?7:30;
    const body=await fetchJson(query(endpoints.air,params));
    if(!body.hourly?.time?.length)throw Error("Historical air-quality data is unavailable");
    source={hourly:mapHourly(body.hourly)};
   }
   const result=buildHistory(name,period,source.hourly,source.status==="stale"?"stale":"live",{fetchedAt:now});
   historyCache.set(key,result);
   return result;
  }catch(error){
   if(saved){const stale={...saved,status:"stale",source:"STALE MODEL DATA · Open-Meteo CAMS",stale:true};historyCache.set(key,stale);return stale}
   const fallback=demoHistoryPayload(name,period);
   fallback.error=error.message||"Historical data unavailable";
   return fallback;
  }
 }
 function mapSnapshot(name,options={}){const d=city(name),p=options.demo?null:cache.get(name);if(!p)return {city:name,latitude:d.latitude,longitude:d.longitude,aqi:d.aqi,status:"demo",source:"DEMO DATA"};return {city:name,latitude:d.latitude,longitude:d.longitude,aqi:p.air.aqi,status:p.status==="stale"?"stale":p.status==="demo"?"demo":p.status==="partial"?"live":"live",source:p.source};}
 return {getCities:async()=>({mode:"demo",data:Object.keys(fixtures.cities)}),demoCurrent:name=>city(name),demoWeather:name=>city(name).weather,environmentalRecords:name=>(fixtures.environmentalRecords||[]).filter(record=>record.region===name),demoPollutionHistory:name=>city(name).series,
  demoRecommendationKeys:aqi=>aqi>200?fixtures.recommendationRules.severe:aqi>150?fixtures.recommendationRules.elevated:aqi>100?fixtures.recommendationRules.moderate:fixtures.recommendationRules.good,
  load,getLiveOptions:liveOptions,loadHistory,loadPrediction,loadAeroSenseML,predictionProviders,getMapSnapshot:mapSnapshot,clearCache:()=>{cache.clear();historyCache.clear();predictionCache.clear()},getCached:name=>cache.get(name)};
})();
