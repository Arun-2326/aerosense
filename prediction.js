/* Forecast normalization and transparent trend analysis. This is not an ML model. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AeroSensePrediction = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  const CONFIG = Object.freeze({ horizonHours: 6, stablePercent: 0.05, minimumAbsoluteChange: 0.5 });

  function timestampMs(timestamp, timezoneOffset = "+05:30") {
    if (typeof timestamp !== "string" || !timestamp.trim()) return NaN;
    const zoned = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(timestamp) ? timestamp : timestamp + timezoneOffset;
    return Date.parse(zoned);
  }

  function classifyTrend(values, options = {}) {
    const clean = (Array.isArray(values) ? values : []).filter(Number.isFinite);
    if (clean.length < 2) return { trend: "unavailable", change: null, firstAverage: null, laterAverage: null };
    const split = Math.max(1, Math.floor(clean.length / 2));
    const first = clean.slice(0, split);
    const later = clean.slice(split);
    const mean = samples => samples.reduce((sum, value) => sum + value, 0) / samples.length;
    const firstAverage = mean(first);
    const laterAverage = mean(later);
    const change = laterAverage - firstAverage;
    const noiseFloor = Math.max(options.minimumAbsoluteChange ?? CONFIG.minimumAbsoluteChange, Math.abs(firstAverage) * (options.stablePercent ?? CONFIG.stablePercent));
    if (change > noiseFloor) return { trend: "rising", change, firstAverage, laterAverage, noiseFloor };
    if (change < -noiseFloor) return { trend: "falling", change, firstAverage, laterAverage, noiseFloor };
    const steps = clean.slice(1).map((value, index) => value - clean[index]);
    const hasRise = steps.some(step => step > noiseFloor);
    const hasFall = steps.some(step => step < -noiseFloor);
    return { trend: hasRise && hasFall ? "mixed" : "stable", change, firstAverage, laterAverage, noiseFloor };
  }

  function normalize(input, options = {}) {
    const now = options.now ?? Date.now();
    const offset = options.timezoneOffset || "+05:30";
    const seen = new Map();
    (Array.isArray(input.values) ? input.values : []).forEach((point, index) => {
      const time = point?.timestamp ?? point?.time;
      const ms = timestampMs(time, offset);
      if (!point || !Number.isFinite(ms) || ms <= now || !Number.isFinite(point.value)) return;
      seen.set(ms, { timestamp: time, timestampMs: ms, value: point.value, weather: point.weather || null, inputIndex: index });
    });
    const values = [...seen.values()].sort((a, b) => a.timestampMs - b.timestampMs).slice(0, input.horizonHours || CONFIG.horizonHours);
    const trend = classifyTrend(values.map(point => point.value));
    return {
      location: input.location,
      pollutant: input.pollutant,
      generatedAt: input.generatedAt || new Date(now).toISOString(),
      horizonHours: values.length,
      source: input.source,
      status: input.status,
      values,
      trend: trend.trend,
      trendChange: trend.change,
      trendSummary: trend,
      uncertainty: null,
      error: input.error || null
    };
  }

  function demoForecast(city, pollutant, currentValue, series, options = {}) {
    const now = options.now ?? Date.now();
    const start = Math.floor(now / 3600000) * 3600000 + 3600000;
    const values = (Array.isArray(series) ? series : []).slice(0, CONFIG.horizonHours).map((value, index) => ({
      timestamp: new Date(start + index * 3600000).toISOString(),
      value
    }));
    return normalize({ location: city, pollutant, generatedAt: new Date(now).toISOString(), horizonHours: CONFIG.horizonHours, source: "DEMO FORECAST · Deterministic city fixture", status: "demo", values }, { ...options, now });
  }

  return { CONFIG, timestampMs, classifyTrend, normalize, demoForecast };
});
