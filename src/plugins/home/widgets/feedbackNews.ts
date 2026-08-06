/**
 * Reiner Selektor für das Feedback-Neuigkeiten-Widget (Phase 1 v1.1), node-
 * testbar. Leitet aus der Ticket-Menge + einem gerätelokalen Anker vier
 * Ereignisarten ab (neueste zuerst, gekappt):
 *
 *  - **Antwort**   — eigenes Ticket mit (neuer) Team-Antwort (Signatur-Vergleich,
 *                    `signatureOf` aus useUnreadReplies wiederverwendet — kein
 *                    zweiter djb2, Guard `djb2-single-source`) inkl. Statuswort.
 *  - **Status**    — Ticket, an dem ich BETEILIGT bin (eigenes ODER eigene Stimme /
 *                    eigener Kommentar / eigenes Sponsoring), dessen `kurator_status`
 *                    vom gemerkten Stand abweicht. Erst damit ist ein
 *                    fortgeschriebener Sammel-Thread verfolgbar (v2.364).
 *  - **Neu vom Team** — fremdes Ticket, angelegt NACH dem Anker.
 *  - **Stimmen**   — eigenes Ticket, Stimmen-Zuwachs gegenüber dem gemerkten Stand.
 *
 * Datenmodell-Grenze: Antworten/Stimmen/Statuswechsel tragen KEIN Ereignis-Datum
 * → kein fabriziertes „vor N T"; die Kopfzeile „seit …" (Anker) trägt die
 * Aktualität. Sortier-Proxy ist das `created_at` des betroffenen Tickets. Import
 * aus den Feedback-SUB-Modulen (nicht dem Barrel — pdfjs-frei, node-testbar).
 */
import type { FeedbackCategory, FeedbackItem, FeedbackStatus } from '@/core/types/feedback';
import { signatureOf } from '@/components/feedback/useUnreadReplies';
import { istMeineId, istMeinTicket } from '@/core/services/feedback/feedbackIdentitaet';
import type { MeineIdentitaet } from '@/core/services/feedback/feedbackIdentitaet';
import {
  CATEGORY_LABELS,
  CATEGORY_TEXT_VAR,
  STATUS_DOT,
  STATUS_LABELS,
} from '@/components/feedback/constants';
import { feedbackAuthorLabel, feedbackTitle } from '@/components/feedback/feedbackUi';
import { alterInTagen } from '@/core/utils/relativeZeit';

export type FeedbackNewsArt = 'antwort' | 'status' | 'neu-team' | 'stimmen';

export interface FeedbackNewsAnker {
  /** ISO — „gelesen bis". */
  anker: string;
  /** ticketId → votes.length zum Anker-Zeitpunkt (eigene Tickets). */
  stimmenStand: Record<string, number>;
  /** ticketId → signatureOf(kurator_response) zum Anker-Zeitpunkt (eigene Tickets). */
  antwortStand: Record<string, string>;
  /**
   * ticketId → `kurator_status` zum Anker-Zeitpunkt — für ALLE Tickets, an denen
   * ich beteiligt bin (siehe {@link istBeteiligt}). Ein Statuswechsel feuert nur
   * bei BEKANNTEM Vorwert; ein fehlender Eintrag gilt als „noch nicht beobachtet"
   * (sonst hätte der Feld-Zuwachs jedes Bestands-Ticket schlagartig als geändert
   * gemeldet). `ergaenzeUnbekannte` trägt neue Beteiligungen nach.
   */
  statusStand: Record<string, FeedbackStatus>;
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

/**
 * Bin ich an diesem Ticket beteiligt? Eigenes Ticket ODER eigene Stimme /
 * eigener Kommentar / eigenes Sponsoring. Bestimmt, für welche Tickets ein
 * Statuswechsel gemeldet wird — der Sinn eines Sammel-Tickets ist, dass mehrere
 * Leute einem Thema folgen, nicht nur der Einreicher.
 */
export function istBeteiligt(t: FeedbackItem, ich: MeineIdentitaet): boolean {
  if (!ich.schreibId) return false;
  if (istMeinTicket(t, ich)) return true;
  if (t.votes?.some(v => istMeineId(v.user_id, ich))) return true;
  if (t.comments?.some(c => istMeineId(c.user_id, ich))) return true;
  if (t.sponsors?.some(s => istMeineId(s.user_id, ich))) return true;
  return false;
}

function tagenSeit(createdAt: string, nowMs: number): number | null {
  const t = Date.parse(createdAt);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((nowMs - t) / 86_400_000));
}

function typLabel(cat: FeedbackCategory | undefined): string {
  return cat ? CATEGORY_LABELS[cat] : 'Feedback';
}

/**
 * Snapshot der aktuellen Stände — der Anker beim „Alles gelesen" bzw. beim
 * Erst-Anker. Stimmen + Antwort-Signaturen nur für EIGENE Tickets, der
 * Status-Stand für alle BETEILIGTEN. `nowIso` wird injiziert (Testbarkeit).
 */
export function schnappschuss(
  items: FeedbackItem[],
  ich: MeineIdentitaet,
  nowIso: string,
): FeedbackNewsAnker {
  const stimmenStand: Record<string, number> = {};
  const antwortStand: Record<string, string> = {};
  const statusStand: Record<string, FeedbackStatus> = {};
  if (ich.schreibId) {
    for (const t of items) {
      if (istBeteiligt(t, ich)) statusStand[t.id] = t.kurator_status;
      if (!istMeinTicket(t, ich)) continue;
      stimmenStand[t.id] = t.votes?.length ?? 0;
      const reply = t.kurator_response?.trim();
      if (reply) antwortStand[t.id] = signatureOf(reply);
    }
  }
  return { anker: nowIso, stimmenStand, antwortStand, statusStand };
}

/**
 * Trägt für NEU hinzugekommene Beteiligungen den aktuellen Status nach, ohne
 * bestehende Stände anzufassen. Ohne diesen Schritt wäre der erste Statuswechsel
 * eines Tickets, das ich gerade erst kommentiert/gestimmt habe, unsichtbar (der
 * Vorwert fehlt bis zum nächsten „Alles gelesen").
 *
 * Rein und additiv: rückwirkend ist nichts „neu", weil der AKTUELLE Status als
 * Vorwert eingetragen wird. `null` = keine Änderung (Aufrufer persistiert nicht).
 */
export function ergaenzeUnbekannte(
  anker: FeedbackNewsAnker,
  items: FeedbackItem[],
  ich: MeineIdentitaet,
): FeedbackNewsAnker | null {
  if (!ich.schreibId) return null;
  const zusatz: Record<string, FeedbackStatus> = {};
  for (const t of items) {
    if (anker.statusStand[t.id] !== undefined) continue;
    if (!istBeteiligt(t, ich)) continue;
    zusatz[t.id] = t.kurator_status;
  }
  if (Object.keys(zusatz).length === 0) return null;
  return { ...anker, statusStand: { ...anker.statusStand, ...zusatz } };
}

/** Leitet die Neuigkeiten ab (neueste zuerst, gekappt auf `maxEintraege`). */
export function berechneFeedbackNews(
  items: FeedbackItem[],
  ich: MeineIdentitaet,
  anker: FeedbackNewsAnker,
  maxEintraege: number,
  nowMs: number,
): FeedbackNewsEintrag[] {
  const ankerMs = Date.parse(anker.anker);
  const eintraege: FeedbackNewsEintrag[] = [];

  for (const t of items) {
    if (t.category === 'praise') continue; // Lob hat keinen Workflow
    const titel = feedbackTitle(t, 90);
    const eigen = istMeinTicket(t, ich);
    const beteiligt = istBeteiligt(t, ich);
    // Nennt die Antwortzeile den Status schon, entfällt die Statuszeile — sonst
    // stünden zwei Zeilen zum selben Ticket in einem 3-Zeilen-Widget.
    let antwortGemeldet = false;

    if (eigen) {
      // Antwort (neue/geänderte Team-Antwort seit dem Anker)
      const reply = t.kurator_response?.trim();
      if (reply && signatureOf(reply) !== anker.antwortStand[t.id]) {
        antwortGemeldet = true;
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
    } else if (!beteiligt && Number.isFinite(ankerMs) && Date.parse(t.created_at) > ankerMs) {
      // Neu vom Team (fremdes Ticket, nach dem Anker angelegt). Bin ich schon
      // beteiligt (Stimme/Kommentar/Sponsoring), kenne ich es — dann trägt nur
      // die Statuszeile unten neue Information.
      const tage = tagenSeit(t.created_at, nowMs);
      const stimmen = t.votes?.length ?? 0;
      eintraege.push({
        key: `neu-team:${t.id}`,
        art: 'neu-team',
        ticketId: t.id,
        badgeLabel: typLabel(t.category),
        badgeColor: t.category ? CATEGORY_TEXT_VAR[t.category] : 'var(--tf-text-tertiary)',
        text: `Neu von ${feedbackAuthorLabel(t) ?? 'Team'}: „${titel}"`,
        meta: [alterInTagen(tage), stimmen > 0 ? `${stimmen} Stimmen` : null]
          .filter(Boolean).join(' · '),
        sortKey: t.created_at,
      });
    }

    // Statuswechsel an einem Ticket, an dem ich beteiligt bin (v2.364). Nur bei
    // BEKANNTEM Vorwert — ein fehlender Stand heißt „noch nicht beobachtet",
    // nicht „geändert".
    const stand = beteiligt ? anker.statusStand[t.id] : undefined;
    if (!antwortGemeldet && stand !== undefined && stand !== t.kurator_status) {
      const autor = eigen ? null : feedbackAuthorLabel(t);
      eintraege.push({
        key: `status:${t.id}`,
        art: 'status',
        ticketId: t.id,
        badgeLabel: 'Status',
        badgeColor: STATUS_DOT[t.kurator_status],
        text: eigen
          ? `Dein ${typLabel(t.category)} „${titel}" ist jetzt ${STATUS_LABELS[t.kurator_status]}`
          : `„${titel}" ist jetzt ${STATUS_LABELS[t.kurator_status]}`,
        meta: [autor ? `von ${autor}` : null, `vorher ${STATUS_LABELS[stand]}`]
          .filter(Boolean).join(' · '),
        sortKey: t.created_at,
      });
    }
  }

  eintraege.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  return eintraege.slice(0, Math.max(0, maxEintraege));
}
