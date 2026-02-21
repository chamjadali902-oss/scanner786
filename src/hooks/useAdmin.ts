import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { ADMIN_SESSION_KEY, isPrimaryAdminEmail } from '@/lib/adminAccess';

const hasAdminAccessSession = () => {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(ADMIN_SESSION_KEY) === 'true';
};

export const setAdminAccessSession = (allowed: boolean) => {
  if (typeof window === 'undefined') return;
  if (allowed) {
    window.localStorage.setItem(ADMIN_SESSION_KEY, 'true');
    return;
  }
  window.localStorage.removeItem(ADMIN_SESSION_KEY);
};

export function useAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    const canAccessAdmin = isPrimaryAdminEmail(user.email) && hasAdminAccessSession();
    setIsAdmin(canAccessAdmin);
    setLoading(false);
  }, [user, authLoading]);

  return { isAdmin, loading: loading || authLoading, user };
}
