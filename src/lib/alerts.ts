// In-app alert system with browser notifications + sound

export type AlertType = 'scan_match' | 'price_alert';

export interface Alert {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  symbol?: string;
  timestamp: number;
  read: boolean;
}

let alerts: Alert[] = [];
let listeners: ((alerts: Alert[]) => void)[] = [];

// Sound effect using Web Audio API
function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    // Audio not available
  }
}

// Request browser notification permission
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

// Send browser notification
function sendBrowserNotification(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
    });
  }
}

// Add a new alert
export function addAlert(
  type: AlertType,
  title: string,
  message: string,
  symbol?: string,
  options: { sound?: boolean; notification?: boolean } = { sound: true, notification: true }
) {
  const alert: Alert = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    title,
    message,
    symbol,
    timestamp: Date.now(),
    read: false,
  };

  alerts = [alert, ...alerts].slice(0, 100); // Keep last 100
  notifyListeners();

  if (options.sound) playAlertSound();
  if (options.notification) sendBrowserNotification(title, message);
}

// Subscribe to alert changes
export function subscribeAlerts(cb: (alerts: Alert[]) => void) {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter(l => l !== cb);
  };
}

function notifyListeners() {
  listeners.forEach(l => l([...alerts]));
}

export function getAlerts() {
  return [...alerts];
}

export function markAlertRead(id: string) {
  alerts = alerts.map(a => a.id === id ? { ...a, read: true } : a);
  notifyListeners();
}

export function markAllRead() {
  alerts = alerts.map(a => ({ ...a, read: true }));
  notifyListeners();
}

export function clearAlerts() {
  alerts = [];
  notifyListeners();
}

export function getUnreadCount() {
  return alerts.filter(a => !a.read).length;
}
