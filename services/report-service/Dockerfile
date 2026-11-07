FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    XDG_CACHE_HOME=/tmp/climateguard-report-cache

# Native WeasyPrint stack, image codecs and fonts for Spanish PDF documents.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 libcairo2 libpango-1.0-0 libpangoft2-1.0-0 \
    libpangocairo-1.0-0 libharfbuzz0b libharfbuzz-subset0 libffi8 \
    libjpeg62-turbo libopenjp2-7 fontconfig fonts-dejavu-core fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Preserve the directory depth expected by app/config.py (parents[3]).
WORKDIR /opt/climateguard/services/report-service
COPY requirements.txt ./
RUN python -m pip install --no-cache-dir -r requirements.txt

RUN groupadd --gid 10001 reports \
    && useradd --uid 10001 --gid reports --no-create-home reports
COPY --chown=reports:reports app ./app
RUN mkdir -p app/generated "$XDG_CACHE_HOME" \
    && chown reports:reports app/generated "$XDG_CACHE_HOME"
USER reports

EXPOSE 8000
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
