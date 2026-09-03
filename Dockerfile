# PROVENANCE — container image for hosted deployment (any Docker platform:
# Railway, Fly.io, Render, Hugging Face Spaces, a VPS).
#
# The 1.5GB registry DB is not baked into the image. Provide it one of two
# ways:
#   1. Set MCA_DB_URL to a direct-download link (e.g. a GitHub release
#      asset) — scripts/fetch_db.py downloads it to a volume on first boot.
#   2. Mount a volume that already contains mca.duckdb and set
#      PROVENANCE_DB to its path.
#
# LLM key: set the same variables as .env.example (ANTHROPIC_API_KEY,
# ANTHROPIC_BASE_URL, PROVENANCE_LLM_MODEL) as platform secrets. With no
# key the app runs in mock mode — fully functional, deterministic.

FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt anthropic

COPY . .

ENV PROVENANCE_DB=/data/mca.duckdb
ENV PORT=8321

CMD ["sh", "-c", "python scripts/fetch_db.py && python -m uvicorn app:app --host 0.0.0.0 --port ${PORT}"]
