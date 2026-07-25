/**
 * Fassungen des Meilenstein-Plans — rein (Zeitstempel kommt von außen, damit
 * Tests nicht an der Uhr hängen). Muster: `registry/versioning.ts` und
 * `textbausteine/versionierung.ts`.
 *
 * Drei Regeln, die den Rest tragen:
 * - **Historie newest-first**, `historie[0]` ≙ dem Stand VOR der aktuellen
 *   Änderung. Gekappt auf `MAX_HISTORIE`.
 * - **Der Status ist eine eigene Achse.** Bearbeiten macht eine neue Fassung
 *   (und setzt sie auf `entwurf`); Freigeben ist ein eigener Schritt mit
 *   eigenem Snapshot — wer wann freigegeben hat, ist die auditrelevante Info.
 * - **Rollback rollt vorwärts**: eine Historien-Fassung wird als NEUE Fassung
 *   übernommen, nie zurückgeschnitten. Der Freigabe-Status wird dabei bewusst
 *   nicht mitgerollt — ob ein Plan gilt, entscheidet der heutige Stand.
 */
import type { MeilensteinKnoten, MeilensteinPlan, MeilensteinPlanSnapshot } from './typen';

/** Deckungsgleich mit der Skill-Registry — ein Plan-Verlauf ist nicht wertvoller. */
export const MAX_HISTORIE = 20;

function snapshot(plan: MeilensteinPlan): MeilensteinPlanSnapshot {
  return {
    version: plan.version,
    stand: plan.stand,
    autor: plan.autor,
    status: plan.status,
    gesamtfristTage: plan.gesamtfristTage,
    knoten: plan.knoten.map(k => ({ ...k })),
    ...(plan.kommentar ? { kommentar: plan.kommentar } : {}),
  };
}

function mitSnapshot(plan: MeilensteinPlan, naechster: Omit<MeilensteinPlan, 'historie'>): MeilensteinPlan {
  return {
    ...naechster,
    historie: [snapshot(plan), ...plan.historie].slice(0, MAX_HISTORIE),
  };
}

/** Strukturvergleich für den No-op-Check — Reihenfolge zählt, Zeitstempel nicht. */
function inhaltGleich(a: MeilensteinPlan, b: { knoten: MeilensteinKnoten[]; gesamtfristTage: number }): boolean {
  return a.gesamtfristTage === b.gesamtfristTage
    && JSON.stringify(a.knoten) === JSON.stringify(b.knoten);
}

export interface FassungsEingabe {
  knoten: MeilensteinKnoten[];
  gesamtfristTage: number;
  autor: string | null;
  kommentar?: string;
  jetzt: string;
}

/**
 * Neue Fassung aus einem bearbeiteten Entwurf. Inhaltsgleiche Bearbeitung ist ein
 * **No-op** (gibt denselben Plan zurück) — sonst füllte jedes Öffnen-und-Schließen
 * die Historie mit Leerlauf-Einträgen, und ein „Speichern" ohne Änderung würde
 * einen freigegebenen Plan still zurück in den Entwurf werfen.
 *
 * Eine echte Änderung startet als `entwurf`: neue Fristen sollen erst nach
 * bewusster Freigabe für das ganze Team gelten.
 */
export function neueFassung(plan: MeilensteinPlan, e: FassungsEingabe): MeilensteinPlan {
  if (inhaltGleich(plan, e)) return plan;
  return mitSnapshot(plan, {
    version: plan.version + 1,
    stand: e.jetzt,
    autor: e.autor,
    status: 'entwurf',
    gesamtfristTage: e.gesamtfristTage,
    knoten: e.knoten.map(k => ({ ...k })),
    ...(e.kommentar?.trim() ? { kommentar: e.kommentar.trim() } : {}),
  });
}

/** Freigabe — eigener Schritt, eigener Snapshot. No-op, wenn schon freigegeben. */
export function freigeben(
  plan: MeilensteinPlan, autor: string | null, jetzt: string, kommentar?: string,
): MeilensteinPlan {
  if (plan.status === 'freigegeben') return plan;
  return mitSnapshot(plan, {
    version: plan.version + 1,
    stand: jetzt,
    autor,
    status: 'freigegeben',
    gesamtfristTage: plan.gesamtfristTage,
    knoten: plan.knoten.map(k => ({ ...k })),
    ...(kommentar?.trim() ? { kommentar: kommentar.trim() } : {}),
  });
}

/** Zurück in den Entwurf — der zuletzt freigegebene Stand bleibt in der Historie
 *  und wird von `freigegebeneFassung` weiter ausgewertet. */
export function zurueckInEntwurf(
  plan: MeilensteinPlan, autor: string | null, jetzt: string, kommentar?: string,
): MeilensteinPlan {
  if (plan.status === 'entwurf') return plan;
  return mitSnapshot(plan, {
    version: plan.version + 1,
    stand: jetzt,
    autor,
    status: 'entwurf',
    gesamtfristTage: plan.gesamtfristTage,
    knoten: plan.knoten.map(k => ({ ...k })),
    ...(kommentar?.trim() ? { kommentar: kommentar.trim() } : {}),
  });
}

/**
 * Übernimmt den Inhalt einer Historien-Fassung als NEUE Fassung (Rollback nach
 * vorne). Der Status wird nicht mitgerollt — die neue Fassung ist ein Entwurf und
 * muss wie jede andere freigegeben werden.
 */
export function uebernimmFassung(
  plan: MeilensteinPlan, version: number, autor: string | null, jetzt: string,
): MeilensteinPlan {
  const quelle = plan.historie.find(h => h.version === version);
  if (!quelle) return plan;
  return neueFassung(plan, {
    knoten: quelle.knoten.map(k => ({ ...k })),
    gesamtfristTage: quelle.gesamtfristTage,
    autor,
    kommentar: `Übernommen aus Fassung ${version}`,
    jetzt,
  });
}
