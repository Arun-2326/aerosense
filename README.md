# AeroSense

**Understand your air. Before it affects you.**

A responsive environmental-intelligence dashboard for Chennai, Bengaluru, Hyderabad, Delhi and Mumbai. It connects location → current conditions → context → trend → prediction → recommendation.

## Run

Open `index.html` directly, or serve `outputs/` from a local static server. A server is recommended for network providers:

    python -m http.server 8000

Then visit `http://localhost:8000`. The dashboard is fully usable in Demo Mode without network access or API keys.

## Data modes and sources

- **LIVE MODEL DATA:** Open-Meteo Air Quality API (CAMS) returns hourly modelled AQI and pollutant estimates; it is not a ground-monitor observation. Open-Meteo Weather API supplies current model weather. Readings display the provider model time and source.
- **PARTIAL MODEL DATA:** the air feed remains live when weather or expected fields are incomplete; missing values stay unavailable. Weather fixtures are identified as demo fallback.
- **DEMO DATA:** stable fixtures for all five cities are used when the network/provider is unavailable, or when the user selects Demo Mode. They are deterministic and labelled.
- **STALE MODEL DATA:** after a successful response, a later failed refresh keeps the last valid sample and marks it stale with its original model timestamp.
- **PREDICTED:** the six-hour prediction and best-time advisor remain deterministic demo logic, not a trained or validated ML model and not an Open-Meteo forecast. There is no confidence percentage.
- **DERIVED INSIGHT:** risk labels and general recommendations are simple rules based on the current displayed AQI. Contributor bars are contextual indicators, not causal measurements.
- **DEMO HISTORY / DEMO COMPARISON:** environmental events, comparisons, and longer-than-24-hour charts use fixtures. The 24-hour pollutant chart uses Open-Meteo hourly model values when available; it does not claim monitor history. The anomaly marker is illustrative demo-only and is hidden on the live-model range.

The live/demo toggle and refresh control are in the dashboard header. A browser without network access or where the provider is blocked by CORS continues in Demo Mode.

## Providers and configuration

`services.js` contains the provider boundary, normalization, per-city cache, stale handling, and deterministic fallback. The public Open-Meteo endpoints need no API key for non-commercial use. For deployment-specific endpoint URLs, set `window.AEROSENSE_CONFIG` **before** loading `services.js`:

    window.AEROSENSE_CONFIG = {
      openMeteoAirBaseUrl: "https://air-quality-api.open-meteo.com/v1/air-quality",
      openMeteoWeatherBaseUrl: "https://api.open-meteo.com/v1/forecast"
    };

A static browser page cannot read `.env` files directly; production build/deployment tooling can inject these public endpoint values from environment variables. Never put private API keys in browser code. `.env.example` is a server/deployment template for future backend integrations.

## Project structure

- `index.html` — landing page and dashboard markup
- `styles.css` — responsive layout, visual system, charts and schematic city map
- `data.js` — deterministic city, weather, historic, forecast, and event fixtures
- `services.js` — Open-Meteo integration, normalized models, graceful fallback and stale cache
- `app.js` — rendering, location switching, controls, demo recommendations and navigation
- `favicon.svg` — local AeroSense icon
- `.env.example` — deployment/backend configuration template

The app uses plain HTML, CSS and JavaScript with no build step, backend, database, or package dependencies. Its map is a clickable schematic, not a geographic OSM/Leaflet map.

## Validation

    node --check app.js
    node --check data.js
    node --check services.js

There is no TypeScript, lint, or production bundler configured.
