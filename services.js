/* Provider boundary: optional same-origin proxy endpoints, deterministic demo fallback. */
window.AeroSenseServices=(()=>{
 const fixtures=window.AeroSenseData;
 const config=window.AEROSENSE_CONFIG||{};
 async function request(path){if(!config.apiBaseUrl)return null;try{const r=await fetch(config.apiBaseUrl.replace(/\/$/,"")+path,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(4000)});if(!r.ok)throw Error("HTTP "+r.status);return await r.json()}catch(_){return null}}
 const city=name=>fixtures.cities[name];
 return {
 getCities:async()=>({mode:"demo",data:Object.keys(fixtures.cities)}),
  demoCurrent:name=>city(name),
  demoWeather:name=>city(name).weather,
  demoHistory:name=>city(name).history,
  demoPollutionHistory:name=>city(name).series,
  demoPrediction:name=>city(name).future,
  demoRecommendationKeys:aqi=>aqi>200?fixtures.recommendationRules.severe:aqi>150?fixtures.recommendationRules.elevated:aqi>100?fixtures.recommendationRules.moderate:fixtures.recommendationRules.good,
  getCurrent:async name=>(await request("/air-quality/current?city="+encodeURIComponent(name)))||city(name),
  getWeather:async name=>(await request("/weather?city="+encodeURIComponent(name)))||city(name).weather,
  getHistory:async name=>(await request("/environmental-events?city="+encodeURIComponent(name)))||city(name).history,
  getPollutionHistory:async name=>(await request("/air-quality/history?city="+encodeURIComponent(name)))||city(name).series,
  getPrediction:async name=>(await request("/predictions?city="+encodeURIComponent(name)))||city(name).future,
  getRecommendations:async(name,profile)=>({profile,aqi:city(name).aqi,mode:"derived"})
 };
})();
