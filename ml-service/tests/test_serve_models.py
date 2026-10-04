import io
import sys
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import serve_models as service

client = TestClient(service.app)


def image_bytes(mode="RGB", size=(24, 16), color=(80, 90, 100)):
    stream = io.BytesIO()
    Image.new(mode, size, color).save(stream, format="PNG")
    return stream.getvalue()


@pytest.mark.parametrize("fraction", [0, 0.04, 0.2, 0.49, 0.9])
def test_remove_xray_border_small_and_boundary_images(fraction):
    source = Image.new("L", (10, 8), 1)
    result = service.remove_xray_border(source, fraction)
    assert result.size[0] > 0 and result.size[1] > 0
    if fraction == 0:
        assert result.size == source.size


def test_apply_clahe_accepts_rgb_and_grayscale():
    for mode in ("RGB", "L"):
        result = service.apply_clahe(Image.new(mode, (64, 48), 80))
        assert result.mode == "L"
        assert result.size[0] > 0 and result.size[1] > 0


@pytest.mark.parametrize("payload", [b"", b"truncated image", b"\x00" * 20])
def test_preprocess_mri_rejects_invalid_bytes(payload):
    assert service.preprocess_mri_image(payload) is None


def test_preprocess_mri_normalizes_shape_and_dtype():
    arr = service.preprocess_mri_image(image_bytes())
    assert arr.shape == (1, 150, 150, 3)
    assert np.issubdtype(arr.dtype, np.floating)
    assert arr.min() >= 0 and arr.max() <= 1


@pytest.mark.parametrize(
    "eff,yolo,fracture,agree",
    [(0.1, 0.0, False, True), (0.9, 0.8, True, True), (0.9, 0.0, False, False), (0.5, 0.15, False, False)],
)
def test_ensemble_decision_boundaries(eff, yolo, fracture, agree):
    result = service.ensemble_decision(eff, yolo)
    assert result["fracture"] is fracture
    assert result["models_agree"] is agree
    assert result["score"] == pytest.approx(eff * 0.45 + yolo * 0.55)


class PredictionModel:
    def __init__(self, values):
        self.values = np.asarray(values)

    def predict(self, _arr, verbose=0):
        return self.values


@pytest.mark.parametrize("values,expected", [([[0.8]], (1, 0.8)), ([[0.2]], (0, 0.8)), ([[0.1, 0.9]], (1, 0.9)), ([[0.7, 0.3]], (0, 0.7))])
def test_prediction_confidence_binary_and_multiclass(values, expected):
    assert service.get_prediction_and_confidence(PredictionModel(values), np.zeros((1,))) == pytest.approx(expected)


def test_prediction_failure_returns_safe_default():
    class Broken:
        def predict(self, *_args, **_kwargs):
            raise RuntimeError("inference error")
    assert service.get_prediction_and_confidence(Broken(), np.zeros((1,))) == (0, 0.5)


def test_analyze_rejects_missing_or_invalid_internal_secret(monkeypatch):
    monkeypatch.setenv("INTERNAL_API_KEY", "expected")
    missing = client.post("/analyze", data={"scan_type": "other"}, files={"file": ("a.png", image_bytes())})
    wrong = client.post("/analyze", headers={"X-Internal-Secret": "wrong"}, data={"scan_type": "other"}, files={"file": ("a.png", image_bytes())})
    assert missing.status_code == 401
    assert wrong.status_code == 401
    assert missing.json()["error"] == wrong.json()["error"] == "Unauthorized"


def test_analyze_reports_missing_server_secret(monkeypatch):
    monkeypatch.delenv("INTERNAL_API_KEY", raising=False)
    response = client.post("/analyze", data={"scan_type": "other"}, files={"file": ("a.png", image_bytes())})
    assert response.status_code == 500
    assert response.json()["error"] == "Server misconfiguration"


def test_analyze_valid_other_scan_without_model_inference(monkeypatch):
    monkeypatch.setenv("INTERNAL_API_KEY", "expected")
    response = client.post("/analyze", headers={"X-Internal-Secret": "expected"}, data={"scan_type": "blood_test"}, files={"file": ("report.txt", b"text")})
    assert response.status_code == 200
    assert response.json()["model_used"] == "blood_test"


def test_health_endpoint_reports_each_model_ready(monkeypatch):
    monkeypatch.setattr(service, "xray_effnet_model", object())
    monkeypatch.setattr(service, "xray_yolo_model", object())
    monkeypatch.setattr(service, "mri_model", object())
    monkeypatch.setattr(service, "xray_models_ready", True)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ready",
        "ready": True,
        "models": {"xray_effnet": True, "xray_yolo": True, "mri": True},
        "xray_model_loaded": True,
        "mri_model_loaded": True,
    }


def test_health_is_unready_if_any_model_is_missing(monkeypatch):
    monkeypatch.setattr(service, "xray_effnet_model", object())
    monkeypatch.setattr(service, "xray_yolo_model", None)
    monkeypatch.setattr(service, "mri_model", object())
    monkeypatch.setattr(service, "xray_models_ready", False)
    response = client.get("/health")
    assert response.status_code == 503
    assert response.json()["ready"] is False
    assert response.json()["models"] == {"xray_effnet": True, "xray_yolo": False, "mri": True}


def test_cors_allows_only_production_app_origin():
    assert service.allow_origins == ["https://medsync.health"]
