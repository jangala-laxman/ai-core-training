import https from 'https';

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          resolve(httpsGet(res.headers.location));
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} from Yahoo Finance`));
          return;
        }
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error(`JSON parse error: ${body.slice(0, 200)}`)); }
      });
    }).on('error', reject);
  });
}

export async function fetchNSEData(tickers, period = '30d') {
  console.log(`Fetching ${period} data for ${tickers.length} tickers...`);

  const rows = [];
  for (const ticker of tickers) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${period}&interval=1d`;
      const json = await httpsGet(url);

      const result = json?.chart?.result?.[0];
      if (!result) {
        console.warn(`  WARNING: No chart result for ${ticker}`);
        continue;
      }

      const timestamps = result.timestamp ?? [];
      const q          = result.indicators?.quote?.[0] ?? {};
      const adjClose   = result.indicators?.adjclose?.[0]?.adjclose;

      for (let i = 0; i < timestamps.length; i++) {
        if (q.open[i] == null) continue;
        rows.push({
          Date:   new Date(timestamps[i] * 1000).toISOString().split('T')[0],
          Open:   q.open[i],
          High:   q.high[i],
          Low:    q.low[i],
          Close:  adjClose?.[i] ?? q.close[i],
          Volume: q.volume[i],
          Ticker: ticker
        });
      }
      console.log(`  ${ticker}: ${timestamps.length} rows`);
    } catch (err) {
      console.warn(`  WARNING: Failed to fetch ${ticker}: ${err.message}`);
    }
  }

  if (rows.length === 0) throw new Error('No data fetched for any ticker. Check your network or ticker symbols.');
  return rows;
}

export function rowsToCsv(rows) {
  const headers = ['Date', 'Open', 'High', 'Low', 'Close', 'Volume', 'Ticker'];
  return [headers.join(','), ...rows.map(r => headers.map(h => r[h]).join(','))].join('\n');
}
