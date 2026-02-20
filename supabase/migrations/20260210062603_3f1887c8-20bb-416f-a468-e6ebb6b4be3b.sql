
-- Community strategies marketplace
CREATE TABLE public.community_strategies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  author_name TEXT NOT NULL DEFAULT 'Anonymous',
  name TEXT NOT NULL,
  description TEXT,
  scan_pool TEXT NOT NULL DEFAULT 'losers',
  timeframe TEXT NOT NULL DEFAULT '15m',
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  likes_count INTEGER NOT NULL DEFAULT 0,
  copies_count INTEGER NOT NULL DEFAULT 0,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.community_strategies ENABLE ROW LEVEL SECURITY;

-- Everyone can view public strategies
CREATE POLICY "Anyone can view public strategies"
ON public.community_strategies FOR SELECT
USING (is_public = true);

-- Users can insert their own
CREATE POLICY "Users can publish strategies"
ON public.community_strategies FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own
CREATE POLICY "Users can update own strategies"
ON public.community_strategies FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Users can delete their own
CREATE POLICY "Users can delete own strategies"
ON public.community_strategies FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Likes table
CREATE TABLE public.strategy_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  strategy_id UUID NOT NULL REFERENCES public.community_strategies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, strategy_id)
);

ALTER TABLE public.strategy_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view likes"
ON public.strategy_likes FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can like"
ON public.strategy_likes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike"
ON public.strategy_likes FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Function to increment/decrement likes count
CREATE OR REPLACE FUNCTION public.update_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_strategies SET likes_count = likes_count + 1 WHERE id = NEW.strategy_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_strategies SET likes_count = likes_count - 1 WHERE id = OLD.strategy_id;
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER trigger_update_likes_count
AFTER INSERT OR DELETE ON public.strategy_likes
FOR EACH ROW
EXECUTE FUNCTION public.update_likes_count();

-- Trigger for updated_at
CREATE TRIGGER update_community_strategies_updated_at
BEFORE UPDATE ON public.community_strategies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
