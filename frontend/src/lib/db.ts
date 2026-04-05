/**
 * Local-first IndexedDB storage using Dexie.js
 *
 * All user data (bets, accounts, bankroll snapshots, budget, settings)
 * is persisted locally in the browser. The backend is the source of truth
 * for live data, but IndexedDB ensures the user always has access to their
 * data even when the backend is offline or their subscription lapses.
 */

import Dexie, { type EntityTable } from 'dexie';

/* ─── Table Interfaces ──────────────────────────────────── */

export interface LocalBet {
  /** Composite key: `${bet_id}` from backend */
  id: string;
  bet_id: string;
  broker: string;
  sport: string;
  legs: Array<{ selection?: string; odds?: number; status?: string; [key: string]: unknown }>;
  stake: number;
  odds: number;
  expected_value: number;
  status: string;
  result: string | null;
  placed_at: string;
  settled_at: string | null;
  /** When this record was last synced from the backend */
  synced_at: number;
}

export interface LocalAccount {
  account_id: string;
  name: string;
  balance: number;
  total_bet_winnings: number;
  total_bet_losses: number;
  net_betting_pnl: number;
  is_limited: boolean;
  is_gubbed: boolean;
  transaction_count: number;
  synced_at: number;
}

export interface LocalBankrollSnapshot {
  /** Auto-incremented */
  id?: number;
  bankroll: number;
  daily_pnl: number;
  win_rate: number;
  total_bets: number;
  avg_odds: number;
  roi: number;
  kelly_fraction: number;
  max_daily_stake: number;
  stop_loss_hit: boolean;
  exposure_total_open_stake: number;
  exposure_open_bet_count: number;
  exposure_pct: number;
  by_broker: Record<string, number>;
  by_sport: Record<string, number>;
  snapshot_at: number;
}

export interface LocalBudget {
  period: 'daily' | 'weekly' | 'monthly';
  limit: number;
  spent: number;
  remaining: number;
  utilisation_pct: number;
  period_start: string;
  period_end: string;
  synced_at: number;
}

export interface LocalSettings {
  /** Allowed setting keys for type safety */
  key: 'riskLevel' | 'dailyLimit' | 'weeklyLimit' | 'monthlyLimit' | 'activeSports' | 'notifications' | 'draymondUrl';
  value: string;
  updated_at: number;
}

/* ─── Database Class ────────────────────────────────────── */

class SportsStevoDB extends Dexie {
  bets!: EntityTable<LocalBet, 'id'>;
  accounts!: EntityTable<LocalAccount, 'account_id'>;
  bankrollSnapshots!: EntityTable<LocalBankrollSnapshot, 'id'>;
  budgets!: EntityTable<LocalBudget, 'period'>;
  settings!: EntityTable<LocalSettings, 'key'>;

  constructor() {
    super('SportsSteveBetBuddy');

    this.version(1).stores({
      bets: 'id, bet_id, broker, sport, status, placed_at, settled_at, synced_at',
      accounts: 'account_id, name, synced_at',
      bankrollSnapshots: '++id, snapshot_at',
      budgets: 'period, synced_at',
      settings: 'key',
    });
  }
}

/**
 * Direct database instance export.
 * Dexie defers the actual IndexedDB connection until the first query is
 * executed, so constructing at module scope is safe in SSR/Node contexts
 * where IndexedDB is absent — as long as no query is run server-side.
 */
export const db = new SportsStevoDB();

/* ─── Sync Helpers ──────────────────────────────────────── */

/**
 * Upsert bets from backend response into IndexedDB.
 * Preserves any bets already stored even if backend returns a subset.
 */
export async function syncBets(
  backendBets: Array<{
    id: string;
    bet_id: string;
    broker: string;
    sport: string;
    legs: Array<{ selection?: string; odds?: number; status?: string; [key: string]: unknown }>;
    stake: number;
    odds: number;
    expected_value: number;
    status: string;
    result: string | null;
    placed_at: string;
    settled_at: string | null;
  }>,
): Promise<void> {
  const now = Date.now();
  const records: LocalBet[] = backendBets.map((b) => ({
    ...b,
    synced_at: now,
  }));
  await db.bets.bulkPut(records);
}

/**
 * Upsert accounts from backend response into IndexedDB.
 */
export async function syncAccounts(
  backendAccounts: Array<{
    account_id: string;
    name: string;
    balance: number;
    total_bet_winnings: number;
    total_bet_losses: number;
    net_betting_pnl: number;
    is_limited: boolean;
    is_gubbed: boolean;
    transaction_count: number;
  }>,
): Promise<void> {
  const now = Date.now();
  const records: LocalAccount[] = backendAccounts.map((a) => ({
    ...a,
    synced_at: now,
  }));
  await db.accounts.bulkPut(records);
}

/**
 * Store a bankroll snapshot. We keep a rolling history so users
 * can see their bankroll over time (local-only analytics).
 * Deduplicates by checking if the last snapshot has the same bankroll value
 * within a short time window (< 30s) to avoid duplicate writes from overlapping polls.
 */
export async function syncBankroll(data: {
  bankroll: number;
  daily_pnl: number;
  win_rate: number;
  total_bets: number;
  avg_odds: number;
  roi: number;
  kelly_fraction: number;
  max_daily_stake: number;
  stop_loss_hit: boolean;
  exposure: {
    total_open_stake: number;
    open_bet_count: number;
    by_broker?: Record<string, number>;
    by_sport?: Record<string, number>;
    exposure_pct: number;
  };
}): Promise<void> {
  const now = Date.now();

  // Wrap dedup check + insert in a transaction to prevent TOCTOU race
  // where two concurrent polls could both pass the dedup check and insert duplicates.
  await db.transaction('rw', db.bankrollSnapshots, async () => {
    const latest = await db.bankrollSnapshots.orderBy('snapshot_at').last();
    if (latest && (now - latest.snapshot_at) < 30_000 && latest.bankroll === data.bankroll) {
      return; // duplicate — skip
    }

    await db.bankrollSnapshots.add({
      bankroll: data.bankroll,
      daily_pnl: data.daily_pnl,
      win_rate: data.win_rate,
      total_bets: data.total_bets,
      avg_odds: data.avg_odds,
      roi: data.roi,
      kelly_fraction: data.kelly_fraction,
      max_daily_stake: data.max_daily_stake,
      stop_loss_hit: data.stop_loss_hit,
      exposure_total_open_stake: data.exposure.total_open_stake,
      exposure_open_bet_count: data.exposure.open_bet_count,
      exposure_pct: data.exposure.exposure_pct,
      by_broker: data.exposure.by_broker ?? {},
      by_sport: data.exposure.by_sport ?? {},
      snapshot_at: now,
    });
  });

  // Keep only last 1000 snapshots to avoid bloat.
  // Done outside the above transaction (read-only concern, best-effort).
  await db.transaction('rw', db.bankrollSnapshots, async () => {
    const count = await db.bankrollSnapshots.count();
    if (count > 1000) {
      const oldest = await db.bankrollSnapshots
        .orderBy('snapshot_at')
        .limit(count - 1000)
        .toArray();
      // Filter out any records whose auto-increment id is undefined before deleting
      const ids = oldest.map((s) => s.id).filter((id): id is number => id !== undefined);
      await db.bankrollSnapshots.bulkDelete(ids);
    }
  });
}

/**
 * Upsert budget data from backend.
 */
export async function syncBudgets(
  budgets: Record<
    string,
    {
      limit: number;
      spent: number;
      remaining: number;
      utilisation_pct: number;
      period_start: string;
      period_end: string;
    }
  >,
): Promise<void> {
  const now = Date.now();
  const records: LocalBudget[] = Object.entries(budgets).map(([period, data]) => ({
    period: period as LocalBudget['period'],
    ...data,
    synced_at: now,
  }));
  await db.budgets.bulkPut(records);
}

/** Allowed setting keys — add new keys here to maintain type safety */
export type SettingKey = LocalSettings['key'];

/**
 * Save a user setting locally.
 */
export async function saveSetting(key: SettingKey, value: string): Promise<void> {
  await db.settings.put({ key, value, updated_at: Date.now() });
}

/**
 * Get a user setting from local store.
 */
export async function getSetting(key: SettingKey): Promise<string | undefined> {
  const record = await db.settings.get(key);
  return record?.value;
}
