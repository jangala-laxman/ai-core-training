FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir \
    yfinance==0.2.40 \
    scikit-learn==1.4.2 \
    pandas==2.2.2 \
    numpy==1.26.4 \
    joblib==1.4.2

COPY train.py .

CMD ["python", "train.py"]
