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
5. Deploy the service and confirm the `onrender.com` URL works.

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
