/**
 * API client for Sports Steve (FastAPI) backend.
 * In dev, Vite proxies /api/steve -> :8010.
 * In production, set VITE_STEVE_API_URL env var in Vercel.
 * Example:
 *   VITE_STEVE_API_URL=https://sports-steve-api.railway.app/api/v1
 *
 * NOTE: Bet Buddy functionality is now handled client-side via src/lib/betBuddy.ts.
 * No backend needed for odds, stats, bankroll math, or data export.
 *
 * AUTH NOTE: Authentication tokens are handled by the backend via session cookies
 * (HttpOnly). No explicit Authorization header is needed on the frontend — the
 * browser includes cookies automatically. Cross-origin requests rely on
 * credentials: 'include' if the backend is on a different origin.
 */

const STEVE_BASE = import.meta.env.VITE_STEVE_API_URL ?? '/api/steve';

// Warn in dev if the env var is missing so misconfiguration is caught early
if (import.meta.env.DEV && !import.meta.env.VITE_STEVE_API_URL) {
  console.warn(
    '[client.ts] VITE_STEVE_API_URL is not set — falling back to /api/steve proxy. ' +
    'Set this env var for production deployments.',
  );
}

/* --- Typed API Error ------------------------------------------------- */

/** Carries the HTTP status code so callers can branch on specific errors */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/* --- Generic Fetch Helper ------------------------------------------- */

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  // Only set Content-Type for requests that send a body (POST, PUT, PATCH)
  // GET/DELETE without body don't need it and it can trigger unnecessary CORS preflights.
  const computedHeaders: Record<string, string> = {};
  if (options?.body) {
    computedHeaders['Content-Type'] = 'application/json';
    // CSRF mitigation: non-standard header forces a CORS preflight, which blocks
    // cross-origin form-based CSRF attacks. Browsers include it on same-origin requests.
    computedHeaders['X-Requested-With'] = 'XMLHttpRequest';
  }

  // Spread order: computed headers first, then caller-supplied headers.
  // Caller-supplied headers take precedence (e.g. to override Content-Type).
  const res = await fetch(url, {
    ...options,
    headers: { ...computedHeaders, ...options?.headers },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ApiError(res.status, `API ${res.status}: ${body || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/* --- Sports Steve API ----------------------------------------------- */

export const steve = {
  /* Trigger endpoints */

  /** Trigger the daily bet assessment */
  triggerDailyRun: () =>
    apiFetch<{ status: string }>(`${STEVE_BASE}/daily-run`, { method: 'POST' }),

  /** Trigger bet resolution */
  resolveBets: () =>
    apiFetch<{ status: string }>(`${STEVE_BASE}/resolve-bets`, { method: 'POST' }),

  /* Read endpoints */

  /** Health check - returns scheduler status, active sports, bankroll */
  health: () =>
    apiFetch<{
      status: string;
      scheduler_running: boolean;
      active_sports: string[];
      bankroll: number;
      timestamp: string;
    }>(`${STEVE_BASE}/health`),

  /** Full bankroll and risk state */
  getBankroll: () =>
    apiFetch<{
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
    }>(`${STEVE_BASE}/bankroll`),

  /** Full bet history */
  getBets: () =>
    apiFetch<{
      bets: Array<{
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
      }>;
      count: number;
    }>(`${STEVE_BASE}/bets`),

  /** Pending bets only */
  getPendingBets: () =>
    apiFetch<{
      bets: Array<{
        id: string;
        bet_id: string;
        broker: string;
        sport: string;
        legs?: Array<{ selection?: string; odds?: number; status?: string; [key: string]: unknown }>;
        stake: number;
        odds: number;
        placed_at: string;
      }>;
      count: number;
    }>(`${STEVE_BASE}/bets/pending`),

  /** Current risk exposure */
  getExposure: () =>
    apiFetch<{
      total_open_stake: number;
      open_bet_count: number;
      by_broker: Record<string, number>;
      by_sport: Record<string, number>;
      exposure_pct: number;
    }>(`${STEVE_BASE}/exposure`),

  /** Sportsbook account balances and health */
  getAccounts: () =>
    apiFetch<{
      accounts: Array<{
        name: string;
        account_id: string;
        balance: number;
        total_bet_winnings: number;
        total_bet_losses: number;
        net_betting_pnl: number;
        is_limited: boolean;
        is_gubbed: boolean;
        transaction_count: number;
      }>;
      total_balance: number;
      health_flags: unknown[];
    }>(`${STEVE_BASE}/accounts`),

  /** Budget usage for current period */
  getBudget: () =>
    apiFetch<{
      budgets: Record<string, {
        limit: number;
        spent: number;
        remaining: number;
        utilisation_pct: number;
        period_start: string;
        period_end: string;
      }>;
      has_budgets: boolean;
    }>(`${STEVE_BASE}/budget`),

  /** Update runtime settings (budget limits, kelly fraction, etc.) */
  updateSettings: (settings: {
    daily_limit?: number;
    weekly_limit?: number;
    monthly_limit?: number;
    kelly_fraction?: number;
    max_daily_stake?: number;
  }) =>
    apiFetch<{ status: string; applied: string[] }>(`${STEVE_BASE}/settings`, {
      method: 'POST',
      body: JSON.stringify(settings),
    }),
};