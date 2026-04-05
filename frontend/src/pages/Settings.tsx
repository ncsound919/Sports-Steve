import { useState, useEffect, useRef } from "react";
import { GlassCard } from "../components/ui/GlassCard";
import { useMode } from "../contexts/ModeContext";
import { steve } from "../api/client";
import { saveSetting, getSetting } from "../lib/db";

export default function Settings() {
  const { mode, setMode, isBeginner } = useMode();
  const [riskLevel, setRiskLevel] = useState<"conservative" | "balanced" | "aggressive">(
    "balanced"
  );
  const [dailyLimit, setDailyLimit] = useState("25");
  const [weeklyLimit, setWeeklyLimit] = useState("100");
  const [monthlyLimit, setMonthlyLimit] = useState("300");
  const [activeSports, setActiveSports] = useState(["NBA"]);
  const [notifications, setNotifications] = useState(true);
  const [draymondUrl, setDraymondUrl] = useState("");
  const [draymondUrlError, setDraymondUrlError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "ok" | "error">("idle");
  // Prevent the setSaveStatus("idle") timeout from firing after unmount
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore settings from IndexedDB on mount
  useEffect(() => {
    // Cleanup timer on unmount to prevent setState after unmount
    return () => {
      if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    async function loadSettings() {
      try {
        const [risk, daily, weekly, monthly, sports, notif, dray] = await Promise.all([
          getSetting("riskLevel"),
          getSetting("dailyLimit"),
          getSetting("weeklyLimit"),
          getSetting("monthlyLimit"),
          getSetting("activeSports"),
          getSetting("notifications"),
          getSetting("draymondUrl"),
        ]);
        // Validate riskLevel before setting — reject any value not in the union
        const validRiskLevels = ["conservative", "balanced", "aggressive"] as const;
        if (risk && (validRiskLevels as readonly string[]).includes(risk)) {
          setRiskLevel(risk as "conservative" | "balanced" | "aggressive");
        }
        if (daily) setDailyLimit(daily);
        if (weekly) setWeeklyLimit(weekly);
        if (monthly) setMonthlyLimit(monthly);
        if (sports) {
          try { setActiveSports(JSON.parse(sports) as string[]); } catch { /* use default */ }
        }
        if (notif !== undefined && notif !== null) {
          try { setNotifications(JSON.parse(notif) as boolean); } catch { /* use default */ }
        }
        if (dray) setDraymondUrl(dray);
      } catch {
        // IndexedDB not available — use defaults
      }
    }
    loadSettings();
  }, []);

  const allSports = ["NBA", "NFL", "MLB", "NHL", "Soccer", "MMA", "Tennis"];

  const toggleSport = (sport: string) => {
    setActiveSports((prev) => {
      const next = prev.includes(sport) ? prev.filter((s) => s !== sport) : [...prev, sport];
      saveSetting("activeSports", JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const kellyFractionMap = { conservative: 0.1, balanced: 0.25, aggressive: 0.5 };

  /** Validate and set draymondUrl — only allow http:// or https:// schemes */
  const handleDraymondUrlChange = (val: string) => {
    setDraymondUrl(val);
    if (val && !/^https?:\/\//i.test(val)) {
      setDraymondUrlError("URL must start with http:// or https://");
    } else {
      setDraymondUrlError("");
    }
  };

  const handleSave = async () => {
    // Block save if URL is invalid
    if (draymondUrlError) return;

    setSaving(true);
    setSaveStatus("idle");
    const persistLocally = () =>
      Promise.all([
        saveSetting("riskLevel", riskLevel),
        saveSetting("dailyLimit", dailyLimit),
        saveSetting("weeklyLimit", weeklyLimit),
        saveSetting("monthlyLimit", monthlyLimit),
        saveSetting("activeSports", JSON.stringify(activeSports)),
        saveSetting("notifications", JSON.stringify(notifications)),
        saveSetting("draymondUrl", draymondUrl),
      ]);

    // Only send non-zero, non-empty limits to the backend.
    // An empty field means "leave unchanged", not "set to 0".
    const dailyNum = parseFloat(dailyLimit);
    const weeklyNum = parseFloat(weeklyLimit);
    const monthlyNum = parseFloat(monthlyLimit);
    const settingsPayload: Parameters<typeof steve.updateSettings>[0] = {
      kelly_fraction: kellyFractionMap[riskLevel],
    };
    if (!isNaN(dailyNum) && dailyLimit !== "") settingsPayload.daily_limit = dailyNum;
    if (!isNaN(weeklyNum) && weeklyLimit !== "") settingsPayload.weekly_limit = weeklyNum;
    if (!isNaN(monthlyNum) && monthlyLimit !== "") settingsPayload.monthly_limit = monthlyNum;

    try {
      await steve.updateSettings(settingsPayload);
      await persistLocally();
      setSaveStatus("ok");
    } catch {
      // Still persist locally even if backend is down
      await persistLocally().catch(() => {});
      setSaveStatus("error");
    } finally {
      setSaving(false);
      if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold font-display tracking-tight">Settings</h1>
        <p className="text-text-secondary mt-1 text-sm">
          Configure your betting experience and preferences.
        </p>
      </div>

      {/* Mode Selection */}
      <GlassCard>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-4">
          Experience Mode
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setMode("beginner")}
            className={`p-5 rounded-xl text-left transition-all duration-200
              ${
                mode === "beginner"
                  ? "bg-win/10 border-2 border-win/30"
                  : "bg-white/[0.03] border-2 border-transparent hover:border-border-glass-hover"
              }`}
          >
            <span className="text-2xl block mb-2">🌱</span>
            <h4 className="font-semibold text-white mb-1">Beginner Mode</h4>
            <p className="text-xs text-text-secondary leading-relaxed">
              Simplified interface with explanations, tooltips, and educational content.
              Perfect if you're new to sports betting.
            </p>
          </button>
          <button
            onClick={() => setMode("expert")}
            className={`p-5 rounded-xl text-left transition-all duration-200
              ${
                mode === "expert"
                  ? "bg-loss/10 border-2 border-loss/30"
                  : "bg-white/[0.03] border-2 border-transparent hover:border-border-glass-hover"
              }`}
          >
            <span className="text-2xl block mb-2">⚡</span>
            <h4 className="font-semibold text-white mb-1">Expert Mode</h4>
            <p className="text-xs text-text-secondary leading-relaxed">
              Full stats, advanced metrics, Kelly criterion details, CLV tracking,
              and all professional tools unlocked.
            </p>
          </button>
        </div>
      </GlassCard>

      {/* Risk Profile */}
      <GlassCard>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-4">
          {isBeginner ? "How Much Risk?" : "Risk Profile"}
        </h3>
        {isBeginner && (
          <p className="text-xs text-text-secondary mb-4">
            This controls how much Sports Steve will bet at once. Conservative is safest.
          </p>
        )}
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              {
                id: "conservative" as const,
                label: "Conservative",
                desc: "Small bets, steady growth",
                kelly: "1/4 Kelly (10%)",
                color: "win",
              },
              {
                id: "balanced" as const,
                label: "Balanced",
                desc: "Moderate risk and reward",
                kelly: "1/3 Kelly (25%)",
                color: "yellow-500",
              },
              {
                id: "aggressive" as const,
                label: "Aggressive",
                desc: "Larger bets, higher variance",
                kelly: "1/2 Kelly (50%)",
                color: "loss",
              },
            ] as const
          ).map((profile) => (
            <button
              key={profile.id}
              onClick={() => setRiskLevel(profile.id)}
              className={`p-4 rounded-xl text-center transition-all duration-200
                ${
                  riskLevel === profile.id
                    ? `bg-${profile.color}/10 border-2 border-${profile.color}/30`
                    : "bg-white/[0.03] border-2 border-transparent hover:border-border-glass-hover"
                }`}
            >
              <p className="text-sm font-semibold text-white">{profile.label}</p>
              <p className="text-[10px] text-text-muted mt-1">{profile.desc}</p>
              {!isBeginner && (
                <p className="text-[10px] text-text-muted mt-0.5 font-mono">{profile.kelly}</p>
              )}
            </button>
          ))}
        </div>
      </GlassCard>

      {/* Budget Limits */}
      <GlassCard>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-4">
          {isBeginner ? "Spending Limits" : "Budget Limits"}
        </h3>
        {isBeginner && (
          <p className="text-xs text-text-secondary mb-4">
            Set maximum amounts to protect your bankroll. Sports Steve will stop when limits are
            reached.
          </p>
        )}
        <div className="grid grid-cols-3 gap-4">
          {(
            [
              { label: "Daily", value: dailyLimit, setter: setDailyLimit },
              { label: "Weekly", value: weeklyLimit, setter: setWeeklyLimit },
              { label: "Monthly", value: monthlyLimit, setter: setMonthlyLimit },
            ] as const
          ).map((limit) => (
            <div key={limit.label}>
              <label className="block text-xs text-text-muted mb-1.5">
                {limit.label} Limit ($)
              </label>
              <input
                type="number"
                value={limit.value}
                onChange={(e) => limit.setter(e.target.value)}
                min="0"
                className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-border-glass
                         text-white font-mono text-sm
                         focus:outline-none focus:border-win/40 focus:ring-1 focus:ring-win/20"
              />
            </div>
          ))}
        </div>
        <p className="text-[10px] text-text-muted mt-3">
          Set to 0 to disable a limit. Changes take effect immediately on the backend.
        </p>
      </GlassCard>

      {/* Active Sports */}
      <GlassCard>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-4">
          {isBeginner ? "Sports to Follow" : "Active Sports"}
        </h3>
        <div className="flex flex-wrap gap-2">
          {allSports.map((sport) => (
            <button
              key={sport}
              onClick={() => toggleSport(sport)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200
                ${
                  activeSports.includes(sport)
                    ? "bg-win/10 text-win border border-win/20"
                    : "bg-white/[0.03] text-text-muted border border-border-glass hover:border-border-glass-hover"
                }`}
            >
              {sport}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-text-muted mt-3">
          Sport selection is saved to the backend. To make it permanent, update{" "}
          <code className="font-mono">ACTIVE_SPORTS</code> in your .env file.
        </p>
      </GlassCard>

      {/* Notifications */}
      <GlassCard>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">
              {isBeginner ? "Bet Alerts" : "Notifications"}
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              Get notified when bets are placed or resolved
            </p>
          </div>
          <button
            onClick={() => setNotifications(!notifications)}
            className={`w-12 h-6 rounded-full transition-all duration-200 ${
              notifications ? "bg-win/30" : "bg-white/[0.08]"
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform duration-200 ${
                notifications ? "translate-x-6" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </GlassCard>

      {/* Draymond Integration */}
      <GlassCard className="border-border-glass-hover">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-win/10 border border-win/20 flex items-center justify-center text-sm">
            🎯
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Draymond Orchestrator</h3>
            <p className="text-[10px] text-text-muted uppercase tracking-wider">
              Central AI Agent Management
            </p>
          </div>
        </div>
        <p className="text-xs text-text-secondary mb-3">
          {isBeginner
            ? "Connect to the Draymond Orchestrator to manage Sports Steve alongside other AI agents."
            : "Draymond integration enables centralized monitoring, chain execution, and cross-agent workflows."}
        </p>
        <div>
          <label className="block text-xs text-text-muted mb-1.5">Orchestrator URL</label>
          <input
            type="url"
            value={draymondUrl}
            onChange={(e) => handleDraymondUrlChange(e.target.value)}
            placeholder="http://localhost:3000"
            className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-border-glass
                     text-white placeholder-text-muted text-sm
                     focus:outline-none focus:border-win/40 focus:ring-1 focus:ring-win/20"
          />
          {draymondUrlError && (
            <p className="text-[10px] text-loss mt-1">{draymondUrlError}</p>
          )}
        </div>
        <div className="flex items-center gap-2 mt-3">
          <div
            className={`w-2 h-2 rounded-full ${draymondUrl ? "bg-yellow-500" : "bg-text-muted"}`}
          />
          <span className="text-[10px] text-text-muted">
            {draymondUrl
              ? "Not connected -- verify URL and start Draymond"
              : "No orchestrator URL configured"}
          </span>
        </div>
      </GlassCard>

      {/* Save Button */}
      <div className="flex items-center justify-end gap-4">
        {saveStatus === "ok" && (
          <p className="text-xs text-win">Settings saved successfully.</p>
        )}
        {saveStatus === "error" && (
          <p className="text-xs text-loss">
            Could not reach backend -- settings saved locally only.
          </p>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-8 py-3 rounded-xl bg-win/10 border border-win/30 text-win
                   font-semibold text-sm hover:bg-win/20 transition-all duration-200
                   disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}