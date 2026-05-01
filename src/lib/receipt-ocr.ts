/**
 * receipt-ocr.ts — Gemini Vision receipt parser
 *
 * Takes an image buffer (JPEG/PNG/WebP), sends it to Gemini 1.5 Flash
 * (cheap, fast, excellent at structured data extraction), and returns
 * a structured list of items with prices, plus the detected retailer.
 *
 * Confidence scoring:
 *  - Each item gets a 0-1 confidence score
 *  - Items with low confidence are flagged for human review
 *  - Receipt-level confidence gates whether we write to the price DB
 */

import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { RetailerName } from '@/types';
import { ReceiptItem, writePrices, updateReceiptResult, PriceRecord } from './db';

const KNOWN_RETAILERS: RetailerName[] = [
  'Coles', 'Woolworths', 'Aldi', 'IGA', 'Costco', 'Harris Farm', 'Amazon AU',
];

export interface ParsedReceipt {
  retailer?: RetailerName;
  storeBranch?: string;
  purchaseDate?: string;
  items: Array<ReceiptItem & { confidence: number; canonical?: string }>;
  totalOnReceipt?: number;
  receiptConfidence: number; // overall 0-1
  warnings: string[];
}

const RECEIPT_PROMPT = `You are an expert Australian grocery receipt parser.

Analyse this receipt image and return ONLY valid JSON matching this schema — no markdown, no explanation:

{
  "retailer": "<one of: Coles|Woolworths|Aldi|IGA|Costco|Harris Farm|Amazon AU|Other>",
  "store_branch": "<branch/suburb if visible, else null>",
  "purchase_date": "<ISO date YYYY-MM-DD if visible, else null>",
  "items": [
    {
      "name": "<exact product name from receipt>",
      "canonical": "<normalised name e.g. 'Full Cream Milk 2L'>",
      "price": <number, individual unit price in AUD>,
      "qty": <number or null>,
      "unit": "<string e.g. 'kg' or null>",
      "on_sale": <true|false>,
      "confidence": <0.0-1.0>
    }
  ],
  "total": <number or null>,
  "receipt_confidence": <0.0-1.0, overall how legible/complete the receipt is>
}

Rules:
- Only include items that are grocery/household products (skip loyalty points, bags, service fees).
- If the receipt is blurry or partially cut off, lower receipt_confidence accordingly.
- Price must be the PER-UNIT price (divide by qty if shown as multi-buy e.g. "2 × $1.50").
- Australian dollars only — if no $ symbol, assume AUD.
- on_sale = true if you see a special/sale indicator next to the item.`;

export async function parseReceiptImage(
  imageBuffer: Buffer,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg',
): Promise<ParsedReceipt> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const genai = new GoogleGenerativeAI(apiKey);
  const model = genai.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const imagePart: Part = {
    inlineData: {
      data: imageBuffer.toString('base64'),
      mimeType,
    },
  };

  const result = await model.generateContent([RECEIPT_PROMPT, imagePart]);
  const text = result.response.text().trim();

  // Strip potential markdown code fences
  const jsonText = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();

  let raw: {
    retailer?: string;
    store_branch?: string;
    purchase_date?: string;
    items?: Array<{
      name?: string;
      canonical?: string;
      price?: number;
      qty?: number;
      unit?: string;
      on_sale?: boolean;
      confidence?: number;
    }>;
    total?: number;
    receipt_confidence?: number;
  };

  try {
    raw = JSON.parse(jsonText);
  } catch {
    throw new Error(`Gemini returned invalid JSON: ${jsonText.slice(0, 200)}`);
  }

  const warnings: string[] = [];
  const detectedRetailer = KNOWN_RETAILERS.find(
    (r) => r.toLowerCase() === (raw.retailer ?? '').toLowerCase(),
  );

  if (!detectedRetailer) warnings.push(`Could not identify retailer: "${raw.retailer}"`);

  const items = (raw.items ?? [])
    .filter((i) => i.name && typeof i.price === 'number' && i.price > 0)
    .map((i) => ({
      name: i.name!,
      canonical: i.canonical,
      price: i.price!,
      qty: i.qty ?? 1,
      unit: i.unit,
      on_sale: i.on_sale ?? false,
      confidence: typeof i.confidence === 'number' ? i.confidence : 0.8,
    }));

  const lowConfItems = items.filter((i) => i.confidence < 0.7);
  if (lowConfItems.length > 0)
    warnings.push(`${lowConfItems.length} item(s) have low confidence — review before trusting`);

  return {
    retailer: detectedRetailer,
    storeBranch: raw.store_branch ?? undefined,
    purchaseDate: raw.purchase_date ?? undefined,
    items,
    totalOnReceipt: raw.total ?? undefined,
    receiptConfidence: raw.receipt_confidence ?? 0.5,
    warnings,
  };
}

// ── Write receipt items back to price DB ─────────────────────────────────────
export function commitReceiptToPriceDb(
  receiptId: string,
  receipt: ParsedReceipt,
): { written: number; skipped: number; points: number } {
  if (!receipt.retailer) return { written: 0, skipped: receipt.items.length, points: 0 };

  // Only commit items with confidence ≥ 0.75 and receipt confidence ≥ 0.6
  const threshold = 0.75;
  const eligible = receipt.items.filter(
    (i) => i.confidence >= threshold && receipt.receiptConfidence >= 0.6,
  );
  const skipped = receipt.items.length - eligible.length;

  const records: PriceRecord[] = eligible.map((item) => ({
    retailer: receipt.retailer!,
    product_name: item.canonical ?? item.name,
    price: item.price,
    unit: item.unit,
    source: 'receipt',
    confidence: item.confidence * receipt.receiptConfidence, // combined confidence
    in_stock: true,
    on_sale: item.on_sale,
    observed_at: receipt.purchaseDate
      ? new Date(receipt.purchaseDate).toISOString()
      : new Date().toISOString(),
  }));

  if (records.length > 0) writePrices(records);

  // Points: 10 per item written, bonus 50 if total validated > 5
  const points = eligible.length * 10 + (eligible.length >= 5 ? 50 : 0);

  updateReceiptResult(receiptId, {
    parsedItems: eligible,
    status: 'done',
    savingsPoints: points,
    itemsValidated: eligible.length,
  });

  return { written: eligible.length, skipped, points };
}
