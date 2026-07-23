/**
 * Tabellen-Ernte für die Antrag-Aufbereitung (Paket 1, rein deterministisch).
 *
 * Arbeitet auf Markdown-Pipe-Tabellen — der Konverter (mammoth → HTML →
 * turndown-gfm) macht aus Word-Tabellen Pipe-Tabellen; ein HTML-Pfad existiert
 * hier bewusst nicht. Findet, klassifiziert und normalisiert AP-Zeitpläne und
 * gleicht VB-Text-Tabelle gegen Anlage 5 ab. Alles reine Funktionen, keine IO.
 */

/** Rohe Markdown-Tabelle: Header + Datenzeilen + Zeichen-Span im Markdown. */
export interface RohTabelle {
  header: string[];
  rows: string[][];
  start: number;
  end: number;
}

export type TabellenKlasse =
  | 'ap-zeitplan-text'
  | 'anlage5'
  | 'risiko'
  | 'ap-taetigkeiten'
  | 'auftraege-dritte'
  | 'unbekannt';

export interface KlassifizierteTabelle extends RohTabelle {
  klasse: TabellenKlasse;
}

/** Normalisierte Arbeitspaket-Zeile (gemeinsames Zielformat für den Gantt). */
export interface ApZeile {
  nummer: string;
  bezeichnung: string;
  istUnterAp: boolean;
  monatStart?: number;
  monatEnde?: number;
  /**
   * Tagesgenaue, fraktionale Monatsposition (1-basiert, wie `monatStart`, aber mit
   * Tagesanteil). NUR aus echten Anlage-5-Datumswerten befüllt; VB-Text-Zeitpläne
   * (nur Monatszahlen) lassen sie leer → die Schwimmbahnen fallen dann auf die
   * ganzen Monate zurück. Der Gantt „Nach AP" nutzt sie NICHT. Herleitung: siehe
   * `zuPos` in `normalisiereAnlage5`.
   */
  posStart?: number;
  posEnde?: number;
  pm?: number;
  maNr?: string;
}

/**
 * Ein Plausibilitäts-Befund. `zeitraum-abweichung`/`nur-im-text`/`nur-in-anlage`/
 * `horizont` kommen aus dem Text↔Anlage-5-Abgleich; `kapazitaet` aus der
 * MA-Auslastungs-Prüfung (Paket 2, deterministisch).
 */
export interface Befund {
  typ: 'zeitraum-abweichung' | 'nur-im-text' | 'nur-in-anlage' | 'horizont' | 'kapazitaet';
  schwere: 'warnung' | 'info';
  text: string;
  quellen: Array<{ rolle: 'vb' | 'anlage5'; sektionId?: string }>;
  /** Bei Verbund-Kapazitätsbefunden: das Teilvorhaben, aus dessen Anlage 5 der Befund stammt. */
  tvAz?: string;
}

// ---------------------------------------------------------------------------
// 1) Pipe-Tabellen-Parser
// ---------------------------------------------------------------------------

/** Eine Pipe-Zeile in Zellen zerlegen (tolerant gg. Rand-Pipes + `\|`-Escapes). */
function splitZellen(line: string): string[] {
  const zellen = line.split(/(?<!\\)\|/).map(c => c.replace(/\\\|/g, '|').trim());
  if (zellen.length && zellen[0] === '') zellen.shift();
  if (zellen.length && zellen[zellen.length - 1] === '') zellen.pop();
  return zellen;
}

/** Ist die Zeile eine GFM-Trennzeile (`| --- | :--: |`)? */
function istTrennzeile(line: string): boolean {
  if (!line.includes('-')) return false;
  const zellen = splitZellen(line);
  return zellen.length > 0 && zellen.every(c => /^:?-{1,}:?$/.test(c));
}

/** Findet alle Markdown-Pipe-Tabellen (Header + Trennzeile + ≥1 Datenzeile). */
export function parsePipeTabellen(md: string): RohTabelle[] {
  const raw = md.split('\n');
  const zeilen: { text: string; start: number }[] = [];
  let offset = 0;
  for (const r of raw) { zeilen.push({ text: r.replace(/\r$/, ''), start: offset }); offset += r.length + 1; }

  const out: RohTabelle[] = [];
  for (let i = 0; i + 1 < zeilen.length; i++) {
    const kopf = zeilen[i]!;
    const trenn = zeilen[i + 1]!;
    if (!kopf.text.includes('|') || !istTrennzeile(trenn.text)) continue;
    const header = splitZellen(kopf.text);
    if (header.length === 0) continue;
    const rows: string[][] = [];
    let j = i + 2;
    for (; j < zeilen.length; j++) {
      const z = zeilen[j]!;
      if (!z.text.includes('|') || z.text.trim() === '') break;
      if (istTrennzeile(z.text)) break;
      rows.push(splitZellen(z.text));
    }
    if (rows.length === 0) { continue; }
    const end = j < zeilen.length ? zeilen[j]!.start : md.length;
    out.push({ header, rows, start: kopf.start, end });
    i = j - 1; // hinter der Tabelle fortsetzen
  }
  return out;
}

// ---------------------------------------------------------------------------
// 2) Klassifikation
// ---------------------------------------------------------------------------

/** Header-Zelle normalisieren: lowercase, Umlaute gefaltet, nur alphanumerisch. */
function normZelle(s: string): string {
  return s.toLowerCase().normalize('NFC')
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '');
}

export function klassifiziereTabelle(t: RohTabelle): TabellenKlasse {
  const H = t.header.map(normZelle);
  const hat = (teil: string): boolean => H.some(h => h.includes(teil));

  const hatAp = H.some(h => h === 'ap' || h === 'nr' || h === 'apnr') || hat('arbeitspaket');
  const hatBez = hat('bezeichnung') || hat('titel') || hat('name');
  const hatBeginn = hat('beginn') || hat('start') || hat('von');
  const hatEnde = hat('ende') || hat('bis');
  const hatManr = hat('manr') || H.some(h => h === 'ma') || hat('mitarbeiter') || hat('personal');
  const hatAufwandPm = hat('aufwandpm') || hat('personenmonat') || H.some(h => h === 'pm');

  // anlage5 zuerst (spezifischer): Datums-Beginn/Ende + MA/PM.
  if (hatAp && hatBez && hatBeginn && hatEnde && (hatManr || hatAufwandPm)) return 'anlage5';

  // ap-zeitplan-text: Monatszahlen (getrennte Monat-Beginn/Ende) ODER Laufzeit-Range-Spalte.
  if ((hatAp || hat('arbeitspaket')) && (hat('laufzeit') || hat('monat') || (hatBeginn && hatEnde))) {
    return 'ap-zeitplan-text';
  }

  if (hat('risiko') && hat('beschreib')) return 'risiko';
  if (hatAp && hat('tatigkeit') && hat('ergebnis')) return 'ap-taetigkeiten';
  if ((hat('lfd') || hat('auftragnehmer') || hat('auftrag')) && hat('kosten')) return 'auftraege-dritte';
  return 'unbekannt';
}

/** Alle Tabellen finden + klassifizieren (nichts verwerfen). */
export function ernteTabellen(md: string): KlassifizierteTabelle[] {
  return parsePipeTabellen(md).map(t => ({ ...t, klasse: klassifiziereTabelle(t) }));
}

// ---------------------------------------------------------------------------
// 3) Normalisierung Zeitplan
// ---------------------------------------------------------------------------

/** Spaltenindex per normalisiertem Header-Prädikat. */
function spaltenIndex(header: string[], pred: (h: string) => boolean): number {
  return header.map(normZelle).findIndex(pred);
}

function parseDeDatum(s: string): { y: number; m: number; d: number } | null {
  const m = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(s);
  return m ? { y: +m[3]!, m: +m[2]!, d: +m[1]! } : null;
}
/** Fortlaufender Monatsindex — erlaubt Differenzen über Jahresgrenzen. */
export const datumAbsolut = (d: { y: number; m: number }): number => d.y * 12 + (d.m - 1);
/** Tage im Kalendermonat von `d` (respektiert Feb 28/29, 30-/31-Tage-Monate). */
export const monatslaenge = (d: { y: number; m: number }): number => new Date(d.y, d.m, 0).getDate();

/**
 * Laufzeit-/Monats-Range aus Freitext lesen: `Monat 1–4`, `M1-4`, `1 – 4`,
 * `3` (einzelner Monat). En-Dash/Em-Dash/Bindestrich/„bis" toleriert;
 * Klammer-Zusätze (`(Juli–Oktober 2024)`) werden ignoriert.
 */
export function parseMonatRange(s: string): { start?: number; ende?: number } {
  const clean = s.replace(/\([^)]*\)/g, ' ');
  const range = /(?:monat|m)?\s*(\d{1,2})\s*(?:[–—-]|bis)\s*(?:monat|m)?\s*(\d{1,2})/i.exec(clean);
  if (range) return { start: +range[1]!, ende: +range[2]! };
  const single = /(?:monat|m)?\s*(\d{1,2})/i.exec(clean);
  if (single) return { start: +single[1]!, ende: +single[1]! };
  return {};
}

function parseGanzzahl(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const m = /-?\d+(?:[.,]\d+)?/.exec(s.replace(/\s/g, ''));
  return m ? parseFloat(m[0]!.replace(',', '.')) : undefined;
}

const istUnterApNummer = (nummer: string): boolean => /^\d+\.\d+/.test(nummer.trim());

/**
 * Anlage-5-Tabelle → `ApZeile[]`. **M1 = Monat des frühesten Beginn-Datums über
 * alle Zeilen** (Default; der Projektstart steht nicht verlässlich in der
 * Tabelle). Ober-AP-Gruppenzeilen (nur Nummer + Bezeichnung, ohne Daten) tragen
 * keine Monate — ihre Spanne leitet der Gantt aus den Unter-APs ab.
 */
export function normalisiereAnlage5(t: RohTabelle): ApZeile[] {
  const apIdx = spaltenIndex(t.header, h => h === 'ap' || h === 'nr' || h === 'apnr');
  const bezIdx = spaltenIndex(t.header, h => h.includes('bezeichnung') || h.includes('titel'));
  const beginnIdx = spaltenIndex(t.header, h => h.includes('beginn') || h.includes('von'));
  const endeIdx = spaltenIndex(t.header, h => h.includes('ende') || h.includes('bis'));
  const maIdx = spaltenIndex(t.header, h => h.includes('manr') || h === 'ma' || h.includes('mitarbeiter'));
  const pmIdx = spaltenIndex(t.header, h => h.includes('aufwandpm') || h.includes('personenmonat') || h === 'pm' || h.includes('aufwand'));

  const daten = t.rows.map(r => ({
    nummer: (r[apIdx] ?? '').trim(),
    bezeichnung: (r[bezIdx] ?? '').trim(),
    beginn: beginnIdx >= 0 ? parseDeDatum(r[beginnIdx] ?? '') : null,
    ende: endeIdx >= 0 ? parseDeDatum(r[endeIdx] ?? '') : null,
    pm: pmIdx >= 0 ? parseGanzzahl(r[pmIdx]) : undefined,
    maNr: maIdx >= 0 ? (r[maIdx] ?? '').trim() || undefined : undefined,
  }));

  const beginnDaten = daten.map(d => d.beginn).filter((d): d is { y: number; m: number; d: number } => d !== null);
  const basis = beginnDaten.reduce<{ y: number; m: number } | null>(
    (min, d) => (min === null || datumAbsolut(d) < datumAbsolut(min) ? d : min), null,
  );
  const zuMonat = (d: { y: number; m: number } | null): number | undefined =>
    d && basis ? datumAbsolut(d) - datumAbsolut(basis) + 1 : undefined;
  // Fraktionale (tagesgenaue) Position, 1-basiert wie `zuMonat`, plus Tagesanteil:
  //   posStart = <ganzer Monat> + (Tag − 1) / Monatslänge   (Monatsanfang = Kante)
  //   posEnde  = <ganzer Monat> +  Tag      / Monatslänge   (Monatsende  = nächste Kante)
  // Beleg: 01.04.→4,0 · 15.04.(Start)→4,467 · 30.04.(Ende)→5,0. Konsistent zur
  // Gantt-Achse (Balken M[s…e] = [x(s) … x(e+1))): ein voller April-Balken
  // (01.–30.04.) spannt posStart 4,0 … posEnde 5,0 = genau eine Monatsspalte.
  const zuPos = (d: { y: number; m: number; d: number } | null, istEnde: boolean): number | undefined => {
    if (!d || !basis) return undefined;
    const ganz = datumAbsolut(d) - datumAbsolut(basis) + 1;
    const tagAnteil = istEnde ? d.d / monatslaenge(d) : (d.d - 1) / monatslaenge(d);
    return ganz + tagAnteil;
  };

  return daten
    .filter(d => d.nummer || d.bezeichnung)
    .map(d => ({
      nummer: d.nummer,
      bezeichnung: d.bezeichnung,
      istUnterAp: istUnterApNummer(d.nummer),
      monatStart: zuMonat(d.beginn),
      monatEnde: zuMonat(d.ende),
      posStart: zuPos(d.beginn, false),
      posEnde: zuPos(d.ende, true),
      pm: d.pm,
      maNr: d.maNr,
    }));
}

/**
 * ap-zeitplan-text → `ApZeile[]`. Monatszahlen direkt aus getrennten
 * Monat-Beginn/Ende-Spalten ODER aus einer Laufzeit-Range-Spalte. Zeilen ohne
 * eigene AP-Nummer bekommen eine laufende Nummer; die Bezeichnung ist der
 * Schlüssel. `pm` NUR aus einer echten PM-Spalte (nie aus „Aufwand"/„Dauer" —
 * dort steckt oft Personentage bzw. Monatsdauer, nicht Personenmonate).
 */
export function normalisiereZeitplanText(t: RohTabelle): ApZeile[] {
  const apIdx = spaltenIndex(t.header, h => h === 'ap' || h === 'nr' || h === 'apnr' || h.includes('arbeitspaket'));
  const bezIdx = spaltenIndex(t.header, h => h.includes('bezeichnung') || h.includes('titel') || h.includes('name'));
  const laufzeitIdx = spaltenIndex(t.header, h => h.includes('laufzeit') || h.includes('zeitraum'));
  const beginnIdx = spaltenIndex(t.header, h => h.includes('beginn') || h.includes('von') || (h.includes('monat') && !h.includes('ende')));
  const endeIdx = spaltenIndex(t.header, h => h.includes('ende') || h.includes('bis'));
  const pmIdx = spaltenIndex(t.header, h => h.includes('aufwandpm') || h.includes('personenmonat') || h === 'pm');

  // Text-Bezeichnung = Bezeichnungsspalte, sonst die AP-Spalte (die dann oft der
  // reine Titel ohne Nummer ist), sonst die erste nicht-numerische Spalte.
  const textIdx = bezIdx >= 0 ? bezIdx : apIdx >= 0 ? apIdx : 0;

  let lauf = 0;
  return t.rows
    .filter(r => (r[textIdx] ?? '').trim() !== '')
    .map(r => {
      lauf += 1;
      const apZelle = apIdx >= 0 ? (r[apIdx] ?? '').trim() : '';
      const nummer = /\d/.test(apZelle) ? apZelle.replace(/^ap\s*/i, '') : String(lauf);
      let start: number | undefined;
      let ende: number | undefined;
      if (laufzeitIdx >= 0) {
        ({ start, ende } = parseMonatRange(r[laufzeitIdx] ?? ''));
      } else {
        start = beginnIdx >= 0 ? parseGanzzahl(r[beginnIdx]) : undefined;
        ende = endeIdx >= 0 ? parseGanzzahl(r[endeIdx]) : undefined;
      }
      return {
        nummer,
        bezeichnung: (r[bezIdx >= 0 ? bezIdx : textIdx] ?? '').trim(),
        istUnterAp: istUnterApNummer(nummer),
        monatStart: start,
        monatEnde: ende ?? start,
        pm: pmIdx >= 0 ? parseGanzzahl(r[pmIdx]) : undefined,
      };
    });
}

// ---------------------------------------------------------------------------
// 4) Plausibilitätsabgleich Text ↔ Anlage 5
// ---------------------------------------------------------------------------

const STOPWORTE = new Set(['des', 'der', 'die', 'das', 'den', 'dem', 'und', 'von', 'im', 'zur', 'zum', 'fur', 'mit', 'im']);

function bezTokens(s: string): Set<string> {
  const norm = s.toLowerCase().normalize('NFC')
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9\s]+/g, ' ');
  return new Set(norm.split(/\s+/).filter(t => t.length > 1 && !STOPWORTE.has(t)));
}

function tokenOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let treffer = 0;
  for (const t of a) if (b.has(t)) treffer++;
  return treffer / Math.max(a.size, b.size);
}

function bezPasst(a: string, b: string): boolean {
  const na = a.toLowerCase().trim();
  const nb = b.toLowerCase().trim();
  if (na && nb && (na.includes(nb) || nb.includes(na))) return true;
  return tokenOverlap(bezTokens(a), bezTokens(b)) >= 0.6;
}

/**
 * Ober-APs mit effektiver Spanne: eigene Monate, sonst aus den Unter-APs
 * (min Start / max Ende) aggregiert. Gruppenzeilen ohne eigene Daten bekommen so
 * ihre reale Spanne für den Vergleich.
 */
function oberApsMitSpanne(zeilen: ApZeile[]): ApZeile[] {
  const kinder = (nr: string): ApZeile[] =>
    zeilen.filter(z => z.istUnterAp && z.nummer.trim().startsWith(nr.trim() + '.'));
  return zeilen.filter(z => !z.istUnterAp).map(o => {
    if (o.monatStart != null || o.monatEnde != null) return o;
    const ks = kinder(o.nummer).filter(k => k.monatStart != null || k.monatEnde != null);
    if (ks.length === 0) return o;
    const starts = ks.map(k => k.monatStart ?? k.monatEnde!).filter(n => n != null);
    const enden = ks.map(k => k.monatEnde ?? k.monatStart!).filter(n => n != null);
    return { ...o, monatStart: Math.min(...starts), monatEnde: Math.max(...enden) };
  });
}

const mLabel = (a?: number, b?: number): string =>
  a != null && b != null ? (a === b ? `M${a}` : `M${a}–M${b}`) : a != null ? `M${a}` : 'ohne Angabe';

function maxMonat(zeilen: ApZeile[]): number {
  return zeilen.reduce((max, z) => Math.max(max, z.monatEnde ?? z.monatStart ?? 0), 0);
}

/**
 * Plausibilitätsabgleich: Text-Zeitplan (VB) vs. Anlage 5. Nur Ober-APs, Matching
 * über normalisierte Bezeichnung (Substring ODER Token-Overlap ≥ 0.6). Reine
 * Funktion. `sektionId` bleibt hier leer und wird ggf. vom Aufrufer angereichert.
 */
export function verglichZeitplaene(text: ApZeile[], anlage: ApZeile[]): Befund[] {
  const befunde: Befund[] = [];
  const textOber = oberApsMitSpanne(text);
  const anlageOber = oberApsMitSpanne(anlage);
  const anlageGematcht = new Set<number>();

  for (const tz of textOber) {
    const idx = anlageOber.findIndex((az, i) => !anlageGematcht.has(i) && bezPasst(tz.bezeichnung, az.bezeichnung));
    if (idx < 0) {
      befunde.push({
        typ: 'nur-im-text', schwere: 'info',
        text: `AP „${tz.bezeichnung}" ist im Text-Projektplan terminiert (${mLabel(tz.monatStart, tz.monatEnde)}), fehlt aber in Anlage 5.`,
        quellen: [{ rolle: 'vb' }],
      });
      continue;
    }
    anlageGematcht.add(idx);
    const az = anlageOber[idx]!;
    const beideMonate = tz.monatStart != null && az.monatStart != null;
    if (beideMonate && (tz.monatStart !== az.monatStart || tz.monatEnde !== az.monatEnde)) {
      befunde.push({
        typ: 'zeitraum-abweichung', schwere: 'warnung',
        text: `AP „${tz.bezeichnung}": Text-Projektplan nennt ${mLabel(tz.monatStart, tz.monatEnde)}, Anlage 5 terminiert ${mLabel(az.monatStart, az.monatEnde)}.`,
        quellen: [{ rolle: 'vb' }, { rolle: 'anlage5' }],
      });
    }
  }

  anlageOber.forEach((az, i) => {
    if (anlageGematcht.has(i)) return;
    befunde.push({
      typ: 'nur-in-anlage', schwere: 'info',
      text: `AP „${az.bezeichnung}" (${mLabel(az.monatStart, az.monatEnde)}) steht in Anlage 5, aber nicht im Text-Projektplan.`,
      quellen: [{ rolle: 'anlage5' }],
    });
  });

  // Horizont: deutlich unterschiedlicher Gesamt-Horizont (≥ 3 Monate).
  const maxText = maxMonat(textOber);
  const maxAnlage = maxMonat(anlageOber);
  if (maxText > 0 && maxAnlage > 0 && Math.abs(maxText - maxAnlage) >= 3) {
    const laenger = maxText > maxAnlage ? 'Text-Projektplan' : 'Anlage 5';
    const kuerzer = maxText > maxAnlage ? 'Anlage 5' : 'Text-Projektplan';
    befunde.push({
      typ: 'horizont', schwere: 'info',
      text: `Zeithorizont weicht ab: ${laenger} reicht bis M${Math.max(maxText, maxAnlage)}, ${kuerzer} endet bei M${Math.min(maxText, maxAnlage)} — spätere APs dort nicht terminiert.`,
      quellen: [{ rolle: 'vb' }, { rolle: 'anlage5' }],
    });
  }

  return befunde;
}

// ---------------------------------------------------------------------------
// 5) Kapazitäts-Prüfung (MA-Auslastung je Kalendermonat, deterministisch)
// ---------------------------------------------------------------------------

/**
 * Kapazitätsgrenze pro MA und Kalendermonat. 1,0 PM = eine Person voll im Monat;
 * `1,2` lässt 20 % Rundungs-/Terminierungs-Toleranz zu (Default — konservativ, da
 * Anlage-5-Halbmonatsangaben oft auf ganze Monate gerundet werden).
 */
export const KAPAZITAET_GRENZE_PM = 1.2;

/** PM deutsch formatieren (Komma-Dezimal, keine Nachkommastelle bei ganzen Zahlen). */
function fmtPm(n: number): string {
  return n.toLocaleString('de-DE', { maximumFractionDigits: 2 });
}

/** Last einer (MA, Monat)-Zelle: aufsummierte anteilige PM + beteiligte APs. */
export interface MaMonatsLast {
  pm: number;
  aps: Array<{ nummer: string; bezeichnung: string; pm: number }>;
}

/**
 * Bündelt die anteiligen Personenmonate je (MA-Nr, Kalendermonat): `maNr → Monat →
 * Last`. Die PM eines Eintrags werden **gleichmäßig über seine Monatsspanne**
 * verteilt; ein Eintrag ohne `monatEnde` (bzw. Halbmonats-Eintrag mit
 * `monatStart == monatEnde`) zählt im jeweiligen Monat **voll**. Nur Zeilen mit
 * MA-Nr + PM + Monat gehen ein; **verschiedene MAs werden NIE zusammengezählt**
 * (jede Person ein eigenes Konto). Reine Funktion — geteilt von `pruefeKapazitaet`
 * (Befunde) und der Schwimmbahnen-Ansicht (Bahn-Warnungen, Default #5).
 */
export function kapazitaetProMaMonat(zeilen: ApZeile[]): Map<string, Map<number, MaMonatsLast>> {
  const proMa = new Map<string, Map<number, MaMonatsLast>>();
  for (const z of zeilen) {
    const ma = z.maNr?.trim();
    if (!ma || z.pm == null || z.pm <= 0 || z.monatStart == null) continue;
    const von = z.monatStart;
    const bis = z.monatEnde ?? z.monatStart;
    const anzahlMonate = Math.max(1, bis - von + 1);
    const anteil = z.pm / anzahlMonate;
    const monate = proMa.get(ma) ?? new Map<number, MaMonatsLast>();
    for (let m = von; m <= bis; m++) {
      const last = monate.get(m) ?? { pm: 0, aps: [] };
      last.pm += anteil;
      last.aps.push({ nummer: z.nummer.trim(), bezeichnung: z.bezeichnung, pm: anteil });
      monate.set(m, last);
    }
    proMa.set(ma, monate);
  }
  return proMa;
}

/**
 * Kapazitäts-Befund: warnt, wenn eine Person in einem Monat über
 * `KAPAZITAET_GRENZE_PM` liegt (physisch nicht leistbar). Aggregation über
 * `kapazitaetProMaMonat`. Reine Funktion.
 */
export function pruefeKapazitaet(zeilen: ApZeile[]): Befund[] {
  const proMa = kapazitaetProMaMonat(zeilen);

  const befunde: Befund[] = [];
  // Deterministische Reihenfolge: MA aufsteigend, dann Monat aufsteigend.
  for (const ma of [...proMa.keys()].sort((a, b) => a.localeCompare(b, 'de'))) {
    const monate = proMa.get(ma)!;
    for (const m of [...monate.keys()].sort((a, b) => a - b)) {
      const last = monate.get(m)!;
      // Float-Rauschen tolerieren (z.B. 3 × 0.4 = 1.2000000000002).
      if (last.pm <= KAPAZITAET_GRENZE_PM + 1e-9) continue;
      const apListe = last.aps.map(a => `AP ${a.nummer} (${fmtPm(a.pm)} PM)`).join(', ');
      befunde.push({
        typ: 'kapazitaet', schwere: 'warnung',
        text: `MA ${ma} ist in M${m} mit ${fmtPm(last.pm)} PM überplant (Kapazität ${fmtPm(KAPAZITAET_GRENZE_PM)} PM/Monat): ${apListe}.`,
        quellen: [{ rolle: 'anlage5' }],
      });
    }
  }
  return befunde;
}

/**
 * Gesamt-Personenmonate ohne Doppelzählung: Unter-APs zählen, Ober-APs nur, wenn sie
 * KEINE (nummern-verwandten) Unter-APs haben. Reine Funktion — geteilt von der
 * Kennzahlen-Karte (`ZeitplanTab`) und dem Zahlen-Quervergleich (Paket 4).
 */
export function summePm(zeilen: ApZeile[]): number {
  const hatKinder = (z: ApZeile): boolean =>
    !z.istUnterAp && zeilen.some(k => k.istUnterAp && k.nummer.trim().startsWith(z.nummer.trim() + '.'));
  return zeilen.reduce((sum, z) => (z.istUnterAp || !hatKinder(z) ? sum + (z.pm ?? 0) : sum), 0);
}
