FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    TF_CPP_MIN_LOG_LEVEL=2

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libglib2.0-0 libgl1 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./requirements.txt
RUN python -m pip install --upgrade pip \
    && python -m pip install -r requirements.txt

COPY serve_models.py ./serve_models.py
COPY models/ ./models/
COPY brain_tumor_model.pkl ./brain_tumor_model.pkl

EXPOSE 7860

CMD ["uvicorn", "serve_models:app", "--host", "0.0.0.0", "--port", "7860", "--workers", "1"]
