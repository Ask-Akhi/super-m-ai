/**
 * GET /api/receipt/[id]
 * Poll for receipt processing status and results.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getReceiptSubmission, getUserStats } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const row = getReceiptSubmission(id) as {
    id: string;
    user_token: string;
    retailer: string | null;
    status: string;
    parsed_items: string | null;
    savings_points: number;
    items_validated: number;
    submitted_at: string;
    processed_at: string | null;
    raw_ocr_text: string | null;
  } | undefined;

  if (!row) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
  }

  const items = row.parsed_items ? JSON.parse(row.parsed_items) : null;
  const userStats = row.status === 'done' ? getUserStats(row.user_token) : null;

  return NextResponse.json({
    id: row.id,
    status: row.status,
    retailer: row.retailer,
    submittedAt: row.submitted_at,
    processedAt: row.processed_at,
    itemsValidated: row.items_validated,
    savingsPoints: row.savings_points,
    items,
    // Only include error text if failed
    error: row.status === 'failed' ? row.raw_ocr_text : undefined,
    // Gamification stats
    userStats: userStats ?? undefined,
    // Motivational message
    message: buildMessage(row.status, row.items_validated, row.savings_points),
  });
}

function buildMessage(status: string, itemsValidated: number, points: number): string {
  if (status === 'pending' || status === 'processing') return '🔍 AI is reading your receipt...';
  if (status === 'failed') return '❌ Couldn\'t read the receipt. Try a clearer photo!';
  if (itemsValidated === 0) return '⚠️ No items could be confidently extracted.';
  const bonus = points >= 150 ? ' Bonus points for a big shop! 🎉' : '';
  return `✅ Added ${itemsValidated} item${itemsValidated !== 1 ? 's' : ''} to our price database! You earned ${points} points.${bonus}`;
}
