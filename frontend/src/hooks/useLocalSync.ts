/**
 * useLocalSync — React hook for local-first data syncing.
 *
 * Pattern:
 *   1. On mount, read cached data from IndexedDB immediately (instant render).
 *   2. Fetch from backend in background.
 *   3. If backend responds, update IndexedDB + React state.
 *   4. If backend is offline, keep showing cached data.
 *   5. Poll on interval, writing every response to IndexedDB.
 *
 * The user always sees their data, even offline.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { db, syncBets, syncAccounts, syncBankroll, syncBudgets } from '../lib/db';
import type { LocalBet, LocalAccount, LocalBudget } from '../lib/db';
import { steve } from '../api/client';

/* ─── Types ─────────────────────────────────────────────── */

interface BankrollState {
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
    by_broker: Record<string, number>;
    by_sport: Record<string, number>;
    exposure_pct: number;
  };
}

const EMPTY_BANKROLL: BankrollState = {
  bankroll: 0, daily_pnl: 0, win_rate: 0, total_bets: 0, avg_odds: 0, roi: 0,
  kelly_fraction: 0.25, max_daily_stake: 0, stop_loss_hit: false,
  exposure: { total_open_stake: 0, open_bet_count: 0, by_broker: {}, by_sport: {}, exposure_pct: 0 },
};

export interface SyncState {
  bets: LocalBet[];
  bankroll: BankrollState;
  accounts: LocalAccount[];
  budgets: LocalBudget[];
  loading: boolean;
  offline: boolean;
  lastSynced: number | null;
  /** Force an immediate refresh from the backend */
  refresh: () => Promise<void>;
}

/* ─── Hook ──────────────────────────────────────────────── */

export function useLocalSync(pollIntervalMs = 60_000): SyncState {
  const [bets, setBets] = useState<LocalBet[]>([]);
  const [bankroll, setBankroll] = useState<BankrollState>(EMPTY_BANKROLL);
  const [accounts, setAccounts] = useState<LocalAccount[]>([]);
  const [budgets, setBudgets] = useState<LocalBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  // Initialized to false here; set true inside useEffect to avoid Strict Mode
  // double-invocation marking the component as unmounted before it has mounted.
  const mounted = useRef(false);
  // Prevents overlapping concurrent fetches when the poll interval is short.
  const fetching = useRef(false);

  /** Load cached data from IndexedDB (instant, no network) */
  const loadFromCache = useCallback(async () => {
    try {
      const [cachedBets, cachedAccounts, cachedBudgets, latestSnapshot] = await Promise.all([
        db.bets.orderBy('placed_at').reverse().toArray(),
        db.accounts.toArray(),
        db.budgets.toArray(),
        db.bankrollSnapshots.orderBy('snapshot_at').last(),
      ]);

      if (!mounted.current) return;

      if (cachedBets.length > 0) setBets(cachedBets);
      if (cachedAccounts.length > 0) setAccounts(cachedAccounts);
      if (cachedBudgets.length > 0) setBudgets(cachedBudgets);
      if (latestSnapshot) {
        setBankroll({
          bankroll: latestSnapshot.bankroll,
          daily_pnl: latestSnapshot.daily_pnl,
          win_rate: latestSnapshot.win_rate,
          total_bets: latestSnapshot.total_bets,
          avg_odds: latestSnapshot.avg_odds,
          roi: latestSnapshot.roi,
          kelly_fraction: latestSnapshot.kelly_fraction,
          max_daily_stake: latestSnapshot.max_daily_stake,
          stop_loss_hit: latestSnapshot.stop_loss_hit,
          exposure: {
            total_open_stake: latestSnapshot.exposure_total_open_stake,
            open_bet_count: latestSnapshot.exposure_open_bet_count,
            by_broker: latestSnapshot.by_broker ?? {},
            by_sport: latestSnapshot.by_sport ?? {},
            exposure_pct: latestSnapshot.exposure_pct,
          },
        });
      }
    } catch {
      // IndexedDB not available -- graceful fallback
    }
  }, []);

  /** Fetch from backend and sync to IndexedDB */
  const fetchAndSync = useCallback(async () => {
    // Skip if a fetch is already in flight (prevents overlapping poll calls)
    if (fetching.current) return;
    fetching.current = true;
    try {
      const [bankrollResp, betsResp, accountsResp, budgetResp] = await Promise.all([
        steve.getBankroll(),
        steve.getBets(),
        steve.getAccounts(),
        steve.getBudget(),
      ]);

      if (!mounted.current) return;

      // Compute timestamp once so React state and IndexedDB records are consistent
      const now = Date.now();

      // Update React state
      setBankroll(bankrollResp);
      setBets(betsResp.bets.map((b) => ({ ...b, synced_at: now })));
      setAccounts(
        accountsResp.accounts.map((a) => ({ ...a, synced_at: now })),
      );

      const budgetList: LocalBudget[] = Object.entries(budgetResp.budgets).map(
        ([period, data]) => ({
          period: period as LocalBudget['period'],
          ...data,
          synced_at: now,
        }),
      );
      setBudgets(budgetList);

      setOffline(false);
      setLastSynced(now);

      // Persist to IndexedDB in background (non-blocking).
      // These writes intentionally continue even if the component unmounts
      // to ensure local data is always up to date for the next mount.
      syncBets(betsResp.bets).catch(() => {});
      syncBankroll(bankrollResp).catch(() => {});
      syncAccounts(accountsResp.accounts).catch(() => {});
      syncBudgets(budgetResp.budgets).catch(() => {});
    } catch {
      if (mounted.current) {
        setOffline(true);
      }
    } finally {
      fetching.current = false;
    }
  }, []);

  /** Combined load: cache first, then network */
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await loadFromCache();
      await fetchAndSync();
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [loadFromCache, fetchAndSync]);

  // Initial load
  useEffect(() => {
    mounted.current = true;

    async function init() {
      await loadFromCache();
      if (mounted.current) setLoading(false);
      await fetchAndSync();
    }

    init().catch(() => {
      // Graceful fallback if init fails entirely (e.g. IndexedDB unavailable)
      if (mounted.current) {
        setLoading(false);
        setOffline(true);
      }
    });

    // Poll
    const interval = setInterval(fetchAndSync, pollIntervalMs);

    return () => {
      mounted.current = false;
      clearInterval(interval);
    };
  }, [loadFromCache, fetchAndSync, pollIntervalMs]);

  return { bets, bankroll, accounts, budgets, loading, offline, lastSynced, refresh };
}
