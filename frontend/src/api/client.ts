/**
 * Unified API client for Sports Steve (FastAPI) and Bet Buddy (Express) backends.
 * In dev, Vite proxies /api/steve → :8010 and /api/buddy → :3001.
 * In production, configure your reverse proxy accordingly.
 */

const STEVE_BASE = '/api/steve';
const BUDDY_BASE = '/api/buddy';

/* ─── Generic Fetch Helper ───────────────────────────── */

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/* ─── Sports Steve API ───────────────────────────────── */

export const steve = {
  /** Trigger the daily bet assessment */
  triggerDailyRun: () =>
    apiFetch<{ status: string }>(`${STEVE_BASE}/daily-run`, { method: 'POST' }),

  /** Trigger bet resolution */
  resolveBets: () =>
    apiFetch<{ status: string }>(`${STEVE_BASE}/resolve-bets`, { method: 'POST' }),
};

/* ─── Bet Buddy API ──────────────────────────────────── */

export const buddy = {
  /** Health check */
  health: () => apiFetch<{ status: string; features: string[] }>(`${BUDDY_BASE}/health`),

  /* — Odds Tools — */
  convertOdds: (odds: number, from: string, to: string) =>
    apiFetch<{ result: number }>(`${BUDDY_BASE}/tools/odds/convert`, {
      method: 'POST',
      body: JSON.stringify({ odds, from, to }),
    }),

  impliedProbability: (odds: number, format: string) =>
    apiFetch<{ result: number }>(`${BUDDY_BASE}/tools/odds/implied-probability`, {
      method: 'POST',
      body: JSON.stringify({ odds, format }),
    }),

  calculateReturn: (odds: number, stake: number, format: string) =>
    apiFetch<{ result: number; profit: number }>(`${BUDDY_BASE}/tools/odds/calculate-return`, {
      method: 'POST',
      body: JSON.stringify({ odds, stake, format }),
    }),

  /* — Statistics Tools — */
  kellyStake: (probability: number, odds: number, bankroll: number, fraction?: number) =>
    apiFetch<{ result: number; details: Record<string, number> }>(`${BUDDY_BASE}/tools/statistics/kelly`, {
      method: 'POST',
      body: JSON.stringify({ probability, odds, bankroll, fraction }),
    }),

  expectedValue: (probability: number, odds: number, stake: number) =>
    apiFetch<{ result: number }>(`${BUDDY_BASE}/tools/statistics/expected-value`, {
      method: 'POST',
      body: JSON.stringify({ probability, odds, stake }),
    }),

  /* — Bankroll Tools — */
  suggestedStake: (bankroll: number, edge: number, odds: number) =>
    apiFetch<{ result: number }>(`${BUDDY_BASE}/tools/bankroll/suggested-stake`, {
      method: 'POST',
      body: JSON.stringify({ bankroll, edge, odds }),
    }),

  responsibleGambling: (bankroll: number, sessionLength: number) =>
    apiFetch<{ limits: Record<string, number>; tips: string[] }>(
      `${BUDDY_BASE}/tools/bankroll/responsible-gambling`,
      { method: 'POST', body: JSON.stringify({ bankroll, sessionLength }) },
    ),

  /* — Export — */
  exportBets: (bets: unknown[], format: string) =>
    apiFetch<{ result: string }>(`${BUDDY_BASE}/tools/export`, {
      method: 'POST',
      body: JSON.stringify({ bets, format }),
    }),

  /* — Games — */
  listGames: () =>
    apiFetch<{ games: unknown[] }>(`${BUDDY_BASE}/games`),

  getBalance: () =>
    apiFetch<{ balance: number }>(`${BUDDY_BASE}/games/simvc/balance`),

  placeBet: (gameId: string, amount: number, selection: string) =>
    apiFetch<{ result: unknown }>(`${BUDDY_BASE}/games/bet`, {
      method: 'POST',
      body: JSON.stringify({ gameId, amount, selection }),
    }),
};
