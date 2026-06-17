import os
import sys
import json
import traceback
import urllib.request
import boto3
import joblib
import pandas as pd

DATA_URL          = os.environ.get("DATA_URL")
MODEL_S3_KEY      = os.environ.get("MODEL_S3_KEY")
TICKER_MAP_S3_KEY = os.environ.get("TICKER_MAP_S3_KEY")
S3_BUCKET         = os.environ.get("S3_BUCKET")
S3_REGION         = os.environ.get("S3_REGION", "us-east-1")
MODEL_PATH        = "/tmp/input/nse_model.pkl"
TICKER_MAP_PATH   = "/tmp/input/ticker_map.json"
DATA_PATH         = "/tmp/inference_data.csv"
OUTPUT_PATH       = os.environ.get("OUTPUT_PATH", "/tmp/output")
TICKERS_ENV       = os.environ.get("TICKERS", "RELIANCE.NS,TCS.NS,INFY.NS,HDFCBANK.NS,WIPRO.NS,LT.NS,ICICIBANK.NS,SBIN.NS")

try:
    if not DATA_URL:
        raise RuntimeError("DATA_URL environment variable is not set")
    if not MODEL_S3_KEY or not S3_BUCKET:
        raise RuntimeError("MODEL_S3_KEY and S3_BUCKET must be set")

    print(f"Downloading model artifacts from S3...")
    os.makedirs("/tmp/input", exist_ok=True)
    s3 = boto3.client("s3", region_name=S3_REGION)
    s3.download_file(S3_BUCKET, MODEL_S3_KEY, MODEL_PATH)
    s3.download_file(S3_BUCKET, TICKER_MAP_S3_KEY, TICKER_MAP_PATH)
    print(f"  Model: {MODEL_S3_KEY}")
    print(f"  Ticker map: {TICKER_MAP_S3_KEY}")

    print(f"Downloading inference data from presigned URL...")
    urllib.request.urlretrieve(DATA_URL, DATA_PATH)
    print(f"Download complete: {DATA_PATH}")

    model = joblib.load(MODEL_PATH)
    with open(TICKER_MAP_PATH) as f:
        ticker_map = json.load(f)

    data = pd.read_csv(DATA_PATH, index_col="Date", parse_dates=True)
    tickers = [t.strip() for t in TICKERS_ENV.split(",")]

    FEATURES = ["Open", "High", "Low", "Close", "Volume", "HL_Range", "TickerCode"]
    rows = []

    for ticker in tickers:
        ticker_data = data[data["Ticker"] == ticker].copy()
        if ticker_data.empty:
            print(f"  WARNING: No data for {ticker}, skipping.")
            continue

        ticker_data["HL_Range"] = (ticker_data["High"] - ticker_data["Low"]) / ticker_data["Close"]
        latest = ticker_data.iloc[-1]
        ticker_code = ticker_map.get(ticker, -1)
        if ticker_code == -1:
            print(f"  WARNING: {ticker} not in training ticker map, skipping.")
            continue

        high  = float(latest["High"])
        low   = float(latest["Low"])
        close = float(latest["Close"])
        rows.append({
            "Ticker":     ticker,
            "Open":       float(latest["Open"]),
            "High":       high,
            "Low":        low,
            "Close":      close,
            "Volume":     float(latest["Volume"]),
            "HL_Range":   (high - low) / close if close != 0 else 0,
            "TickerCode": ticker_code,
            "AsOf":       str(ticker_data.index[-1].date())
        })
        print(f"  {ticker}: Close={close:.2f}, as of {ticker_data.index[-1].date()}")

    if not rows:
        raise RuntimeError("No live data available for inference.")

    df_live  = pd.DataFrame(rows)
    probs    = model.predict_proba(df_live[FEATURES])[:, 1]
    df_live["BuyScore"] = probs
    df_live["Rank"]     = df_live["BuyScore"].rank(ascending=False).astype(int)
    ranked   = df_live.sort_values("BuyScore", ascending=False).reset_index(drop=True)

    result = {
        "top_pick": {
            "ticker":      ranked.iloc[0]["Ticker"],
            "buy_score":   round(float(ranked.iloc[0]["BuyScore"]), 4),
            "close_price": round(float(ranked.iloc[0]["Close"]), 2),
            "as_of":       ranked.iloc[0]["AsOf"]
        },
        "all_scores": [
            {
                "rank":        int(row["Rank"]),
                "ticker":      row["Ticker"],
                "buy_score":   round(float(row["BuyScore"]), 4),
                "close_price": round(float(row["Close"]), 2),
                "signal":      "BUY" if row["BuyScore"] >= 0.6 else "HOLD" if row["BuyScore"] >= 0.45 else "AVOID",
                "as_of":       row["AsOf"]
            }
            for _, row in ranked.iterrows()
        ]
    }

    os.makedirs(OUTPUT_PATH, exist_ok=True)
    output_file = os.path.join(OUTPUT_PATH, "recommendations.json")
    with open(output_file, "w") as f:
        json.dump(result, f, indent=2)

    print(f"\n=== TOP PICK: {result['top_pick']['ticker']} (score: {result['top_pick']['buy_score']}) ===")
    print("\nFull Rankings:")
    for s in result["all_scores"]:
        print(f"  {s['rank']}. {s['ticker']:<20} Score: {s['buy_score']:.4f}  Signal: {s['signal']}")

    print(f"\nRECOMMENDATIONS_SAVED: {output_file}")
    print("Inference complete.")

except Exception as e:
    print(f"\nFATAL ERROR: {e}", file=sys.stderr)
    traceback.print_exc(file=sys.stderr)
    sys.exit(1)
