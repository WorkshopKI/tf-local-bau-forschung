/* ── Zentrale Typ-Definitionen ──
 * Alle geteilten Typen an einem Ort, damit Coding-Agenten
 * das Datenmodell schnell verstehen können.
 */

/* ── LLM / Chat ── */

export type Msg = { role: "user" | "assistant" | "system"; content: string };

export interface SavedConversation {
  id: string;
  title: string;
  messages: Msg[];
  systemPrompt: string;
  model: string;
  createdAt: number;
  updatedAt: number;
}

/* ── Modelle & KI-Routing ── */

export interface ModelOption {
  value: string;
  label: string;
  isLatest?: boolean;
  isPremium?: boolean;
  isOpenSource?: boolean;
  isCustom?: boolean;
  tier?: "internal" | "external";
}

export interface AIRoutingConfig {
  internalEndpoint: string;
  internalModel: string;
  externalProvider: string;
  externalModel: string;
  confidentialRouting: "internal-only" | "internal-with-approval";
  internalRouting: "prefer-internal" | "internal-only";
  openRouting: "prefer-external" | "prefer-internal";
  warnOnExternal: boolean;
  auditLog: boolean;
}

/* ── Organisation ── */

export type OrgScope =
  | "privat"
  | "organisation"
  | "legal"
  | "oeffentlichkeitsarbeit"
  | "hr"
  | "it"
  | "bauverfahren";

/* ── Auth ── */

export interface UserProfile {
  id: string;
  display_name: string | null;
  auth_method: "email_otp" | "guest";
  course_id: string | null;
  is_admin: boolean;
  preferred_model: string;
}

/* ── Sync / Fortschritt ── */

export interface ExerciseResult {
  exercise_id: number;
  score: number;
  feedback: string | null;
  user_prompt: string;
  completed_at: string;
}

export interface LocalProgress {
  exercises: ExerciseResult[];
  completedLessons: string[];
  quizScores: Record<string, number>;
  challengeCards: string[];
  updatedAt: string;
}

export type SyncStatus = "idle" | "syncing" | "synced" | "error" | "offline";

/* ── Übungen ── */

export interface Exercise {
  id: number;
  level: number;
  badPrompt: string;
  context: string;
  improvementHints: string[];
  goodExample: string;
  evaluationCriteria: {
    hasContext: boolean;
    isSpecific: boolean;
    hasConstraints: boolean;
  };
  departmentVariants?: {
    department: "legal" | "oeffentlichkeitsarbeit" | "hr" | "it" | "bauverfahren";
    badPrompt: string;
    context: string;
    improvementHints: string[];
    goodExample: string;
  }[];
}

/* ── Prompts ── */

export interface PromptConstraints {
  musts: string[];
  mustNots: string[];
  escalationTriggers: string[];
}

export interface PromptItem {
  category: string;
  title: string;
  prompt: string;
  needsWeb?: boolean;
  level?: "alltag" | "beruf" | "websuche" | "research" | "blueprint" | "organisation" | "miniapps";
  type?: "prompt" | "blueprint";
  constraints?: PromptConstraints;
  acceptanceCriteria?: string;
  estimatedAgentTime?: string;
  requiredTools?: string[];
  department?: string;
  riskLevel?: "niedrig" | "mittel" | "hoch";
  official?: boolean;
  confidentiality?: "open" | "internal" | "confidential";
  confidentialityReason?: string;
  targetDepartment?: "legal" | "oeffentlichkeitsarbeit" | "hr" | "it" | "bauverfahren";
  actaFields?: {
    act?: string;
    context?: string;
    task?: string;
    ausgabe?: string;
    extensions?: {
      examples: string[];
      rules: string;
      reasoning: string;
      verification: boolean;
      verificationNote: string;
      reversePrompt: boolean;
      negatives: string;
    };
  };
}

/* ── Skills ── */

export interface SavedSkill {
  id: string;
  title: string;
  prompt: string;
  sourceTitle: string;
  category: string;
  notes: string;
  variables: Record<string, string>;
  confidentiality?: "open" | "internal" | "confidential";
  targetDepartment?: string;
  targetModel?: string;
  createdAt: number;
  updatedAt: number;
}

/* ── Daily Challenges ── */

export interface DailyChallenge {
  id: string;
  title: string;
  type: "prompt-improve" | "spot-the-flaw" | "redaction" | "iteration" | "workflow";
  category: string;
  difficulty: 1 | 2 | 3;
  prompt: string;
  badExample?: string;
  targetDepartment?: string;
  estimatedMinutes: number;
}

/* ── Flaw Challenges ── */

export interface FlawChallenge {
  id: string;
  title: string;
  department?: string;
  context: string;
  generatedOutput: string;
  flaws: {
    id: string;
    type: "factual" | "logic" | "privacy" | "compliance" | "hallucination" | "missing";
    description: string;
    location: string;
    severity: "kritisch" | "mittel" | "hinweis";
  }[];
  difficulty: 1 | 2 | 3;
}

/* ── KI-Kontext & Qualitätsregeln ── */

export interface WorkRule {
  id: string;
  text: string;
  domain: string;
  active: boolean;
  createdAt: string;
}

export interface KIContext {
  profile: {
    abteilung: string;
    fachgebiet: string;
    aufgaben: string;
    stil: string;
  };
  workRules: WorkRule[];
}

export interface Constraint {
  id: string;
  title: string;
  rule: string;
  domain: string;
  active: boolean;
  source: "manual" | "rejection";
  example?: {
    before: string;
    after: string;
  };
  createdAt: string;
}

/* ── Einstellungen ── */

export interface PlatformSettings {
  orgName: string;
  language: string;
  requireReview: boolean;
  autoQualityScoring: boolean;
  mandatoryOnboarding: boolean;
}

export interface ComplianceSettings {
  detectSensitiveData: boolean;
  reviewHighRisk: boolean;
  auditLog: boolean;
  approvedModelsOnly: boolean;
}

/* ── Feedback-System ── */

export type FeedbackCategory = "praise" | "problem" | "idea" | "question";

export type FeedbackStatus =
  | "neu"
  | "in_bearbeitung"
  | "umgesetzt"
  | "abgelehnt"
  | "archiviert";

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  praise: "Lob",
  problem: "Problem",
  idea: "Idee",
  question: "Frage",
};

export interface FeedbackContext {
  route: string;
  page: string;
  mode: string;
  lastFeature: string;
  lastAction: string;
  viewport: string;
  device: string;
  timestamp: string;
  errors: string[];
  sessionDuration: number;
}

export interface FeedbackItem {
  id: string;
  category: FeedbackCategory;
  stars?: number;
  text: string;
  context: FeedbackContext;
  llm_summary?: string;
  llm_classification?: {
    category: string;
    summary: string;
    details: string;
    affectedArea: string;
    priority_suggestion: number;
    relevant_files?: string[];
  };
  user_confirmed?: boolean;
  screen_ref?: string;
  admin_status: FeedbackStatus;
  admin_notes?: string;
  admin_priority?: number;
  generated_prompt?: string;
  user_id: string;
  user_display_name?: string;
  created_at: string;
}

export interface FeedbackTrigger {
  event: string;
  delay: number;
  message: string;
  category?: FeedbackCategory;
}

export interface FeedbackConfig {
  llm_model: string;
  proactive_triggers: boolean;
  max_chatbot_turns: number;
}

