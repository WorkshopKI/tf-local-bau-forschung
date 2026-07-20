/**
 * Pfad-Zugriff mit Alias-Ketten — der Drift-Puffer des Import-Adapters.
 *
 * Eine Schema-Definition nennt je Zielfeld eine Liste möglicher Quellpfade:
 * der erste ist der primäre, die weiteren sind Aliasse aus älteren oder
 * neueren Plattform-Generationen. Der Report zeigt, welcher Pfad gegriffen hat —
 * damit ist eine Schema-Drift sichtbar, statt still repariert zu werden.
 */

export type PfadStatus = 'primaer' | 'alias' | 'fehlend';

export interface AliasTreffer {
  wert: unknown;
  /** Der tatsächlich benutzte Quellpfad; `null` wenn keiner traf. */
  benutzterPfad: string | null;
  status: PfadStatus;
}

/**
 * Liest einen Punkt-getrennten Pfad. Array-Indizes werden als Zahlsegment
 * geschrieben (`a.0.b`). Gibt `undefined` zurück, wenn der Pfad nicht existiert.
 */
export function lesePfad(wurzel: unknown, pfad: string): unknown {
  if (pfad.length === 0) return undefined;
  let aktuell: unknown = wurzel;
  for (const segment of pfad.split('.')) {
    if (aktuell === null || typeof aktuell !== 'object') return undefined;
    aktuell = (aktuell as Record<string, unknown>)[segment];
    if (aktuell === undefined) return undefined;
  }
  return aktuell;
}

/** `true`, wenn der Pfad existiert und nicht `null`/`undefined` ist. */
export function pfadVorhanden(wurzel: unknown, pfad: string): boolean {
  const wert = lesePfad(wurzel, pfad);
  return wert !== undefined && wert !== null;
}

/**
 * Probiert die Pfade der Reihe nach. Der erste Pfad, der einen Wert liefert,
 * gewinnt; Index 0 gilt als `'primaer'`, alle weiteren als `'alias'`.
 *
 * Bewusst gilt auch `''`, `0` und `false` als Treffer — nur `undefined`/`null`
 * zählen als „nicht vorhanden". Ein Fördersatz von 0 ist ein Wert, kein Fehlen.
 */
export function leseAlias(wurzel: unknown, pfade: readonly string[]): AliasTreffer {
  for (let i = 0; i < pfade.length; i++) {
    const pfad = pfade[i]!;
    const wert = lesePfad(wurzel, pfad);
    if (wert !== undefined && wert !== null) {
      return { wert, benutzterPfad: pfad, status: i === 0 ? 'primaer' : 'alias' };
    }
  }
  return { wert: undefined, benutzterPfad: null, status: 'fehlend' };
}

// --- Typ-Verengungen (die Quelle ist unzuverlässig getypt) -----------------

/** Zahl aus einem Quellwert; toleriert Zahl-als-String (`"5000"`, `"5,5"`). */
export function alsZahl(wert: unknown): number | null {
  if (typeof wert === 'number') return Number.isFinite(wert) ? wert : null;
  if (typeof wert === 'string') {
    const norm = wert.trim().replace(/\s/g, '').replace(',', '.');
    if (norm.length === 0) return null;
    const n = Number(norm);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Nicht-leerer, getrimmter String — sonst `null`. */
export function alsText(wert: unknown): string | null {
  if (typeof wert !== 'string') return null;
  const t = wert.trim();
  return t.length > 0 ? t : null;
}

/** Array oder leeres Array — nie `undefined`. */
export function alsListe(wert: unknown): unknown[] {
  return Array.isArray(wert) ? wert : [];
}

/**
 * Sammelt Werte entlang eines Pfades, in dem `*` für „alle Array-Elemente"
 * steht — z. B. `data.grid.*.auftrage.*.apRef`. Nötig, weil die Quelle
 * AP-Referenzen in zweifach verschachtelten Grids führt. Rein.
 */
export function sammleWerte(wurzel: unknown, pfadMitStern: string): unknown[] {
  const segmente = pfadMitStern.split('.');

  const gehe = (knoten: unknown, tiefe: number): unknown[] => {
    if (tiefe === segmente.length) return knoten === undefined ? [] : [knoten];
    if (knoten === null || typeof knoten !== 'object') return [];

    const segment = segmente[tiefe]!;
    if (segment === '*') {
      if (!Array.isArray(knoten)) return [];
      return knoten.flatMap(kind => gehe(kind, tiefe + 1));
    }
    return gehe((knoten as Record<string, unknown>)[segment], tiefe + 1);
  };

  return gehe(wurzel, 0);
}

/**
 * Sammelt alle Blatt-Pfade eines Objekts (Punkt-Notation, Array-Indizes als
 * Zahlsegment). Grundlage für „unbekannte Felder" im Import-Report und für den
 * Redaktions-Nachweis.
 */
export function sammlePfade(wurzel: unknown, praefix = '', ziel: string[] = []): string[] {
  if (wurzel !== null && typeof wurzel === 'object') {
    const eintraege = Array.isArray(wurzel)
      ? wurzel.map((v, i) => [String(i), v] as const)
      : Object.entries(wurzel as Record<string, unknown>);
    if (eintraege.length === 0 && praefix.length > 0) ziel.push(praefix);
    for (const [schluessel, wert] of eintraege) {
      sammlePfade(wert, praefix ? `${praefix}.${schluessel}` : schluessel, ziel);
    }
  } else if (praefix.length > 0) {
    ziel.push(praefix);
  }
  return ziel;
}
