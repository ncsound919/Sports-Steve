import { useState } from "react";
import { GlassCard, StatCard } from "../components/ui/GlassCard";
import { useMode } from "../contexts/ModeContext";
import { steve } from "../api/client";

interface Pick {
  player: string;
  stat_type: string;
  pp_line: number;
  odds: number;
  pp_projection_id: string;
  game_id: string;
  oddsapi_home: string;
  oddsapi_away: string;
  oddsapi_line: string;
  edge: number;
  sport: string;
}

export default function Picks() {
  const { isBeginner } = useMode();
  const [picks, setPicks] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(false);
  const [sport, setSport] = useState("NBA");
  const [minEdge, setMinEdge] = useState(0.05);

  const handleFetch = async () => {
    setLoading(true);
    try {
      const result = await steve.getPicks(sport, minEdge);
      setPicks(result.picks);
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  };

  const positiveEdge = picks.filter((p) => p.edge > 0);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight">
            {isBeginner ? "Best Bets" : "PrizePicks Picks"}
          </h1>
          <p className="text-text-secondary mt-1 text-sm">
            {isBeginner
              ? "Here's the best props matched to odds API."
              : "PrizePicks props with Odds API edge analysis."}
          </p>
        </div>
      </div>

      {/* Controls */}
      <GlassCard>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs text-text-muted mb-1">Sport</label>
            <select
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              className="glass-sm px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm"
            >
              <option value="NBA">NBA</option>
              <option value="NFL">NFL</option>
              <option value="NHL">NHL</option>
              <option value="MLB">MLB</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Min Edge</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={minEdge}
              onChange={(e) => setMinEdge(parseFloat(e.target.value))}
              className="glass-sm px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm w-20"
            />
          </div>
          <button
            onClick={handleFetch}
            disabled={loading}
            className="glass-sm px-5 py-2 text-sm font-medium text-win border border-win/20 hover:bg-win/10 transition-all"
          >
            {loading ? "Loading..." : "Find Picks"}
          </button>
        </div>
      </GlassCard>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Matches Found"
          value={picks.length.toString()}
          trend="neutral"
        />
        <StatCard
          label="Positive Edge"
          value={positiveEdge.length.toString()}
          trend={positiveEdge.length > 0 ? "up" : "down"}
        />
        <StatCard
          label="Best Edge"
          value={picks.length > 0 && positiveEdge.length > 0 ? `${(Math.max(...positiveEdge.map((p) => p.edge)) * 100).toFixed(1)}%` : "--"}
          trend={picks.length > 0 ? "up" : "neutral"}
        />
      </div>

      {/* Picks List */}
      <div>
        <h2 className="text-lg font-semibold font-display mb-4">Matched Picks</h2>
        <div className="space-y-2">
          {picks.length === 0 && !loading && (
            <div className="text-center py-10 text-text-muted text-sm">
              No picks found. Adjust filters or try a different sport.
            </div>
          )}
          {picks.map((pick, idx) => (
            <GlassCard key={idx} padding="sm" hover className="flex items-center gap-4">
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  pick.edge > 0 ? "bg-win" : "bg-loss"
                }`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {pick.player}
                </p>
                <p className="text-xs text-text-muted">
                  {pick.stat_type} · {pick.sport}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-mono text-text-secondary">
                  {pick.pp_line}
                </p>
                <p className="text-[10px] text-text-muted">PP line</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-mono text-text-secondary">
                  {pick.oddsapi_line}
                </p>
                <p className="text-[10px] text-text-muted">odds API</p>
              </div>
              <div className="text-right w-20">
                <p
                  className={`text-sm font-bold stat-value ${
                    pick.edge > 0 ? "text-win" : "text-loss"
                  }`}
                >
                  {pick.edge > 0 ? "+" : ""}
                  {(pick.edge * 100).toFixed(1)}%
                </p>
                <p className="text-[10px] text-text-muted uppercase">edge</p>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </div>
  );
}