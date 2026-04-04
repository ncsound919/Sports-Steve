import type { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: 'green' | 'red' | 'none';
  padding?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

const paddings = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export function GlassCard({
  children,
  className = '',
  hover = false,
  glow = 'none',
  padding = 'md',
  onClick,
}: GlassCardProps) {
  const glowClass =
    glow === 'green' ? 'glow-green' : glow === 'red' ? 'glow-red' : '';
  const hoverClass = hover ? 'glass-hover cursor-pointer' : '';
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      className={`glass ${paddings[padding]} ${hoverClass} ${glowClass} ${className}`}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
    >
      {children}
    </Tag>
  );
}

/* ─── Stat Card Variant ──────────────────────────────── */

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  tip?: string;
  showTip?: boolean;
}

export function StatCard({ label, value, subValue, trend, tip, showTip }: StatCardProps) {
  const trendColor =
    trend === 'up'
      ? 'text-win'
      : trend === 'down'
        ? 'text-loss'
        : 'text-text-secondary';

  return (
    <div
      className={`glass p-5 ${showTip && tip ? 'beginner-tip' : ''}`}
      data-tip={tip}
    >
      <p className="text-xs uppercase tracking-wider text-text-muted font-medium mb-2">
        {label}
      </p>
      <p className={`text-2xl font-bold stat-value ${trendColor}`}>{value}</p>
      {subValue && (
        <p className="text-xs text-text-muted mt-1">{subValue}</p>
      )}
    </div>
  );
}
