import { Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import OddsCalculator from './pages/OddsCalculator';
import BankrollManager from './pages/BankrollManager';
import BetHistory from './pages/BetHistory';
import HelpCenter from './pages/HelpCenter';
import Settings from './pages/Settings';

export default function App() {
  return (
    <Routes>
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/odds" element={<OddsCalculator />} />
        <Route path="/bankroll" element={<BankrollManager />} />
        <Route path="/bets" element={<BetHistory />} />
        <Route path="/help" element={<HelpCenter />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
