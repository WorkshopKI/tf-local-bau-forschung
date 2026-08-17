/**
 * Die laufende Suchanfrage übersteht ein Neuladen — aber nicht die Nacht.
 *
 * Anfrage, Facettenwahl, Wort-/Begriffs-Abwahl und Frageplan gehören zusammen:
 * sie beschreiben EINE Suche. Bis v4.82 lagen sie als Modul-State im Store, was
 * den Sprung in die Detailseite überlebte (dafür waren sie dorthin gezogen) —
 * aber kein `F5`. Nach einem Neuladen stand der Nutzer vor einem leeren Feld,
 * und weil zugleich der Rückweg weg war, war die Trefferliste unerreichbar.
 *
 * Deshalb `sessionStorage` und nicht `localStorage`: er überlebt das Neuladen
 * und stirbt mit dem Tab. Die Absicht des Store-Modulkopfs bleibt damit gewahrt
 * — ein Kaltstart landet im Leerzustand, niemand erbt eine Suche von vorgestern.
 *
 * Alle Leser sind **tolerant**: Fremdinhalt (Handbearbeitung, alter Stand,
 * anderes Schema) heißt „nichts gemerkt", nie ein halb geladener Zustand. Das
 * ist load-bearing — ein kaputter Frageplan würde die Deutungszeile mit einer
 * Legende füllen, die zur Anfrage nicht passt.
 */
import { LEERE_WAHL, FACETTEN_REIHENFOLGE, type FacettenWahl, type FacettenId } from './facetten';
import type { Frageplan } from '@/core/services/search/frageplan';

const PRAEFIX = 'teamflow_suche_sitzung_';

export const S_QUERY = PRAEFIX + 'query';
export const S_FACETTEN = PRAEFIX + 'facetten';
export const S_WOERTER = PRAEFIX + 'woerter';
export const S_BEGRIFFE = PRAEFIX + 'begriffe';
export const S_PLAN = PRAEFIX + 'plan';

/** Merkt einen Wert. `null`, `undefined` und `''` löschen den Eintrag. */
export function merke(schluessel: string, wert: unknown): void {
  try {
    if (wert === null || wert === undefined || wert === '') {
      sessionStorage.removeItem(schluessel);
      return;
    }
    sessionStorage.setItem(schluessel, JSON.stringify(wert));
  } catch { /* ignore — ohne Speicher verhält sich die Seite wie vor v4.83 */ }
}

function rohLesen(schluessel: string): unknown {
  try {
    const roh = sessionStorage.getItem(schluessel);
    if (roh === null) return undefined;
    return JSON.parse(roh) as unknown;
  } catch {
    return undefined;
  }
}

function istWortliste(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(e => typeof e === 'string');
}

/** Die gemerkte Anfrage, oder `''`. */
export function liesQuery(): string {
  const v = rohLesen(S_QUERY);
  return typeof v === 'string' ? v : '';
}

/** Eine gemerkte Wortliste (Abwahl von Wörtern bzw. Leitbegriffen), oder `[]`. */
export function liesWortliste(schluessel: string): string[] {
  const v = rohLesen(schluessel);
  return istWortliste(v) ? v : [];
}

/**
 * Die gemerkte Facettenwahl.
 *
 * Nur die bekannten Facetten-Ids werden übernommen — eine Facette, die es nicht
 * mehr gibt, filterte sonst unsichtbar weiter.
 */
export function liesFacettenWahl(): FacettenWahl {
  const v = rohLesen(S_FACETTEN);
  if (!v || typeof v !== 'object' || Array.isArray(v)) return LEERE_WAHL;
  const quelle = v as Record<string, unknown>;
  const wahl: Record<FacettenId, readonly string[]> = { ...LEERE_WAHL };
  let etwasDabei = false;
  for (const id of FACETTEN_REIHENFOLGE) {
    const werte = quelle[id];
    if (istWortliste(werte) && werte.length > 0) {
      wahl[id] = werte;
      etwasDabei = true;
    }
  }
  return etwasDabei ? wahl : LEERE_WAHL;
}

/**
 * Der gemerkte Frageplan, oder `null`.
 *
 * Geprüft wird, was die Seite tatsächlich liest: die Frage (seine Identität),
 * die Leitbegriffe mit ihren Nadeln, die zwei Plan-Facetten und die Verlustliste.
 * Fehlt oder passt eines davon nicht, ist der ganze Plan hinfällig — die Suche
 * fällt dann auf die Stichwortsuche zurück, was ein gültiger Zustand ist.
 */
export function liesFrageplan(): Frageplan | null {
  const v = rohLesen(S_PLAN);
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const p = v as Record<string, unknown>;
  if (typeof p.frage !== 'string' || p.frage.length === 0) return null;
  if (!Array.isArray(p.leitbegriffe) || p.leitbegriffe.length === 0) return null;
  const begriffeOk = p.leitbegriffe.every(b => {
    if (!b || typeof b !== 'object') return false;
    const k = b as Record<string, unknown>;
    return typeof k.begriff === 'string' && k.begriff.length > 0
      && istWortliste(k.nadeln) && typeof k.pflicht === 'boolean';
  });
  if (!begriffeOk) return null;
  if (!p.facetten || typeof p.facetten !== 'object') return null;
  const f = p.facetten as Record<string, unknown>;
  if (!istWortliste(f.status) || !istWortliste(f.jahr)) return null;
  if (!istWortliste(p.ignoriert)) return null;
  return v as Frageplan;
}
