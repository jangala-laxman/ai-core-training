FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir \
    scikit-learn==1.4.2 \
    pandas==2.2.2 \
    numpy==1.26.4 \
    joblib==1.4.2 \
    boto3==1.34.0

COPY infer.py .

CMD ["python", "infer.py"]
