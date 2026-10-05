# AeroSense

**Understand your air. Before it affects you.**

A responsive environmental-intelligence demo connecting current conditions → possible contributors → trend → prediction → best time → recommendation.

> **Data honesty:** this project is Demo Mode by default. City readings, weather, timeline series, prediction series and history examples are deterministic fixtures; they are never presented as live. Predictions are illustrative, not a trained model. History entries are not verified incidents or sources.

## Run

Open index.html directly, or serve the outputs folder with Python:

    python -m http.server 8000

Then visit http://localhost:8000. The file-open route needs no server or network.

## Product features

- Landing page with a locally generated environmental signal visualization
- Five deterministic city datasets: Chennai, Bengaluru, Hyderabad, Delhi and Mumbai
- AQI, risk, change, pollutant breakdown, weather context and contributor indicators
- Schematic clickable city map and map controls
- Historical pollution charts with range and pollutant controls plus a labeled demo spike
- Six-hour predicted AQI view, profile aware outdoor advisor, location comparison and recommendation engine
- Clearly illustrative environmental history, accessible dialogs, responsive layout and dark mode

## Project structure

- index.html — landing screen and dashboard markup
- styles.css — responsive visual system and chart/map styling
- data.js — stable city, weather, historical, forecast and history fixtures
- services.js — normalized service boundary and optional same-origin provider proxy with Demo Mode fallback
- app.js — dashboard rendering, interactions, advisor and recommendations
- favicon.svg — local AeroSense mark
- .env.example — backend-only integration settings template

The empty starter repository had no app framework or installed project dependencies. This implementation uses plain HTML/CSS/JavaScript and local SVG so it opens as a file and runs without package installation, API keys, PostgreSQL or external map assets.

## Data categories

- **DEMO DATA:** every bundled observation, weather value, example history entry and timeline point.
- **PREDICTED:** six-hour per-city demo forecasts and best-time AQI, fixed to keep the demo repeatable.
- **DERIVED INSIGHT:** risk bands, simple deltas, contributor labels, anomaly presentation and recommendations based on fixture values.
- **LIVE DATA:** none is currently connected. services.js is prepared to call a configured same-origin proxy but the UI remains in Demo Mode until a server provider and normalized response contract are implemented.

The confidence percentage is illustrative and must not be understood as validated model confidence. Contributor indicators show association only, not causation. The anomaly is a deliberately included demo event, not a live statistical alert.

## Services and real provider integration

services.js separates UI-facing methods for city list, current air quality, weather, pollution history, prediction, environmental history and recommendation context. With no proxy configured, the deterministic fixtures keep every view available. To connect providers, add a backend proxy that normalizes responses to the fields used by data.js and app.js and sets AEROSENSE_CONFIG.apiBaseUrl in the page bootstrap. Keep secrets server-side.

Potential provider integrations:

- OpenAQ for air-quality observations, with attribution, units and timestamp validation.
- Open-Meteo for weather and environmental context.
- OpenStreetMap tiles with Leaflet for a geographically accurate map. The included map is a schematic illustration, not a geocoder or geographic map.
- Verifiable public environmental event sources only. Demo history must not be mistaken for a real incident feed.

Use .env.example as a server-side template. Never expose private keys via a static JavaScript file.

## Prediction and anomaly methodology

The present forecast is a deterministic six-value sequence per city. No scikit-learn model has been trained and no MAE, RMSE or R² claims are made. Production forecasts require sourced historical data, temporal holdout validation, a baseline comparison and calibrated intervals.

The timeline spike is present as a demo visual. A future detector could evaluate percentage movement and rolling z-scores, require enough samples, record source/time, deduplicate alerts and distinguish detection from projected duration.

## Backend and database

There is no backend, API server or database in the runnable demo. This is deliberate for immediate demonstration. A future FastAPI layer can implement the proxy endpoints named in services.js. PostgreSQL is optional for stored observations/preferences; Demo Mode should continue to work without it.

## Responsive demo walkthrough

1. Load the landing page and choose Explore Air Quality.
2. Switch cities with the selector or map markers; inspect AQI, pollutants and weather.
3. Review possible contributors and the non-causality note.
4. Change the trend horizon and pollutant; inspect the labeled spike.
5. Review future predictions and select an activity profile.
6. Compare locations, then read example history and tailored recommendations.

## Validation

Run syntax checks with:

    node --check app.js
    node --check data.js
    node --check services.js

No TypeScript or frontend production build is configured because this is a dependency-free static implementation. There is no lint configuration or automated test suite in this starter repository.
