const QUOTE_URL =
  "https://query1.finance.yahoo.com/v7/finance/spark?range=1d&interval=1d&symbols=%5ENSEI,%5EBSESN,BTC-USD,ETH-USD,GC%3DF,INR%3DX,CL%3DF,%5EN225,%5EDJI,RELIANCE.NS,TCS.NS,HDFCBANK.NS";

const INSTRUMENTS = [
  { key: "^NSEI", label: "NIFTY 50", format: "inr" },
  { key: "^BSESN", label: "SENSEX", format: "inr" },
  { key: "BTC-USD", label: "BTC/USD", format: "usd" },
  { key: "ETH-USD", label: "ETH/USD", format: "usd" },
  { key: "GC=F", label: "GOLD", format: "usd" },
  { key: "INR=X", label: "USD/INR", format: "fx" },
  { key: "CL=F", label: "CRUDE OIL", format: "usd" },
  { key: "^N225", label: "NIKKEI", format: "plain" },
  { key: "^DJI", label: "DOW JONES", format: "plain" },
  { key: "RELIANCE.NS", label: "RELIANCE", format: "inr" },
  { key: "TCS.NS", label: "TCS", format: "inr" },
  { key: "HDFCBANK.NS", label: "HDFC BANK", format: "inr" }
];

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: { message: "Method not allowed." } });
  }

  try {
    const upstreamResponse = await fetch(QUOTE_URL, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0",
        "X-Title": "FinanceAI"
      }
    });

    const rawBody = await upstreamResponse.text();
    const data = parseJson(rawBody);

    if (!upstreamResponse.ok) {
      return res.status(upstreamResponse.status).json(data);
    }

    return res.status(200).json({
      items: normalizeTickerItems(data)
    });
  } catch (error) {
    return res.status(500).json({
      error: {
        message: `Ticker request failed: ${error.message || "unknown error"}`
      }
    });
  }
};

function normalizeTickerItems(data) {
  const results = new Map(
    (data?.spark?.result || []).map((item) => [item.symbol, item.response?.[0]?.meta || {}])
  );

  return INSTRUMENTS.map((instrument) => {
    const meta = results.get(instrument.key) || {};
    const current = Number(meta.regularMarketPrice ?? 0);
    const previous = Number(meta.chartPreviousClose ?? current);
    const changePercent = previous ? ((current - previous) / previous) * 100 : 0;

    return {
      s: instrument.label,
      v: formatValue(current, instrument.format),
      c: formatChange(changePercent),
      u: changePercent >= 0 ? 1 : 0
    };
  }).filter((item) => item.v !== "N/A");
}

function formatValue(value, format) {
  if (!Number.isFinite(value) || value <= 0) {
    return "N/A";
  }

  if (format === "usd") {
    return `$${value.toLocaleString("en-US", { maximumFractionDigits: value >= 100 ? 0 : 2 })}`;
  }

  if (format === "inr") {
    return `Rs${value.toLocaleString("en-IN", { maximumFractionDigits: value >= 100 ? 0 : 2 })}`;
  }

  if (format === "fx") {
    return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  return value.toLocaleString("en-US", { maximumFractionDigits: value >= 100 ? 0 : 2 });
}

function formatChange(value) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function parseJson(rawBody) {
  try {
    return JSON.parse(rawBody);
  } catch {
    return {};
  }
}
