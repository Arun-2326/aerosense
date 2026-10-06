# AeroSense

**Understand your air. Before it affects you.**

A responsive environmental-intelligence dashboard for Chennai, Bengaluru, Hyderabad, Delhi and Mumbai. It connects location → current conditions → context → trend → prediction → recommendation.

## Run

Serve `outputs/` from a local static server for the geographic map and network providers (opening the file directly can prevent the tile service from receiving a valid browser referrer). For Windows PowerShell, `node serve.cjs` serves the dashboard on port 8001:

    node serve.cjs

Then visit `http://localhost:8001`. Demo readings and charts work without API keys; geographic map tiles require network access.

## Data modes and sources

- **LIVE MODEL DATA:** Open-Meteo Air Quality API (CAMS) returns hourly modelled AQI and pollutant estimates; it is not a ground-monitor observation. Open-Meteo Weather API supplies current model weather. Readings display the provider model time and source.
- **PARTIAL MODEL DATA:** the air feed remains live when weather or expected fields are incomplete; missing values stay unavailable. Weather fixtures are identified as demo fallback.
- **DEMO DATA:** stable fixtures for all five cities are used when the network/provider is unavailable, or when the user selects Demo Mode. They are deterministic and labelled.
- **STALE MODEL DATA:** after a successful response, a later failed refresh keeps the last valid sample and marks it stale with its original model timestamp.
- **PROVIDER FORECAST:** “What happens next?” uses up to six actual future hourly pollutant values returned by the Open-Meteo Air Quality endpoint. It labels live, stale and demo forecast states separately, shows the available horizon, and does not draw a confidence band or claim AeroSense ML.
- **DEMO FORECAST:** deterministic per-city PM2.5 and PM10 fixtures keep the forecast visualization and trend explanation demonstrable offline. The selected pollutant has its own series; unsupported/missing forecasts remain unavailable.
- **DERIVED INSIGHT:** risk labels and general recommendations are simple rules based on the current displayed AQI. Contributor bars are contextual indicators, not causal measurements.
- **DEMO HISTORY / DEMO COMPARISON:** environmental events and comparisons use fixtures. The 24-hour pollutant chart uses hourly Open-Meteo model data when available. Anomaly markers are produced by the statistical detector and inherit the history data status.
- **HISTORICAL MODEL DATA:** 24 hours uses hourly Open-Meteo CAMS values. The 7-day and 30-day views request their own archived ranges and show daily average pollutant concentrations; daily maximum and sample counts remain available in the normalized summaries. These are archived model forecasts, not ground-station measurements. No AQI is derived from concentrations. Historical archive failures show cached data as stale or a clearly labelled deterministic demo history.

The live/demo toggle and refresh control are in the dashboard header. A browser without network access or where the provider is blocked by CORS continues in Demo Mode.

## Providers and configuration

`services.js` contains the provider boundary, normalization, per-city cache, stale handling, and deterministic fallback. The public Open-Meteo endpoints need no API key for non-commercial use. For deployment-specific endpoint URLs, set `window.AEROSENSE_CONFIG` **before** loading `services.js`:

Historical requests use the existing Open-Meteo Air Quality endpoint with `past_hours=24` or `past_days=7/30`. Cache entries are scoped to endpoint, city, range, and local date (10 minutes for 24h, 1 hour for 7d, and 3 hours for 30d). A forced refresh bypasses these TTLs.

    window.AEROSENSE_CONFIG = {
      openMeteoAirBaseUrl: "https://air-quality-api.open-meteo.com/v1/air-quality",
      openMeteoWeatherBaseUrl: "https://api.open-meteo.com/v1/forecast",
      osmTileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
    };

A static browser page cannot read `.env` files directly; production build/deployment tooling can inject these public endpoint values from environment variables. Never put private API keys in browser code. `.env.example` is a server/deployment template for future backend integrations.

## Project structure

- `index.html` — landing page and dashboard markup
- `styles.css`, `map.css` — responsive layout, visual system, charts, and geographic map styling
- `history.css` — historical chart metadata and no-data states
- `data.js` — deterministic city, weather, historic, forecast, and event fixtures
- `services.js` — Open-Meteo integration, normalized models, graceful fallback and city/range historical cache
- `prediction.js` — normalized future timestamps, six-hour limit, stale filtering and transparent trend calculation
- `app.js` — rendering, location switching, controls, demo recommendations and navigation
- `map.js` — Leaflet map presentation, city-reference markers, and selection synchronization
- `favicon.svg` — local AeroSense icon
- `.env.example` — deployment/backend configuration template

### Prediction engine

The prediction panel preserves both Open-Meteo's atmospheric provider forecast and an independently trained AeroSense Random Forest. The trained model predicts **one-hour-ahead PM2.5 only**. It is called through the optional FastAPI service; failure or insufficient provider input leaves the provider forecast intact. Demo Mode never claims a model inference: it labels the deterministic provider fixture and says the trained model was not queried. The comparison card includes model version, source provenance, actual holdout metrics and no confidence percentage.

The provider returns only valid timestamps later than the current time, ordered chronologically and capped at six points. If fewer are returned, the UI states the available horizon instead of filling missing hours. PM2.5 and PM10 fixtures are separate; other pollutants are forecast only when the provider returns their future values. A failed live forecast uses the last still-valid cached provider forecast marked stale; if none exists, it uses the deterministic demo fixture, clearly labelled.

Trend is computed from forecast values alone: the mean of the first half of the available horizon is compared with the mean of its later half. A difference must exceed the larger of 0.5 concentration units or 5% of the first-half mean to be called rising/falling. Smaller net differences are stable unless the series has meaningful moves in both directions, in which case it is mixed. This summarizes the series and does not infer causes. Future temperature, humidity, wind speed and pressure are attached to forecast rows when returned, for possible future model use only; no causal claim is made.

The dashboard uses plain HTML, CSS and JavaScript with no frontend build step. The optional prediction service is Python/FastAPI. Leaflet 1.9.4 is loaded from its CDN and geographic tiles use OpenStreetMap standard HTTPS tiles with visible attribution. The five markers indicate city reference coordinates and are not monitoring stations. The map needs network access; if its library or tiles cannot load, the dashboard remains usable and shows a map error state.

#### Trained PM2.5 model

- **Dataset:** India Air Quality Database, XKDR Forum, [dataset portal](https://airquality.xkdr.org/) and [public API documentation](https://github.com/xKDR/Air-Quality-Database/blob/main/docs/PUBLIC_API.md). This training used only CPCB CAAQM station observations, joined to XKDR station metadata; US Embassy/AirNow observations were excluded.
- **Coverage and time:** 242 CPCB cities represented in the downloaded 2024 extract; January 1–December 31, 2024. The hourly city-level response is the median station PM2.5 for each city and hour. The dataset publisher documents CC BY 4.0. Attribution: “India Air Quality Database, XKDR Forum; CPCB CAAQM data.” Raw parquet files are not committed.
- **Target:** next-hour CPCB city-hour median PM2.5, in µg/m³. PM2.5 current value, exact previous-hour lags (1/2/3/6), trailing 3/6-hour summaries, local hour/day/month and city-level coordinates are the features. There are no synthetic weather or pollutant values; missing values remain missing and preprocessing is fit inside the training pipeline.
- **Model:** scikit-learn RandomForestRegressor, model version 1.0.0, with median imputation. Training candidates are selected on validation MAE only. The final model is refit on a deterministic 40,000-row train sample plus up to 20,000 validation rows. The test period is not used for fitting or model selection. Runtime library versions are recorded in the model card; scikit-learn is pinned for artifact compatibility.
- **Chronological split:** train before 2024-09-01 (1,240,201 eligible examples); validation 2024-09-01 to 2024-10-31 (313,320); held-out test 2024-11-01 to 2024-12-31 (323,815). Feature windows only look backward and target is shifted exactly one hour ahead after hourly reindexing; gaps are not interpolated.
- **Held-out test metrics (µg/m³):** Random Forest MAE **8.68**, RMSE **18.60**, R² **0.870**; persistence baseline (next value equals current) MAE **9.28**, RMSE **19.54**, R² **0.857**. The model beats persistence on this dataset's test MAE by about 6.4%; that is an offline evaluation result, not a guarantee of operational accuracy.
- **Artifact and provenance:** `backend/models/pm25_model.joblib` and `backend/models/model_card.json`. The card includes source, license, timestamps, features, splits, counts, and model/baseline metrics.
- **Limitations:** CPCB source values are preliminary and can have gaps/outliers. City-hour aggregation can smooth local variation. The browser currently supplies Open-Meteo hourly PM2.5 as recent input, while training targets are CPCB observations, so this is a source/domain shift and the displayed comparison should be interpreted cautiously. The evaluation is pooled across India and does not establish per-city performance. Only cities represented by CPCB data are accepted. No weather variables or 2–6-hour independent ML horizons are provided. No confidence intervals are calculated.

### Reproducible local development (Windows PowerShell)

Run these commands from the `outputs` project directory. The venv is project-local; no global Python packages are required. The current `backend/requirements.txt` bounds work with Python 3.14, and scikit-learn remains pinned to match the committed model artifact.

    python --version
    python -m venv .venv
    .\.venv\Scripts\Activate.ps1
    python -m pip install --upgrade pip
    python -m pip install -r backend\requirements.txt

If PowerShell blocks activation, use the venv interpreter directly instead of changing machine-wide execution policy:

    .\.venv\Scripts\python.exe -m pip install --upgrade pip
    .\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt

Verify the installed framework and model dependencies:

    python -c "import fastapi; print(fastapi.__version__)"
    python -c "import sklearn, pandas, numpy, joblib, duckdb; print('dependencies OK')"

Start the API in one PowerShell window:

    cd backend
    python -m uvicorn app:app --host 127.0.0.1 --port 8002

In a second PowerShell window, return to `outputs` and start the frontend:

    cd ..
    node serve.cjs

Open `http://localhost:8001/`. The API's `/health`, `/api/model-card`, and `/api/prediction` routes are available on port 8002. The configured CORS allowlist permits the dashboard origins `http://localhost:8001` and `http://127.0.0.1:8001`.

Run the complete backend unittest suite from the `outputs` directory with the venv active:

    python -m unittest discover -s backend -p "test*.py" -v

The test suite loads the committed model and the raw XKDR 2024 dataset. Raw data is excluded from Git; if it is absent, obtain the public data API key as described below and download the data before running dataset-dependent tests.

### Training data and model provenance

To reproduce training, download the public 2024 files first (the XKDR API key is read from `AEROSENSE_DATA_API_KEY` and is never stored):

    python -m pip install -r backend\requirements.txt
    python backend\download_dataset.py
    python backend\train_model.py

The dashboard expects the API at `http://127.0.0.1:8002` by default; set `window.AEROSENSE_CONFIG.mlApiBaseUrl` before `services.js` to override it.

## Validation

    node --check app.js
    node --check data.js
    node --check services.js
    node --check prediction.js
    node --check map.js
    node --test tests/anomaly.test.cjs tests/prediction.test.cjs
    python -m unittest discover -s backend -p "test*.py" -v

There is no TypeScript, lint, or production bundler configured.

## Statistical anomaly detection

`anomaly.js` analyzes the selected pollutant history independently of the dashboard UI. For each observation it compares the value with a preceding-only rolling baseline: up to 12 prior valid hourly observations for 24h, 6 prior daily observations for 7d, or 14 prior daily observations for 30d. It requires at least 6 valid, uniquely timestamped baseline observations; nulls, invalid/missing timestamps, and duplicate timestamps are excluded (the last valid duplicate is retained). Missing values are never converted to zero or interpolated.

The primary method is the rolling median and median absolute deviation (MAD): `robust score = 0.6745 × (current − baseline median) / MAD`. Absolute scores from 2.5 are labelled elevated; scores from 3.5 are anomalous and receive chart markers. These configurable thresholds in `anomaly.js` describe statistical deviation only; they are not medical or health-safety limits. When MAD is zero but baseline standard deviation is nonzero, a median-centered standard-deviation score is used. For a constant baseline, a different current value is classified as an anomaly by exact deviation and no score is shown; identical values are normal. Insufficient history produces no score or marker.

Only the current point is compared against its earlier baseline; historical marker positions use each detected sample's actual timestamp/index. Demo, stale, and historical-model results retain their data-state labels. The method is sensitive to window size and does not establish why a value changed, validate provider measurements, predict future pollution, or establish health risk. **An anomaly indicates an unusual statistical deviation from the selected historical baseline. It does not establish the cause of the change.**

Run detector tests with:

    node --test tests/anomaly.test.cjs
