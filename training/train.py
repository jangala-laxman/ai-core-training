import os
import json
import joblib
import pandas as pd
import yfinance as yf
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

OUTPUT_PATH = os.environ.get("OUTPUT_PATH", "/tmp/output")
TICKERS_ENV = os.environ.get("TICKERS", "RELIANCE.NS,TCS.NS,INFY.NS,HDFCBANK.NS,WIPRO.NS,LT.NS,ICICIBANK.NS,SBIN.NS")
PERIOD = os.environ.get("PERIOD", "30d")

tickers = [t.strip() for t in TICKERS_ENV.split(",")]

print(f"Fetching {PERIOD} data for {len(tickers)} tickers: {tickers}")

frames = []
for ticker in tickers:
    df = yf.download(ticker, period=PERIOD, interval="1d", progress=False)
    if df.empty:
        print(f"WARNING: No data for {ticker}, skipping.")
        continue

    df = df[["Open", "High", "Low", "Close", "Volume"]].copy()
    df.columns = ["Open", "High", "Low", "Close", "Volume"]
    df["Ticker"] = ticker
    df["Return"] = df["Close"].pct_change()
    df["HL_Range"] = (df["High"] - df["Low"]) / df["Close"]
    df["Signal"] = (df["Return"].shift(-1) > 0).astype(int)
    frames.append(df)
    print(f"  {ticker}: {len(df)} rows fetched")

if not frames:
    raise RuntimeError("No data fetched for any ticker. Check network or ticker symbols.")

data = pd.concat(frames).dropna()
data["TickerCode"] = pd.factorize(data["Ticker"])[0]

print(f"\nTotal training rows: {len(data)}")
print(f"Date range: {data.index.min()} to {data.index.max()}")
print(f"Tickers used: {data['Ticker'].unique().tolist()}")

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
        "accuracy": round(accuracy, 4),
        "tickers": tickers,
        "features": FEATURES,
        "period": PERIOD,
        "rows_trained": len(data),
        "date_range": {
            "start": str(data.index.min()),
            "end": str(data.index.max())
        }
    }, f, indent=2)

print(f"\nARTIFACT_SAVED: {OUTPUT_PATH}/nse_model.pkl")
print(f"TICKER_MAP_SAVED: {OUTPUT_PATH}/ticker_map.json")
print(f"META_SAVED: {OUTPUT_PATH}/model_meta.json")
print("Training complete.")
