-- ══ Feedback-System Tabellen ══

-- Feedback-Tickets
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id),
  user_display_name TEXT,
  category TEXT NOT NULL CHECK (category IN ('praise','problem','idea','question')),
  stars INTEGER CHECK (stars BETWEEN 1 AND 5),
  text TEXT,
  context JSONB NOT NULL DEFAULT '{}',
  llm_summary TEXT,
  llm_classification JSONB,
  user_confirmed BOOLEAN,
  screen_ref TEXT,
  admin_status TEXT NOT NULL DEFAULT 'neu' CHECK (admin_status IN ('neu','in_bearbeitung','umgesetzt','abgelehnt','archiviert')),
  admin_notes TEXT,
  admin_priority INTEGER CHECK (admin_priority BETWEEN 1 AND 5),
  generated_prompt TEXT
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Nutzer können eigenes Feedback erstellen
CREATE POLICY "users_insert_own_feedback" ON feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Nutzer können eigenes Feedback lesen
CREATE POLICY "users_read_own_feedback" ON feedback
  FOR SELECT USING (auth.uid() = user_id);

-- Admins können alles lesen
CREATE POLICY "admins_read_all_feedback" ON feedback
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Admins können alles aktualisieren
CREATE POLICY "admins_update_all_feedback" ON feedback
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- ══ Feedback-Konfiguration (Singleton) ══

CREATE TABLE IF NOT EXISTS feedback_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  llm_model TEXT NOT NULL DEFAULT 'anthropic/claude-sonnet-4.6',
  proactive_triggers BOOLEAN NOT NULL DEFAULT true,
  max_chatbot_turns INTEGER NOT NULL DEFAULT 6,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE feedback_config ENABLE ROW LEVEL SECURITY;

-- Jeder kann Config lesen
CREATE POLICY "anyone_read_feedback_config" ON feedback_config
  FOR SELECT USING (true);

-- Nur Admins können Config ändern
CREATE POLICY "admins_update_feedback_config" ON feedback_config
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- Default-Eintrag einfügen
INSERT INTO feedback_config DEFAULT VALUES ON CONFLICT (id) DO NOTHING;
