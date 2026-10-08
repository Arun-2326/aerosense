# AeroSense — Real-Time Air Quality Intelligence & Prediction

**Understand your air. Before it affects you.**

AeroSense combines current atmospheric-model air-quality data, weather context, historical trends, statistical anomaly detection, a one-hour Random Forest PM2.5 estimate, the Open-Meteo provider forecast, practical activity guidance, and geographically scoped TNPCB environmental records. It is a deployed environmental-intelligence web application built with a vanilla HTML/CSS/JavaScript frontend and a separate Python/FastAPI ML backend.

## Live Demo

| Service | URL |
| --- | --- |
| Frontend | [https://aerosense-1-voch.onrender.com](https://aerosense-1-voch.onrender.com) |
| Backend API | [https://aerosense-pdfu.onrender.com](https://aerosense-pdfu.onrender.com) |
| API documentation | [https://aerosense-pdfu.onrender.com/docs](https://aerosense-pdfu.onrender.com/docs) |
| GitHub repository | [Arun-2326/aerosense](https://github.com/Arun-2326/aerosense) |

The frontend and FastAPI inference backend are deployed as separate Render services. The browser gets air-quality and weather data from Open-Meteo and sends eligible Random Forest prediction requests to the backend over HTTPS.

## Problem Statement

Air quality changes across regions and over time. People need a clear way to explore current conditions, recent trends, relevant weather context, possible future conditions, and practical exposure guidance. The recruitment task also calls for environmental and compliance information. AeroSense integrates a limited set of verified Tamil Nadu Pollution Control Board (TNPCB) source records and keeps their geographic and source scope explicit.

## What the Application Does

The product flow is:

**LOCATION → CURRENT CONDITIONS → WHY → HISTORICAL TRENDS → ANOMALY → ML PREDICTION → PROVIDER FORECAST → BEST WINDOW → RECOMMENDATION → ENVIRONMENTAL CONTEXT**

Users select a supported city, inspect current air and weather context, explore hourly or daily historical model values, review statistical anomalies and contextual explanations, compare the separate ML and provider outlooks, and view activity guidance and regional TNPCB source records.

## Key Features

| Feature | Implementation |
| --- | --- |
| Live atmospheric-model AQ data | Open-Meteo Air Quality API when available; model output, not a ground-monitor reading. |
| Current pollutants | AQI, PM2.5, PM10, NO2, SO2, and O3 where supplied. |
| Weather context | Open-Meteo temperature, humidity, wind, and precipitation where available. |
| Interactive map | Leaflet with OpenStreetMap tiles and Chennai, Bengaluru, Hyderabad, Delhi, and Mumbai reference locations. Markers are not monitoring stations. |
| 24-hour history | Hourly pollutant history where provider data is available. |
| 7-day history | Daily-average historical pollutant values. |
| 30-day history | Daily-average historical pollutant values. |
| Statistical anomaly detection | Preceding-only rolling statistical baseline; anomaly is not a causal or health diagnosis. |
| Contextual explanations | Pollution and weather context described as association, not confirmed cause. |
| Random Forest prediction | Optional one-hour-ahead PM2.5 estimate when live input and the backend are available. |
| Provider forecast | Separate Open-Meteo future hourly atmospheric-model values, up to six hours in the dashboard. |
| Model comparison | Displays the separate provider and AeroSense ML estimate when eligible. |
| Activity Advisor | Ranks forecast windows for a selected activity profile using a heuristic. |
| Compare Locations | Compares up to three cities using deterministic AQI fixture values. |
| Demo Mode | Repeatable, clearly labelled fixtures for the five supported cities. |
| Recommendations | General, rule-based environmental guidance; not medical advice. |
| TNPCB Environmental & Compliance History | Verified supplied monitoring and closure/sealing records, filtered to their represented region. |

The Activity Advisor supports **General public, Walking, Running, Cycling,** and **Sensitive groups** profiles. It ranks available future hours heuristically using forecast PM2.5 and available AQI, PM10, and wind context; it shows best/worst windows only when forecast values differ meaningfully. This is informational guidance, not medical advice. Compare Locations displays up to three cities using deterministic AQI fixtures, not live provider city measurements.

## Data Sources and Prediction Outputs

These three outputs have different sources and are labelled separately in the interface:

1. **Open-Meteo current air-quality output:** atmospheric-model values for the selected coordinates and provider timestamp. They are not direct ground-monitor observations.
2. **AeroSense Random Forest:** a one-hour-ahead PM2.5 estimate produced by the separate FastAPI backend from recent hourly provider PM2.5 inputs.
3. **Open-Meteo provider forecast:** future hourly pollutant values from the provider's atmospheric model. These are not AeroSense ML predictions.

Open-Meteo weather context is fetched separately. Historical model values and deterministic Demo Mode fixtures are also identified by provenance/status in the interface.

### Data Status and Provenance Labels

- **LIVE / LIVE MODEL DATA:** a current successful Open-Meteo atmospheric-model response; “live” does not mean a ground-monitor observation.
- **PARTIAL:** air-quality data is available, while some weather or expected fields are unavailable.
- **STALE:** a cached provider response is shown after refresh failure, retaining its original timestamp where available.
- **DEMO:** deterministic fixture data; it is not live.
- **PREDICTED:** a future value from Open-Meteo's forecast or the separate AeroSense Random Forest. The source is labelled; predicted values are not observations.
- **DERIVED:** a calculated trend, heuristic score, risk label, anomaly result, or contextual explanation. Derived results are not direct measurements and do not establish causation.

## Environmental & Compliance Information

AeroSense integrates the verified TNPCB records supplied for this project. These are historical source materials, not a live feed.

### Chennai monitoring records

Official TNPCB ambient-air monitoring records are included for:

- Adyar Residential
- Nungambakkam Traffic Area

These are monitoring observations, **not compliance findings or violations**.

### Closure and sealing records

TNPCB closure/sealing records retain their original geographic scope and are displayed when the selected region matches the record. District-level records are not presented as Chennai actions unless the source supports that attribution. Selecting a verified records region changes the Environmental History context; it does not imply that the air-quality dashboard has measurements for that region.

If the integrated source set contains no verified Chennai-specific compliance action, the interface reports that source gap. It does not claim that no historical action ever existed. Records identify TNPCB as the authority and show their source document/reference, location, proceeding, and regulatory basis where available. Demo fixtures are separate from these verified TNPCB records. No incidents are fabricated.

## Architecture

```text
Browser — vanilla HTML / CSS / JavaScript
  ├── Open-Meteo Air Quality API (current/history/forecast model values)
  ├── Open-Meteo Weather API (weather context)
  ├── Leaflet ── OpenStreetMap tiles
  ├── Deterministic demo fixtures (separate from live provider data)
  ├── TNPCB source records (historical, geographically scoped)
  └── HTTPS ── Render FastAPI backend
                 ├── /api/prediction
                 └── scikit-learn Random Forest PM2.5 model
```

The frontend owns rendering, interaction, provider normalization, fallback, and in-memory caching. The backend validates prediction input and loads the committed model artifact. The frontend can demonstrate deterministic fixtures without calling the trained model.

## Technology Stack

| Area | Technologies |
| --- | --- |
| Frontend | HTML, CSS, JavaScript |
| Backend | Python, FastAPI, Uvicorn |
| ML and data | scikit-learn Random Forest, pandas, NumPy, joblib, DuckDB |
| Map | Leaflet, OpenStreetMap |
| Testing | Node.js built-in test runner, Python `unittest` |
| Deployment | Render Static Site and Render Web Service |

The current application does not use React, TypeScript, Vite, Tailwind, React Router, Recharts, PostgreSQL, or OpenAQ.

## Machine Learning

- **Model:** scikit-learn `RandomForestRegressor`, version **1.0.0**, with median imputation.
- **Target:** city-hour median PM2.5 concentration one hour ahead, in µg/m³.
- **Training source:** 2024 India Air Quality Database published by XKDR Forum, filtered to CPCB CAAQM station observations and joined to station metadata. US Embassy/AirNow observations were excluded; the publisher documents CC BY 4.0.
- **Features:** current PM2.5, exact-hour lags (1, 2, 3, and 6 hours), trailing summaries, local hour/day/month, and coordinates. Missing hours are not interpolated.
- **Evaluation split:** chronological; training before September 2024, validation September–October, held-out test November–December 2024. Candidate selection uses validation MAE. The final fit samples up to 40,000 training rows and 20,000 validation rows.

### Held-out test results

| Model | MAE (µg/m³) | RMSE (µg/m³) | R² |
| --- | ---: | ---: | ---: |
| Random Forest | 8.68 | 18.60 | 0.870 |
| Persistence baseline (next value = current value) | 9.28 | 19.54 | 0.857 |

These offline metrics are not guaranteed live accuracy. Runtime input uses Open-Meteo atmospheric-model PM2.5, while training and evaluation targets are CPCB station-city medians. This source/domain difference limits how the offline scores should be interpreted for live provider inputs or individual cities. The model metadata is in [`backend/models/model_card.json`](backend/models/model_card.json); the serialized artifact is [`backend/models/pm25_model.joblib`](backend/models/pm25_model.joblib).

## Anomaly Detection and Context

The statistical detector uses preceding-only rolling windows: up to 12 prior hourly observations for 24 hours, 6 prior daily observations for 7 days, and 14 prior daily observations for 30 days. It requires at least 6 valid, uniquely timestamped prior readings. Null readings and invalid timestamps are excluded; duplicate timestamps retain the last valid sample. Missing values are not zero-filled or interpolated.

The primary robust score is `0.6745 × (current − baseline median) / MAD`. Absolute scores of 2.5 or more are elevated; scores of 3.5 or more are anomalous and receive chart markers. If MAD is zero but the baseline varies, a median-centered standard-deviation fallback is used. With a constant baseline, a changed current value is marked anomalous by exact deviation without inventing a score. An anomaly signals unusual statistical behavior, not cause or health risk. Contextual contributors likewise do not confirm a pollution source or establish causation.

## API

The deployed FastAPI service is available at `https://aerosense-pdfu.onrender.com`.

| Method and path | Purpose |
| --- | --- |
| `GET /health` | Reports service status and whether the model artifact exists. |
| `GET /api/model-card` | Returns model metadata and evaluation information. |
| `POST /api/prediction` | Validates recent observations and returns the one-hour-ahead PM2.5 estimate. |

The prediction request contains a supported city, coordinates, and at least seven valid consecutive hourly PM2.5 observations. The frontend sends eligible inference requests to `https://aerosense-pdfu.onrender.com/api/prediction`. API docs: [FastAPI documentation](https://aerosense-pdfu.onrender.com/docs).

## Production Deployment

- **Frontend:** Render Static Site at [aerosense-1-voch.onrender.com](https://aerosense-1-voch.onrender.com).
- **Backend:** separate Render Web Service at [aerosense-pdfu.onrender.com](https://aerosense-pdfu.onrender.com).
- **Prediction request:** HTTPS `POST https://aerosense-pdfu.onrender.com/api/prediction`.
- **CORS:** the backend reads the comma-separated `AEROSENSE_CORS_ORIGINS` environment variable. The Render service allowlist includes the deployed frontend origin `https://aerosense-1-voch.onrender.com`; the private environment value is not stored in this repository.

Open-Meteo remains the frontend's air-quality and weather provider. Render hosts the API and does not replace that data source.

## Project Structure

```text
.
├── index.html                 # Landing page and dashboard markup
├── styles.css                 # Main responsive styles
├── history.css                # Historical and TNPCB record styles
├── map.css                    # Map styles
├── app.js                     # Dashboard rendering and interactions
├── services.js                # Open-Meteo, fixtures, cache, fallback, ML API client
├── data.js                    # Deterministic city fixtures and TNPCB source records
├── prediction.js              # Forecast normalization and trend calculation
├── intelligence.js            # Contextual explanations and Activity Advisor
├── anomaly.js                 # Rolling statistical anomaly detection
├── map.js                     # Leaflet map presentation
├── favicon.svg
├── serve.cjs                   # Local static frontend server (port 8001)
├── tests/
│   ├── anomaly.test.cjs
│   ├── intelligence.test.cjs
│   └── prediction.test.cjs
└── backend/
    ├── app.py                  # FastAPI application and routes
    ├── inference.py            # Input validation and model inference
    ├── train_model.py          # Dataset processing and model training
    ├── download_dataset.py     # XKDR dataset download helper
    ├── requirements.txt
    ├── test_ml.py
    └── models/
        ├── model_card.json
        └── pm25_model.joblib
```

Raw downloaded datasets and virtual environments are local and excluded from Git.

## Local Development

The following Windows PowerShell commands are for local development. Localhost URLs below are **not production endpoints**.

### Frontend

Install Node.js if needed, then run from the repository root:

```powershell
node serve.cjs
```

Open [http://localhost:8001](http://localhost:8001). Demo fixtures work without API keys. Live Open-Meteo requests and map tiles require network access.

### Backend

Create and install a local Python environment from the repository root:

```powershell
python --version
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r backend\requirements.txt
```

If PowerShell blocks environment activation, use `.\.venv\Scripts\python.exe` in place of `python` for the pip commands. Start the backend in a separate PowerShell window:

```powershell
cd backend
python -m uvicorn app:app --host 127.0.0.1 --port 8002
```

The local backend URL is `http://127.0.0.1:8002`; it is only for local development. To point the frontend at a local backend, set `window.AEROSENSE_CONFIG.mlApiBaseUrl` before `services.js` loads. By default, the deployed frontend uses the production HTTPS backend URL.

## Environment Configuration and Security

- `AEROSENSE_CORS_ORIGINS` is read by `backend/app.py` as a comma-separated origin allowlist. Its code default contains local frontend origins; production must allow the deployed frontend origin through Render service configuration.
- `AEROSENSE_DATA_API_KEY` is read by `backend/download_dataset.py` when downloading XKDR training data. It is not needed to run the deployed app or use its committed model artifact.
- The static frontend does not load `.env` files. Optional browser endpoint overrides are provided through `window.AEROSENSE_CONFIG` before `services.js` loads; supported fields include `openMeteoAirBaseUrl`, `openMeteoWeatherBaseUrl`, `osmTileUrl`, and `mlApiBaseUrl`.
- `.env.example` contains placeholders for deployment or future integrations. `OPENAQ_API_KEY`, `OPENAQ_BASE_URL`, `AEROSENSE_API_BASE_URL`, and `DATABASE_URL` are not used by the current application.
- `.gitignore` excludes local virtual environments and downloaded raw/processed datasets from Git.
- Do not place private API keys or other secrets in frontend source or browser configuration. The current Open-Meteo workflow does not require a private API key.

## Testing

Run from the repository root:

```powershell
node --test tests/*.cjs
python backend/test_ml.py
```

Verified results for this submission: **33 frontend tests passed**, **10 backend tests passed**, and **`git diff --check` passed**. The backend suite loads the committed model and includes a dataset-dependent test. Raw XKDR parquet files are excluded from Git; obtain the dataset before running that test. Dataset/API access is not needed for the other backend checks.

## Demo Mode

Demo Mode uses deterministic fixtures for **Chennai, Bengaluru, Hyderabad, Delhi,** and **Mumbai**. Repeated selections use stable city-specific current values and forecast/history fixtures. Demo data is labelled and is not live. If a live-provider request fails with no valid cached response, the service can return demo fixtures; a cached provider response may instead be retained and labelled stale. Demo Mode is separate from the verified TNPCB historical source records.

## 2-Minute Evaluator Demo

1. Open the [Live Demo](https://aerosense-1-voch.onrender.com) and select **Chennai**.
2. Show current AQ and its Open-Meteo atmospheric-model source; clarify that it is not a ground-monitor measurement.
3. Open **Pollution Trends**, switch between 24h, 7d, and 30d, and review an anomaly or contextual explanation if available.
4. Open **Prediction** and distinguish the current value, AeroSense Random Forest **+1 hour** estimate, and later Open-Meteo provider-forecast hours.
5. Show **Model Comparison** and the separate source labels.
6. Open **Activity Advisor**, change a profile, and explain that its ranking is heuristic guidance, not medical advice.
7. Open **Environmental & Compliance History**. Show Chennai's Adyar and Nungambakkam monitoring observations and distinguish them from compliance actions.
8. If useful, select a region with a verified TNPCB closure/sealing record and point out its source-stated geographic scope.
9. Switch to **Demo Mode** and explain the LIVE/PARTIAL/STALE/DEMO and PREDICTED/DERIVED provenance labels.

## Limitations

- Open-Meteo air-quality values are atmospheric-model output, not direct ground-monitor observations.
- Training targets are CPCB station-city medians, while runtime input is Open-Meteo model PM2.5; this source/domain shift limits interpretation of offline model metrics.
- The Random Forest predicts one hour ahead for PM2.5 only, requires seven valid consecutive hourly inputs, and provides no confidence interval.
- Provider fields may be missing; unavailable values are not inferred or filled with zero. Live provider data and map tiles require network access, and outages may result in stale or demo states.
- Compare Locations uses deterministic AQI fixtures, not live Open-Meteo city measurements.
- Verified TNPCB coverage is limited to the integrated records and represented regions. A missing record does not prove that no historical incident or action existed; monitoring observations are not compliance findings.
- Contextual analysis does not establish causation or confirm a pollution source. Activity guidance is informational and is not medical advice.

## Future Improvements

- Expand verified environmental and compliance sources, geographic coverage, and source types.
- Add more monitoring-station sources and reconcile their coverage and provenance.
- Explore multi-hour ML forecasting and evaluate each horizon independently.
- Improve region-specific training data and evaluate model performance by city and source.
- Consider optional persistence for environmental records if the product requires it.

These are future directions, not current features.

## Submission

AeroSense is a Web Development recruitment project for **NEXUS Club, VIT Chennai**.

- **Live Demo:** [https://aerosense-1-voch.onrender.com](https://aerosense-1-voch.onrender.com)
- **Repository:** [https://github.com/Arun-2326/aerosense](https://github.com/Arun-2326/aerosense)

**Understand your air. Before it affects you.**
