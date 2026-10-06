/* Leaflet presentation layer. All readings arrive through AeroSenseServices. */
window.AeroSenseMap = (() => {
  let map = null;
  let markers = new Map();
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
    const status = item.status === "stale" ? "STALE" : item.status === "demo" ? "DEMO" : "LIVE";
    const html = '<span class="aerosense-marker' + (selected ? ' is-selected' : '') + '" style="--marker-color:' + colors[level] + '"><b>' + item.city + '</b><span>' + (Number.isFinite(item.aqi) ? 'AQI ' + Math.round(item.aqi) : 'AQI unavailable') + '</span><small>' + status + '</small></span>';
    return window.L.divIcon({ className: "aerosense-leaflet-icon", html, iconSize: [116, 57], iconAnchor: [58, 56], popupAnchor: [0, -52] });
  }
  function update(items, selected) {
    if (!map) return;
    items.forEach(item => {
      const isSelected = item.city === selected;
      let marker = markers.get(item.city);
      if (!marker) {
        marker = window.L.marker([item.latitude, item.longitude], { icon: makeIcon(item, isSelected), title: item.city + " city reference" }).addTo(map);
        marker.on("click", () => selectedCallback(item.city));
        markers.set(item.city, marker);
      } else {
        marker.setIcon(makeIcon(item, isSelected));
      }
      const [level, label] = severity(item.aqi);
      const status = item.status === "stale" ? "STALE" : item.status === "demo" ? "DEMO" : "LIVE";
      marker.bindPopup('<strong>' + item.city + '</strong><br>' + (Number.isFinite(item.aqi) ? 'AQI ' + Math.round(item.aqi) + ' · ' + label : label) + '<br>' + status + '<br><small>City reference · not a monitoring station</small>');
    });
    if (selected !== lastSelected && markers.has(selected)) {
      map.setView(markers.get(selected).getLatLng(), Math.max(map.getZoom(), 6), { animate: false });
      lastSelected = selected;
    }
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
    map.whenReady(() => map.invalidateSize());
    window.addEventListener("resize", () => map && map.invalidateSize());
    return true;
  }
  function fitAll() {
    if (!map || !markers.size) return;
    map.fitBounds(window.L.latLngBounds([...markers.values()].map(m => m.getLatLng())), { padding: [28, 28], maxZoom: 6 });
  }
  function resize() { if (map) map.invalidateSize(); }
  return { init, update, fitAll, resize, isReady: () => !!map };
})();
