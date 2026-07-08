/**
 * Gliederungs-Parser für die Antrag-Aufbereitung (Paket 1, rein deterministisch).
 *
 * Zerlegt das VB-Markdown in im Original verankerte Sektionen mit Zeichen-Spans
 * (Fundstellen-Anker). BEWUSST getrennt von `parseVbHeadings`
 * (`gutachten/relevanz-map.ts`): jener nimmt NUR H2/H3 und vergibt positionale
 * IDs (`h0`, `h-intro`) — an denen die Relevanz-Map-Caches hängen; ihn zu ändern
 * würde diese Caches brechen. Dieser Parser braucht dagegen H1 (Kapitel ohne
 * H2-Kinder dürfen nicht im Vorgänger verschwinden), Nummerierungs-Inferenz für
 * als Fließtext angekommene Überschriften (Word-Custom-Styles gehen bei der
 * Konvertierung verloren) und stabile nummern-basierte IDs.
 *
 * Reine Funktion, keine IO — testbar via vitest ohne DOM.
 */

/** Eine erkannte VB-Sektion: stabile ID + Überschrift + Zeichen-Span im Markdown. */
export interface VbSektion {
  /**
   * Stabil bei unverändertem Dokument:
   *  - `k-<nummer>` bei erkannter Nummerierung (z.B. `k-3.1`),
   *  - sonst `s<laufindex>` (0-basiert über alle Marker),
   *  - Vorspann vor dem ersten Marker: `s-intro`,
   *  - Inhaltsverzeichnis: `s-toc`.
   */
  id: string;
  /** Kapitelnummer (`'3.1'`), falls erkannt. */
  nummer?: string;
  titel: string;
  ebene: 1 | 2 | 3;
  /** Span `[start … end)` im übergebenen Markdown (Zeilenanfang bis nächster Marker / EOF). */
  start: number;
  end: number;
  quelle: 'heading' | 'nummerierung';
}

interface Zeile {
  /** Zeileninhalt OHNE ein evtl. anhängendes `\r` (für Matching). */
  text: string;
  /** Zeichen-Offset des Zeilenanfangs im Original-Markdown. */
  start: number;
}

interface Marker {
  start: number;
  titel: string;
  ebene: 1 | 2 | 3;
  nummer?: string;
  quelle: 'heading' | 'nummerierung';
  /** true → dieser Marker ist der IHV-Anker (`s-toc`). */
  toc?: boolean;
}

const HEADING_RE = /^(#{1,3})\s+(.+?)\s*$/;
/** Führende Kapitelnummer `3` / `3.1` / `3.1.2` gefolgt von Titeltext. */
const NUMMER_RE = /^(\d+(?:\.\d+){0,2})\s+(\S.*)$/;
const TOC_ANCHOR_RE = /^#{0,3}\s*inhalt(sverzeichnis)?\s*:?\s*$/i;
/** Zeile endet auf eine (Seiten-)Zahl nach Whitespace/Punktleader — typische IHV-Zeile. */
const TOC_LINE_RE = /\S.*(?:\.{2,}|\s|\t)\s*\d{1,3}\s*$/;

/** In Zeilen mit Offset zerlegen (offset-treu, auch bei `\r\n`). */
function toZeilen(md: string): Zeile[] {
  const out: Zeile[] = [];
  let offset = 0;
  for (const raw of md.split('\n')) {
    out.push({ text: raw.replace(/\r$/, ''), start: offset });
    offset += raw.length + 1; // + '\n'
  }
  return out;
}

/** Nummern-Pfad `'3.1'` → `[3, 1]`. */
function nummerPfad(nummer: string): number[] {
  return nummer.split('.').map(n => parseInt(n, 10));
}

/**
 * Plausibilitäts-Prüfung für Nummerierungs-Inferenz gegen die bislang akzeptierte
 * Sequenz `seq` (numerischer Pfad der zuletzt akzeptierten Nummer). Setzt die
 * Zeile eine plausible Fortsetzung? Kapitel monoton +1; `3.1` nur im Kapitel `3`;
 * `3.1.2` nur nach `3.1`. Ohne Sequenz (Doc-Start) muss die erste Kapitelnummer
 * `1` sein — so wird `25 Prozent Einsparung …` verlässlich verworfen.
 */
function istPlausibleFortsetzung(pfad: number[], seq: number[]): boolean {
  if (pfad.length === 1) {
    const letztesTop = seq[0] ?? 0;
    return pfad[0] === letztesTop + 1;
  }
  if (pfad.length === 2) {
    if (pfad[0] !== seq[0]) return false;
    const letztesSub = seq.length >= 2 ? seq[1]! : 0;
    return pfad[1] === letztesSub + 1;
  }
  // pfad.length === 3
  if (pfad[0] !== seq[0] || pfad[1] !== seq[1]) return false;
  const letztesSubSub = seq.length >= 3 ? seq[2]! : 0;
  return pfad[2] === letztesSubSub + 1;
}

/**
 * Findet einen Inhaltsverzeichnis-Block: Anker-Zeile (`Inhalt` /
 * `Inhaltsverzeichnis`) gefolgt von gehäuften Seitenzahl-Zeilen. Gibt den
 * Zeilen-Indexbereich `[anker … letzteTocZeile]` zurück (inklusive) oder null.
 * Toleriert kurze Lücken (Leerzeilen) innerhalb des Blocks.
 */
function findeIhvBlock(zeilen: Zeile[]): { von: number; bis: number } | null {
  const ankerIdx = zeilen.findIndex(z => TOC_ANCHOR_RE.test(z.text));
  if (ankerIdx < 0) return null;
  let bis = ankerIdx;
  let luecke = 0;
  let tocTreffer = 0;
  for (let i = ankerIdx + 1; i < zeilen.length; i++) {
    const t = zeilen[i]!.text.trim();
    if (t === '') { luecke++; if (luecke > 2) break; continue; }
    if (TOC_LINE_RE.test(t)) { bis = i; tocTreffer++; luecke = 0; continue; }
    // Nicht-IHV-Inhaltszeile → Block endet.
    break;
  }
  // Nur als IHV werten, wenn wirklich mehrere Seitenzahl-Zeilen folgen (sonst
  // ist „Inhalt" vielleicht eine echte Kapitelüberschrift).
  return tocTreffer >= 2 ? { von: ankerIdx, bis } : null;
}

/**
 * Parst die Gliederung: Markdown-Headings H1–H3 als Primärmarker, plus
 * Nummerierungs-Inferenz für Fließtext-Überschriften, IHV ausgeschlossen.
 * Degradiert nie zu leerem Ergebnis bei nicht-leerem Text.
 */
export function parseVbGliederung(md: string): VbSektion[] {
  if (!md.trim()) return [];

  const zeilen = toZeilen(md);
  const ihv = findeIhvBlock(zeilen);
  const imIhv = (i: number): boolean => ihv !== null && i > ihv.von && i <= ihv.bis;

  const marker: Marker[] = [];
  const seq: number[] = []; // zuletzt akzeptierter Nummern-Pfad (für die Inferenz)

  for (let i = 0; i < zeilen.length; i++) {
    const z = zeilen[i]!;

    // IHV-Anker → eine einzige `s-toc`-Sektion; die Block-Zeilen werden
    // (via `imIhv`) von der Marker-Erkennung ausgeschlossen.
    if (ihv && i === ihv.von) {
      marker.push({ start: z.start, titel: 'Inhaltsverzeichnis', ebene: 1, quelle: 'heading', toc: true });
      continue;
    }
    if (imIhv(i)) continue;

    // 1) Markdown-Heading H1–H3.
    const hm = HEADING_RE.exec(z.text);
    if (hm) {
      const ebene = hm[1]!.length as 1 | 2 | 3;
      const titelRoh = hm[2]!.trim();
      const nm = NUMMER_RE.exec(titelRoh);
      const nummer = nm ? nm[1] : undefined;
      const titel = nm ? nm[2]!.trim() : titelRoh;
      if (nummer) { const p = nummerPfad(nummer); seq.length = 0; seq.push(...p); }
      marker.push({ start: z.start, titel, ebene, nummer, quelle: 'heading' });
      continue;
    }

    // 2) Nummerierungs-Inferenz für Fließtext-Überschriften.
    const nm = NUMMER_RE.exec(z.text);
    if (!nm) continue;
    const zeileText = z.text.trim();
    if (zeileText.length >= 120) continue;      // zu lang für eine Überschrift
    if (/\.$/.test(zeileText)) continue;        // endet auf Satzpunkt → Fließtext
    const pfad = nummerPfad(nm[1]!);
    if (pfad.length > 3) continue;
    if (!istPlausibleFortsetzung(pfad, seq)) continue;
    seq.length = 0; seq.push(...pfad);
    marker.push({
      start: z.start, titel: nm[2]!.trim(), ebene: pfad.length as 1 | 2 | 3,
      nummer: nm[1], quelle: 'nummerierung',
    });
  }

  // Degradation: kein einziger Marker → ganzes Dokument als eine Sektion.
  if (marker.length === 0) {
    return [{ id: 's-intro', titel: '(Gesamtdokument)', ebene: 1, start: 0, end: md.length, quelle: 'heading' }];
  }

  marker.sort((a, b) => a.start - b.start);

  const sektionen: VbSektion[] = [];
  const vergebeneIds = new Set<string>();
  const eindeutig = (basis: string): string => {
    if (!vergebeneIds.has(basis)) { vergebeneIds.add(basis); return basis; }
    let n = 2;
    while (vergebeneIds.has(`${basis}-${n}`)) n++;
    const id = `${basis}-${n}`;
    vergebeneIds.add(id);
    return id;
  };

  // Vorspann vor dem ersten Marker.
  const ersterStart = marker[0]!.start;
  if (md.slice(0, ersterStart).trim()) {
    vergebeneIds.add('s-intro');
    sektionen.push({ id: 's-intro', titel: '(Einleitung)', ebene: 1, start: 0, end: ersterStart, quelle: 'heading' });
  }

  for (let i = 0; i < marker.length; i++) {
    const m = marker[i]!;
    const end = i + 1 < marker.length ? marker[i + 1]!.start : md.length;
    const id = m.toc ? eindeutig('s-toc') : m.nummer ? eindeutig(`k-${m.nummer}`) : eindeutig(`s${i}`);
    sektionen.push({
      id, nummer: m.nummer, titel: m.titel, ebene: m.ebene, start: m.start, end, quelle: m.quelle,
    });
  }

  return sektionen;
}
