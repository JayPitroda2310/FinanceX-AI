# FinanceAI

FinanceAI is a static chat-style finance web app prepared for Vercel deployment.

## Deploy to Vercel

1. Import this GitHub repo into Vercel.
2. Add an environment variable named `OPENROUTER_API_KEY`.
3. Deploy.

## Local note

The frontend now calls `/api/chat`, which is served by Vercel in production. A plain static file server will not provide that API route.
