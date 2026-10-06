/* Transparent rolling statistical anomaly detection; no ML or causal inference. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AeroSenseAnomaly = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  const CONFIG = Object.freeze({
    elevatedScore: 2.5,
    anomalyScore: 3.5,
    minBaseline: 6,
    windows: Object.freeze({ "24h": 12, "7d": 6, "30d": 14 })
  });

  function median(values) {
    const sorted = values.slice().sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function orderedUnique(points, valueKey) {
    const byTime = new Map();
    points.forEach((point, pointIndex) => {
      if (!point || typeof point.time !== "string" || !point.time.trim()) return;
      const timeMs = Date.parse(point.time);
      const value = point[valueKey];
      if (!Number.isFinite(timeMs) || !Number.isFinite(value)) return;
      // Keep the last valid value for a duplicate timestamp; never fill missing values.
      byTime.set(timeMs, { time: point.time, timeMs, value, pointIndex });
    });
    return [...byTime.values()].sort((a, b) => a.timeMs - b.timeMs);
  }

  function assess(current, baseline, options = {}) {
    const minBaseline = options.minBaseline || CONFIG.minBaseline;
    if (!Number.isFinite(current) || baseline.length < minBaseline) {
      return { status: "insufficient", current: Number.isFinite(current) ? current : null, baseline: null, score: null, method: null, direction: null };
    }
    const center = median(baseline);
    const deviations = baseline.map(value => Math.abs(value - center));
    const mad = median(deviations);
    const difference = current - center;
    let score = null;
    let method = "rolling-median-mad";

    if (mad > 0) {
      score = 0.6745 * difference / mad;
    } else {
      // MAD can be zero in quantized/flat series. Use population standard deviation
      // when it provides a scale; for a constant baseline, compare exact deviation
      // without inventing a score or numerical epsilon.
      const mean = baseline.reduce((sum, value) => sum + value, 0) / baseline.length;
      const variance = baseline.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / baseline.length;
      const standardDeviation = Math.sqrt(variance);
      if (standardDeviation > 0) {
        score = difference / standardDeviation;
        method = "rolling-median-standard-deviation-fallback";
      } else {
        method = "constant-baseline-deviation";
        if (difference === 0) return { status: "normal", current, baseline: center, score: 0, method, direction: null };
        return { status: "anomalous", current, baseline: center, score: null, method, direction: difference > 0 ? "high" : "low" };
      }
    }

    const magnitude = Math.abs(score);
    const anomalyScore = options.anomalyScore ?? CONFIG.anomalyScore;
    const elevatedScore = options.elevatedScore ?? CONFIG.elevatedScore;
    const status = magnitude >= anomalyScore ? "anomalous" : magnitude >= elevatedScore ? "elevated" : "normal";
    return { status, current, baseline: center, score, method, direction: difference === 0 ? null : difference > 0 ? "high" : "low" };
  }

  function analyze(points, valueKey, range = "24h", options = {}) {
    const settings = { ...CONFIG, ...options };
    const windowSize = settings.windows[range] || settings.windows["24h"];
    const samples = orderedUnique(Array.isArray(points) ? points : [], valueKey);
    const results = [];
    samples.forEach((sample, index) => {
      const baselineSamples = samples.slice(Math.max(0, index - windowSize), index);
      const assessment = assess(sample.value, baselineSamples.map(item => item.value), settings);
      results.push({ ...assessment, time: sample.time, pointIndex: sample.pointIndex, baselineCount: baselineSamples.length, valueKey, dataStatus: options.dataStatus || "unknown" });
    });
    const latest = results[results.length - 1] || { status: "insufficient", current: null, baseline: null, score: null, method: null, direction: null, time: null, pointIndex: null, baselineCount: 0, valueKey, dataStatus: options.dataStatus || "unknown" };
    return { latest, points: results, anomalies: results.filter(result => result.status === "anomalous"), dataStatus: options.dataStatus || "unknown", config: { windowSize, minBaseline: settings.minBaseline, elevatedScore: settings.elevatedScore, anomalyScore: settings.anomalyScore } };
  }

  return { CONFIG, median, assess, analyze };
});
