#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MedSync ML Service
FastAPI service for medical image analysis using ML models
"""

from pathlib import Path
import io
import os
import pickle
import secrets
import sys
import tempfile
from typing import Any, Dict, Optional, Tuple

import cv2
import numpy as np
import timm
import torch
from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from torchvision import transforms
from ultralytics import YOLO
from dotenv import load_dotenv

# Load environment variables from project root
env_path = Path(__file__).resolve().parent.parent / ".env.local"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv() # Fallback to default .env

# Ensure console output can handle Unicode log messages on Windows.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# Initialize Limiter
limiter = Limiter(key_func=get_remote_address)
app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# The browser never calls this service directly; the Next.js backend proxies requests.
# Keep the sole browser origin pinned to the production app domain.
allow_origins = ["https://medsync.health"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# New X-ray ensemble artifacts from project models folder.
MODEL_DIR = Path(__file__).resolve().parent / "models"
EFFNET_CKPT = MODEL_DIR / "best_effnet_v4.pth"
YOLO_CKPT = MODEL_DIR / "best.pt"

ENSEMBLE_CONFIG = {
    "effnet_threshold": 0.6623,
    "yolo_conf": 0.15,
    "yolo_iou": 0.45,
    "yolo_imgsz": 640,
    "effnet_weight": 0.45,
    "yolo_weight": 0.55,
    "final_threshold": 0.50,
    "border_crop_pct": 0.04,
}

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

infer_transform = transforms.Compose(
    [
        transforms.Resize((260, 260)),
        transforms.Grayscale(num_output_channels=3),
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ]
)


def remove_xray_border(pil_img: Image.Image, pct: float = ENSEMBLE_CONFIG["border_crop_pct"]) -> Image.Image:
    img = np.array(pil_img)
    h, w = img.shape[:2]
    mh, mw = int(h * pct), int(w * pct)
    if h <= 2 * mh or w <= 2 * mw:
        return pil_img
    return Image.fromarray(img[mh : h - mh, mw : w - mw])


def apply_clahe(pil_img: Image.Image) -> Image.Image:
    img_np = np.array(pil_img.convert("L"))
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(img_np)
    return remove_xray_border(Image.fromarray(enhanced))


def load_effnet(ckpt_path: Path):
    ckpt = torch.load(ckpt_path, map_location=device, weights_only=False)
    cfg = ckpt["config"]
    model = timm.create_model(
        cfg["model_name"],
        pretrained=False,
        num_classes=cfg["num_classes"],
        drop_rate=cfg["drop_rate"],
    )
    model.load_state_dict(ckpt["model_state"])
    model = model.to(device).eval()
    print(f"Loaded EfficientNet checkpoint from {ckpt_path}")
    return model


def run_effnet(image_clahe: Image.Image) -> float:
    tensor = infer_transform(image_clahe).unsqueeze(0).to(device)
    with torch.no_grad():
        probs = torch.softmax(xray_effnet_model(tensor), dim=1)[0].cpu().numpy()
    return float(probs[1])


def run_yolo(image_bytes: bytes) -> Tuple[float, list, int, int]:
    with Image.open(io.BytesIO(image_bytes)) as pil_image:
        image_width, image_height = pil_image.size

    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        tmp.write(image_bytes)
        temp_path = tmp.name

    detections = []
    try:
        results = xray_yolo_model.predict(
            source=temp_path,
            conf=ENSEMBLE_CONFIG["yolo_conf"],
            iou=ENSEMBLE_CONFIG["yolo_iou"],
            imgsz=ENSEMBLE_CONFIG["yolo_imgsz"],
            verbose=False,
        )
        result = results[0]
        if result.boxes is not None and len(result.boxes) > 0:
            for box in result.boxes:
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                confidence = float(box.conf[0].cpu())
                detections.append(
                    {
                        "confidence": round(confidence, 3),
                        "bbox": [int(x1), int(y1), int(x2), int(y2)],
                    }
                )
        yolo_score = max((d["confidence"] for d in detections), default=0.0)
        return yolo_score, detections, image_width, image_height
    finally:
        try:
            os.remove(temp_path)
        except OSError:
            pass


def ensemble_decision(effnet_score: float, yolo_score: float) -> Dict[str, Any]:
    w_e = ENSEMBLE_CONFIG["effnet_weight"]
    w_y = ENSEMBLE_CONFIG["yolo_weight"]
    score = (w_e * effnet_score) + (w_y * yolo_score)

    effnet_pred = effnet_score >= ENSEMBLE_CONFIG["effnet_threshold"]
    yolo_pred = yolo_score >= ENSEMBLE_CONFIG["yolo_conf"]
    models_agree = effnet_pred == yolo_pred
    uncertain = (not models_agree) or (0.40 <= score <= 0.65)
    fracture = score >= ENSEMBLE_CONFIG["final_threshold"]

    return {
        "score": score,
        "fracture": fracture,
        "uncertain": uncertain,
        "models_agree": models_agree,
    }


def preprocess_mri_image(image_bytes: bytes) -> Optional[np.ndarray]:
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB").resize((150, 150))
        arr = np.array(image) / 255.0
        return arr.reshape(1, 150, 150, 3)
    except Exception as exc:
        print(f"Error preprocessing MRI image: {exc}")
        return None


def get_prediction_and_confidence(model, arr: np.ndarray) -> Tuple[int, float]:
    try:
        pred_raw = model.predict(arr, verbose=0)
        if pred_raw.shape[1] == 1:
            predicted_class = int(pred_raw[0][0] > 0.5)
            confidence = pred_raw[0][0] if predicted_class == 1 else 1 - pred_raw[0][0]
        else:
            predicted_class = int(np.argmax(pred_raw[0]))
            confidence = float(np.max(pred_raw[0]))
        return predicted_class, float(confidence)
    except Exception as exc:
        print(f"Error in MRI prediction: {exc}")
        return 0, 0.5


# Load X-ray ensemble models
try:
    xray_effnet_model = load_effnet(EFFNET_CKPT)
    xray_yolo_model = YOLO(str(YOLO_CKPT))
    xray_models_ready = True
    print("Loaded X-ray ensemble models successfully")
except Exception as exc:
    print(f"Error loading X-ray ensemble models: {exc}")
    xray_effnet_model = None
    xray_yolo_model = None
    xray_models_ready = False

# Keep existing MRI model behavior
try:
    mri_model_path = MODEL_DIR.parent / "brain_tumor_model.pkl"
    with open(mri_model_path, "rb") as f:
        brain_tumor_wrapped = pickle.load(f)
        mri_model = brain_tumor_wrapped["model"]
    print(f"Loaded brain tumor model successfully from {mri_model_path}")
except Exception as exc:
    print(f"Error loading brain tumor model: {exc}")
    mri_model = None


@app.post("/analyze")
@limiter.limit("20/minute")
def analyze(request: Request, scan_type: str = Form(...), file: UploadFile = File(...)):
    """Analyze medical images using appropriate ML models"""
    internal_secret = request.headers.get("X-Internal-Secret")
    expected_secret = os.getenv("INTERNAL_API_KEY")

    if not expected_secret:
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=500,
            content={
                "error": "Server misconfiguration",
                "severity": "critical",
                "findings": "INTERNAL_API_KEY is not configured on the ML service.",
                "confidence": 0.0,
                "recommendations": "Set the INTERNAL_API_KEY environment variable.",
            },
        )

    if not internal_secret or not secrets.compare_digest(internal_secret, expected_secret):
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=401,
            content={
                "error": "Unauthorized",
                "severity": "critical",
                "findings": "Access denied: Invalid credentials.",
                "confidence": 0.0,
                "recommendations": "Please contact system administrator.",
            },
        )

    try:
        image_bytes = file.file.read()
        scan_kind = scan_type.lower()

        if scan_kind in ["xray", "x_ray", "chest_xray", "bone_xray"]:
            if not xray_models_ready:
                return {
                    "error": "X-ray model not available",
                    "findings": "X-ray analysis model is not loaded.",
                    "confidence": 0.0,
                    "recommendations": "Please contact system administrator.",
                    "severity": "unknown",
                }

            pil_orig = Image.open(io.BytesIO(image_bytes)).convert("L")
            pil_clahe = apply_clahe(pil_orig)
            effnet_score = run_effnet(pil_clahe)
            yolo_score, detections, image_width, image_height = run_yolo(image_bytes)
            decision = ensemble_decision(effnet_score, yolo_score)

            fracture_risk_score = float(decision["score"])
            pred = 1 if decision["fracture"] else 0
            uncertain = bool(decision["uncertain"])
            # Confidence should represent certainty in the predicted class.
            # For non-fracture predictions, invert the fracture risk score.
            confidence = fracture_risk_score if pred == 1 else (1.0 - fracture_risk_score)

            if uncertain:
                findings = (
                    "X-ray analysis is uncertain due to disagreement between ensemble models. "
                    "Radiologist review is recommended."
                )
                severity = "moderate"
                recommendations = "Models disagree; radiologist review required. This is decision support, not a diagnosis."
            elif pred == 1:
                findings = "High probability of bone fracture or significant abnormality detected in the X-ray image."
                severity = "severe" if confidence > 0.8 else "moderate"
                recommendations = "Flagged for priority clinician review. This is decision support, not a diagnosis."
            else:
                findings = "No fracture or abnormality flagged by the model in the X-ray image."
                severity = "none"
                recommendations = "Clinician review required. This is decision support, not a diagnosis."

            return {
                "findings": findings,
                "confidence": round(confidence, 3),
                "recommendations": recommendations,
                "severity": severity,
                "model_used": "xray_ensemble",
                "prediction": pred,
                "details": {
                    "effnet_score": round(float(effnet_score), 3),
                    "yolo_score": round(float(yolo_score), 3),
                    "models_agree": bool(decision["models_agree"]),
                    "uncertain": uncertain,
                    "uncertainty_reason": (
                        "Model disagreement and/or borderline ensemble score"
                        if uncertain
                        else "No major model disagreement detected"
                    ),
                    "ensemble_score": round(fracture_risk_score, 3),
                    "fracture_risk_score": round(fracture_risk_score, 3),
                    "predicted_class_confidence": round(float(confidence), 3),
                    "image_width": image_width,
                    "image_height": image_height,
                    "detections": detections,
                },
            }

        if scan_kind in ["mri", "mri_brain", "brain_mri"]:
            if mri_model is None:
                return {
                    "error": "MRI model not available",
                    "findings": "MRI analysis model is not loaded.",
                    "confidence": 0.0,
                    "recommendations": "Please contact system administrator.",
                    "severity": "unknown",
                }

            arr = preprocess_mri_image(image_bytes)
            if arr is None:
                return {
                    "error": "Failed to preprocess image",
                    "findings": "Image processing failed. Please check image format.",
                    "confidence": 0.0,
                    "recommendations": "Please upload a valid medical image.",
                    "severity": "unknown",
                }

            pred, confidence = get_prediction_and_confidence(mri_model, arr)
            if pred == 1:
                findings = "Possible brain tumor or mass lesion flagged by the model in the MRI scan."
                severity = "critical" if confidence > 0.8 else "severe"
                recommendations = "Flagged for urgent clinician review. This is decision support, not a diagnosis."
            else:
                findings = "No tumor or abnormality flagged by the model in the MRI scan."
                severity = "none"
                recommendations = "Clinician review required. This is decision support, not a diagnosis."

            return {
                "findings": findings,
                "confidence": round(float(confidence), 3),
                "recommendations": recommendations,
                "severity": severity,
                "model_used": "mri_keras",
                "prediction": int(pred),
            }

        return {
            "error": "Unsupported scan type",
            "findings": f"No AI model is available for {scan_type} scans. Please review manually.",
            "confidence": 0.0,
            "recommendations": "Manual clinician review required.",
            "severity": "unknown",
            "model_used": None,
        }

    except Exception as exc:
        print(f"Error in analysis: {exc}")
        return {
            "error": "Analysis failed",
            "findings": "AI analysis encountered an error. Please review manually.",
            "confidence": 0.0,
            "recommendations": "Manual review recommended.",
            "severity": "unknown",
        }


@app.get("/health")
async def health_check():
    """Report readiness of each model artifact, not merely process liveness."""
    from fastapi.responses import JSONResponse

    models = {
        "xray_effnet": xray_effnet_model is not None,
        "xray_yolo": xray_yolo_model is not None,
        "mri": mri_model is not None,
    }
    ready = all(models.values()) and xray_models_ready
    result = {
        "status": "ready" if ready else "not_ready",
        "ready": ready,
        "models": models,
        # Keep the previous aggregate keys for existing health consumers.
        "xray_model_loaded": xray_models_ready,
        "mri_model_loaded": models["mri"],
    }
    return result if ready else JSONResponse(status_code=503, content=result)


if __name__ == "__main__":
    import uvicorn

    print("Starting MedSync ML Service")
    print("Service will be available at: http://localhost:8000")
    print("Health check: http://localhost:8000/health")
    uvicorn.run(app, host="0.0.0.0", port=8000)
