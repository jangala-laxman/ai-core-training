import os
import sys
import json
import traceback
import joblib
import pandas as pd
import yfinance as yf

MODEL_PATH = os.environ.get("MODEL_PATH", "/tmp/input/nse_model.pkl")
TICKER_MAP_PATH = os.environ.get("TICKER_MAP_PATH", "/tmp/input/ticker_map.json")
OUTPUT_PATH = os.environ.get("OUTPUT_PATH", "/tmp/output")

TICKERS_ENV = os.environ.get("TICKERS", "RELIANCE.NS,TCS.NS,INFY.NS,HDFCBANK.NS,WIPRO.NS,LT.NS,ICICIBANK.NS,SBIN.NS")

def flatten_columns(df):
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [col[0] for col in df.columns]
    return df

try:
    tickers = [t.strip() for t in TICKERS_ENV.split(",")]

    print(f"Loading model from: {MODEL_PATH}")
    model = joblib.load(MODEL_PATH)

    with open(TICKER_MAP_PATH) as f:
        ticker_map = json.load(f)

    print(f"Fetching latest data for {len(tickers)} tickers...")

    FEATURES = ["Open", "High", "Low", "Close", "Volume", "HL_Range", "TickerCode"]
    rows = []

    for ticker in tickers:
        df = yf.download(ticker, period="5d", interval="1d", progress=False, auto_adjust=True)
        df = flatten_columns(df)
        if df.empty:
            print(f"  WARNING: No data for {ticker}, skipping.")
            continue

        latest = df.iloc[-1]
        high = float(latest["High"])
        low = float(latest["Low"])
        close = float(latest["Close"])
        hl_range = (high - low) / close if close != 0 else 0
        ticker_code = ticker_map.get(ticker, -1)

        if ticker_code == -1:
            print(f"  WARNING: {ticker} not in training ticker map, skipping.")
            continue

        rows.append({
            "Ticker": ticker,
            "Open": float(latest["Open"]),
            "High": high,
            "Low": low,
            "Close": close,
            "Volume": float(latest["Volume"]),
            "HL_Range": hl_range,
            "TickerCode": ticker_code,
            "AsOf": str(df.index[-1].date())
        })
        print(f"  {ticker}: Close={close:.2f}, as of {df.index[-1].date()}")

    if not rows:
        raise RuntimeError("No live data fetched. Cannot generate recommendations.")

    df_live = pd.DataFrame(rows)
    X_live = df_live[FEATURES]

    probs = model.predict_proba(X_live)[:, 1]
    df_live["BuyScore"] = probs
    df_live["Rank"] = df_live["BuyScore"].rank(ascending=False).astype(int)

    ranked = df_live.sort_values("BuyScore", ascending=False).reset_index(drop=True)

    result = {
        "top_pick": {
            "ticker": ranked.iloc[0]["Ticker"],
            "buy_score": round(float(ranked.iloc[0]["BuyScore"]), 4),
            "close_price": round(float(ranked.iloc[0]["Close"]), 2),
            "as_of": ranked.iloc[0]["AsOf"]
        },
        "all_scores": [
            {
                "rank": int(row["Rank"]),
                "ticker": row["Ticker"],
                "buy_score": round(float(row["BuyScore"]), 4),
                "close_price": round(float(row["Close"]), 2),
                "signal": "BUY" if row["BuyScore"] >= 0.6 else "HOLD" if row["BuyScore"] >= 0.45 else "AVOID",
                "as_of": row["AsOf"]
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
