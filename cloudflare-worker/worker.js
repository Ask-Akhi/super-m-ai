const ALLOWED_HOST_PATTERNS = [
  'www.coles.com.au',
  'coles.com.au',
  'www.woolworths.com.au',
  'woolworths.com.au',
  'www.aldi.com.au',
  'aldi.com.au',
  'www.igashop.com.au',
  'igashop.com.au',
  'www.costco.com.au',
  'costco.com.au',
  'www.harrisfarm.com.au',
  'harrisfarm.com.au',
  'www.amazon.com.au',
  'amazon.com.au',
  'www.target.com.au',
  'target.com.au',
  'www.officeworks.com.au',
  'officeworks.com.au',
  'k535caawve-dsn.algolia.net',
  'www.bigw.com.au',
  'bigw.com.au',
  'api.bigw.com.au',
  'www.google.com',
  'google.com',
];

function isAllowedHost(hostname) {
  return ALLOWED_HOST_PATTERNS.some((pattern) => hostname === pattern || hostname.endsWith(`.${pattern}`));
}

function sanitizeHeaders(inputHeaders) {
  const headers = new Headers();
  const blocked = new Set(['host', 'content-length', 'cf-connecting-ip', 'cf-ray']);
  for (const [key, value] of Object.entries(inputHeaders || {})) {
    if (!value) continue;
    if (blocked.has(String(key).toLowerCase())) continue;
    headers.set(key, String(value));
  }
  return headers;
}

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const providedToken = request.headers.get('x-proxy-token');
    if (env.SCRAPER_PROXY_TOKEN && providedToken !== env.SCRAPER_PROXY_TOKEN) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { url, method = 'GET', headers: upstreamHeaders, body } = payload || {};
    if (!url || typeof url !== 'string') {
      return Response.json({ error: 'Target URL is required' }, { status: 400 });
    }

    let target;
    try {
      target = new URL(url);
    } catch {
      return Response.json({ error: 'Invalid target URL' }, { status: 400 });
    }

    if (!['http:', 'https:'].includes(target.protocol) || !isAllowedHost(target.hostname)) {
      return Response.json({ error: 'Target host not allowed' }, { status: 403 });
    }

    try {
      const upstreamResponse = await fetch(target.toString(), {
        method,
        headers: sanitizeHeaders(upstreamHeaders),
        body: method === 'POST' && body != null ? JSON.stringify(body) : undefined,
        redirect: 'follow',
      });

      const responseBody = await upstreamResponse.text();
      return Response.json({
        ok: upstreamResponse.ok,
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        body: responseBody,
      }, {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      });
    } catch (error) {
      return Response.json({
        ok: false,
        status: 502,
        statusText: error instanceof Error ? error.message : 'Worker fetch failed',
        body: '',
      }, { status: 200 });
    }
  },
};
