
-- Create favorite_coins table
CREATE TABLE public.favorite_coins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, symbol)
);

-- Enable RLS
ALTER TABLE public.favorite_coins ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own favorites" ON public.favorite_coins FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can add favorites" ON public.favorite_coins FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove favorites" ON public.favorite_coins FOR DELETE USING (auth.uid() = user_id);
