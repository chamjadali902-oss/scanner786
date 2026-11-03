# Roadmap

## Market Intelligence Hub — DONE
- [x] Market Overview page (/overview)
- [x] Coin Detail Hub (/coin/:symbol)
- [x] News & Events feed (/news)
- [x] Market Heatmap (/heatmap)
- [x] Routes + nav links
- [x] Typecheck pass

## Entry Trigger Alerts — DONE
- [x] price_alerts table (RLS, user-owned) + types regenerated
- [x] Trigger dialog on scanner result cards (setup levels + custom price + note)
- [x] Background monitor (20s poll, fires in-app alert + browser notification, one-shot -> triggered)
- [x] Triggers tab in AlertsPanel (pause/resume/delete/clear hit)
- [x] vitest rule test for trigger firing; Playwright end-to-end fired

## Optional next
- [ ] Playwright runtime check of /overview, /heatmap, /news, /coin/BTCUSDT
