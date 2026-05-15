const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL_ID = "openrouter/auto";
const FALLBACK_MODELS = [];

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: { message: "Method not allowed." } });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: {
        message: "Missing OPENROUTER_API_KEY on the server. Add it in Vercel Project Settings > Environment Variables, then redeploy."
      }
    });
  }

  try {
    const requestBody = await getRequestBody(req);
    const upstreamResponse = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-Title": "FinanceAI"
      },
      body: JSON.stringify({
        model: MODEL_ID,
        models: FALLBACK_MODELS,
        max_tokens: 400,
        temperature: 0.4,
        provider: {
          allow_fallbacks: true
        },
        messages: requestBody.messages || []
      })
    });

    const rawBody = await upstreamResponse.text();
    const data = parseJson(rawBody);
    return res.status(upstreamResponse.status).json(data);
  } catch (error) {
    return res.status(500).json({
      error: {
        message: `Server request to OpenRouter failed: ${error.message || "unknown error"}`
      }
    });
  }
};

async function getRequestBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.body === "string") {
    return parseJson(req.body);
  }

  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks).toString("utf-8");
  return parseJson(rawBody);
}

function parseJson(rawBody) {
  try {
    return JSON.parse(rawBody);
  } catch {
    return {};
  }
}
