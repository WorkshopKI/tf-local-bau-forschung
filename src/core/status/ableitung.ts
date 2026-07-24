/**
 * Ableitungs-Engine (Schicht 3) — rein deterministisch, ohne UI.
 *
 * Der abgeleitete Hauptstatus ist der **höchste Phasenrang** über alle aktuellen
 * (berücksichtigten) Feldwerte eines Verbunds — robust gegen einzelne vergessene
 * Felder. Ein terminaler Wert schlägt den Rang. Widersprüche (Spine-Phasen ≥ 2
 * Stufen auseinander) werden als Konflikt AUSGEWIESEN, nie stillschweigend
 * aufgelöst (das Ergebnis bleibt der Max-Rang). Dazu: priorisierte
 * Nächste-Schritte-Regeln. Kein LLM.
 */
import { parseGermanDate } from '@/core/services/csv/dateParse';
import type {
  AbgeleiteterSchritt, AbleitungsErgebnis, Bedingung, Beitrag, KonfliktDetail,
  MappingVersion, SpinePhase, StatusCategory, StatusWertEintrag,
} from './typen';
import { normalisiereWert } from './typen';

/** Ordinal der Spine-Phasen für den Konflikt-Abstand. `keine` = 0 (zählt nicht). */
const SPINE_ORDINAL: Record<SpinePhase, number> = {
  keine: 0, eingang: 1, vollstaendigkeit: 2, fachpruefung: 3, bewilligung: 4, schluss: 5,
};

/** Ab dieser Spine-Phasen-Distanz gilt ein Widerspruch als Konflikt (v1 fix). */
export const KONFLIKT_SCHWELLE = 2;

const MS_TAG = 86_400_000;

interface Eingang {
  feldId: string;
  wert: string;
  tvId?: string;
}

function sammleEingaenge(
  felder: Record<string, string>,
  tvFelder?: Record<string, Record<string, string>>,
): Eingang[] {
  const out: Eingang[] = [];
  for (const [feldId, wert] of Object.entries(felder)) out.push({ feldId, wert });
  if (tvFelder) {
    for (const [tvId, rec] of Object.entries(tvFelder)) {
      for (const [feldId, wert] of Object.entries(rec)) out.push({ feldId, wert, tvId });
    }
  }
  return out;
}

function wertIndex(version: MappingVersion): Map<string, StatusWertEintrag> {
  const m = new Map<string, StatusWertEintrag>();
  for (const w of version.werte) m.set(`${w.feldId}::${normalisiereWert(w.wert)}`, w);
  return m;
}

function baueBeitraege(version: MappingVersion, eingaenge: Eingang[]): Beitrag[] {
  const idx = wertIndex(version);
  const datumFelder = new Set(version.felder.filter(f => f.typ === 'datum').map(f => f.feldId));
  const bekannteFelder = new Set(version.felder.map(f => f.feldId));
  const out: Beitrag[] = [];

  for (const e of eingaenge) {
    // Datumsfelder + unbekannte Felder tragen nicht zur Spine-Ableitung bei.
    if (!bekannteFelder.has(e.feldId) || datumFelder.has(e.feldId)) continue;
    const wert = (e.wert ?? '').trim();
    if (!wert) continue;

    const eintrag = idx.get(`${e.feldId}::${normalisiereWert(wert)}`);
    const basis = { feldId: e.feldId, wert, ...(e.tvId ? { tvId: e.tvId } : {}) };

    if (!eintrag) {
      out.push({ ...basis, kategorie: 'sonstige', spinePhase: 'keine', rang: 0, terminal: false, beruecksichtigt: false, grund: 'unkuratiert' });
      continue;
    }
    const view = {
      ...basis,
      kategorie: eintrag.kategorie,
      spinePhase: eintrag.spinePhase,
      rang: eintrag.rang,
      terminal: eintrag.terminal,
    };
    if (!eintrag.aktiv) { out.push({ ...view, beruecksichtigt: false, grund: 'inaktiv' }); continue; }
    if (eintrag.rang === 0) { out.push({ ...view, beruecksichtigt: false, grund: 'rang-0' }); continue; }
    out.push({ ...view, beruecksichtigt: true });
  }
  return out;
}

/** Deterministischer Tie-Break bei gleichem Rang: höhere Spine-Phase, dann
 *  feldId, tvId, wert. */
function besser(a: Beitrag, b: Beitrag): Beitrag {
  if (a.rang !== b.rang) return a.rang > b.rang ? a : b;
  const oa = SPINE_ORDINAL[a.spinePhase], ob = SPINE_ORDINAL[b.spinePhase];
  if (oa !== ob) return oa > ob ? a : b;
  const ka = `${a.feldId}|${a.tvId ?? ''}|${a.wert}`;
  const kb = `${b.feldId}|${b.tvId ?? ''}|${b.wert}`;
  return ka <= kb ? a : b;
}

function fuehrender(beitraege: Beitrag[]): Beitrag | null {
  return beitraege.reduce<Beitrag | null>((best, b) => (best === null ? b : besser(best, b)), null);
}

// --- Regel-Auswertung ------------------------------------------------------

function baueKontext(
  felder: Record<string, string>,
  tvFelder?: Record<string, Record<string, string>>,
): Map<string, string[]> {
  const m = new Map<string, string[]>();
  const add = (feldId: string, wert: string): void => {
    const list = m.get(feldId);
    if (list) list.push(wert); else m.set(feldId, [wert]);
  };
  for (const [f, w] of Object.entries(felder)) add(f, w);
  if (tvFelder) for (const rec of Object.values(tvFelder)) for (const [f, w] of Object.entries(rec)) add(f, w);
  return m;
}

function pruefeBedingung(b: Bedingung, ctx: Map<string, string[]>, heute?: string): boolean {
  if ('alle' in b) return b.alle.every(x => pruefeBedingung(x, ctx, heute));
  if ('einige' in b) return b.einige.some(x => pruefeBedingung(x, ctx, heute));
  const werte = ctx.get(b.feldId) ?? [];
  switch (b.op) {
    case 'ist': return werte.some(v => normalisiereWert(v) === normalisiereWert(b.wert ?? ''));
    case 'istNicht': return !werte.some(v => normalisiereWert(v) === normalisiereWert(b.wert ?? ''));
    case 'gefuellt': return werte.some(v => v.trim() !== '');
    case 'leer': return !werte.some(v => v.trim() !== '');
    case 'datumVor':
    case 'datumNach': {
      if (!heute) return false;
      const grenzeMs = new Date(heute).getTime() + b.tageRelativHeute * MS_TAG;
      const datum = werte.map(v => parseGermanDate(v)).find((d): d is string => !!d);
      if (!datum) return false;
      const ms = new Date(datum).getTime();
      return b.op === 'datumVor' ? ms < grenzeMs : ms > grenzeMs;
    }
    default: return false;
  }
}

function leiteSchritte(version: MappingVersion, ctx: Map<string, string[]>, heute?: string): AbgeleiteterSchritt[] {
  const treffer = version.regeln
    .filter(r => r.aktiv && pruefeBedingung(r.bedingung, ctx, heute))
    .sort((a, b) => a.prioritaet - b.prioritaet);
  const out: AbgeleiteterSchritt[] = [];
  const gesehen = new Set<string>();
  for (const r of treffer) {
    for (const s of r.schritte) {
      const key = `${s.label}|${s.werkzeug ?? ''}`;
      if (gesehen.has(key)) continue;
      gesehen.add(key);
      out.push({ ...s, regelId: r.id });
    }
  }
  return out;
}

/**
 * Leitet den Hauptstatus + Konflikt + nächste Schritte aus dem Feld-Ensemble ab.
 * Rein. `heute` (ISO) nur für Datumsregeln nötig — fehlt es, evaluieren
 * Datumsregeln zu `false`.
 */
export function leiteStatusAb(
  version: MappingVersion,
  felder: Record<string, string>,
  tvFelder?: Record<string, Record<string, string>>,
  heute?: string,
): AbleitungsErgebnis {
  const beitraege = baueBeitraege(version, sammleEingaenge(felder, tvFelder));
  const beruecksichtigt = beitraege.filter(b => b.beruecksichtigt);
  const terminale = beruecksichtigt.filter(b => b.terminal);

  const leitend = terminale.length > 0 ? fuehrender(terminale) : fuehrender(beruecksichtigt);

  // Konflikt: berücksichtigte, NICHT-terminale Werte mit ≥ Schwelle Spine-Abstand.
  const nichtTerminal = beruecksichtigt.filter(b => !b.terminal);
  const ordinale = nichtTerminal.map(b => SPINE_ORDINAL[b.spinePhase]).filter(o => o > 0);
  let konflikt = false;
  let konfliktDetails: KonfliktDetail[] = [];
  if (ordinale.length >= 2 && Math.max(...ordinale) - Math.min(...ordinale) >= KONFLIKT_SCHWELLE) {
    konflikt = true;
    const leitOrd = leitend ? SPINE_ORDINAL[leitend.spinePhase] : 0;
    konfliktDetails = nichtTerminal
      .filter(b => SPINE_ORDINAL[b.spinePhase] !== leitOrd)
      .map(b => ({ feldId: b.feldId, wert: b.wert, ...(b.tvId ? { tvId: b.tvId } : {}), spinePhase: b.spinePhase }));
  }

  const spinePhase: SpinePhase = leitend ? leitend.spinePhase : 'keine';
  const kategorie: StatusCategory = leitend ? leitend.kategorie : 'sonstige';

  return {
    spinePhase,
    kategorie,
    fuehrenderWert: leitend
      ? { feldId: leitend.feldId, wert: leitend.wert, rang: leitend.rang, ...(leitend.tvId ? { tvId: leitend.tvId } : {}) }
      : null,
    terminal: terminale.length > 0,
    konflikt,
    konfliktDetails,
    beitraege,
    naechsteSchritte: leiteSchritte(version, baueKontext(felder, tvFelder), heute),
  };
}
