import axios, { AxiosRequestConfig } from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
import { ProductResult, RetailerName } from '@/types';

export interface ScraperResult {
  retailer: RetailerName;
  results: ProductResult[];
  status: 'ok' | 'empty' | 'blocked' | 'error';
  message?: string;
}

const BASE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-AU,en-GB;q=0.9,en;q=0.8',
  Connection: 'keep-alive',
  'Cache-Control': 'no-cache',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Upgrade-Insecure-Requests': '1',
};
const JSON_HEADERS = {
  ...BASE_HEADERS,
  Accept: 'application/json, text/plain, */*',
  'Content-Type': 'application/json',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
};

// ── Google Shopping scraper (universal fallback for AU retailers) ─────────────
export async function scrapeGoogleShopping(query: string, retailerDomain?: string): Promise<ScraperResult> {
  try {
    const site = retailerDomain ? ` site:${retailerDomain}` : '';
    const searchQuery = `${query} australia price${site}`;
    const url = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&tbm=shop&gl=au&hl=en-AU&num=10`;
    const html = await get(url, {
      headers: {
        ...BASE_HEADERS,
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Referer: 'https://www.google.com.au/',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    const $ = cheerio.load(html);
    const results: ProductResult[] = [];

    // Google Shopping result cards
    $('div.sh-dgr__content, .sh-pr__product-results-grid > div, [data-docid]').slice(0, 10).each((_, el) => {
      const name = $(el).find('h3, .tAxDx, [class*="title"], .translate-content').first().text().trim();
      const priceText = $(el).find('.a8Pemb, [class*="price"], .kHxwFf').first().text().trim();
      const price = parsePrice(priceText);
      const store = $(el).find('.aULzUe, .IuHnof, [class*="merchant"], [class*="store"]').first().text().trim();
      const imgEl = $(el).find('img').first();
      const imgSrc = imgEl.attr('src') ?? imgEl.attr('data-src') ?? '';
      const href = $(el).find('a').first().attr('href') ?? '';
      const productUrl = href.startsWith('http') ? href : href.startsWith('/url?') 
        ? new URLSearchParams(href.slice(5)).get('q') ?? href 
        : `https://www.google.com${href}`;

      if (name && price) {
        results.push({
          retailer: (store as RetailerName) || 'Amazon AU',
          productName: name,
          price,
          imageUrl: imgSrc.startsWith('data:') ? '' : imgSrc,
          productUrl,
          inStock: true,
          onSale: false,
          scrapedAt: ts(),
          storeBranch: store || undefined,
        });
      }
    });

    return results.length
      ? { retailer: 'Amazon AU', results, status: 'ok' }
      : { retailer: 'Amazon AU', results: [], status: 'empty', message: 'No Google Shopping results' };
  } catch (err) {
    return { retailer: 'Amazon AU', results: [], status: 'error', message: String(err) };
  }
}

async function get(url: string, cfg?: AxiosRequestConfig): Promise<string> {
  const r = await axios.get(url, { headers: BASE_HEADERS, timeout: 15000, maxRedirects: 5, ...cfg });
  return r.data as string;
}

async function getJson<T>(url: string, cfg?: AxiosRequestConfig): Promise<T> {
  const r = await axios.get(url, { headers: JSON_HEADERS, timeout: 15000, maxRedirects: 5, ...cfg });
  return r.data as T;
}

async function postJson<T>(url: string, body: unknown, cfg?: AxiosRequestConfig): Promise<T> {
  const r = await axios.post(url, body, { headers: JSON_HEADERS, timeout: 15000, maxRedirects: 5, ...cfg });
  return r.data as T;
}

function parsePrice(t: string): number | null {
  if (!t) return null;
  const m = t.replace(/,/g, '').replace(/\s/g, '').match(/\$?([\d]{1,5}\.[\d]{1,2})/);
  return m ? parseFloat(m[1]) : null;
}

function ts() { return new Date().toISOString(); }

function absoluteUrl(base: string, value?: string): string {
  if (!value) return base;
  if (value.startsWith('http')) return value;
  return `${base}${value.startsWith('/') ? '' : '/'}${value}`;
}

// ── COLES ─────────────────────────────────────────────────────────────────────
export async function scrapeColes(query: string): Promise<ScraperResult> {
  // Try Coles v2 search API first (most reliable)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = await getJson<any>(
      `https://www.coles.com.au/api/2.0/page/categories/search?q=${encodeURIComponent(query)}&page=1&pageSize=8`,
      {
        headers: {
          ...JSON_HEADERS,
          Referer: `https://www.coles.com.au/search?q=${encodeURIComponent(query)}`,
          Origin: 'https://www.coles.com.au',
          'ocp-apim-subscription-key': '',
        },
      });
    const prods = api?.results ?? api?.products ?? [];
    if (prods.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results: ProductResult[] = prods.slice(0, 8).map((p: any) => ({
        retailer: 'Coles' as RetailerName,
        productName: p.name ?? p.title ?? '',
        price: p.pricing?.now ?? p.price ?? 0,
        originalPrice: p.pricing?.was,
        unit: p.pricing?.unit?.quantity ? `${p.pricing.unit.quantity}${p.pricing.unit.ofMeasureType ?? ''}` : p.size,
        pricePerUnit: p.pricing?.unit?.price,
        imageUrl: absoluteUrl('https://www.coles.com.au', p.imageUris?.[0]?.uri ?? p.image ?? ''),
        productUrl: `https://www.coles.com.au/product/${p.id ?? ''}`,
        inStock: !(p.restriction?.isUnavailable ?? false),
        onSale: !!p.pricing?.promotionType,
        scrapedAt: ts(),
      })).filter((r: ProductResult) => r.productName && r.price > 0);
      if (results.length) return { retailer: 'Coles', results, status: 'ok' };
    }
  } catch { /* fall through */ }

  // Try Coles __NEXT_DATA__ via HTML
  try {
    const html = await get(`https://www.coles.com.au/search?q=${encodeURIComponent(query)}`,
      { headers: { ...BASE_HEADERS, Referer: 'https://www.coles.com.au/' } });
    const $ = cheerio.load(html);
    const nd = $('#__NEXT_DATA__').html();
    if (nd) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = JSON.parse(nd) as any;
      const prods = data?.props?.pageProps?.searchResults?.results ?? data?.props?.pageProps?.products ?? [];
      if (prods.length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const results: ProductResult[] = prods.slice(0, 8).map((p: any) => ({
          retailer: 'Coles' as RetailerName,
          productName: p.name ?? p.title ?? '',
          price: p.pricing?.now ?? p.price ?? 0,
          originalPrice: p.pricing?.was,
          unit: p.pricing?.unit?.quantity ? `${p.pricing.unit.quantity}${p.pricing.unit.ofMeasureType ?? ''}` : p.size,
          pricePerUnit: p.pricing?.unit?.price,
          imageUrl: absoluteUrl('https://www.coles.com.au', p.imageUris?.[0]?.uri ?? p.image ?? ''),
          productUrl: `https://www.coles.com.au/product/${p.id ?? ''}`,
          inStock: !(p.restriction?.isUnavailable ?? false),
          onSale: !!p.pricing?.promotionType,
          scrapedAt: ts(),
        })).filter((r: ProductResult) => r.productName && r.price > 0);
        if (results.length) return { retailer: 'Coles', results, status: 'ok' };
      }

      // HTML CSS selectors fallback
      const results: ProductResult[] = [];
      for (const sel of ['[data-testid="product-tile"]', '.product-tile', '[class*="ProductTile"]', 'article[class*="product"]']) {
        $(sel).slice(0, 8).each((_, el) => {
          const name = $(el).find('[data-testid="product-name"],h2,h3,[class*="name"]').first().text().trim();
          const price = parsePrice($(el).find('[class*="price"],[data-testid*="price"]').first().text());
          if (name && price) {
            results.push({
              retailer: 'Coles', productName: name, price,
              productUrl: absoluteUrl('https://www.coles.com.au', $(el).find('a').attr('href') ?? ''),
              imageUrl: absoluteUrl('https://www.coles.com.au', $(el).find('img').attr('src') ?? ''),
              inStock: true,
              onSale: $(el).find('[class*="special"],[class*="sale"]').length > 0,
              scrapedAt: ts(),
            });
          }
        });
        if (results.length) break;
      }
      if (results.length) return { retailer: 'Coles', results, status: 'ok' };
    }
    return { retailer: 'Coles', results: [], status: 'empty', message: 'No Coles results' };
  } catch (err) {
    return { retailer: 'Coles', results: [], status: 'error', message: String(err) };
  }
}

// ── WOOLWORTHS ────────────────────────────────────────────────────────────────
export async function scrapeWoolworths(query: string): Promise<ScraperResult> {
  try {
    type WP = { Name: string; Price: number; WasPrice?: number; PackageSize?: string; CupPrice?: number; MediumImageFile?: string; Stockcode?: number; IsInStock?: boolean; IsOnSpecial?: boolean };
    type WR = { Products?: Array<{ Products?: WP[] }>; SearchResultsCount?: number };
    const data = await getJson<WR>(
      `https://www.woolworths.com.au/apis/ui/Search/products?searchTerm=${encodeURIComponent(query)}&pageNumber=1&pageSize=8&sortType=TraderRelevance&isMobile=false`,
      {
        headers: {
          ...JSON_HEADERS,
          Referer: 'https://www.woolworths.com.au/shop/search/products?searchTerm=' + encodeURIComponent(query),
          Origin: 'https://www.woolworths.com.au',
          'x-requested-with': 'XMLHttpRequest',
          Cookie: 'wow-auth-token=; _abck=; ak_bmsc=',
        },
      });
    const products = data?.Products?.[0]?.Products ?? [];
    if (!products.length) return { retailer: 'Woolworths', results: [], status: 'empty', message: 'No Woolworths results' };
    const results: ProductResult[] = products.slice(0, 8).map((p) => ({
      retailer: 'Woolworths' as RetailerName,
      productName: p.Name,
      price: p.Price ?? 0,
      originalPrice: p.WasPrice && p.WasPrice !== p.Price ? p.WasPrice : undefined,
      unit: p.PackageSize,
      pricePerUnit: p.CupPrice ? parseFloat(p.CupPrice.toFixed(2)) : undefined,
      imageUrl: p.MediumImageFile
        ? (p.MediumImageFile.startsWith('http') ? p.MediumImageFile : `https://cdn0.woolworths.media/content/wowproductimages/medium/${p.MediumImageFile}`)
        : '',
      productUrl: `https://www.woolworths.com.au/shop/productdetails/${p.Stockcode ?? ''}`,
      inStock: p.IsInStock ?? true,
      onSale: !!p.IsOnSpecial,
      scrapedAt: ts(),
    })).filter((r) => r.productName && r.price > 0);
    return results.length
      ? { retailer: 'Woolworths', results, status: 'ok' }
      : { retailer: 'Woolworths', results: [], status: 'empty' };
  } catch (err) {
    // Woolworths blocks server IPs — try their public catalogue API
    try {
      type CatalogItem = { name?: string; price?: number; wasPrice?: number; size?: string; imageUrl?: string; urlFriendlyName?: string; stockcode?: number };
      const fallback = await getJson<{ totalRecordCount?: number; products?: CatalogItem[] }>(
        `https://www.woolworths.com.au/apis/ui/browse/category?categoryId=1_A8K4E&pageNumber=1&pageSize=8&sortType=TraderRelevance&filters=&keyword=${encodeURIComponent(query)}`,
        { headers: { ...JSON_HEADERS, Referer: 'https://www.woolworths.com.au/' } }
      );
      const prods = fallback?.products ?? [];
      if (prods.length) {
        const results: ProductResult[] = prods.map((p) => ({
          retailer: 'Woolworths' as RetailerName,
          productName: p.name ?? '',
          price: p.price ?? 0,
          originalPrice: p.wasPrice && p.wasPrice !== p.price ? p.wasPrice : undefined,
          unit: p.size,
          imageUrl: p.imageUrl ?? '',
          productUrl: `https://www.woolworths.com.au/shop/productdetails/${p.stockcode ?? ''}`,
          inStock: true,
          onSale: !!(p.wasPrice && p.wasPrice > (p.price ?? 0)),
          scrapedAt: ts(),
        })).filter((r) => r.productName && r.price > 0);
        if (results.length) return { retailer: 'Woolworths', results, status: 'ok' };
      }
    } catch { /* fall through */ }
    return { retailer: 'Woolworths', results: [], status: 'error', message: String(err) };
  }
}

// ── ALDI ──────────────────────────────────────────────────────────────────────
export async function scrapeAldi(query: string): Promise<ScraperResult> {
  try {
    const html = await get(`https://www.aldi.com.au/en/search/?text=${encodeURIComponent(query)}`,
      { headers: { ...BASE_HEADERS, Referer: 'https://www.aldi.com.au/' } });
    const $ = cheerio.load(html);
    const results: ProductResult[] = [];
    for (const sel of ['.search-result-items .item', '[class*="ProductCard"]', '.product__item', '[class*="search-result"] li']) {
      $(sel).slice(0, 8).each((_, el) => {
        const name = $(el).find('h3,h2,[class*="title"],[class*="name"]').first().text().trim();
        const price = parsePrice($(el).find('[class*="price"]').first().text());
        if (name && price) {
          const href = $(el).find('a').attr('href') ?? '';
          results.push({
            retailer: 'Aldi', productName: name, price,
            productUrl: href.startsWith('http') ? href : `https://www.aldi.com.au${href}`,
            imageUrl: absoluteUrl('https://www.aldi.com.au', $(el).find('img').attr('src') ?? ''),
            inStock: true, onSale: false, scrapedAt: ts(),
          });
        }
      });
      if (results.length) break;
    }
    return results.length
      ? { retailer: 'Aldi', results, status: 'ok' }
      : { retailer: 'Aldi', results: [], status: 'empty', message: 'Aldi may not carry this item or requires JS' };
  } catch (err) {
    return { retailer: 'Aldi', results: [], status: 'error', message: String(err) };
  }
}

// ── IGA ───────────────────────────────────────────────────────────────────────
export async function scrapeIGA(query: string): Promise<ScraperResult> {
  try {
    type IGP = { name?: string; title?: string; price?: number; regularPrice?: number; size?: string; imageUrl?: string; url?: string; inStock?: boolean; onSale?: boolean };
    const data = await getJson<{ products?: IGP[]; data?: { products?: IGP[] } }>(
      `https://www.igashop.com.au/api/storefront/stores/51172/search?misspelled=true&q=${encodeURIComponent(query)}&take=8`,
      { headers: { ...JSON_HEADERS, Referer: 'https://www.igashop.com.au/', Origin: 'https://www.igashop.com.au' } });
    const raw = data?.products ?? data?.data?.products ?? [];
    if (raw.length) {
      const results: ProductResult[] = raw.slice(0, 8).map((p) => ({
        retailer: 'IGA' as RetailerName,
        productName: p.name ?? p.title ?? '',
        price: p.price ?? 0,
        originalPrice: p.regularPrice && p.regularPrice !== p.price ? p.regularPrice : undefined,
        unit: p.size,
        imageUrl: p.imageUrl ?? '',
        productUrl: p.url ? (p.url.startsWith('http') ? p.url : `https://www.igashop.com.au${p.url}`) : 'https://www.igashop.com.au',
        inStock: p.inStock ?? true,
        onSale: !!p.onSale,
        scrapedAt: ts(),
      })).filter((r) => r.productName && r.price > 0);
      if (results.length) return { retailer: 'IGA', results, status: 'ok' };
    }
  } catch { /* fall through to HTML */ }
  try {
    const html = await get(`https://www.igashop.com.au/search?q=${encodeURIComponent(query)}`,
      { headers: { ...BASE_HEADERS, Referer: 'https://www.igashop.com.au/' } });
    const $ = cheerio.load(html);
    const results: ProductResult[] = [];
    $('[class*="product"],.product-tile,.product-card').slice(0, 8).each((_, el) => {
      const name = $(el).find('[class*="name"],[class*="title"],h2,h3').first().text().trim();
      const price = parsePrice($(el).find('[class*="price"]').first().text());
      if (name && price) {
        const href = $(el).find('a').attr('href') ?? '';
        results.push({
          retailer: 'IGA', productName: name, price,
          productUrl: href.startsWith('http') ? href : `https://www.igashop.com.au${href}`,
          imageUrl: absoluteUrl('https://www.igashop.com.au', $(el).find('img').attr('src') ?? ''),
          inStock: true, onSale: false, scrapedAt: ts(),
        });
      }
    });
    return results.length
      ? { retailer: 'IGA', results, status: 'ok' }
      : { retailer: 'IGA', results: [], status: 'empty', message: 'No IGA results' };
  } catch (err) {
    return { retailer: 'IGA', results: [], status: 'error', message: String(err) };
  }
}

// ── COSTCO ────────────────────────────────────────────────────────────────────
export async function scrapeCostco(query: string): Promise<ScraperResult> {
  try {
    const html = await get(`https://www.costco.com.au/search?text=${encodeURIComponent(query)}`,
      { headers: { ...BASE_HEADERS, Referer: 'https://www.costco.com.au/' } });
    const $ = cheerio.load(html);
    const results: ProductResult[] = [];
    const nd = $('#__NEXT_DATA__').html();
    if (nd) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = JSON.parse(nd) as any;
        const prods = data?.props?.pageProps?.searchResults?.products ?? data?.props?.pageProps?.results ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        prods.slice(0, 8).forEach((p: any) => {
          const price = p.yourPrice?.value ?? p.price ?? parsePrice(String(p.formattedPrice ?? ''));
          if (p.name && price) {
            results.push({
              retailer: 'Costco', productName: p.name, price,
              imageUrl: absoluteUrl('https://www.costco.com.au', p.thumbnail ?? p.image ?? ''),
              productUrl: absoluteUrl('https://www.costco.com.au', p.url ?? ''),
              inStock: p.stock?.stockLevelStatus !== 'outOfStock',
              onSale: !!p.discountPercent, scrapedAt: ts(),
            });
          }
        });
        if (results.length) return { retailer: 'Costco', results, status: 'ok' };
      } catch { /* fall through */ }
    }
    for (const sel of ['.product-list-item', '.ProductListItem', '[class*="product-item"]', '.item-tile', 'li[class*="product"]']) {
      $(sel).slice(0, 8).each((_, el) => {
        const name = $(el).find('[class*="description"],[class*="name"],h2,h3').first().text().trim();
        const price = parsePrice($(el).find('[class*="price"],.your-price').first().text());
        if (name && price) {
          const href = $(el).find('a').attr('href') ?? '';
          results.push({
            retailer: 'Costco', productName: name, price,
            productUrl: absoluteUrl('https://www.costco.com.au', href),
            imageUrl: absoluteUrl('https://www.costco.com.au', $(el).find('img').attr('src') ?? ''),
            inStock: true, onSale: false, scrapedAt: ts(),
          });
        }
      });
      if (results.length) break;
    }
    return results.length
      ? { retailer: 'Costco', results, status: 'ok' }
      : { retailer: 'Costco', results: [], status: 'empty', message: 'Costco may not stock this or requires login' };
  } catch (err) {
    return { retailer: 'Costco', results: [], status: 'error', message: String(err) };
  }
}

// ── HARRIS FARM ───────────────────────────────────────────────────────────────
export async function scrapeHarrisFarm(query: string): Promise<ScraperResult> {
  try {
    const html = await get(`https://www.harrisfarm.com.au/search?type=product&q=${encodeURIComponent(query)}`,
      { headers: { ...BASE_HEADERS, Referer: 'https://www.harrisfarm.com.au/' } });
    const $ = cheerio.load(html);
    const results: ProductResult[] = [];
    const nd = $('#__NEXT_DATA__').html();
    if (nd) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = JSON.parse(nd) as any;
        const prods = data?.props?.pageProps?.products ?? data?.props?.pageProps?.searchResults ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        prods.slice(0, 8).forEach((p: any) => {
          const price = p.priceMin ?? p.price ?? parsePrice(String(p.formattedPrice ?? ''));
          if (p.title && price) {
            results.push({
              retailer: 'Harris Farm', productName: p.title, price,
              imageUrl: absoluteUrl('https://www.harrisfarm.com.au', p.featuredImage?.url ?? ''),
              productUrl: `https://www.harrisfarm.com.au${p.handle ? `/products/${p.handle}` : ''}`,
              inStock: p.availableForSale ?? true,
              onSale: !!p.compareAtPriceMin, scrapedAt: ts(),
            });
          }
        });
        if (results.length) return { retailer: 'Harris Farm', results, status: 'ok' };
      } catch { /* fall through */ }
    }
    for (const sel of ['.product-item', '.grid-product', '[class*="ProductCard"]', '.product']) {
      $(sel).slice(0, 8).each((_, el) => {
        const name = $(el).find('[class*="title"],[class*="name"],h2,h3').first().text().trim();
        const price = parsePrice($(el).find('[class*="price"]').first().text());
        if (name && price) {
          const href = $(el).find('a').attr('href') ?? '';
          results.push({
            retailer: 'Harris Farm', productName: name, price,
            productUrl: absoluteUrl('https://www.harrisfarm.com.au', href),
            imageUrl: absoluteUrl('https://www.harrisfarm.com.au', $(el).find('img').attr('src') ?? $(el).find('img').attr('data-src') ?? ''),
            inStock: !$(el).find('[class*="sold-out"],[class*="unavailable"]').length,
            onSale: $(el).find('[class*="sale"],[class*="discount"]').length > 0,
            scrapedAt: ts(),
          });
        }
      });
      if (results.length) break;
    }
    return results.length
      ? { retailer: 'Harris Farm', results, status: 'ok' }
      : { retailer: 'Harris Farm', results: [], status: 'empty', message: 'No Harris Farm results' };
  } catch (err) {
    return { retailer: 'Harris Farm', results: [], status: 'error', message: String(err) };
  }
}

// ── AMAZON AU ─────────────────────────────────────────────────────────────────
export async function scrapeAmazon(query: string): Promise<ScraperResult> {
  try {
    const html = await get(`https://www.amazon.com.au/s?k=${encodeURIComponent(query)}&i=grocery`,
      { headers: { ...BASE_HEADERS, Referer: 'https://www.amazon.com.au/' } });
    const $ = cheerio.load(html);
    const results: ProductResult[] = [];
    $('[data-component-type="s-search-result"]').slice(0, 8).each((_, el) => {
      const name = $(el).find('h2 span').first().text().trim();
      const whole = $(el).find('.a-price-whole').first().text().replace(/[^0-9]/g, '');
      const frac = $(el).find('.a-price-fraction').first().text().replace(/[^0-9]/g, '') || '00';
      const price = whole ? parseFloat(`${whole}.${frac}`) : null;
      const href = $(el).find('h2 a').attr('href') ?? $(el).find('a.a-link-normal').attr('href') ?? '';
      if (name && price) {
        results.push({
          retailer: 'Amazon AU', productName: name, price,
          productUrl: absoluteUrl('https://www.amazon.com.au', href),
          imageUrl: $(el).find('img.s-image').attr('src') ?? '',
          inStock: !$(el).find('.a-color-price').text().toLowerCase().includes('unavailable'),
          onSale: $(el).find('[class*="savingsPercentage"],.a-badge-text').length > 0,
          scrapedAt: ts(),
        });
      }
    });
    return results.length
      ? { retailer: 'Amazon AU', results, status: 'ok' }
      : { retailer: 'Amazon AU', results: [], status: 'empty', message: 'No Amazon AU grocery results' };
  } catch (err) {
    return { retailer: 'Amazon AU', results: [], status: 'error', message: String(err) };
  }
}

// ── TARGET ───────────────────────────────────────────────────────────────────
export async function scrapeTarget(query: string): Promise<ScraperResult> {
  try {
    const html = await get(`https://www.target.com.au/search?text=${encodeURIComponent(query)}`,
      { headers: { ...BASE_HEADERS, Referer: 'https://www.target.com.au/' } });
    const $ = cheerio.load(html);
    const results: ProductResult[] = [];

    $('[data-testid^="product-card-"]').slice(0, 8).each((_, el) => {
      const card = $(el);
      const name = card.find('img[alt]').attr('alt')
        ?? card.find('a[href]').last().text().trim()
        ?? '';
      const href = card.find('a[href]').first().attr('href') ?? '';
      const imageUrl = card.find('img').first().attr('src') ?? '';
      const priceText = card.find('[data-testid="product-price"]').text().replace(/\s+/g, ' ');
      const prices = [...priceText.matchAll(/\$([\d]+(?:\.\d{1,2})?)/g)].map((match) => parseFloat(match[1]));
      const price = prices[0] ?? null;
      const originalPrice = prices.length > 1 && prices[1] > (price ?? 0) ? prices[1] : undefined;

      if (name && price) {
        results.push({
          retailer: 'Target',
          productName: name.trim(),
          price,
          originalPrice,
          imageUrl: absoluteUrl('https://www.target.com.au', imageUrl),
          productUrl: absoluteUrl('https://www.target.com.au', href),
          inStock: !card.text().toLowerCase().includes('sold out'),
          onSale: !!originalPrice || card.text().toLowerCase().includes('sale'),
          scrapedAt: ts(),
        });
      }
    });

    return results.length
      ? { retailer: 'Target', results, status: 'ok' }
      : { retailer: 'Target', results: [], status: 'empty', message: 'No Target results' };
  } catch (err) {
    return { retailer: 'Target', results: [], status: 'error', message: String(err) };
  }
}

// ── OFFICEWORKS ──────────────────────────────────────────────────────────────
export async function scrapeOfficeworks(query: string): Promise<ScraperResult> {
  try {
    type OfficeworksHit = {
      name?: string;
      displayName?: string;
      sku?: string;
      salePrice?: number;
      price?: number;
      listPrice?: number;
      wasPrice?: number;
      brand?: string;
      image?: string;
      imageUrl?: string;
      productUrl?: string;
      url?: string;
      inStock?: boolean;
    };
    type OfficeworksResponse = { hits?: OfficeworksHit[] };
    const normalizeOfficeworksPrice = (value?: number) => {
      if (!value) return 0;
      return value > 50 ? parseFloat((value / 100).toFixed(2)) : value;
    };

    const data = await postJson<OfficeworksResponse>(
      'https://k535caawve-dsn.algolia.net/1/indexes/*/queries',
      {
        requests: [
          {
            indexName: 'prod-product-wc-bestmatch-personal',
            params: new URLSearchParams({
              query,
              hitsPerPage: '8',
              page: '0',
              clickAnalytics: 'false',
            }).toString(),
          },
        ],
      },
      {
        headers: {
          ...JSON_HEADERS,
          'x-algolia-agent': 'Algolia for JavaScript (4.24.0); Browser',
          'x-algolia-application-id': 'K535CAAWVE',
          'x-algolia-api-key': '8a831febe0110932cfa06ff0e2024b4f',
        },
      },
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hits = (data as any)?.results?.[0]?.hits ?? data.hits ?? [];
    const results: ProductResult[] = hits.slice(0, 8).map((hit: OfficeworksHit): ProductResult => {
      const price = normalizeOfficeworksPrice(hit.salePrice ?? hit.price ?? 0);
      const originalPrice = normalizeOfficeworksPrice(hit.wasPrice ?? hit.listPrice);
      const path = hit.productUrl ?? hit.url ?? (hit.sku ? `/shop/officeworks/p/${hit.sku}` : '');
      return {
        retailer: 'Officeworks',
        productName: hit.displayName ?? hit.name ?? '',
        price,
        originalPrice: originalPrice && originalPrice > price ? originalPrice : undefined,
        imageUrl: absoluteUrl('https://www.officeworks.com.au', hit.imageUrl ?? hit.image ?? ''),
        productUrl: absoluteUrl('https://www.officeworks.com.au', path),
        inStock: hit.inStock ?? true,
        onSale: !!(originalPrice && originalPrice > price),
        scrapedAt: ts(),
      };
    }).filter((result: ProductResult) => result.productName && result.price > 0);

    return results.length
      ? { retailer: 'Officeworks', results, status: 'ok' }
      : { retailer: 'Officeworks', results: [], status: 'empty', message: 'No Officeworks results' };
  } catch (err) {
    return { retailer: 'Officeworks', results: [], status: 'error', message: String(err) };
  }
}

// ── BIG W ────────────────────────────────────────────────────────────────────
export async function scrapeBigW(query: string): Promise<ScraperResult> {
  try {
    type BigWRegionalPrice = {
      price?: { cents?: number };
      rrp?: { cents?: number };
      unitPrice?: { cents?: number; unit?: string };
      promotions?: string[];
      clearance?: boolean;
    };
    type BigWProduct = {
      identifiers?: { articleId?: string };
      information?: {
        name?: string;
        media?: {
          image?: { medium?: string; large?: string; small?: string };
          images?: Array<{
            mediumImg?: { url?: string };
            largeImg?: { url?: string };
            smallImg?: { url?: string };
            source?: { url?: string };
            thumbnail?: { url?: string };
          }>;
        };
      };
      prices?: Record<string, BigWRegionalPrice>;
      stock?: boolean;
    };
    type BigWSearchResponse = { organic?: { results?: BigWProduct[] } };

    const data = await postJson<BigWSearchResponse>(
      'https://api.bigw.com.au/search/v1/search',
      { text: query, page: 0, perPage: 8, format: '1', clientId: 'web' },
      {
        headers: {
          ...JSON_HEADERS,
          Origin: 'https://www.bigw.com.au',
          Referer: 'https://www.bigw.com.au/',
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      },
    );

    const products = data?.organic?.results ?? [];
    const results: ProductResult[] = products.slice(0, 8).map((product): ProductResult => {
      const prices = product.prices?.NSW ?? product.prices?.NAT ?? Object.values(product.prices ?? {})[0];
      const currentPrice = prices?.price?.cents ? prices.price.cents / 100 : 0;
      const originalPrice = prices?.rrp?.cents ? prices.rrp.cents / 100 : undefined;
      const media = product.information?.media;
      const primaryImage = media?.image?.medium
        ?? media?.image?.large
        ?? media?.image?.small
        ?? media?.images?.[0]?.mediumImg?.url
        ?? media?.images?.[0]?.largeImg?.url
        ?? media?.images?.[0]?.smallImg?.url
        ?? media?.images?.[0]?.source?.url
        ?? media?.images?.[0]?.thumbnail?.url
        ?? '';
      const promoLabels = prices?.promotions ?? [];

      return {
        retailer: 'Big W',
        productName: product.information?.name ?? '',
        price: currentPrice,
        originalPrice: originalPrice && originalPrice > currentPrice ? originalPrice : undefined,
        unit: prices?.unitPrice?.unit,
        pricePerUnit: prices?.unitPrice?.cents ? prices.unitPrice.cents / 100 : undefined,
        productUrl: absoluteUrl('https://www.bigw.com.au', `/product/${product.identifiers?.articleId ?? ''}`),
        imageUrl: absoluteUrl('https://www.bigw.com.au', primaryImage),
        inStock: product.stock ?? true,
        onSale: !!((originalPrice && originalPrice > currentPrice) || promoLabels.length || prices?.clearance),
        scrapedAt: ts(),
      };
    }).filter((result) => result.productName && result.price > 0);

    const deduped = results.filter((result, index, arr) => arr.findIndex((item) => item.productUrl === result.productUrl) === index);

    return deduped.length
      ? { retailer: 'Big W', results: deduped.slice(0, 8), status: 'ok' }
      : { retailer: 'Big W', results: [], status: 'empty', message: 'No Big W results' };
  } catch (err) {
    return { retailer: 'Big W', results: [], status: 'error', message: String(err) };
  }
}

// ── BLOCKED / HEAVILY PROTECTED RETAILERS ───────────────────────────────────
function blockedRetailer(retailer: RetailerName, message: string): ScraperResult {
  return { retailer, results: [], status: 'blocked', message };
}

// ── Dispatcher ────────────────────────────────────────────────────────────────
export async function scrapeRetailer(retailer: RetailerName, query: string): Promise<ProductResult[]> {
  return (await scrapeRetailerWithStatus(retailer, query)).results;
}

// Retailer → their website domain for Google Shopping fallback
const RETAILER_DOMAIN: Partial<Record<RetailerName, string>> = {
  Coles: 'coles.com.au',
  Woolworths: 'woolworths.com.au',
  Aldi: 'aldi.com.au',
  IGA: 'igashop.com.au',
  'Harris Farm': 'harrisfarm.com.au',
  Costco: 'costco.com.au',
  'Amazon AU': 'amazon.com.au',
  Target: 'target.com.au',
  'Big W': 'bigw.com.au',
};

// Grocery retailers where we try Google Shopping as a fallback on hard failures
const GROCERY_RETAILERS = new Set<RetailerName>(['Coles', 'Woolworths', 'Aldi', 'IGA', 'Harris Farm', 'Costco']);

export async function scrapeRetailerWithStatus(retailer: RetailerName, query: string): Promise<ScraperResult> {
  let result: ScraperResult;
  switch (retailer) {
    case 'Coles':       result = await scrapeColes(query); break;
    case 'Woolworths':  result = await scrapeWoolworths(query); break;
    case 'Aldi':        result = await scrapeAldi(query); break;
    case 'IGA':         result = await scrapeIGA(query); break;
    case 'Costco':      result = await scrapeCostco(query); break;
    case 'Harris Farm': result = await scrapeHarrisFarm(query); break;
    case 'Amazon AU':   result = await scrapeAmazon(query); break;
    case 'Target':      result = await scrapeTarget(query); break;
    case 'Officeworks': result = await scrapeOfficeworks(query); break;
    case 'Big W':       result = await scrapeBigW(query); break;
    case 'Kmart':       return blockedRetailer('Kmart', 'Kmart blocks automated access.');
    case 'Chemist Warehouse': return blockedRetailer('Chemist Warehouse', 'Chemist Warehouse blocks automated access.');
    case 'Priceline':   return blockedRetailer('Priceline', 'Priceline blocks automated access.');
    default:            return { retailer, results: [], status: 'error', message: 'Unknown retailer' };
  }

  // Only use Google Shopping when the retailer request failed outright.
  // If a retailer returned "empty", keep that signal instead of inventing weak substitutes.
  if (result.status === 'error' && GROCERY_RETAILERS.has(retailer)) {
    try {
      const domain = RETAILER_DOMAIN[retailer];
      const gSearch = await scrapeGoogleShopping(query, domain);
      if (gSearch.results.length > 0) {
        // Tag results with correct retailer
        const taggedResults = gSearch.results.map((r) => ({ ...r, retailer, storeBranch: 'via Google Shopping' }));
        return { retailer, results: taggedResults, status: 'ok', message: 'Results via Google Shopping' };
      }
    } catch { /* ignore */ }
  }

  return result;
}
