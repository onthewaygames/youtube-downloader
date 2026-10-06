FROM python:3.11-slim

# FFmpeg kurulumu
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY api.py .

EXPOSE 10000

ENV PORT=10000

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "10000"]
