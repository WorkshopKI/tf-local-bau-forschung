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
  AbgeleiteterSchritt, AbleitungsErgebnis, Beitrag, KonfliktDetail,
  MappingVersion, SpinePhase, StatusCategory, StatusFeldEintrag, StatusWertEintrag,
} from './typen';
import { normalisiereWert } from './typen';
import { kategorieFuerFeld } from './spine-kategorie';
import { baueKontext, pruefeBedingung, type BedingungsKontext } from './bedingung';

/** Ordinal der Spine-Phasen für den Konflikt-Abstand. `keine` = 0 (zählt nicht). */
const SPINE_ORDINAL: Record<SpinePhase, number> = {
  keine: 0, eingang: 1, vollstaendigkeit: 2, fachpruefung: 3, bewilligung: 4, schluss: 5,
};

/** Ab dieser Spine-Phasen-Distanz gilt ein Widerspruch als Konflikt (v1 fix). */
export const KONFLIKT_SCHWELLE = 2;

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

/**
 * Beitrag eines **Datums- oder Textfeldes**. Diese Felder haben kein Wert-Enum:
 * die Phase hängt am Feld, nicht am Wert („Bewilligung an ZE ist gesetzt"
 * bedeutet Bewilligung, egal welches Datum dort steht).
 *
 * Ein Feld ohne Rang trägt nicht bei — so ist der ganze Code-Katalog ausgeliefert.
 * Erst wenn die PL einem Feld einen Rang gibt, wirkt es auf die Phase.
 */
function feldBeitrag(feld: StatusFeldEintrag, basis: Omit<Beitrag, keyof BeitragsWertung>): Beitrag {
  const rang = feld.rang ?? 0;
  const terminal = feld.terminal === true;
  const spinePhase = feld.spinePhase ?? 'keine';
  const view = {
    ...basis,
    kategorie: kategorieFuerFeld(spinePhase, terminal, feld.kategorie),
    spinePhase,
    rang,
    terminal,
  };
  if (!feld.aktiv) return { ...view, beruecksichtigt: false, grund: 'inaktiv' };
  if (rang === 0) return { ...view, beruecksichtigt: false, grund: 'rang-0' };
  return { ...view, beruecksichtigt: true };
}

/** Die Wertungs-Felder eines `Beitrag`s — der Rest ist reine Herkunft. */
type BeitragsWertung = Pick<
  Beitrag, 'kategorie' | 'spinePhase' | 'rang' | 'terminal' | 'beruecksichtigt' | 'grund'
>;

function baueBeitraege(version: MappingVersion, eingaenge: Eingang[]): Beitrag[] {
  const idx = wertIndex(version);
  const felder = new Map(version.felder.map(f => [f.feldId, f]));
  const out: Beitrag[] = [];

  for (const e of eingaenge) {
    const feld = felder.get(e.feldId);
    if (!feld) continue;                      // unbekanntes Feld trägt nicht bei
    const wert = (e.wert ?? '').trim();
    if (!wert) continue;
    const basis = { feldId: e.feldId, wert, ...(e.tvId ? { tvId: e.tvId } : {}) };

    if (feld.typ !== 'wert') {
      // Ein Datumsfeld mit unlesbarem Inhalt ist kein Ereignis, sondern ein
      // Datenfehler — es soll die Phase nicht anheben.
      if (feld.typ === 'datum' && parseGermanDate(wert) === null) continue;
      out.push(feldBeitrag(feld, basis));
      continue;
    }

    const eintrag = idx.get(`${e.feldId}::${normalisiereWert(wert)}`);
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
// Der Bedingungs-Evaluator selbst wohnt in `bedingung.ts` (geteilt mit den
// Bearbeitungs-Meilensteinen) — hier nur die Regel-Auswahl + Dedup.

function leiteSchritte(version: MappingVersion, ctx: BedingungsKontext, heute?: string): AbgeleiteterSchritt[] {
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
  //
  // Bewusst nur über WERT-Felder: ein Wert behauptet „hier steht der Vorgang
  // gerade", ein Datum hält fest „dieser Punkt wurde passiert". Ein Antragseingang
  // neben einem fertigen Gutachten ist kein Widerspruch, sondern eine Historie —
  // zählte man Datumsfelder mit, meldete praktisch jeder Antrag einen Konflikt.
  const wertFelder = new Set(version.felder.filter(f => f.typ === 'wert').map(f => f.feldId));
  const nichtTerminal = beruecksichtigt.filter(b => !b.terminal && wertFelder.has(b.feldId));
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
