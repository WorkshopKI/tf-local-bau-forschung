/**
 * Reine Zuordnungs-Logik zwischen Quellen-Belegen und Sätzen des finalen Textes
 * (Journey-Paket 4, Phase 6). Alle Nummerierung 0-basiert über `splitSentences(
 * finalerText)` — dieselbe Basis wie Parser, `data-satz-index` und Check-Engine.
 *
 * **Live-Degradation:** `satzAnzahl` ist stets die AKTUELLE Satzzahl des (ggf.
 * manuell editierten) finalen Textes. Belege, deren Indizes nun außerhalb liegen,
 * fallen hier auf „ohne Zuordnung" zurück (leere Live-Indizes) — reine Anzeige-
 * Logik, die gespeicherten `satzIndizes` bleiben unangetastet.
 */
import type { QuellenBeleg } from '@/core/services/skills';

/** Die im aktuellen Text noch gültigen (im Bereich liegenden) Satz-Indizes eines Belegs. */
export function liveGueltigeIndizes(beleg: QuellenBeleg, satzAnzahl: number): number[] {
  return beleg.satzIndizes.filter(i => i >= 0 && i < satzAnzahl);
}

/** True, wenn der Beleg im aktuellen Text mindestens einen Satz stützt. */
export function belegHatZuordnung(beleg: QuellenBeleg, satzAnzahl: number): boolean {
  return liveGueltigeIndizes(beleg, satzAnzahl).length > 0;
}

/** Belege, die den gegebenen Satz (live-gültig) stützen. */
export function belegeFuerSatz(belege: QuellenBeleg[], satzIndex: number, satzAnzahl: number): QuellenBeleg[] {
  return belege.filter(b => liveGueltigeIndizes(b, satzAnzahl).includes(satzIndex));
}

/** True, wenn die Live-Indizes des Belegs eine der gegebenen Satz-Nummern treffen (Karten-Highlight). */
export function belegBetrifftSaetze(beleg: QuellenBeleg, saetze: readonly number[], satzAnzahl: number): boolean {
  if (saetze.length === 0) return false;
  const idx = liveGueltigeIndizes(beleg, satzAnzahl);
  return saetze.some(s => idx.includes(s));
}

/** Abdeckung: Anzahl distinkter Sätze mit ≥1 (live-gültigem) Beleg + Gesamt-Satzzahl. */
/**
 * Sätze OHNE (live gültigen) Beleg — 0-basiert, aufsteigend. Deterministische
 * Vorarbeit für die kriterien-basierte LLM-QS: das Beleg-Kriterium bekommt sie
 * als Prüfkandidaten mit, damit das Modell gezielt hinsieht statt zu raten.
 * Bewusst nur eine Auswahl-Hilfe — „ohne Beleg" heißt NICHT „unbelegt/falsch"
 * (die Beleg-Ableitung ist selbst nur eine Heuristik).
 */
export function saetzeOhneBeleg(belege: QuellenBeleg[], satzAnzahl: number): number[] {
  const belegt = new Set<number>();
  for (const b of belege) for (const i of liveGueltigeIndizes(b, satzAnzahl)) belegt.add(i);
  const offen: number[] = [];
  for (let i = 0; i < satzAnzahl; i++) if (!belegt.has(i)) offen.push(i);
  return offen;
}

export function belegAbdeckung(belege: QuellenBeleg[], satzAnzahl: number): { abgedeckt: number; gesamt: number } {
  const covered = new Set<number>();
  for (const b of belege) for (const i of liveGueltigeIndizes(b, satzAnzahl)) covered.add(i);
  return { abgedeckt: covered.size, gesamt: satzAnzahl };
}
