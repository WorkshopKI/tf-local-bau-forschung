/**
 * Kompetenz-Matrix — Farb-Helfer (v2.16, Design-Handoff).
 *
 * Zwei getrennte Heatmap-Sprachen (Plan / Handoff): Grün = Kompetenz-Level
 * (Token `--tf-level-*`, via `data-v`-Selektor in `kompetenz-matrix.css`),
 * Graustufen = Kapazität (`capCellBg`). Kategorie-Farben werden NICHT hier
 * gebacken, sondern über `--kat-h`/`--kat-s` (aus `KATEGORIE_HS`) + die
 * theme-skopierten Lightness-Vars in CSS komponiert → automatische Dark-Parität.
 */
import type { CSSProperties } from 'react';
import type { KategorieFarbe, UeberKategorie } from '../../types';
import { KATEGORIE_HS } from '../../views/uebersicht/kategorie-colors';

/** Map Überkategorie-ID → konfigurierte Farbe (aus `config.ueberKategorien`).
 *  So bleibt die Matrix farblich konsistent mit den übrigen Auslastungs-Tabs
 *  (Klassifizieren/Zuweisen/Kapazitäten) statt feste Handoff-Hues zu backen. */
export function buildFarbeByUeber(kategorien: UeberKategorie[]): Record<string, KategorieFarbe> {
  const out: Record<string, KategorieFarbe> = {};
  for (const k of kategorien) out[k.id] = k.farbe;
  return out;
}

/**
 * Graustufen-Hintergrund einer Kapazitäts-Zelle. `L = (base − ratio × range) %`
 * mit `ratio = wert / spaltenmax`; base/range kommen aus `--tf-cap-base-l` /
 * `--tf-cap-range` (theme-skopiert: Light dichter = dunkler, Dark dichter =
 * heller via negativem range). Leere/0-Zelle → `undefined` (erbt Zell-bg = weiß
 * bzw. dunkel). Dynamischer, datengetriebener Wert → Inline-Style ist die
 * dokumentierte DESIGN_GUIDE-Ausnahme.
 */
export function capCellBg(value: number | undefined, columnMax: number): string | undefined {
  if (value === undefined || value <= 0 || columnMax <= 0) return undefined;
  const ratio = Math.min(1, value / columnMax);
  return `hsl(220, 8%, calc((var(--tf-cap-base-l) - ${ratio} * var(--tf-cap-range)) * 1%))`;
}

/** Setzt `--kat-h`/`--kat-s` einer Kategorie als CSS-Custom-Props (für Bänder,
 *  Code-Header, Chips). Fällt auf `slate` zurück. */
export function katVars(farbe: KategorieFarbe | undefined | null): CSSProperties {
  const { h, s } = KATEGORIE_HS[farbe ?? 'slate'] ?? KATEGORIE_HS.slate;
  return { ['--kat-h' as string]: h, ['--kat-s' as string]: `${s}%` } as CSSProperties;
}

/** Hover-Deskriptor für das Spalten-/Gruppen-Highlight (Subset von
 *  `HoverState` aus dem Modell — hier dupliziert, um Import-Zyklen zu meiden). */
export type HoverHighlight =
  | { kind: 'col'; subIdx: number; farbe: KategorieFarbe }
  | { kind: 'group'; ueberId: string; farbe: KategorieFarbe }
  | null;

/**
 * Generiert das Hover-Highlight-CSS für GENAU den aktuellen Hover (Ring auf
 * Treffer-Zellen, Dimmen der Nicht-Treffer-Zeilen, MA-Akzent, Spalten- bzw.
 * Gruppen-Perimeter). Wird als `<style>` gerendert — CSS kann `data-hcol` nicht
 * mit `data-ci` vergleichen, darum pro Hover frisch erzeugt (nur ~6 Regeln, nur
 * bei Hover-Wechsel; die 79 Zeilen re-rendern NICHT). Alle Regeln unter
 * `.km-wrap` gescopt + `:has()` (Chrome/Edge-only, akzeptiert). */
export function buildHoverCss(hover: HoverHighlight): string {
  if (!hover) return '';
  const { h, s } = KATEGORIE_HS[hover.farbe] ?? KATEGORIE_HS.slate;
  const hl = `hsl(${h}, ${s}%, 50%)`;
  const frame = `color-mix(in srgb, ${hl} 55%, transparent)`;
  const tint = `color-mix(in srgb, ${hl} 14%, var(--tf-bg))`;
  const hit = '[data-v]:not([data-v="0"])';

  if (hover.kind === 'col') {
    const n = hover.subIdx;
    const cell = `.km-wrap .km-cc[data-ci="${n}"]`;
    return [
      `${cell}${hit}{box-shadow:inset 0 0 0 1.6px ${hl};}`,
      `.km-wrap tr[data-row]:not(:has(.km-cc[data-ci="${n}"]${hit})){opacity:.62;}`,
      `.km-wrap tr[data-row]:has(.km-cc[data-ci="${n}"]${hit}) .km-ma{box-shadow:inset 3px 0 0 ${hl};background:${tint};color:${hl};}`,
      `${cell}{border-left:1px solid ${frame};border-right:1px solid ${frame};}`,
      `.km-wrap .km-h-code[data-ci="${n}"]{box-shadow:inset 0 2px 0 ${frame},inset 1px 0 0 ${frame},inset -1px 0 0 ${frame};}`,
    ].join('\n');
  }

  const g = hover.ueberId;
  return [
    `.km-wrap .km-cc[data-gi="${g}"]${hit}{box-shadow:inset 0 0 0 1.6px ${hl};}`,
    `.km-wrap tr[data-row]:not(:has(.km-cc[data-gi="${g}"]${hit})){opacity:.62;}`,
    `.km-wrap tr[data-row]:has(.km-cc[data-gi="${g}"]${hit}) .km-ma{box-shadow:inset 3px 0 0 ${hl};background:${tint};color:${hl};}`,
    `.km-wrap .km-cc[data-gi="${g}"].gs-first{border-left:1px solid ${frame};}`,
    `.km-wrap .km-cc[data-gi="${g}"].gs-last{border-right:1px solid ${frame};}`,
    `.km-wrap .km-h-band[data-gi="${g}"]{box-shadow:inset 0 2px 0 ${frame};}`,
  ].join('\n');
}
