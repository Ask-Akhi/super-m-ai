import { NextRequest, NextResponse } from 'next/server';

const BASE_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Map CDN hostnames to the referer the CDN expects
const CDN_REFERER_MAP: Record<string, string> = {
  'cdn0.woolworths.media': 'https://www.woolworths.com.au/',
  'woolworths.media': 'https://www.woolworths.com.au/',
  'productimages.coles.com.au': 'https://www.coles.com.au/',
  'coles.com.au': 'https://www.coles.com.au/',
  'www.coles.com.au': 'https://www.coles.com.au/',
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
    return new NextResponse('Invalid image URL', { status: 400 });
  }

  try {
    const upstream = await fetch(url, {
      headers: {
        'User-Agent': BASE_UA,
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-AU,en-GB;q=0.9,en;q=0.8',
        Referer: getRefererForUrl(url),
      },
      cache: 'no-store',
    });

    if (!upstream.ok) {
      return new NextResponse('Upstream image unavailable', { status: upstream.status });
    }

    const contentType = upstream.headers.get('content-type') ?? 'image/jpeg';
    const body = await upstream.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch {
    return new NextResponse('Image fetch failed', { status: 502 });
  }
}
