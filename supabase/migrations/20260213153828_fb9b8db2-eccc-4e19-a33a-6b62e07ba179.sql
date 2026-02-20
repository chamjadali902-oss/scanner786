
-- Allow admins to view ALL profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete community strategies
CREATE POLICY "Admins can delete any strategy"
ON public.community_strategies
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update any community strategy
CREATE POLICY "Admins can update any strategy"
ON public.community_strategies
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view all saved strategies
CREATE POLICY "Admins can view all saved strategies"
ON public.saved_strategies
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view all trades
CREATE POLICY "Admins can view all trades"
ON public.trades
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
