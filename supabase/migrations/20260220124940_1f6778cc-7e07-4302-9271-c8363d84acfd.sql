
CREATE TABLE public.ai_prompts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  system_prompt text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_prompts ENABLE ROW LEVEL SECURITY;

-- Only admins can manage prompts
CREATE POLICY "Admins can do everything on ai_prompts"
  ON public.ai_prompts
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Edge functions (service role) can read prompts
CREATE POLICY "Service role can read ai_prompts"
  ON public.ai_prompts
  FOR SELECT
  USING (true);

CREATE TRIGGER update_ai_prompts_updated_at
  BEFORE UPDATE ON public.ai_prompts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
