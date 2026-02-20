import { useState, useEffect, useCallback } from 'react';
import { Alert, subscribeAlerts, getAlerts, markAlertRead, markAllRead, clearAlerts, getUnreadCount, addAlert, requestNotificationPermission } from '@/lib/alerts';

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>(getAlerts());
  const [unreadCount, setUnreadCount] = useState(getUnreadCount());
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
  );

  useEffect(() => {
    const unsub = subscribeAlerts((newAlerts) => {
      setAlerts(newAlerts);
      setUnreadCount(newAlerts.filter(a => !a.read).length);
    });
    return unsub;
  }, []);

  const enableNotifications = useCallback(async () => {
    const granted = await requestNotificationPermission();
    setNotificationsEnabled(granted);
    return granted;
  }, []);

  return {
    alerts,
    unreadCount,
    notificationsEnabled,
    enableNotifications,
    markRead: markAlertRead,
    markAllRead,
    clearAlerts,
    addAlert,
  };
}
