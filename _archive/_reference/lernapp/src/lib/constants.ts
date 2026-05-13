/* ── Zentralisierte Konstanten ──
 * Alle Magic Strings an einem Ort, damit Coding-Agenten
 * konsistent arbeiten können.
 */

/* ── Route-Pfade ── */
export const ROUTES = {
  HOME: "/",
  LIBRARY: "/library",
  PLAYGROUND: "/playground",
  ONBOARDING: "/onboarding",
  SETTINGS: "/settings",
  LOGIN: "/login",
  ADMIN_PARTICIPANTS: "/admin/teilnehmer",
  ADMIN_FEEDBACK: "/admin/feedback",
} as const;

/* ── localStorage Keys ── */
export const LS_KEYS = {
  ORG_SCOPE: "org_scope",
  THINKING_ENABLED: "thinking_enabled",
  CUSTOM_MODELS: "custom_openrouter_models",
  AI_ROUTING: "ai_routing_config",
  MY_SKILLS: "my_skills",
  PROMPT_RATINGS: "prompt_ratings",
  CONVERSATIONS: "playground_conversations",
  ACTIVE_CONVERSATION: "playground_active_id",
  DAILY_CHALLENGE: "daily_challenge_history",
  NUDGE_DISMISSED: "iteration_nudge_dismissed",
  GUEST_BANNER_DISMISSED: "guest_banner_dismissed",
  PLATFORM_SETTINGS: "platform_settings",
  COMPLIANCE_SETTINGS: "compliance_settings",
  PROGRESS: "user_progress_v2",
  LEGACY_HISTORY: "playground_history",
  APP_MODE: "app_mode",
  STANDALONE_PROFILE: "standalone_profile",
  STANDALONE_EXERCISES: "standalone_exercises",
  STANDALONE_LESSONS: "standalone_lessons",
  STANDALONE_QUIZZES: "standalone_quizzes",
  STANDALONE_CHALLENGES: "standalone_challenges",
  STANDALONE_API_KEY: "standalone_api_key",
  STANDALONE_ENDPOINT: "standalone_endpoint",
  PLAYGROUND_MODE: "playground_mode",
  TOUR_COMPLETED: "tour_completed",
  KI_CONTEXT: "ps-ki-context",
  CONSTRAINTS: "ps-constraints",
  REJECTION_NUDGE_COOLDOWN: "ps-rejection-nudge-cooldown",
  LERNPFAD_PROGRESS: "ps-lernpfad-progress",
  COMPARISON_HISTORY: "ps-comparison-history",
  FEEDBACK_ITEMS: "ps-feedback",
  FEEDBACK_CONFIG: "ps-feedback-config",
} as const;

/* ── Semantische Badge-Farben (3-Stufen) ──
 * Verwende diese Konstanten für Risiko/Priorität/Severity-Badges.
 * Confidentiality-Badges nutzen eigene Styles in ConfidentialityBadge.tsx.
 * NICHT die Tailwind-Strings manuell kopieren!
 */
export const BADGE_COLORS = {
  /** Primary-Akzent für aktive Zustände */
  low: "bg-primary/10 text-primary",
  /** Neutral-Mittel für Klassifikation */
  medium: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  /** Kräftiger für hohe Priorität — NICHT für Confidentiality */
  high: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400",
  /** Neutral */
  neutral: "bg-muted text-muted-foreground",
} as const;

/** Mapping für deutsche Prioritäts-Labels → Badge-Farben */
export const PRIORITY_COLORS: Record<string, string> = {
  niedrig: BADGE_COLORS.neutral,
  mittel: BADGE_COLORS.medium,
  hoch: BADGE_COLORS.high,
};

/** Mapping für deutsche Risiko-Labels → Badge-Farben */
export const RISK_COLORS: Record<string, string> = {
  niedrig: BADGE_COLORS.low,
  mittel: BADGE_COLORS.medium,
  hoch: BADGE_COLORS.high,
  kritisch: BADGE_COLORS.high,
};

/** Mapping für Severity-Labels → Badge-Farben */
export const SEVERITY_COLORS: Record<string, string> = {
  kritisch: BADGE_COLORS.high,
  mittel: BADGE_COLORS.medium,
  hinweis: BADGE_COLORS.neutral,
};

/* ── Badge-Farben für Prompt-Level ── */
export const LEVEL_BADGE_COLORS: Record<string, string> = {
  alltag: BADGE_COLORS.low,
  beruf: BADGE_COLORS.low,
  websuche: BADGE_COLORS.medium,
  research: BADGE_COLORS.medium,
  blueprint: BADGE_COLORS.high,
  organisation: BADGE_COLORS.high,
};

/* ── Alert/Warning-Card Farben ──
 * Für Alert-Boxen und Warnhinweis-Karten mit border + bg + text + dark:-Varianten.
 * NICHT die Tailwind-Strings manuell kopieren!
 */
export const ALERT_COLORS = {
  /** 🟡 Warnung — amber */
  warning: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400",
  /** 🔴 Gefahr — red */
  danger: "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-400",
} as const;

/* ── Feedback-Kategorie-Farben ── */
export const FEEDBACK_CATEGORY_COLORS: Record<string, string> = {
  praise: BADGE_COLORS.low,
  problem: BADGE_COLORS.high,
  idea: BADGE_COLORS.neutral,
  question: BADGE_COLORS.medium,
};

/* ── Feedback-Status-Farben ── */
export const FEEDBACK_STATUS_COLORS: Record<string, string> = {
  neu: BADGE_COLORS.medium,
  in_bearbeitung: BADGE_COLORS.low,
  umgesetzt: BADGE_COLORS.low,
  abgelehnt: BADGE_COLORS.high,
  archiviert: BADGE_COLORS.neutral,
};

/* ── Default-Modelle ── */
export const DEFAULT_MODEL = "google/gemini-3-flash-preview";
export const SECONDARY_MODEL = "openai/gpt-5";
