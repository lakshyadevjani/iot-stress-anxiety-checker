CalmSense — Run & Share Locally

This project is a static frontend (HTML/CSS/JS). To run locally and share a public link you can either host it on a static host (recommended) or create a tunnel from your machine.

1) Run the local server

PowerShell (from project folder):

```powershell
cd "d:\workshop practise\iot based stress and anxiety"
# Python 3 built-in server
python -m http.server 8000
```

Open: http://localhost:8000/index.html

2) Quick tunnels (temporary public URL)

- ngrok (recommended for reliability)
  - Install: download from https://ngrok.com and follow signup to get an authtoken.
  - Start tunnel (after signing in and installing authtoken):

```powershell
# HTTP tunnel to port 8000
ngrok http 8000
```

  - ngrok prints a public HTTPS URL (e.g. https://abcd1234.ngrok.io). Share that.
  - Notes: free tier rotates URLs on each run unless you buy a reserved domain.

- localtunnel (no signup)
  - Install Node.js, then:

```powershell
npm install -g localtunnel
# run
lt --port 8000
```

  - localtunnel prints a public URL. You can request a subdomain with `--subdomain name` (may be taken).

- Cloudflare Tunnel (cloudflared)
  - Install `cloudflared` and follow Cloudflare docs to create a tunnel that can run persistently.
  - This requires a Cloudflare account and domain for persistent stable URLs.

3) Static hosting (persistent, free options)

- GitHub Pages
  - Create a repo, push this folder, enable Pages from `main` branch (root). Your site will be served at `https://<user>.github.io/<repo>`.

- Netlify / Vercel
  - Connect your GitHub repo and deploy — both provide custom domains and continuous deploys.

4) Security & tips

- Do NOT expose sensitive local services or files when tunneling.
- For demos to many users, use GitHub Pages / Netlify for stability and HTTPS.

If you want, I can:
- Create a GitHub repo and push these files for you.
- Show exact ngrok setup including authtoken steps.
- Configure a simple `deploy` script.

Tell me which option you prefer and I will proceed.