const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const anomaly = require("../anomaly.js");

const series = values => values.map((value, index) => ({ time: new Date(Date.UTC(2026, 0, 1, index)).toISOString(), pm25: value }));

test("ordinary stable readings are not flagged", () => {
  const result = anomaly.analyze(series([10, 11, 9, 10, 10, 11, 10.5]), "pm25", "24h");
  assert.equal(result.latest.status, "normal");
  assert.equal(result.anomalies.length, 0);
});

test("detects a high spike against preceding observations", () => {
  const result = anomaly.analyze(series([10, 11, 9, 10, 10, 11, 30]), "pm25", "24h");
  assert.equal(result.latest.status, "anomalous");
  assert.equal(result.latest.direction, "high");
  assert.equal(result.latest.baseline, 10);
  assert.ok(result.latest.score >= anomaly.CONFIG.anomalyScore);
});

test("detects a low spike against preceding observations", () => {
  const result = anomaly.analyze(series([100, 101, 99, 100, 100, 101, 30]), "pm25", "24h");
  assert.equal(result.latest.status, "anomalous");
  assert.equal(result.latest.direction, "low");
});

test("insufficient history has no baseline or score", () => {
  const result = anomaly.analyze(series([10, 11, 12]), "pm25", "24h");
  assert.equal(result.latest.status, "insufficient");
  assert.equal(result.latest.baseline, null);
  assert.equal(result.latest.score, null);
  assert.equal(result.anomalies.length, 0);
});

test("constant baselines use exact deviation without inventing a score", () => {
  const flat = anomaly.analyze(series([10, 10, 10, 10, 10, 10, 10]), "pm25", "24h");
  assert.equal(flat.latest.status, "normal");
  assert.equal(flat.latest.score, 0);
  const changed = anomaly.analyze(series([10, 10, 10, 10, 10, 10, 11]), "pm25", "24h");
  assert.equal(changed.latest.status, "anomalous");
  assert.equal(changed.latest.score, null);
  assert.equal(changed.latest.method, "constant-baseline-deviation");
});

test("nonconstant baseline with zero MAD uses the documented standard-deviation fallback", () => {
  const result = anomaly.analyze(series([1, 1, 1, 1, 1, 2, 20]), "pm25", "24h");
  assert.equal(result.latest.status, "anomalous");
  assert.equal(result.latest.method, "rolling-median-standard-deviation-fallback");
  assert.ok(Number.isFinite(result.latest.score));
});

test("null readings and invalid timestamps are excluded rather than treated as zero", () => {
  const points = [
    ...series([10, 11, 9, 10, 10, 11]),
    { time: "2026-01-01T06:00:00Z", pm25: null },
    { time: "not-a-time", pm25: 900 },
    { time: "2026-01-01T07:00:00Z", pm25: 31 }
  ];
  const result = anomaly.analyze(points, "pm25", "24h");
  assert.equal(result.latest.current, 31);
  assert.equal(result.latest.status, "anomalous");
  assert.equal(result.latest.pointIndex, 8);
});

test("duplicate timestamps keep one last valid sample and marker points to its input index", () => {
  const points = series([10, 11, 9, 10, 10, 11]);
  points.push({ time: "2026-01-01T05:00:00.000Z", pm25: 10 });
  points.push({ time: "2026-01-01T06:00:00.000Z", pm25: 35 });
  const result = anomaly.analyze(points, "pm25", "24h");
  assert.equal(result.latest.status, "anomalous");
  assert.equal(result.latest.pointIndex, 7);
  assert.equal(result.latest.time, "2026-01-01T06:00:00.000Z");
});

test("demo and stale detections retain their data state", () => {
  const demo = anomaly.analyze(series([1, 1, 1, 1, 1, 1, 9]), "pm25", "24h", { dataStatus: "demo" });
  const stale = anomaly.analyze(series([1, 1, 1, 1, 1, 1, 9]), "pm25", "24h", { dataStatus: "stale" });
  assert.equal(demo.latest.status, "anomalous");
  assert.equal(demo.latest.dataStatus, "demo");
  assert.equal(stale.latest.dataStatus, "stale");
});

test("all five deterministic city fixtures support PM2.5 and PM10 analysis", () => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve("../data.js"), "utf8"), context);
  const cities = context.window.AeroSenseData.cities;
  assert.deepEqual(Object.keys(cities).sort(), ["Bengaluru", "Chennai", "Delhi", "Hyderabad", "Mumbai"].sort());
  for (const city of Object.values(cities)) {
    const points = city.series.map((pm25, index) => ({ time: new Date(Date.UTC(2026, 0, 1, index)).toISOString(), pm25, pm10: pm25 * 1.6 }));
    for (const pollutant of ["pm25", "pm10"]) {
      const result = anomaly.analyze(points, pollutant, "24h", { dataStatus: "demo" });
      assert.equal(result.latest.dataStatus, "demo");
      assert.ok(["normal", "elevated", "anomalous", "insufficient"].includes(result.latest.status));
      assert.ok(result.anomalies.every(item => points[item.pointIndex].time === item.time));
    }
  }
});

test("timeline no longer places a percentage-based illustrative marker", () => {
  const app = fs.readFileSync(require.resolve("../app.js"), "utf8");
  assert.match(app, /AeroSenseAnomaly\.analyze\(payload\.points\s*,\s*key\s*,\s*selectedRange/);
  assert.match(app, /lineChart\(values\s*,\s*labels\s*,\s*anomaly\.anomalies\)/);
  assert.doesNotMatch(app, /Math\.floor\(\(vals\.length-1\)\*\.77\)/);
  assert.doesNotMatch(app, /Illustrative demo spike/);
});
