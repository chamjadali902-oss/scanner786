CREATE TABLE public.price_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  symbol text NOT NULL,
  timeframe text,
  direction text NOT NULL CHECK (direction IN ('above','below')),
  trigger_price numeric NOT NULL,
  note text,
  source text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','triggered','paused')),
  triggered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_price_alerts_user ON public.price_alerts(user_id);
CREATE INDEX idx_price_alerts_status ON public.price_alerts(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_alerts TO authenticated;
GRANT ALL ON public.price_alerts TO service_role;

ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own price alerts"
  ON public.price_alerts FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own price alerts"
  ON public.price_alerts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own price alerts"
  ON public.price_alerts FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own price alerts"
  ON public.price_alerts FOR DELETE TO authenticated
  USING (user_id = auth.uid());