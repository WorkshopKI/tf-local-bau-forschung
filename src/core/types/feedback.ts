// Feedback-System Domain-Types (Phase 1 + 2: User-Feedback + Admin-Dashboard).
// Forward-compatible mit Phase 3 Sponsoring (optionale Felder bleiben undefined).

export type FeedbackCategory = 'praise' | 'problem' | 'idea' | 'question';

export type FeedbackStatus =
  | 'neu'
  | 'geplant'
  | 'in_bearbeitung'
  | 'umgesetzt'
  | 'abgelehnt'
  | 'archiviert';

export type LLMCategoryCode = 'bug' | 'feature' | 'ux' | 'praise' | 'question';

export interface FeedbackContext {
  /** Active plugin id at capture time (e.g. 'bauantraege', 'suche'). */
  route: string;
  /** Human-readable plugin name. */
  page: string;
  device: 'Mobile' | 'Tablet' | 'Desktop';
  viewport: string;
  lastAction?: string;
  /** Session duration in seconds. */
  sessionDuration: number;
  /** Recent window.onerror messages (max 5, newest last). */
  errors: string[];
  timestamp: string;
  /** TEAMFLOW_AREAS.ref vom DetailsStep-Dropdown. */
  screenRef?: string;
  screenRefLabel?: string;
}

export interface LLMClassification {
  category: LLMCategoryCode;
  summary: string;
  details: string;
  affectedArea: string;
  priority_suggestion: number;
  relevant_files?: string[];
}

export interface FeedbackItem {
  id: string;
  created_at: string;
  user_id: string;
  user_display_name?: string;
  category: FeedbackCategory;
  stars?: number;
  text: string;
  context: FeedbackContext;
  llm_summary?: string;
  llm_classification?: LLMClassification;
  user_confirmed?: boolean;
  // Admin-Felder
  admin_status: FeedbackStatus;
  admin_priority?: number;
  admin_notes?: string;
  generated_prompt?: string;
  // FAQ-Felder
  is_faq?: boolean;
  faq_answer?: string;
  faq_keywords?: string[];
  faq_ask_count?: number;
  // Forward-compat Phase 3 Sponsoring (NICHT befüllt jetzt)
  effort_estimate?: 'S' | 'M' | 'L' | 'XL';
  effort_hours?: number;
}

export interface FeedbackConfig {
  llm_model: string;
  max_chatbot_turns: number;
  system_prompt_path: string;
  shared_feedback_path: string;
}

export interface ChatMsg {
  role: 'system' | 'user' | 'assistant';
  content: string;
  /** UI-only: option chips an Assistant-Replies; vor API-Call entfernen. */
  options?: string[];
}

export interface BotParseResult {
  text: string;
  options?: string[];
}

export interface FeedbackFilters {
  category?: FeedbackCategory;
  status?: FeedbackStatus;
  priority?: number;
}

export interface SharedFeedbackFile {
  version: 1;
  updated_at: string;
  items: FeedbackItem[];
}

export const FEEDBACK_LS_KEY = 'teamflow_feedback_items';
export const FEEDBACK_CONFIG_LS_KEY = 'teamflow_feedback_config';
export const FEEDBACK_HINT_DISMISSED_KEY = 'teamflow_feedback_shared_hint_dismissed';
export const FEEDBACK_DATA_DIR = 'feedback';
export const FEEDBACK_SHARED_FILE = 'feedback/feedback.json';
export const FEEDBACK_PROMPT_FILE = 'feedback/system-prompt.md';

export const DEFAULT_FEEDBACK_CONFIG: FeedbackConfig = {
  llm_model: 'openai/gpt-oss-120b',
  max_chatbot_turns: 6,
  system_prompt_path: FEEDBACK_PROMPT_FILE,
  shared_feedback_path: FEEDBACK_SHARED_FILE,
};
