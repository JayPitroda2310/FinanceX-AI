# FinanceAI

FinanceAI is a static chat-style finance web app prepared for Vercel deployment.

## Deploy to Vercel

1. Import this GitHub repo into Vercel.
2. Add an environment variable named `OPENROUTER_API_KEY`.
3. Redeploy after saving the variable.

The environment variable must be added in:
`Vercel Dashboard -> Project -> Settings -> Environment Variables`

## Local note

The frontend now calls `/api/chat`, which is served by Vercel in production. A plain static file server will not provide that API route.
