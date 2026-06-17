import os
import sys
import json
import traceback
import urllib.request
import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

DATA_URL    = os.environ.get("DATA_URL")
DATA_PATH   = "/tmp/training_data.csv"
OUTPUT_PATH = os.environ.get("OUTPUT_PATH", "/tmp/output")
TICKERS_ENV = os.environ.get("TICKERS", "RELIANCE.NS,TCS.NS,INFY.NS,HDFCBANK.NS,WIPRO.NS,LT.NS,ICICIBANK.NS,SBIN.NS")
PERIOD      = os.environ.get("PERIOD", "30d")

try:
    if not DATA_URL:
        raise RuntimeError("DATA_URL environment variable is not set")

    print(f"Downloading training data from presigned URL...")
    urllib.request.urlretrieve(DATA_URL, DATA_PATH)
    print(f"Download complete: {DATA_PATH}")

    data = pd.read_csv(DATA_PATH, index_col="Date", parse_dates=True)
    print(f"Loaded {len(data)} rows, columns: {data.columns.tolist()}")

    tickers = data["Ticker"].unique().tolist()
    print(f"Tickers in data: {tickers}")

    data["Return"]   = data.groupby("Ticker")["Close"].pct_change()
    data["HL_Range"] = (data["High"] - data["Low"]) / data["Close"]
    data["Signal"]   = (
        data.groupby("Ticker")["Return"]
            .transform(lambda x: x.shift(-1))
            .gt(0)
            .astype(int)
    )
    data = data.dropna()
    data["TickerCode"] = pd.factorize(data["Ticker"])[0]

    print(f"\nTotal training rows: {len(data)}")
    print(f"Date range: {data.index.min()} to {data.index.max()}")

    FEATURES = ["Open", "High", "Low", "Close", "Volume", "HL_Range", "TickerCode"]
    X = data[FEATURES]
    y = data["Signal"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
    model.fit(X_train, y_train)

    accuracy = accuracy_score(y_test, model.predict(X_test))
    print(f"\nModel accuracy on test set: {accuracy:.4f}")
    print(f"Feature importances: {dict(zip(FEATURES, model.feature_importances_.round(4)))}")

    ticker_map = {t: i for i, t in enumerate(data["Ticker"].unique())}

    os.makedirs(OUTPUT_PATH, exist_ok=True)
    joblib.dump(model, os.path.join(OUTPUT_PATH, "nse_model.pkl"))
    with open(os.path.join(OUTPUT_PATH, "ticker_map.json"), "w") as f:
        json.dump(ticker_map, f)
    with open(os.path.join(OUTPUT_PATH, "model_meta.json"), "w") as f:
        json.dump({
            "accuracy":     round(accuracy, 4),
            "tickers":      tickers,
            "features":     FEATURES,
            "period":       PERIOD,
            "rows_trained": len(data),
            "date_range": {
                "start": str(data.index.min()),
                "end":   str(data.index.max())
            }
        }, f, indent=2)

    print(f"\nARTIFACT_SAVED: {OUTPUT_PATH}/nse_model.pkl")
    print(f"TICKER_MAP_SAVED: {OUTPUT_PATH}/ticker_map.json")
    print(f"META_SAVED: {OUTPUT_PATH}/model_meta.json")
    print("Training complete.")

except Exception as e:
    print(f"\nFATAL ERROR: {e}", file=sys.stderr)
    traceback.print_exc(file=sys.stderr)
    sys.exit(1)
