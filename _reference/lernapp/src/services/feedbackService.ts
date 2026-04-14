/* ── Feedback-Service (Dual-Mode) ──
 * Workshop-Modus: Supabase-Tabelle `feedback`
 * Standalone-Modus: localStorage `ps-feedback`
 */

import { LS_KEYS } from "@/lib/constants";
import { loadArrayFromStorage, saveToStorage, loadFromStorage } from "@/lib/storage";
import type { FeedbackItem, FeedbackConfig, FeedbackStatus } from "@/types";

/**
 * Temporäre Typdefinition für die Supabase `feedback` Tabelle.
 * Kann entfernt werden sobald `supabase gen types` die Tabelle enthält.
 */
interface FeedbackRow {
  id: string;
  created_at: string;
  user_id: string;
  category: string;
  stars: number | null;
  text: string | null;
  context: Record<string, unknown>;
  llm_summary: string | null;
  llm_classification: Record<string, unknown> | null;
  user_confirmed: boolean | null;
  screen_ref: string | null;
  admin_status: string;
  admin_notes: string | null;
  admin_priority: number | null;
  generated_prompt: string | null;
  user_display_name: string | null;
}

function isWorkshopMode(): boolean {
  return localStorage.getItem(LS_KEYS.APP_MODE) === "workshop";
}

function generateId(): string {
  return `fb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const DEFAULT_CONFIG: FeedbackConfig = {
  llm_model: "anthropic/claude-sonnet-4.6",
  proactive_triggers: true,
  max_chatbot_turns: 6,
};

// ═══ TICKETS ═══

/**
 * Erstellt ein neues Feedback-Ticket.
 * Workshop-Modus: Insert in Supabase `feedback` Tabelle (Fallback auf localStorage bei Fehler).
 * Standalone-Modus: Speichert in localStorage.
 */
export async function submitFeedback(
  data: Omit<FeedbackItem, "id" | "admin_status" | "created_at">
): Promise<FeedbackItem> {
  const item: FeedbackItem = {
    ...data,
    id: generateId(),
    admin_status: "neu",
    created_at: new Date().toISOString(),
  };

  if (isWorkshopMode()) {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await (supabase.from("feedback") as any).insert({
        id: item.id,
        category: item.category,
        stars: item.stars ?? null,
        text: item.text,
        context: item.context,
        user_id: item.user_id,
        user_display_name: item.user_display_name ?? null,
        screen_ref: item.screen_ref ?? null,
        admin_status: item.admin_status,
      });
      if (error) {
        // Tabelle existiert möglicherweise noch nicht — Fallback auf localStorage
        console.warn("Supabase-Feedback fehlgeschlagen, Fallback auf localStorage:", error.message);
        saveItemToLocalStorage(item);
      }
    } catch (e) {
      // Netzwerk-/Verbindungsfehler — Fallback auf localStorage
      console.warn("Supabase nicht erreichbar, Fallback auf localStorage:", e);
      saveItemToLocalStorage(item);
    }
  } else {
    saveItemToLocalStorage(item);
  }

  return item;
}

export interface FeedbackFilters {
  category?: string;
  status?: FeedbackStatus;
  priority?: number;
}

/**
 * Lädt die Feedback-Liste mit optionalen Filtern.
 * Workshop-Modus: Query an Supabase `feedback` Tabelle.
 * Standalone-Modus: Liest aus localStorage und filtert clientseitig.
 */
export async function getFeedbackList(filters?: FeedbackFilters): Promise<FeedbackItem[]> {
  let items: FeedbackItem[];

  if (isWorkshopMode()) {
    const { supabase } = await import("@/integrations/supabase/client");
    let query = (supabase.from("feedback") as any).select("*").order("created_at", { ascending: false });

    if (filters?.category) query = query.eq("category", filters.category);
    if (filters?.status) query = query.eq("admin_status", filters.status);
    if (filters?.priority) query = query.eq("admin_priority", filters.priority);

    const { data, error } = await query;
    if (error) throw new Error(`Feedback laden fehlgeschlagen: ${error.message}`);
    items = ((data as FeedbackRow[]) ?? []).map(mapFromRow);
  } else {
    items = loadArrayFromStorage<FeedbackItem>(LS_KEYS.FEEDBACK_ITEMS);
    if (filters?.category) items = items.filter((i) => i.category === filters.category);
    if (filters?.status) items = items.filter((i) => i.admin_status === filters.status);
    if (filters?.priority) items = items.filter((i) => i.admin_priority === filters.priority);
  }

  return items;
}

/**
 * Aktualisiert ein bestehendes Feedback-Ticket (z.B. Admin-Status, LLM-Klassifikation, Bestätigung).
 * Workshop-Modus: Update in Supabase `feedback` Tabelle.
 * Standalone-Modus: Aktualisiert in localStorage.
 */
export async function updateFeedback(
  id: string,
  updates: Partial<Pick<FeedbackItem, "admin_status" | "admin_notes" | "admin_priority" | "generated_prompt" | "llm_summary" | "llm_classification" | "user_confirmed">>
): Promise<void> {
  if (isWorkshopMode()) {
    const { supabase } = await import("@/integrations/supabase/client");
    const { error } = await (supabase.from("feedback") as any).update(updates).eq("id", id);
    if (error) throw new Error(`Feedback aktualisieren fehlgeschlagen: ${error.message}`);
  } else {
    const items = loadArrayFromStorage<FeedbackItem>(LS_KEYS.FEEDBACK_ITEMS);
    const idx = items.findIndex((i) => i.id === id);
    if (idx >= 0) {
      items[idx] = { ...items[idx], ...updates };
      saveToStorage(LS_KEYS.FEEDBACK_ITEMS, items);
    }
  }
}

// ═══ CONFIG ═══

/**
 * Lädt die Feedback-Konfiguration (LLM-Modell, Trigger-Einstellungen, max Turns).
 * Workshop-Modus: Liest aus Supabase `feedback_config` Tabelle.
 * Standalone-Modus / Fallback: Liest aus localStorage mit DEFAULT_CONFIG als Fallback.
 */
export async function loadFeedbackConfig(): Promise<FeedbackConfig> {
  if (isWorkshopMode()) {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await (supabase.from("feedback_config") as any).select("*").eq("id", 1).single();
    if (data) {
      const row = data as Record<string, unknown>;
      return {
        llm_model: (row.llm_model as string) ?? DEFAULT_CONFIG.llm_model,
        proactive_triggers: (row.proactive_triggers as boolean) ?? DEFAULT_CONFIG.proactive_triggers,
        max_chatbot_turns: (row.max_chatbot_turns as number) ?? DEFAULT_CONFIG.max_chatbot_turns,
      };
    }
  }
  return loadFromStorage<FeedbackConfig>(LS_KEYS.FEEDBACK_CONFIG, DEFAULT_CONFIG);
}

/**
 * Speichert die Feedback-Konfiguration.
 * Workshop-Modus: Update in Supabase `feedback_config` Tabelle.
 * Standalone-Modus: Speichert in localStorage.
 */
export async function saveFeedbackConfig(config: FeedbackConfig): Promise<void> {
  if (isWorkshopMode()) {
    const { supabase } = await import("@/integrations/supabase/client");
    const { error } = await (supabase.from("feedback_config") as any).update({
      llm_model: config.llm_model,
      proactive_triggers: config.proactive_triggers,
      max_chatbot_turns: config.max_chatbot_turns,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    if (error) throw new Error(`Config speichern fehlgeschlagen: ${error.message}`);
  } else {
    saveToStorage(LS_KEYS.FEEDBACK_CONFIG, config);
  }
}

// ═══ HELPERS ═══

/** Speichert ein FeedbackItem am Anfang des localStorage-Arrays. */
function saveItemToLocalStorage(item: FeedbackItem): void {
  const items = loadArrayFromStorage<FeedbackItem>(LS_KEYS.FEEDBACK_ITEMS);
  items.unshift(item);
  saveToStorage(LS_KEYS.FEEDBACK_ITEMS, items);
}

/** Mappt eine Supabase-Row (FeedbackRow) auf das App-interne FeedbackItem Interface. */
function mapFromRow(row: FeedbackRow): FeedbackItem {
  return {
    id: row.id,
    category: row.category as FeedbackItem["category"],
    stars: row.stars ?? undefined,
    text: row.text ?? "",
    context: row.context as FeedbackItem["context"],
    llm_summary: row.llm_summary ?? undefined,
    llm_classification: row.llm_classification as FeedbackItem["llm_classification"],
    user_confirmed: row.user_confirmed ?? undefined,
    screen_ref: row.screen_ref ?? undefined,
    admin_status: (row.admin_status as FeedbackStatus) ?? "neu",
    admin_notes: row.admin_notes ?? undefined,
    admin_priority: row.admin_priority ?? undefined,
    generated_prompt: row.generated_prompt ?? undefined,
    user_id: row.user_id,
    user_display_name: row.user_display_name ?? undefined,
    created_at: row.created_at,
  };
}
