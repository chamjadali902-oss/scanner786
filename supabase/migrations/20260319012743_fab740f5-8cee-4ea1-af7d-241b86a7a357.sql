
-- Fix permissive INSERT policy - edge function uses service role which bypasses RLS
DROP POLICY "Service can insert signals" ON public.analysis_signals;

CREATE POLICY "Users can view own signals insert" ON public.analysis_signals
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
