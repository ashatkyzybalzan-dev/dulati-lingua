# Dulati Lingua AI

Responsive, mobile-first language-learning website with a Node.js backend and Groq-powered AI chat.

## Requirements

- Node.js 20 or newer (Node 22 LTS recommended)
- A Groq API key from https://console.groq.com/

## Run locally

1. Install Node.js.
2. Copy `.env.example` to `.env` and add your key. The app does not load `.env` automatically, so set the variables in your terminal or use a local environment loader if desired.
3. On macOS/Linux:
   ```bash
   export GROQ_API_KEY="your_key_here"
   export GROQ_MODEL="openai/gpt-oss-20b"
   npm start
   ```
   On Windows PowerShell:
   ```powershell
   $env:GROQ_API_KEY="your_key_here"
   $env:GROQ_MODEL="openai/gpt-oss-20b"
   npm start
   ```
4. Open http://localhost:3000
5. Check configuration at http://localhost:3000/api/health

## Deploy to Render

1. Create a new GitHub repository, for example `dulati-lingua-ai`.
2. Upload the contents of this folder to the repository root. `package.json` and `server.js` must be in the root directory, not inside a nested `src` folder.
3. In Render, create a **Web Service** connected to that repository.
4. Set:
   - **Build Command:** leave blank (no build step is required)
   - **Start Command:** `npm start`
   - **Runtime:** Node
5. In **Environment**, add:
   - `GROQ_API_KEY` = your private Groq API key
   - `GROQ_MODEL` = `openai/gpt-oss-20b`
6. Deploy and wait until the service says **Live**.
7. Open `/api/health` on your Render URL. Expected response:
   ```json
   {"ok":true,"aiConfigured":true,"provider":"Groq","model":"openai/gpt-oss-20b"}
   ```
8. Test the AI chat on the homepage. If it fails, open Render **Logs** and inspect the `Groq API error` line.

## Important notes

- Never put `GROQ_API_KEY` in `public/app.js`, HTML, CSS, or any browser-side code.
- Do not commit `.env` or share the API key in screenshots or messages.
- `GROQ_MODEL` is read once when the Node process starts. After changing it in Render, redeploy/restart the service.
- Groq model availability, rate limits, and free-tier quotas can change. If the configured model becomes unavailable, set `GROQ_MODEL` to a model currently enabled for your Groq account.
- The visitor counter in this starter project is in-memory. It resets when Render restarts the service and is not a unique-user analytics system. For a persistent public counter, connect a database or analytics provider.
- The chat supports text only; it does not record audio or perform speech recognition.
- This is a starter project, not a user-account system. No passwords or private user profiles are collected.
