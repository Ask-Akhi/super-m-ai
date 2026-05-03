# Super M AI — Australian Price Comparison

> AI-powered grocery & product price comparison across major Australian supermarkets and retailers.

## 🛒 Supported Retailers
| Store | Website |
|---|---|
| Coles | https://www.coles.com.au |
| Woolworths | https://www.woolworths.com.au |
| Aldi | https://www.aldi.com.au |
| IGA | https://www.igashop.com.au |
| Costco | https://www.costco.com.au |
| Harris Farm | https://www.harrisfarm.com.au |
| Amazon AU | https://www.amazon.com.au |

## 🚀 Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Copy env and add your OpenAI key
cp .env.example .env.local

# 3. Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🌍 Production Domain

Your production domain can be configured with:

```bash
NEXT_PUBLIC_APP_URL=https://grocerywithai.com
CAP_SERVER_URL=https://grocerywithai.com
```

## 🧠 How It Works

1. User types a product query (e.g. *"2L full cream milk"*)
2. The **LLM Agent** (GPT-4o) interprets the query and dispatches tool calls to each **retailer scraper agent**
3. Each agent fetches live pricing from the retailer's website
4. Results are ranked cheapest → most expensive with price-per-unit comparison
5. A **price trend chart** shows historical pricing using cached data

## ⚙️ Environment Variables

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | Your OpenAI API key |
| `NEXT_PUBLIC_APP_URL` | App URL (default: http://localhost:3000) |
| `CAP_SERVER_URL` | Hosted HTTPS URL used by the native iOS/Android wrapper |
| `SCRAPER_PROXY_URL` | Optional Cloudflare Worker proxy URL for retailer scraping |
| `SCRAPER_PROXY_TOKEN` | Shared secret sent to the Worker proxy |

## 📦 Tech Stack
- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS v4**
- **OpenAI GPT-4o** (LLM orchestration)
- **Cheerio + Axios** (HTML scraping)
- **Recharts** (price trend charts)
- **Zustand** (client state)
- **Capacitor** (native iOS / Android app wrapper)

## 📱 Mobile Deployment

### Installable Web App
- The app now ships with a web manifest, mobile icons, and a service worker.
- On iPhone or Android you can install it from the browser as a home-screen app.

### Native iOS / Android Wrapper
1. Deploy the Next.js app to a public HTTPS URL.
2. Set `CAP_SERVER_URL=https://grocerywithai.com`
3. Build the web app:

```bash
npm run build
```

4. Sync Capacitor:

```bash
npm run cap:sync
```

5. Open the native projects:

```bash
npm run cap:android
npm run cap:ios
```

Notes:
- Android packaging can be continued in Android Studio.
- iOS packaging requires Xcode on macOS, even though the wrapper config is included here.
- This project uses live server APIs, so the native wrapper is configured for a hosted deployment URL instead of static export.

## 🚢 Recommended Deployment On Render

This repo now includes [render.yaml](./render.yaml) for a Render web service.

### Render setup
1. Push this repo to GitHub.
2. In Render, create a new `Web Service` from the repo.
3. Render can detect `render.yaml`, or you can configure the same values manually:
   - Build command: `npm install && npm run build`
   - Start command: `npm run start -- --hostname 0.0.0.0 --port $PORT`
4. Add environment variables in Render:
   - `OPENAI_API_KEY`
   - `GROQ_API_KEY` if still used
   - `GEMINI_API_KEY` if still used
   - `NEXT_PUBLIC_APP_URL=https://grocerywithai.com`
   - `CAP_SERVER_URL=https://grocerywithai.com`
   - `SCRAPER_PROXY_URL=https://<your-worker>.workers.dev`
   - `SCRAPER_PROXY_TOKEN=<same secret stored in Cloudflare Workers>`
5. Deploy the service and confirm the `onrender.com` URL works.

## ☁️ Free Cloudflare Worker Scraper Proxy

This project now includes a free Cloudflare Worker proxy in [`cloudflare-worker/`](./cloudflare-worker) so retailer fetches can run from Cloudflare's IP pool instead of your Render server IP.

Why this helps:
- Coles / Woolworths / other AU retailers may block or degrade responses from Render IPs
- Cloudflare Workers use a different network path
- The app can keep its current search logic, but external retailer requests are proxied through the Worker

### Deploy the Worker

1. Install Wrangler:

```bash
npm install -g wrangler
```

2. Log in:

```bash
wrangler login
```

3. In [`cloudflare-worker/`](./cloudflare-worker), copy `wrangler.toml.example` to `wrangler.toml`.

4. Set the shared secret:

```bash
wrangler secret put SCRAPER_PROXY_TOKEN
```

5. Deploy:

```bash
cd cloudflare-worker
wrangler deploy
```

6. Copy the Worker URL and set these in Render:

```bash
SCRAPER_PROXY_URL=https://<your-worker>.workers.dev
SCRAPER_PROXY_TOKEN=<same secret value>
```

7. In Render, run `Manual Deploy` → `Clear build cache & deploy`.

### What the proxy does

- Accepts a signed POST request from your app
- Validates the target host against an allowlist
- Fetches the retailer page / JSON from Cloudflare's edge
- Returns the raw response body to the app

This is the simplest free way to fix the "works locally but fails on the purchased domain" problem at the network/source layer.

### Custom domain on Render
1. In Render, open your web service.
2. Go to `Settings` → `Custom Domains`.
3. Add `grocerywithai.com`.
4. Also add `www.grocerywithai.com` if you want both.

### DNS records
Use the exact values Render shows in the custom domain screen. In general:

- For `www`, create a `CNAME` to your `*.onrender.com` service URL.
- For the root/apex `grocerywithai.com`, use:
  - `ANAME` or `ALIAS` to your `*.onrender.com` service if your DNS provider supports it, or
  - the Render root-domain IP/record shown in the Render domain instructions for your DNS provider.
- Remove any `AAAA` records for the domain while configuring Render custom domains.

After DNS propagates, return to Render and click `Verify`. Render will provision HTTPS automatically.

## ⚠️ Legal Notice
This tool is for personal price comparison. Always check retailer terms of service before scraping.
