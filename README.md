# FinanceAI

FinanceAI is a static chat-style finance web app prepared for Vercel deployment.

## Deploy to Vercel

1. Import this GitHub repo into Vercel.
2. Add an environment variable named `OPENROUTER_API_KEY`.
3. Redeploy after saving the variable.

The environment variable must be added in:
`Vercel Dashboard -> Project -> Settings -> Environment Variables`

## Local note

The frontend now calls `/api/chat`, which is served by Vercel in production.

For local testing:

1. Create `.env.local`
2. Add `OPENROUTER_API_KEY=your_openrouter_api_key_here`
3. Run `py server.py`
4. For Vercel, redeploy after pushing so `/api/chat` is rebuilt from `api/chat/index.js`
