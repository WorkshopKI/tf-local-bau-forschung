-- API Usage Tracking Table
CREATE TABLE public.api_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  model text NOT NULL DEFAULT 'unknown',
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  estimated_cost numeric NOT NULL DEFAULT 0,
  request_type text NOT NULL DEFAULT 'chat',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.api_usage_log ENABLE ROW LEVEL SECURITY;

-- Users can read their own usage
CREATE POLICY "Users can read own usage"
  ON public.api_usage_log
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role inserts (edge functions use service role key)
-- No INSERT policy for authenticated users needed since edge functions use service_role
-- Admins can read all usage for reporting
CREATE POLICY "Admins can read all usage"
  ON public.api_usage_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Index for fast user lookups
CREATE INDEX idx_api_usage_log_user_id ON public.api_usage_log (user_id);
CREATE INDEX idx_api_usage_log_created_at ON public.api_usage_log (created_at);