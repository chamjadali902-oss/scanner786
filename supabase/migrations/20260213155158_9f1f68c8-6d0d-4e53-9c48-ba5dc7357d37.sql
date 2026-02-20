-- Allow admins to update any trade
CREATE POLICY "Admins can update any trade"
ON public.trades
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete any trade
CREATE POLICY "Admins can delete any trade"
ON public.trades
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update any profile
CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete any profile
CREATE POLICY "Admins can delete any profile"
ON public.profiles
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view all community strategies (including hidden)
CREATE POLICY "Admins can view all community strategies"
ON public.community_strategies
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to manage favorite_coins
CREATE POLICY "Admins can view all favorites"
ON public.favorite_coins
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete any favorite"
ON public.favorite_coins
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to manage chat_messages
CREATE POLICY "Admins can view all messages"
ON public.chat_messages
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete any message"
ON public.chat_messages
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to manage strategy_likes
CREATE POLICY "Admins can manage likes"
ON public.strategy_likes
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins full access to saved_strategies
CREATE POLICY "Admins can update any saved strategy"
ON public.saved_strategies
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete any saved strategy"
ON public.saved_strategies
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));