"""FastAPI inference service. Run from backend with: uvicorn app:app --port 8002"""
import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from inference import ARTIFACT, PredictionError, load_artifact, predict

app = FastAPI(title="AeroSense prediction API", version="1.0.0")
origins = os.environ.get("AEROSENSE_CORS_ORIGINS", "http://localhost:8001,http://127.0.0.1:8001,http://localhost:8000,http://127.0.0.1:8000").split(",")
app.add_middleware(CORSMiddleware, allow_origins=[origin.strip() for origin in origins if origin.strip()], allow_methods=["GET", "POST"], allow_headers=["Content-Type"])


class Observation(BaseModel):
    time: str
    pm25: float


class PredictionRequest(BaseModel):
    city: str
    latitude: float
    longitude: float
    history: list[Observation]
    input_source: str = "Open-Meteo historical air-quality model series"


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": ARTIFACT.exists()}


@app.get("/api/model-card")
def model_card():
    try:
        return load_artifact()["metadata"]
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/api/prediction")
def prediction(body: PredictionRequest):
    try:
        return predict(body.model_dump())
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except PredictionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
