FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml poetry.lock ./

RUN pip install poetry && \
    poetry config virtualenvs.create false && \
    poetry install --no-dev

COPY . .

CMD uvicorn mt_dashboard_backend.main:app --host 0.0.0.0 --port ${PORT:-8080}