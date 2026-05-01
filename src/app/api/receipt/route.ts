/**
 * POST /api/receipt
 *
 * Accepts a multipart/form-data upload with:
 *   - image: File (JPEG/PNG/WebP, max 10MB)
 *   - retailer?: string (optional hint)
 *   - userToken: string (anonymous session ID for gamification)
 *
 * Returns immediately with a submission ID, then processes async.
 * Poll GET /api/receipt/[id] for results.
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createReceiptSubmission } from '@/lib/db';
import { parseReceiptImage, commitReceiptToPriceDb } from '@/lib/receipt-ocr';
import fs from 'fs';
import path from 'path';

const UPLOAD_DIR =
  process.env.NODE_ENV === 'production' ? '/tmp/receipts' : path.join(process.cwd(), 'data', 'receipts');

export const runtime = 'nodejs';
export const maxDuration = 60; // Gemini Vision can take ~10s on large images

export async function POST(req: NextRequest) {
  try {
    // Ensure upload dir exists
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

    const formData = await req.formData();
    const imageFile = formData.get('image') as File | null;
    const retailerHint = formData.get('retailer') as string | null;
    const userToken = (formData.get('userToken') as string | null) ?? `anon-${uuidv4().slice(0, 8)}`;

    if (!imageFile) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(imageFile.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${imageFile.type}. Use JPEG, PNG or WebP.` },
        { status: 400 },
      );
    }

    // Validate file size (10MB max)
    if (imageFile.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image too large. Max 10MB.' }, { status: 400 });
    }

    // Save to disk
    const id = uuidv4();
    const ext = imageFile.type === 'image/png' ? 'png' : imageFile.type === 'image/webp' ? 'webp' : 'jpg';
    const filePath = path.join(UPLOAD_DIR, `${id}.${ext}`);
    const buffer = Buffer.from(await imageFile.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    // Create DB record immediately (status: pending)
    createReceiptSubmission(id, userToken, filePath, retailerHint ?? undefined);

    // Process asynchronously (fire-and-forget, return ID to client)
    processReceiptAsync(id, buffer, imageFile.type as 'image/jpeg' | 'image/png' | 'image/webp').catch(
      (err) => console.error('[receipt] async processing failed:', err),
    );

    return NextResponse.json({
      id,
      status: 'processing',
      message: 'Receipt uploaded! Processing with AI — check back in a few seconds.',
      pollUrl: `/api/receipt/${id}`,
    });
  } catch (err) {
    console.error('[receipt] POST error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

async function processReceiptAsync(
  id: string,
  buffer: Buffer,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp',
) {
  const { updateReceiptResult } = await import('@/lib/db');
  try {
    const receipt = await parseReceiptImage(buffer, mimeType);
    const { written, skipped, points } = commitReceiptToPriceDb(id, receipt);
    console.log(
      `[receipt] ${id} processed: ${written} items written, ${skipped} skipped, ${points} points`,
    );
  } catch (err) {
    console.error(`[receipt] processing error for ${id}:`, err);
    updateReceiptResult(id, {
      status: 'failed',
      rawOcrText: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}
