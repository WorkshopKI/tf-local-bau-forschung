/**
 * Reiner Selektor für das Feedback-Neuigkeiten-Widget (Phase 1 v1.1), node-
 * testbar. Leitet aus der Ticket-Menge + einem gerätelokalen Anker drei
 * Ereignisarten ab (neueste zuerst, gekappt):
 *
 *  - **Antwort**   — eigenes Ticket mit (neuer) Team-Antwort (Signatur-Vergleich,
 *                    `signatureOf` aus useUnreadReplies wiederverwendet — kein
 *                    zweiter djb2, Guard `djb2-single-source`) inkl. Statuswort.
 *  - **Neu vom Team** — fremdes Ticket, angelegt NACH dem Anker.
 *  - **Stimmen**   — eigenes Ticket, Stimmen-Zuwachs gegenüber dem gemerkten Stand.
 *
 * Datenmodell-Grenze: Antworten/Stimmen tragen KEIN Ereignis-Datum → kein
 * fabriziertes „vor N T"; die Kopfzeile „seit …" (Anker) trägt die Aktualität.
 * Sortier-Proxy ist das `created_at` des betroffenen Tickets. Import aus den
 * Feedback-SUB-Modulen (nicht dem Barrel — pdfjs-frei, node-testbar).
 */
import type { FeedbackCategory, FeedbackItem } from '@/core/types/feedback';
import { signatureOf } from '@/components/feedback/useUnreadReplies';
import { CATEGORY_LABELS, CATEGORY_TEXT_VAR, STATUS_LABELS } from '@/components/feedback/constants';
import { feedbackAuthorLabel, feedbackTitle } from '@/components/feedback/feedbackUi';

export type FeedbackNewsArt = 'antwort' | 'neu-team' | 'stimmen';

export interface FeedbackNewsAnker {
  /** ISO — „gelesen bis". */
  anker: string;
  /** ticketId → votes.length zum Anker-Zeitpunkt (eigene Tickets). */
  stimmenStand: Record<string, number>;
  /** ticketId → signatureOf(kurator_response) zum Anker-Zeitpunkt (eigene Tickets). */
  antwortStand: Record<string, string>;
}

export interface FeedbackNewsEintrag {
  /** Stabiler React-Key (`art:ticketId`). */
  key: string;
  art: FeedbackNewsArt;
  ticketId: string;
  badgeLabel: string;
  /** Token (var(--tf-fb-*)) — kein Hex. */
  badgeColor: string;
  /** Hauptzeile. */
  text: string;
  /** Sub-Zeile (Alter / Stimmen / Status) — kann leer sein. */
  meta: string;
  /** Sortier-Schlüssel (created_at des Tickets, Proxy). */
  sortKey: string;
}

const ANTWORT_COLOR = 'var(--tf-fb-lob)';   // grün (umgesetzt/positiv)
const STIMMEN_COLOR = 'var(--tf-fb-ux)';    // violett (Zuspruch)

function tagenSeit(createdAt: string, nowMs: number): number | null {
  const t = Date.parse(createdAt);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((nowMs - t) / 86_400_000));
}

function typLabel(cat: FeedbackCategory | undefined): string {
  return cat ? CATEGORY_LABELS[cat] : 'Feedback';
}

/**
 * Snapshot der aktuellen Stände (Stimmen + Antwort-Signaturen) der EIGENEN
 * Tickets — der Anker beim „Alles gelesen" bzw. beim Erst-Anker. `nowIso` wird
 * injiziert (Testbarkeit).
 */
export function schnappschuss(
  items: FeedbackItem[],
  meId: string | undefined,
  nowIso: string,
): FeedbackNewsAnker {
  const stimmenStand: Record<string, number> = {};
  const antwortStand: Record<string, string> = {};
  if (meId) {
    for (const t of items) {
      if (t.user_id !== meId) continue;
      stimmenStand[t.id] = t.votes?.length ?? 0;
      const reply = t.kurator_response?.trim();
      if (reply) antwortStand[t.id] = signatureOf(reply);
    }
  }
  return { anker: nowIso, stimmenStand, antwortStand };
}

/** Leitet die Neuigkeiten ab (neueste zuerst, gekappt auf `maxEintraege`). */
export function berechneFeedbackNews(
  items: FeedbackItem[],
  meId: string | undefined,
  anker: FeedbackNewsAnker,
  maxEintraege: number,
  nowMs: number,
): FeedbackNewsEintrag[] {
  const ankerMs = Date.parse(anker.anker);
  const eintraege: FeedbackNewsEintrag[] = [];

  for (const t of items) {
    if (t.category === 'praise') continue; // Lob hat keinen Workflow
    const titel = feedbackTitle(t, 90);
    const eigen = !!meId && t.user_id === meId;

    if (eigen) {
      // Antwort (neue/geänderte Team-Antwort seit dem Anker)
      const reply = t.kurator_response?.trim();
      if (reply && signatureOf(reply) !== anker.antwortStand[t.id]) {
        eintraege.push({
          key: `antwort:${t.id}`,
          art: 'antwort',
          ticketId: t.id,
          badgeLabel: 'Antwort',
          badgeColor: ANTWORT_COLOR,
          text: `Dein ${typLabel(t.category)} „${titel}" wurde ${STATUS_LABELS[t.kurator_status].toLowerCase()}`,
          meta: `Status: ${STATUS_LABELS[t.kurator_status]}`,
          sortKey: t.created_at,
        });
      }
      // Stimmen-Zuwachs gegenüber dem gemerkten Stand
      const jetzt = t.votes?.length ?? 0;
      const stand = anker.stimmenStand[t.id] ?? 0;
      if (jetzt > stand) {
        eintraege.push({
          key: `stimmen:${t.id}`,
          art: 'stimmen',
          ticketId: t.id,
          badgeLabel: 'Stimmen',
          badgeColor: STIMMEN_COLOR,
          text: `+${jetzt - stand} Stimmen auf „${titel}"`,
          meta: `jetzt ${jetzt} · Status: ${STATUS_LABELS[t.kurator_status]}`,
          sortKey: t.created_at,
        });
      }
    } else if (Number.isFinite(ankerMs) && Date.parse(t.created_at) > ankerMs) {
      // Neu vom Team (fremdes Ticket, nach dem Anker angelegt)
      const tage = tagenSeit(t.created_at, nowMs);
      const stimmen = t.votes?.length ?? 0;
      eintraege.push({
        key: `neu-team:${t.id}`,
        art: 'neu-team',
        ticketId: t.id,
        badgeLabel: typLabel(t.category),
        badgeColor: t.category ? CATEGORY_TEXT_VAR[t.category] : 'var(--tf-text-tertiary)',
        text: `Neu von ${feedbackAuthorLabel(t) ?? 'Team'}: „${titel}"`,
        meta: [tage !== null ? `vor ${tage} T` : null, stimmen > 0 ? `${stimmen} Stimmen` : null]
          .filter(Boolean).join(' · '),
        sortKey: t.created_at,
      });
    }
  }

  eintraege.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  return eintraege.slice(0, Math.max(0, maxEintraege));
}
