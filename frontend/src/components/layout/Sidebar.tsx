import { NavLink } from 'react-router-dom';
import { useMode } from '../../contexts/ModeContext';
import { ModeToggle } from '../ui/ModeToggle';

const NAV_ITEMS = [
  {
    path: '/',
    label: 'PrizePicks Picks',
    beginnerLabel: 'Best Bets',
    icon: '🎯',
    description: 'PrizePicks props with edge analysis',
  },
  {
    path: '/dashboard',
    label: 'Dashboard',
    beginnerLabel: 'Home',
    icon: '📊',
    description: 'Overview of your betting activity',
  },
  {
    path: '/odds',
    label: 'Odds Calculator',
    beginnerLabel: 'Calculate Odds',
    icon: '🔢',
    description: 'Convert odds and calculate payouts',
  },
  {
    path: '/bankroll',
    label: 'Bankroll Manager',
    beginnerLabel: 'My Money',
    icon: '💰',
    description: 'Track your budget and bet sizing',
  },
  {
    path: '/bets',
    label: 'Bet History',
    beginnerLabel: 'My Bets',
    icon: '📋',
    description: 'View past and pending bets',
  },
  {
    path: '/help',
    label: 'Help Center',
    beginnerLabel: 'Learn Betting',
    icon: '📚',
    description: 'Glossary, techniques, and API setup',
  },
  {
    path: '/settings',
    label: 'Settings',
    beginnerLabel: 'Settings',
    icon: '⚙️',
    description: 'Configure your experience',
  },
];

export function Sidebar() {
  const { isBeginner } = useMode();

  return (
    <aside className="glass-sidebar w-64 h-screen flex flex-col fixed left-0 top-0 z-40">
      {/* Logo / Brand */}
      <div className="px-6 py-6 border-b border-border-glass">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-win/10 border border-win/20 flex items-center justify-center">
            <span className="text-xl">🏈</span>
          </div>
          <div>
            <h1 className="text-base font-bold font-display tracking-tight text-white">
              Sports Steve
            </h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-medium">
              AI Betting Intelligence
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200
              ${isActive
                ? 'bg-white/[0.06] text-white border border-border-glass-hover'
                : 'text-text-secondary hover:text-white hover:bg-white/[0.03]'
              }`
            }
          >
            <span className="text-lg w-6 text-center">{item.icon}</span>
            <div className="flex-1 min-w-0">
              <span className="block truncate">
                {isBeginner ? item.beginnerLabel : item.label}
              </span>
              {isBeginner && (
                <span className="block text-[10px] text-text-muted truncate mt-0.5">
                  {item.description}
                </span>
              )}
            </div>
          </NavLink>
        ))}
      </nav>

      {/* Bottom Controls */}
      <div className="px-4 py-5 border-t border-border-glass space-y-4">
        <ModeToggle />
        <div className="flex items-center gap-2 px-2">
          <div className="w-2 h-2 rounded-full bg-win animate-glow-pulse" />
          <span className="text-[10px] text-text-muted uppercase tracking-wider">
            Draymond Ready
          </span>
        </div>
      </div>
    </aside>
  );
}
