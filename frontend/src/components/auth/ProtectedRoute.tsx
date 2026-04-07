import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    async function checkAccess() {
      try {
        // 1. Check session
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setHasAccess(false);
          setIsLoading(false);
          return;
        }

        // 2. Check purchase — user needs sports-steve OR bet-buddy
        // Uses user_has_access(p_user_id, p_entity_slug) from migration 008_purchases.sql
        const [{ data: hasSportsSteve }, { data: hasBetBuddy }] = await Promise.all([
          supabase.rpc('user_has_access', {
            p_user_id: user.id,
            p_entity_slug: 'sports-steve',
          }),
          supabase.rpc('user_has_access', {
            p_user_id: user.id,
            p_entity_slug: 'bet-buddy',
          }),
        ]);

        setHasAccess(!!hasSportsSteve || !!hasBetBuddy);
      } catch (err) {
        console.error('Fatal error checking access:', err);
        setHasAccess(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkAccess();
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#dc2626] border-t-transparent"></div>
      </div>
    );
  }

  if (!hasAccess) {
    // Redirect to marketing site with error param
    const marketingUrl = `https://theupliftlab.com/tools/sports-bundle?error=access_denied&redirect=${encodeURIComponent(window.location.href)}`;
    window.location.href = marketingUrl;
    return null;
  }

  return <>{children}</>;
};
