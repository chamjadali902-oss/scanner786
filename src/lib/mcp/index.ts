import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getMarketSnapshot from "./tools/get-market-snapshot";
import listFavoriteCoins from "./tools/list-favorite-coins";
import addFavoriteCoin from "./tools/add-favorite-coin";
import removeFavoriteCoin from "./tools/remove-favorite-coin";
import listTrades from "./tools/list-trades";
import logTrade from "./tools/log-trade";
import listSavedStrategies from "./tools/list-saved-strategies";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "pro-new",
  title: "pro new",
  version: "0.1.0",
  instructions:
    "Trading tools for this app. Use get_market_snapshot for live Binance price, EMA/RSI and swing levels on any pair and timeframe. Use list_favorite_coins, add_favorite_coin and remove_favorite_coin to manage the user's watchlist, list_trades and log_trade for their trade journal, and list_saved_strategies to inspect their scanner strategies. All user data tools act as the signed-in user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    getMarketSnapshot,
    listFavoriteCoins,
    addFavoriteCoin,
    removeFavoriteCoin,
    listTrades,
    logTrade,
    listSavedStrategies,
  ],
});
