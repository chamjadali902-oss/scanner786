import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getMarketSnapshot from "./tools/get-market-snapshot";
import listFavoriteCoins from "./tools/list-favorite-coins";
import addFavoriteCoin from "./tools/add-favorite-coin";
import removeFavoriteCoin from "./tools/remove-favorite-coin";
import listTrades from "./tools/list-trades";
import logTrade from "./tools/log-trade";
import listSavedStrategies from "./tools/list-saved-strategies";
import getFuturesData from "./tools/get-futures-data";
import getNewsEvents from "./tools/get-news-events";
import runScanner from "./tools/run-scanner";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "pro-new",
  title: "pro new",
  version: "0.2.0",
  instructions:
    "Trading tools for this app. For a full analysis of any coin combine get_market_snapshot (price, EMA, RSI, swings, candles; spot or futures), get_futures_data (funding, OI change, long/short, taker flow) and get_news_and_events (news + macro calendar). Use run_scanner to find coins matching setups on any timeframe. Use list_favorite_coins, add_favorite_coin, remove_favorite_coin for the watchlist, list_trades and log_trade for the journal, list_saved_strategies for scanner strategies. Never guess numbers; always fetch live data first. User data tools act as the signed-in user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    getMarketSnapshot,
    getFuturesData,
    getNewsEvents,
    runScanner,
    listFavoriteCoins,
    addFavoriteCoin,
    removeFavoriteCoin,
    listTrades,
    logTrade,
    listSavedStrategies,
  ],
});
