
-- Watchlist coins table (max 20 per user enforced via trigger)
CREATE TABLE public.watchlist_coins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, symbol)
);

ALTER TABLE public.watchlist_coins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own watchlist" ON public.watchlist_coins
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can add to watchlist" ON public.watchlist_coins
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove from watchlist" ON public.watchlist_coins
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Enforce max 20 coins per user via trigger
CREATE OR REPLACE FUNCTION public.check_watchlist_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.watchlist_coins WHERE user_id = NEW.user_id) >= 20 THEN
    RAISE EXCEPTION 'Maximum 20 coins allowed in watchlist';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER watchlist_limit_check
  BEFORE INSERT ON public.watchlist_coins
  FOR EACH ROW
  EXECUTE FUNCTION public.check_watchlist_limit();

-- Analysis signals table
CREATE TABLE public.analysis_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  signal_type TEXT NOT NULL, -- 'buy', 'sell', 'strong_buy', 'strong_sell'
  trend TEXT NOT NULL, -- 'uptrend', 'downtrend', 'sideways'
  confidence INTEGER NOT NULL DEFAULT 0, -- 0-100
  entry_price NUMERIC,
  stop_loss NUMERIC,
  take_profit_1 NUMERIC,
  take_profit_2 NUMERIC,
  take_profit_3 NUMERIC,
  risk_reward NUMERIC,
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  indicator_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_notified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.analysis_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own signals" ON public.analysis_signals
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can update own signals" ON public.analysis_signals
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Service can insert signals" ON public.analysis_signals
  FOR INSERT TO authenticated WITH CHECK (true);

-- Push subscriptions table
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own subscriptions" ON public.push_subscriptions
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX idx_watchlist_user ON public.watchlist_coins(user_id);
CREATE INDEX idx_signals_user_created ON public.analysis_signals(user_id, created_at DESC);
CREATE INDEX idx_signals_unread ON public.analysis_signals(user_id, is_read) WHERE is_read = false;
