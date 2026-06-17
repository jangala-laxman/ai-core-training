import yahooFinance from 'yahoo-finance2';

export async function fetchNSEData(tickers, period = '30d') {
  const days = parseInt(period.replace(/\D/g, ''), 10) || 30;
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const p1 = startDate.toISOString().split('T')[0];
  const p2 = endDate.toISOString().split('T')[0];

  console.log(`Fetching ${period} data (${p1} → ${p2}) for ${tickers.length} tickers...`);

  const rows = [];
  for (const ticker of tickers) {
    try {
      const result = await yahooFinance.historical(ticker, { period1: p1, period2: p2, interval: '1d' });
      for (const day of result) {
        rows.push({
          Date:   day.date.toISOString().split('T')[0],
          Open:   day.open,
          High:   day.high,
          Low:    day.low,
          Close:  day.adjClose ?? day.close,
          Volume: day.volume,
          Ticker: ticker
        });
      }
      console.log(`  ${ticker}: ${result.length} rows`);
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
