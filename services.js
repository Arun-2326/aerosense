/* Provider boundary: Open-Meteo live feeds with explicit deterministic demo fallback. */
window.AeroSenseServices=(()=>{
 const fixtures=window.AeroSenseData;
 const config=window.AEROSENSE_CONFIG||{};
 const cache=new Map();
 const city=name=>fixtures.cities[name];
 const finite=v=>Number.isFinite(v)?v:null;
 const query=(base,params)=>base+"?"+new URLSearchParams(params).toString();
 const endpoints={
  air:config.openMeteoAirBaseUrl||"https://air-quality-api.open-meteo.com/v1/air-quality",
  weather:config.openMeteoWeatherBaseUrl||"https://api.open-meteo.com/v1/forecast"
 };
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
   fetchJson(query(endpoints.weather,{latitude:d.latitude,longitude:d.longitude,timezone:"Asia/Kolkata",current:"temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m"}))
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
  const missingAirFields=Object.values(air).filter(v=>typeof v==="number").length<6;
  const state=weatherResult&&!missingAirFields?"live":"partial";
  const payload={city:name,coordinates:{latitude:airResult.latitude||d.latitude,longitude:airResult.longitude||d.longitude},status:state,source:state==="live"?"Open-Meteo":"Open-Meteo air quality · weather fallback",timestamp:currentTime,stale:false,error:weatherResult?null:(results[1].reason?.message||"Weather feed unavailable"),air,weather,hourly,mode:"live",timezone:airResult.timezone||"Asia/Kolkata"};
  cache.set(name,payload);
  return payload;
 }
 async function load(name,options={}){
  if(!city(name))throw Error("Unsupported city: "+name);
  if(options.mode==="demo")return demo(name);
  try{return await getLive(name)}catch(error){
   const prior=cache.get(name);
   if(prior)return {...prior,status:"stale",stale:true,error:error.message,source:"STALE LIVE DATA · Open-Meteo"};
   return demo(name,error.message||"Live data unavailable");
  }
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
   future:points.filter(p=>p.time&&Date.parse(p.time+"+05:30")>Date.now()).slice(0,6).map(p=>p.aqi).filter(v=>v!==null),
   wind:payload.weather.windKmh===null?"Unavailable":payload.weather.windKmh<7?"Low":payload.weather.windKmh<18?"Moderate":"High",
   humidity:payload.weather.humidityPct===null?"Unavailable":payload.weather.humidityPct<35?"Low":payload.weather.humidityPct>70?"High":"Moderate",
   temperature:payload.weather.tempC===null?"Unavailable":payload.weather.tempC>32?"High":"Moderate",
   rain:payload.weather.precipMm===null?"Unavailable":payload.weather.precipMm===0?"None":payload.weather.precipMm<2?"Low":"Moderate",
   rise:Math.abs(delta),weather:payload.weather};
 }
 return {getCities:async()=>({mode:"demo",data:Object.keys(fixtures.cities)}),demoCurrent:name=>city(name),demoWeather:name=>city(name).weather,demoHistory:name=>city(name).history,demoPollutionHistory:name=>city(name).series,demoPrediction:name=>city(name).future,
  demoRecommendationKeys:aqi=>aqi>200?fixtures.recommendationRules.severe:aqi>150?fixtures.recommendationRules.elevated:aqi>100?fixtures.recommendationRules.moderate:fixtures.recommendationRules.good,
  load,getLiveOptions:liveOptions,clearCache:()=>cache.clear(),getCached:name=>cache.get(name)};
})();
