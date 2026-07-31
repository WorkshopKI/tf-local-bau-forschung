/**
 * Reine Ableitungen für die Abschnitts-Karte: Pipeline-Status, QS-Badge,
 * Kriterien-Stand und der konsolidierte Hinweis-Streifen.
 *
 * Bewusst hier statt in den Komponenten: das Repo hat keine Render-Tests
 * (`@testing-library` ist nicht installiert), also wandert alles Entscheidbare
 * in reine Funktionen — die sind vollständig testbar, und die Komponenten
 * bleiben Darstellung.
 */
import { qsRollup } from './qs';
import { pruefeLektorat, befundText } from './lektorat';
import type { QsBefund, StepRun } from './types';

export type AnzeigeTon = 'ok' | 'hinweis' | 'neutral';

/* -------------------------------------------------------------------------- */
/* Pipeline-Status (Kopfzeile)                                                 */
/* -------------------------------------------------------------------------- */

export interface PipelineStatus {
  text: string;
  ton: AnzeigeTon;
}

/**
 * Was mit diesem Abschnitt passiert ist — die Kette „Formulieren → Feinschliff"
 * in einer Zeile. `lektoriert` und `feinschliffUebersprungen` schließen einander
 * aus (`applyLektorat` löscht die Markierung), der dritte Fall ist ein Abschnitt
 * aus der Zeit vor der Auto-Kette bzw. ein reiner Rohentwurf.
 */
export function pipelineStatus(run: StepRun): PipelineStatus {
  if (run.lektoriert) return { text: 'Formuliert · Feinschliff', ton: 'ok' };
  if (run.feinschliffUebersprungen) return { text: 'Formuliert · Feinschliff übersprungen', ton: 'hinweis' };
  return { text: 'Formuliert', ton: 'neutral' };
}

/* -------------------------------------------------------------------------- */
/* QS-Badge + Kriterien-Stand                                                  */
/* -------------------------------------------------------------------------- */

export interface QsBadgeInfo {
  text: string;
  ton: AnzeigeTon;
}

/**
 * Der QS-Stand für das Badge am Freigeben-Knopf. STRENG beratend — er beschreibt
 * nur, was die QS gesagt hat, und blockiert nie.
 *
 * Reihenfolge ist Absicht: eine veraltete Abnahme schlägt alles andere, weil
 * „stand mal so da, gilt aber nicht mehr" die wichtigste Aussage ist.
 */
export function qsBadge(run: StepRun): QsBadgeInfo {
  if (run.qsAbnahme?.veraltet) return { text: 'QS veraltet', ton: 'hinweis' };
  if (run.qsAbnahme?.status === 'bestanden') return { text: 'QS bestanden', ton: 'ok' };
  const befunde = run.qsHinweise ?? [];
  if (befunde.length > 0) {
    const r = qsRollup(befunde);
    return { text: r.summary, ton: r.level === 'ok' ? 'ok' : 'hinweis' };
  }
  return { text: 'nicht geprüft', ton: 'neutral' };
}

/** „n von m Kriterien ok" für den Kopf des QS-Strips. */
export function qsKriterienStand(befunde: QsBefund[]): { ok: number; gesamt: number } {
  return { ok: befunde.filter(b => b.bewertung === 'ok').length, gesamt: befunde.length };
}

/** Zeigt die Karte überhaupt einen QS-Strip? */
/**
 * Beschriftung der internen KI, die den Abschnitt erzeugt hat — für die Fußzeile.
 * Wortlaut wie im Fallback-Hinweis („Agentische KI … Standard-KI hat übernommen"),
 * damit Fußzeile und Hinweise dieselbe Sprache sprechen.
 *
 * `null` für Records ohne `ziel` (vor v2.365 erzeugt): lieber nichts sagen als raten.
 * Insbesondere NICHT aus der aktuellen Präferenz ableiten — der Umschalter bewegt
 * sich, der Text nicht.
 */
export function zielLabel(run: StepRun): string | null {
  if (!run.ziel) return null;
  return run.ziel === 'agentisch' ? 'Agentische KI' : 'Standard-KI';
}

export function hatQsStrip(run: StepRun): boolean {
  return (run.qsHinweise?.length ?? 0) > 0 || run.qsAbnahme != null;
}

/* -------------------------------------------------------------------------- */
/* Hinweis-Streifen                                                            */
/* -------------------------------------------------------------------------- */

export interface Hinweis {
  /** Stabiler Key für die Liste. */
  key: string;
  text: string;
  /** `hinweis` = amber (etwas stimmt womöglich nicht), `neutral` = reine Information. */
  ton: 'hinweis' | 'neutral';
  /** Optionaler Tooltip mit der Langfassung. */
  titel?: string;
}

/**
 * Sammelt ALLE Streifen-Meldungen eines Abschnitts in EINER Liste. Vorher waren
 * das bis zu fünf einzeln gerenderte Banner übereinander — die Karte hatte damit
 * mehr Hinweis-Ebenen als Inhalt.
 *
 * `retryNote` kommt vom Controller (Auto-Retry-Vermerk), alles andere steckt im
 * Schritt selbst.
 */
export function abschnittHinweise(run: StepRun, retryNote?: string | null): Hinweis[] {
  const out: Hinweis[] = [];
  if (retryNote) out.push({ key: 'retry', text: retryNote, ton: 'hinweis' });
  if (run.warnung) out.push({ key: 'warnung', text: run.warnung, ton: 'hinweis' });
  if (run.chatResetStatus) {
    out.push({
      key: 'chatreset',
      ton: 'hinweis',
      text: 'Chat-Reset fehlgeschlagen — dieser Abschnitt kann durch alten Chat-Verlauf der '
        + 'internen KI beeinflusst sein. In der KI-Oberfläche einen neuen Chat starten und den '
        + 'Abschnitt neu generieren.',
    });
  }
  // Der Lektorat-Wächter rechnet LIVE gegen die letzte Verlaufs-Fassung (= der
  // Stand vor dem Feinschliff); nichts Zusätzliches ist dafür persistiert.
  if (run.lektoriert) {
    const vorher = run.verlauf?.[run.verlauf.length - 1]?.finalerText;
    const befund = vorher ? befundText(pruefeLektorat(vorher, run.finalerText)) : '';
    if (befund) {
      out.push({
        key: 'lektorat',
        ton: 'hinweis',
        text: `Gegenüber dem Stand vor dem Feinschliff: ${befund} — bitte im Versionsvergleich prüfen.`,
      });
    }
  }
  if (run.vbGekuerzt) {
    out.push({
      key: 'vbgekuerzt',
      text: 'Auf gekürzter VB-Basis entstanden — der Schluss floss nicht ein.',
      ton: 'neutral',
    });
  }
  if (run.zielFallback) {
    out.push({
      key: 'zielfallback',
      text: 'Agentische KI nicht verfügbar — Standard-KI hat übernommen.',
      ton: 'neutral',
    });
  }
  if (run.feinschliffUebersprungen) {
    out.push({
      key: 'feinschliff',
      text: 'Feinschliff übersprungen — angezeigter Text ist der Rohentwurf.',
      ton: 'neutral',
    });
  }
  return out;
}
