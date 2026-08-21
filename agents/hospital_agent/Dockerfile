FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY shared/ ./shared/
COPY agents/hospital_agent/ ./agents/hospital_agent/
CMD ["uvicorn", "agents.hospital_agent.main:app", "--host", "0.0.0.0", "--port", "8002"]
