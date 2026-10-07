/* Leaflet presentation layer. All readings arrive through AeroSenseServices. */
window.AeroSenseMap = (() => {
  let map = null;
  let markers = new Map();
  let markerLocations = new Map();
  let leaderLines = new Map();
  let lastSelected = null;
  let selectedCallback = () => {};
  let tileTimer = null;
  let tileLoaded = false;
  const state = () => document.getElementById("mapState");
  const colors = { good: "#4e9c73", moderate: "#a1812d", sensitive: "#aa753c", unhealthy: "#b56e36", very: "#ac5c52", hazardous: "#905889", unavailable: "#829297" };
  function severity(aqi) {
    if (!Number.isFinite(aqi)) return ["unavailable", "AQI unavailable"];
    return aqi <= 50 ? ["good", "Good"] : aqi <= 100 ? ["moderate", "Moderate"] : aqi <= 150 ? ["sensitive", "Sensitive groups"] : aqi <= 200 ? ["unhealthy", "Unhealthy"] : aqi <= 300 ? ["very", "Very unhealthy"] : ["hazardous", "Hazardous"];
  }
  function showFailure() {
    const el = state();
    if (!el || tileLoaded) return;
    el.textContent = "Map tiles could not be loaded.";
    el.classList.add("map-state-error");
  }
  function makeIcon(item, selected) {
    const [level] = severity(item.aqi);
    const codes = { Chennai: "CHE", Bengaluru: "BLR", Hyderabad: "HYD", Delhi: "DEL", Mumbai: "MUM" };
    const html = '<span class="aerosense-marker' + (selected ? ' is-selected' : '') + '" style="--marker-color:' + colors[level] + '" aria-hidden="true">' + codes[item.city] + '</span>';
    return window.L.divIcon({ className: "aerosense-leaflet-icon", html, iconSize: [38, 28], iconAnchor: [19, 14], popupAnchor: [0, -14] });
  }
  function resolveCollisions() {
    if (!map || !markers.size) return;
    const size = map.getSize(), placed = [], candidates = [[0, 0]];
    [44, 62, 80].forEach(radius => {
      for (let step = 0; step < 8; step++) {
        const angle = -Math.PI / 2 + step * Math.PI / 4;
        candidates.push([Math.round(Math.cos(angle) * radius), Math.round(Math.sin(angle) * radius)]);
      }
    });
    markers.forEach((marker, cityName) => {
      const actual = markerLocations.get(cityName), base = map.latLngToLayerPoint(actual);
      const offset = candidates.find(([x, y]) => {
        const px = base.x + x, py = base.y + y;
        return px >= 22 && px <= size.x - 22 && py >= 18 && py <= size.y - 18 && placed.every(point => Math.hypot(point.x - px, point.y - py) >= 44);
      }) || [0, 0];
      const visualPoint = window.L.point(base.x + offset[0], base.y + offset[1]);
      const visual = map.layerPointToLatLng(visualPoint);
      marker.setLatLng(visual);
      const leader = leaderLines.get(cityName);
      if (Math.hypot(offset[0], offset[1]) > 4) leader.setLatLngs([actual, visual]).setStyle({ opacity: 0.58 });
      else leader.setStyle({ opacity: 0 });
      placed.push(visualPoint);
    });
  }
  function update(items, selected) {
    if (!map) return;
    items.forEach(item => {
      const isSelected = item.city === selected;
      let marker = markers.get(item.city);
      if (!marker) {
        const location = window.L.latLng(item.latitude, item.longitude);
        marker = window.L.marker(location, { icon: makeIcon(item, isSelected), title: item.city + " city reference", riseOnHover: true }).addTo(map);
        marker.on("click", () => { map.closePopup(); selectedCallback(item.city); });
        markers.set(item.city, marker);
        markerLocations.set(item.city, location);
        leaderLines.set(item.city, window.L.polyline([location, location], { color: "#52676a", weight: 1, opacity: 0, interactive: false }).addTo(map).bringToBack());
      } else {
        marker.setIcon(makeIcon(item, isSelected));
        markerLocations.set(item.city, window.L.latLng(item.latitude, item.longitude));
      }
      const [level, label] = severity(item.aqi);
      const status = item.status === "stale" ? "STALE" : item.status === "demo" ? "DEMO" : "LIVE";
      marker.bindPopup('<strong>' + item.city + '</strong><br>' + (Number.isFinite(item.aqi) ? 'AQI ' + Math.round(item.aqi) + ' · ' + label : label) + '<br>' + status + '<br><small>City reference · not a monitoring station</small>');
    });
    if (selected !== lastSelected && markers.has(selected)) {
      map.setView(markerLocations.get(selected), Math.max(map.getZoom(), 6), { animate: false });
      lastSelected = selected;
    }
    resolveCollisions();
  }
  function init(cityData, onSelect) {
    if (map) return true;
    const el = document.getElementById("mapVisual");
    if (!el || !window.L) { showFailure(); return false; }
    selectedCallback = onSelect || (() => {});
    map = window.L.map(el, { zoomControl: true, scrollWheelZoom: true, preferCanvas: true });
    const tiles = window.L.tileLayer((window.AEROSENSE_CONFIG && window.AEROSENSE_CONFIG.osmTileUrl) || "https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'
    }).addTo(map);
    tiles.on("tileload", () => {
      tileLoaded = true;
      const overlay = state();
      if (overlay) overlay.hidden = true;
      if (tileTimer) clearTimeout(tileTimer);
    });
    tiles.on("tileerror", () => { if (!tileTimer) tileTimer = setTimeout(showFailure, 7000); });
    if (!tileTimer) tileTimer = setTimeout(showFailure, (window.AEROSENSE_CONFIG && window.AEROSENSE_CONFIG.mapTileTimeoutMs) || 7000);
    const bounds = window.L.latLngBounds(cityData.map(c => [c.latitude, c.longitude]));
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 6, animate: false });
    map.on("zoomend moveend", resolveCollisions);
    map.whenReady(() => map.invalidateSize());
    window.addEventListener("resize", () => map && map.invalidateSize());
    return true;
  }
  function fitAll() {
    if (!map || !markers.size) return;
    map.invalidateSize({ pan: false });
    map.closePopup();
    map.fitBounds(window.L.latLngBounds([...markerLocations.values()]), { padding: [48, 48], maxZoom: 6, animate: false });
  }
  function resize() { if (map) map.invalidateSize(); }
  return { init, update, fitAll, resize, isReady: () => !!map };
})();
