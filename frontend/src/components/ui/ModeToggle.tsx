import { useMode } from '../../contexts/ModeContext';

export function ModeToggle() {
  const { mode, toggleMode } = useMode();

  return (
    <button
      onClick={toggleMode}
      className="relative flex items-center h-9 w-[180px] rounded-full glass-sm overflow-hidden 
                 transition-all duration-300 group"
      aria-label={`Switch to ${mode === 'beginner' ? 'expert' : 'beginner'} mode`}
    >
      {/* Sliding indicator */}
      <div
        className={`absolute top-0.5 bottom-0.5 w-[88px] rounded-full transition-all duration-300 ease-out
          ${mode === 'beginner'
            ? 'left-0.5 bg-win/20 border border-win/30'
            : 'left-[89px] bg-loss/20 border border-loss/30'
          }`}
      />

      {/* Labels */}
      <span
        className={`relative z-10 flex-1 text-center text-xs font-semibold tracking-wide transition-colors duration-200
          ${mode === 'beginner' ? 'text-win' : 'text-text-muted'}`}
      >
        BEGINNER
      </span>
      <span
        className={`relative z-10 flex-1 text-center text-xs font-semibold tracking-wide transition-colors duration-200
          ${mode === 'expert' ? 'text-loss' : 'text-text-muted'}`}
      >
        EXPERT
      </span>
    </button>
  );
}
