/**
 * GET /api/leaderboard
 * Returns top contributors (gamification).
 *
 * GET /api/leaderboard?token=xxx
 * Returns the calling user's personal stats.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLeaderboard, getUserStats } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');

  if (token) {
    const stats = getUserStats(token);
    return NextResponse.json({
      userToken: token,
      receiptsScanned: stats?.receipts_scanned ?? 0,
      totalPoints: stats?.total_points ?? 0,
      itemsContributed: stats?.items_contributed ?? 0,
      rank: await getUserRank(token),
      tier: getTier(stats?.total_points ?? 0),
    });
  }

  const board = getLeaderboard(10);
  return NextResponse.json({
    leaderboard: board.map((row, i) => ({
      rank: i + 1,
      userToken: maskToken(row.user_token),
      totalPoints: row.total_points,
      receiptsScanned: row.receipts,
      tier: getTier(row.total_points),
    })),
  });
}

async function getUserRank(token: string): Promise<number> {
  const board = getLeaderboard(1000);
  const idx = board.findIndex((r) => r.user_token === token);
  return idx === -1 ? 999 : idx + 1;
}

function maskToken(token: string): string {
  // Show first 4 chars + *** for privacy
  return token.slice(0, 4) + '***';
}

function getTier(points: number): { name: string; emoji: string; nextAt: number | null } {
  if (points >= 2000) return { name: 'Price Legend',   emoji: '👑', nextAt: null };
  if (points >= 750)  return { name: 'Deal Hunter',    emoji: '🏆', nextAt: 2000 };
  if (points >= 250)  return { name: 'Savvy Shopper',  emoji: '🥈', nextAt: 750 };
  if (points >= 50)   return { name: 'Bargain Finder', emoji: '🥉', nextAt: 250 };
  return              { name: 'Newcomer',       emoji: '🌱', nextAt: 50 };
}
