# Optional — Render can build this natively from render.yaml. Use this for Docker-based
# hosts (Fly, Railway, Render "Docker" runtime, a VPS).
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PIP_NO_CACHE_DIR=1

WORKDIR /app
COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install .

COPY . .

EXPOSE 8000
# Run migrations then serve. $PORT is provided by most PaaS; default 8000 locally.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
