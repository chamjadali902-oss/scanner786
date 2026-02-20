
-- Drop restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Anyone can view public strategies" ON public.community_strategies;
DROP POLICY IF EXISTS "Users can delete own strategies" ON public.community_strategies;
DROP POLICY IF EXISTS "Users can publish strategies" ON public.community_strategies;
DROP POLICY IF EXISTS "Users can update own strategies" ON public.community_strategies;

CREATE POLICY "Anyone can view public strategies"
ON public.community_strategies FOR SELECT
USING (is_public = true);

CREATE POLICY "Users can publish strategies"
ON public.community_strategies FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own strategies"
ON public.community_strategies FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own strategies"
ON public.community_strategies FOR DELETE
USING (auth.uid() = user_id);

-- Fix strategy_likes too
DROP POLICY IF EXISTS "Users can like" ON public.strategy_likes;
DROP POLICY IF EXISTS "Users can unlike" ON public.strategy_likes;
DROP POLICY IF EXISTS "Users can view likes" ON public.strategy_likes;

CREATE POLICY "Users can view likes"
ON public.strategy_likes FOR SELECT
USING (true);

CREATE POLICY "Users can like"
ON public.strategy_likes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike"
ON public.strategy_likes FOR DELETE
USING (auth.uid() = user_id);
