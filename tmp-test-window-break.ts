// Temporary verification for window-break detector
import { detectWindowBreak } from './src/lib/window-break';
import { Candle } from './src/types/scanner';

const mk = (h: number, l: number, c: number): Candle => ({
  openTime: 0, open: c, high: h, low: l, close: c, volume: 1, closeTime: 0, quoteVolume: 1, trades: 1,
});

let fails = 0;
const expect = (name: string, got: unknown, want: unknown) => {
  if (got !== want) { console.error(`FAIL ${name}: got ${got}, want ${want}`); fails++; }
  else console.log(`ok ${name}`);
};

// Case 1: previous 2 candles, current candle breaks their low (wick)
{
  const candles = [mk(105, 95, 100), mk(104, 96, 99), mk(98, 90, 95)];
  const r = detectWindowBreak(candles, 'low', { window: 2, maxAge: 0 });
  expect('2-candle low wick break detected', r.detected, true);
  expect('break level = min of previous 2 lows (95)', r.breakLevel, 95);
  expect('candlesAgo 0', r.candlesAgo, 0);
  expect('stillBeyond false (close 95 == level)', r.stillBeyond, false);
}

// Case 2: requireClose — wick-only break must NOT count
{
  const candles = [mk(105, 95, 100), mk(104, 96, 99), mk(94, 90, 99)];
  const r = detectWindowBreak(candles, 'low', { window: 2, maxAge: 0, requireClose: true });
  expect('requireClose rejects wick-only low break', r.detected, false);
}

// Case 3: break 2 candles ago within maxAge, window right before the break candle
{
  const base = Array.from({ length: 5 }, () => mk(100, 90, 95));
  const candles = [...base, mk(110, 96, 108), mk(109, 100, 105), mk(108, 101, 106)];
  const r = detectWindowBreak(candles, 'high', { window: 5, maxAge: 5 });
  expect('high break within maxAge detected', r.detected, true);
  expect('break level = window high 100', r.breakLevel, 100);
  expect('candlesAgo = 2', r.candlesAgo, 2);
  expect('stillBeyond true (106 > 100)', r.stillBeyond, true);
  expect('brokeByClose true', r.brokeByClose, true);
}

// Case 4: 300-candle window, flat range, latest candle closes above
{
  const base = Array.from({ length: 300 }, (_, i) => mk(100 + (i % 2) * 0.1, 90 - (i % 2) * 0.1, 95));
  const candles = [...base, mk(115, 94, 112)];
  const r = detectWindowBreak(candles, 'high', { window: 300, maxAge: 0 });
  expect('300-candle window high break', r.detected, true);
  expect('break level = 100.1', r.breakLevel, 100.1);
  expect('windowSize 300', r.windowSize, 300);
}

// Case 5: break older than maxAge -> not detected
{
  const base = Array.from({ length: 5 }, () => mk(100, 90, 95));
  const candles = [...base, mk(110, 96, 108), mk(109, 100, 105), mk(108, 101, 106)];
  const r = detectWindowBreak(candles, 'high', { window: 5, maxAge: 1 });
  expect('break beyond maxAge rejected', r.detected, false);
}

// Case 6: not enough history for the window
{
  const candles = [mk(105, 95, 100), mk(104, 96, 99)];
  const r = detectWindowBreak(candles, 'high', { window: 300, maxAge: 0 });
  expect('insufficient history -> not detected', r.detected, false);
}

// Case 7: close-beyond confirmed on a LATER candle than the wick-break candle
{
  const base = Array.from({ length: 5 }, () => mk(100, 90, 95));
  const candles = [...base, mk(101, 95, 96), mk(102, 99, 101.5), mk(102, 100, 101)]; // wick break, then close above
  const r = detectWindowBreak(candles, 'high', { window: 5, maxAge: 5, requireClose: true });
  expect('close confirmed on later candle', r.detected, true);
  expect('candlesAgo 1', r.candlesAgo, 1);
}

console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILURES`);
if (fails > 0) process.exit(1);
