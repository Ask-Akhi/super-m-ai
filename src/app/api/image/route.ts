import { NextRequest, NextResponse } from 'next/server';

const BASE_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#1e293b" rx="12"/><text x="100" y="90" text-anchor="middle" fill="#475569" font-size="36">&#x1F6D2;</text><text x="100" y="125" text-anchor="middle" fill="#475569" font-size="13" font-family="sans-serif">No image</text></svg>`;

function placeholderResponse() {
  return new NextResponse(PLACEHOLDER_SVG, {
    status: 200,
    headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=3600' },
  });
}

// Map CDN hostnames to the referer the CDN expects
const CDN_REFERER_MAP: Record<string, string> = {
  'cdn0.woolworths.media': 'https://www.woolworths.com.au/',
  'woolworths.media': 'https://www.woolworths.com.au/',
  'productimages.coles.com.au': 'https://www.coles.com.au/',
  'coles.com.au': 'https://www.coles.com.au/',
  'www.coles.com.au': 'https://www.coles.com.au/',
  'harrisfarm.com.au': 'https://www.harrisfarm.com.au/',
  'www.harrisfarm.com.au': 'https://www.harrisfarm.com.au/',
  'media.harrisfarm.com.au': 'https://www.harrisfarm.com.au/',
  'images.igashop.com.au': 'https://www.igashop.com.au/',
  'assets.bigw.com.au': 'https://www.bigw.com.au/',
  // Officeworks — images served from www.officeworks.com.au or their CDN subdomain
  'officeworks.com.au': 'https://www.officeworks.com.au/',
  'www.officeworks.com.au': 'https://www.officeworks.com.au/',
  // Amazon AU product images
  'images-na.ssl-images-amazon.com': 'https://www.amazon.com.au/',
  'm.media-amazon.com': 'https://www.amazon.com.au/',
};

function getRefererForUrl(urlStr: string): string {
  try {
    const { hostname } = new URL(urlStr);
    for (const [cdn, referer] of Object.entries(CDN_REFERER_MAP)) {
      if (hostname === cdn || hostname.endsWith(`.${cdn}`)) return referer;
    }
  } catch { /* ignore */ }
  return 'https://grocerywithai.com/';
}

function isAllowedImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url || !isAllowedImageUrl(url)) {
    return placeholderResponse();
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    let upstream: Response;
    try {
      upstream = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': BASE_UA,
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Accept-Language': 'en-AU,en-GB;q=0.9,en;q=0.8',
          Referer: getRefererForUrl(url),
        },
        cache: 'no-store',
      });
    } finally {
      clearTimeout(timer);
    }

    if (!upstream.ok) {
      console.warn(`[image-proxy] upstream ${upstream.status} for ${url}`);
      return placeholderResponse();
    }

    const contentType = upstream.headers.get('content-type') ?? 'image/jpeg';
    if (!contentType.startsWith('image/') && !contentType.includes('octet-stream')) {
      console.warn(`[image-proxy] unexpected content-type "${contentType}" for ${url}`);
      return placeholderResponse();
    }

    const body = await upstream.arrayBuffer();
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch (err) {
    console.warn(`[image-proxy] fetch error for ${url}:`, err);
    return placeholderResponse();
  }
}
