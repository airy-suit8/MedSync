---
title: MedSync ML Service
emoji: 🩺
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
pinned: false
---

# MedSync ML Service

FastAPI service for MedSync's X-ray ensemble (EfficientNet + YOLOv8) and brain MRI model.

The service exposes `GET /health` for model readiness and `POST /analyze` for authenticated image analysis. Set `INTERNAL_API_KEY` as a Hugging Face Space secret before exposing the service to callers.

The model files are expected at `models/best_effnet_v4.pth`, `models/best.pt`, and `brain_tumor_model.pkl`.
