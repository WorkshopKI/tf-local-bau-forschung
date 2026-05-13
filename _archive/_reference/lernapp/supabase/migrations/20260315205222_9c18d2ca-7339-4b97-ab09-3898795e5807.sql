
-- Feedback tickets table
CREATE TABLE public.feedback (
  id text PRIMARY KEY,
  category text NOT NULL DEFAULT 'allgemein',
  stars integer,
  text text NOT NULL DEFAULT '',
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id uuid NOT NULL,
  user_display_name text,
  screen_ref text,
  admin_status text NOT NULL DEFAULT 'neu',
  admin_notes text,
  admin_priority integer,
  generated_prompt text,
  llm_summary text,
  llm_classification jsonb,
  user_confirmed boolean,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY "Users can insert own feedback"
  ON public.feedback FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can read own feedback
CREATE POLICY "Users can read own feedback"
  ON public.feedback FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admins can read all feedback
CREATE POLICY "Admins can read all feedback"
  ON public.feedback FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update all feedback
CREATE POLICY "Admins can update all feedback"
  ON public.feedback FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Feedback config table (single-row)
CREATE TABLE public.feedback_config (
  id integer PRIMARY KEY DEFAULT 1,
  llm_model text NOT NULL DEFAULT 'anthropic/claude-sonnet-4.6',
  proactive_triggers boolean NOT NULL DEFAULT true,
  max_chatbot_turns integer NOT NULL DEFAULT 6,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback_config ENABLE ROW LEVEL SECURITY;

-- Insert default config row
INSERT INTO public.feedback_config (id) VALUES (1);

-- Admins can read/update config
CREATE POLICY "Admins can read feedback config"
  ON public.feedback_config FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update feedback config"
  ON public.feedback_config FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
