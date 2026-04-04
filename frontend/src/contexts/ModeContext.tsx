import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { UserMode } from '../types';

interface ModeContextType {
  mode: UserMode;
  toggleMode: () => void;
  setMode: (mode: UserMode) => void;
  isBeginner: boolean;
  isExpert: boolean;
}

const ModeContext = createContext<ModeContextType | null>(null);

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<UserMode>(() => {
    const saved = localStorage.getItem('ss-user-mode');
    return (saved === 'expert' ? 'expert' : 'beginner') as UserMode;
  });

  const setMode = useCallback((m: UserMode) => {
    setModeState(m);
    localStorage.setItem('ss-user-mode', m);
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === 'beginner' ? 'expert' : 'beginner');
  }, [mode, setMode]);

  return (
    <ModeContext.Provider
      value={{
        mode,
        toggleMode,
        setMode,
        isBeginner: mode === 'beginner',
        isExpert: mode === 'expert',
      }}
    >
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error('useMode must be used within ModeProvider');
  return ctx;
}
