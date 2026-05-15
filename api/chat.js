const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL_ID = "openrouter/free";
const FALLBACK_MODELS = [
  "openrouter/free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "openai/gpt-oss-120b:free"
];

export default async function handler(req, res) {
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
        messages: req.body?.messages || []
      })
    });

    const rawBody = await upstreamResponse.text();
    const data = parseJson(rawBody);
    return res.status(upstreamResponse.status).json(data);
  } catch (error) {
    return res.status(500).json({
      error: {
        message: "Server request to OpenRouter failed."
      }
    });
  }
}

function parseJson(rawBody) {
  try {
    return JSON.parse(rawBody);
  } catch {
    return {};
  }
}
