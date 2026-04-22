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

// ── Phase 3: Aufwand + Sponsoring ───────────────────────────────────────────

export type EffortEstimate = 'S' | 'M' | 'L' | 'XL';

export const EFFORT_HOURS: Record<EffortEstimate, number> = {
  S: 2, M: 8, L: 16, XL: 40,
};

export const EFFORT_LABELS: Record<EffortEstimate, string> = {
  S: 'Klein (~2h)',
  M: 'Mittel (~8h)',
  L: 'Groß (~16h)',
  XL: 'Sehr groß (~40h)',
};

export interface FeedbackSponsor {
  user_id: string;
  user_display_name: string;
  type: 'points' | 'hours';
  /** Anzahl Punkte oder Stunden. */
  amount: number;
  /** Projekt-Referenz (z.B. "BA-2026-015") — nur bei type='hours'. */
  project_ref?: string;
  created_at: string;
}

export interface UserBudget {
  user_id: string;
  /** Quartals-Key, z.B. "2026-Q2". */
  quarter: string;
  points_total: number;
  points_spent: number;
}

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
  /** Optional: wird vom LLM per autoClassifyFeedback() gesetzt (kein User-Input mehr). */
  category?: FeedbackCategory;
  stars?: number;
  text: string;
  context: FeedbackContext;
  llm_summary?: string;
  llm_classification?: LLMClassification;
  user_confirmed?: boolean;
  // Kurator-Felder (ehemals admin_*; Legacy-Aliase beim Lesen als Fallback).
  kurator_status: FeedbackStatus;
  kurator_priority?: number;
  kurator_notes?: string;
  /** @deprecated Legacy-Alias vor v1.9 — wird beim Laden auf kurator_status gemappt. */
  admin_status?: FeedbackStatus;
  /** @deprecated */ admin_priority?: number;
  /** @deprecated */ admin_notes?: string;
  generated_prompt?: string;
  // FAQ-Felder
  is_faq?: boolean;
  faq_answer?: string;
  faq_keywords?: string[];
  faq_ask_count?: number;
  // Phase 3: Aufwand (Admin setzt)
  effort_estimate?: EffortEstimate;
  effort_hours?: number;
  // Phase 3: Sponsoring
  sponsors?: FeedbackSponsor[];
  sponsor_points_total?: number;
  sponsor_hours_total?: number;
}

export interface FeedbackConfig {
  llm_model: string;
  max_chatbot_turns: number;
  system_prompt_path: string;
  shared_feedback_path: string;
  // Phase 3: Sponsoring-Schwellen (konfigurierbar im Admin-Panel)
  sponsoring_thresholds?: Record<EffortEstimate, number>;
  hours_to_points_factor?: number;
  budget_points_per_quarter?: number;
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
export const FEEDBACK_DATA_DIR = '_intern/feedback';
export const FEEDBACK_SHARED_FILE = '_intern/feedback/feedback.json';
export const FEEDBACK_PROMPT_FILE = '_intern/feedback/system-prompt.md';
/** @deprecated Legacy-Pfade vor v1.9. Migration-Helper prüft auf diese. */
export const LEGACY_FEEDBACK_SHARED_FILE = 'feedback/feedback.json';
export const LEGACY_FEEDBACK_PROMPT_FILE = 'feedback/system-prompt.md';

export const DEFAULT_SPONSORING_THRESHOLDS: Record<EffortEstimate, number> = {
  S: 5, M: 15, L: 30, XL: 50,
};
export const DEFAULT_HOURS_TO_POINTS_FACTOR = 3;
export const DEFAULT_BUDGET_POINTS_PER_QUARTER = 10;
export const BUDGET_LS_KEY_PREFIX = 'teamflow_user_budget_v1';

export const DEFAULT_FEEDBACK_CONFIG: FeedbackConfig = {
  llm_model: 'openai/gpt-oss-120b',
  max_chatbot_turns: 6,
  system_prompt_path: FEEDBACK_PROMPT_FILE,
  shared_feedback_path: FEEDBACK_SHARED_FILE,
  sponsoring_thresholds: DEFAULT_SPONSORING_THRESHOLDS,
  hours_to_points_factor: DEFAULT_HOURS_TO_POINTS_FACTOR,
  budget_points_per_quarter: DEFAULT_BUDGET_POINTS_PER_QUARTER,
};
