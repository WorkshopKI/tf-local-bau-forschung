-- ══════════════════════════════════════════════════════════════
-- API Usage Tracking: Pro-User Token- und Kosten-Logging
-- ══════════════════════════════════════════════════════════════

CREATE TABLE public.api_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost DECIMAL(10,6) NOT NULL DEFAULT 0,
  request_type TEXT NOT NULL DEFAULT 'chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.api_usage_log ENABLE ROW LEVEL SECURITY;

-- Index für schnelle User-Abfragen und Zeitraum-Filter
CREATE INDEX idx_usage_log_user_created ON public.api_usage_log (user_id, created_at DESC);

-- User können eigene Usage-Daten lesen
CREATE POLICY "Users can read own usage"
  ON public.api_usage_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admins können alle Usage-Daten lesen
CREATE POLICY "Admins can read all usage"
  ON public.api_usage_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Service Role kann inserten (Edge Functions)
CREATE POLICY "Service role can insert usage"
  ON public.api_usage_log FOR INSERT
  WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════
-- Admin: Budget pro User anpassen (user_api_keys)
-- ══════════════════════════════════════════════════════════════

-- Admins können alle API-Key-Einträge lesen
CREATE POLICY "Admins can read all api keys"
  ON public.user_api_keys FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins können Budget für alle User anpassen
CREATE POLICY "Admins can update api keys"
  ON public.user_api_keys FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins können API-Key-Einträge anlegen (z.B. Budget vorab setzen)
CREATE POLICY "Admins can insert api keys"
  ON public.user_api_keys FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
