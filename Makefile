.PHONY: up down api web migrate ingest fmt

up:
	docker compose up -d

down:
	docker compose down

migrate:
	cd apps/api && alembic upgrade head

ingest:
	cd apps/api && python -m app.ingestion.jobs.sync_symbols && python -m app.ingestion.jobs.ingest_bhavcopy

api:
	cd apps/api && uvicorn app.main:app --reload --port $${API_PORT:-8000}

web:
	cd apps/web && npm run dev

fmt:
	cd apps/api && ruff check --fix . && ruff format .
	cd apps/web && npm run lint -- --fix
