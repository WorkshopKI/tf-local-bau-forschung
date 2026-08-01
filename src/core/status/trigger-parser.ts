/**
 * Der Trigger-Parser: was ein gesetztes Kürzel im Fachsystem auslöst.
 *
 * Das Legacy hängt an jedes Kürzel eine Folge von Prozeduren mit Pipe-getrennten
 * Parametern. Vier Prozeduren kommen vor:
 *
 * | Prozedur | Parameter | Bedeutung |
 * |---|---|---|
 * | `TRG_TVs_Status_TV_VB` | `<59\|ABB\|YIRR\|\|\|\|31\|31` | bedingter Statuswechsel auf TV + VB |
 * | `TRG.VorgEintragNeu` | `XAAE\|210\|0` | Folge-Vorgangseintrag anlegen |
 * | `TRG.VorgEintragMail` | `TIB\|!.055.VorgInfo.01\|BIB` | Mail mit Textbaustein |
 * | `TRG.Status.TV.VB` | `211\|74` | Status unbedingt setzen |
 *
 * **Ehrlichkeit ist die Hauptaufgabe dieses Moduls.** Eine Zeile, die nicht in
 * das Schema passt, wird NIE stillschweigend verworfen: `geparst` bleibt `null`
 * und `satz` trägt „Nicht interpretiert: <Rohtext>". Und auch innerhalb einer
 * erkannten Zeile werden unbekannte Argumente nicht weggeworfen, sondern als
 * `weitere` mitgeführt und im Satz angehängt — die Legacy-Doku deckt die
 * mittleren Positionen von `TRG_TVs_Status_TV_VB` nicht ab, und ein Parser, der
 * so tut als wäre da nichts, belügt den Leser.
 *
 * **Toleranz bei leeren Argumenten:** die Anzahl leerer Pipes schwankt zwischen
 * Zuarbeit-Fassungen. Der Parser liest deshalb von beiden Enden her (die letzten
 * beiden Argumente sind die Zielstatus, die ersten drei die Bedingungen) statt
 * auf einer festen Länge zu bestehen.
 *
 * Rein und deterministisch: keine IO, keine Uhr.
 */
import { normKey } from './normalisierung';
import type { StatusVergleich, TriggerParam, TriggerZeile } from './typen';

/** Die vier bekannten Prozedur-Namen, normalisiert nachschlagbar. */
const PROZEDUREN: ReadonlyMap<string, TriggerParam['art']> = new Map([
  ['trg_tvs_status_tv_vb', 'statusTvVb'],
  ['trg.vorgeintragneu', 'vorgEintragNeu'],
  ['trg.vorgeintragmail', 'vorgEintragMail'],
  ['trg.status.tv.vb', 'statusSetzen'],
]);

/**
 * Die „Bezugsdatei"-Nummern des Legacy. 210 steht an Verbund-Codes (`XAAE`),
 * 211 an Teilvorhaben-Codes — die Zuarbeit belegt beides mit je einem Beispiel
 * (`AAE/3` mit `XAAE|210|0`, `ABA/1` mit `211|74` und der Lesart „TV-Status").
 * Die Zuordnung ist damit **erschlossen, nicht belegt** — sie steht auf der
 * Verifikationsliste. Unbekannte Nummern werden roh beschriftet statt geraten.
 */
const EBENEN_KURZ: ReadonlyMap<string, 'VB' | 'TV'> = new Map([
  ['210', 'VB'],
  ['211', 'TV'],
]);

/** „TV-Ebene 211" bzw. „Ebene 999" — die Nummer bleibt immer sichtbar. */
function ebenePhrase(roh: string): string {
  const t = roh.trim();
  const kurz = EBENEN_KURZ.get(t);
  return kurz ? `${kurz}-Ebene ${t}` : `Ebene ${t}`;
}

/** „TV-Status (211)" bzw. „Status (Ebene 999)". */
function statusEbenePhrase(roh: string): string {
  const t = roh.trim();
  const kurz = EBENEN_KURZ.get(t);
  return kurz ? `${kurz}-Status (${t})` : `Status (Ebene ${t})`;
}

/** `<59` → `{op:'<', code:59}`. `null`, wenn dort keine Vergleichsangabe steht. */
export function parseStatusVergleich(roh: string): StatusVergleich | null {
  const t = roh.trim();
  const m = /^([<>=])\s*(\d{1,3})$/.exec(t);
  if (!m) return null;
  return { op: m[1] as StatusVergleich['op'], code: Number(m[2]) };
}

/** Statuszahl aus einem Argument; leer oder unlesbar → `null` (= unverändert). */
function parseStatus(roh: string | undefined): number | null {
  const t = (roh ?? '').trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isInteger(n) ? n : null;
}

/** Leeres Argument → `null`, sonst getrimmt. */
function optional(roh: string | undefined): string | null {
  const t = (roh ?? '').trim();
  return t.length > 0 ? t : null;
}

/**
 * Textbaustein-Kennung lesbar machen: `!.055.VorgInfo.01` → `VorgInfo.01`.
 * Das Präfix ist die interne Dateinummer und sagt dem Leser nichts.
 */
export function textbausteinName(roh: string): string {
  const t = roh.trim();
  const m = /^!\.\d+\.(.+)$/.exec(t);
  return m ? m[1]! : t;
}

// --- Parser je Prozedur ------------------------------------------------------

function parseStatusTvVb(args: string[]): TriggerParam | null {
  // Von beiden Enden lesen: vorne die Bedingungen, hinten die Zielstatus.
  // Mit weniger als fünf Argumenten überlappen beide Enden — dann ist die Zeile
  // nicht das, wofür wir sie halten, und wird lieber gar nicht gedeutet.
  if (args.length < 5) return null;
  const statusVb = parseStatus(args[args.length - 1]);
  const statusTv = parseStatus(args[args.length - 2]);
  if (statusTv === null && statusVb === null) return null;
  return {
    art: 'statusTvVb',
    status: parseStatusVergleich(args[0] ?? ''),
    ohneTvKuerzel: optional(args[1]),
    ohneVerbundKuerzel: optional(args[2]),
    weitere: args.slice(3, args.length - 2).map(a => a.trim()).filter(a => a.length > 0),
    statusTv,
    statusVb,
  };
}

function parseVorgEintragNeu(args: string[]): TriggerParam | null {
  const code = optional(args[0]);
  const ebene = optional(args[1]);
  if (!code || !ebene) return null;
  const tage = Number((args[2] ?? '0').trim() || '0');
  if (!Number.isFinite(tage)) return null;
  return { art: 'vorgEintragNeu', code, ebene, tage };
}

function parseVorgEintragMail(args: string[]): TriggerParam | null {
  const empfaenger = optional(args[0]);
  const textbaustein = optional(args[1]);
  if (!empfaenger || !textbaustein) return null;
  return { art: 'vorgEintragMail', empfaenger, textbaustein, cc: optional(args[2]) };
}

function parseStatusSetzen(args: string[]): TriggerParam | null {
  const ebene = optional(args[0]);
  const status = parseStatus(args[1]);
  if (!ebene || status === null) return null;
  return { art: 'statusSetzen', ebene, status };
}

// --- Satzform ----------------------------------------------------------------

function satzStatusTvVb(p: Extract<TriggerParam, { art: 'statusTvVb' }>): string {
  const bedingungen: string[] = [];
  if (p.status) {
    const wort = p.status.op === '<' ? 'vor' : p.status.op === '>' ? 'nach' : 'ist';
    bedingungen.push(`VB-Status ${wort} ${p.status.code}`);
  }
  if (p.ohneTvKuerzel) bedingungen.push(`TV hat kein ${p.ohneTvKuerzel}`);
  if (p.ohneVerbundKuerzel) {
    bedingungen.push(`kein TV des Verbunds hat ${p.ohneVerbundKuerzel}`);
  }
  for (const w of p.weitere) bedingungen.push(`weiteres Argument „${w}"`);

  const wirkung: string[] = [];
  if (p.statusTv !== null) wirkung.push(`TV-Status ${p.statusTv}`);
  if (p.statusVb !== null) wirkung.push(`VB-Status ${p.statusVb}`);
  const setze = `setze ${wirkung.join(' und ')}`;

  return bedingungen.length > 0
    ? `Wenn ${bedingungen.join(', ')} → ${setze}.`
    : `${setze[0]!.toUpperCase()}${setze.slice(1)}.`;
}

/** Die deutsche Satzform eines geparsten Triggers. */
export function triggerSatz(p: TriggerParam): string {
  switch (p.art) {
    case 'statusTvVb':
      return satzStatusTvVb(p);
    case 'vorgEintragNeu':
      return `Vorgangseintrag ${p.code} anlegen (${ebenePhrase(p.ebene)}, ${p.tage >= 0 ? '+' : ''}${p.tage} Tage).`;
    case 'vorgEintragMail': {
      const cc = p.cc ? `, CC ${p.cc}` : '';
      return `Mail an ${p.empfaenger}, Textbaustein ${textbausteinName(p.textbaustein)}${cc}.`;
    }
    case 'statusSetzen':
      return `Setze ${statusEbenePhrase(p.ebene)} auf ${p.status}.`;
  }
}

// --- Einstieg ----------------------------------------------------------------

/** Rohzeile, wie sie aus der XLSX kommt. */
export interface TriggerRohzeile {
  kuerzel: string;
  folge: string | number;
  prozedur: string;
  parameter: string;
  richtlinie?: string;
}

/**
 * Parst eine Rohzeile. Liefert IMMER eine `TriggerZeile` — auch für Zeilen, die
 * der Parser nicht deuten kann. Verworfen wird nichts.
 */
export function parseTriggerZeile(roh: TriggerRohzeile): TriggerZeile {
  const kuerzel = roh.kuerzel.normalize('NFC').trim();
  const folgeZahl = Number(String(roh.folge).trim());
  const parameterRoh = roh.parameter.trim();
  const basis = {
    kuerzel,
    folge: Number.isInteger(folgeZahl) ? folgeZahl : 0,
    prozedur: roh.prozedur.trim(),
    parameterRoh,
    ...(roh.richtlinie?.trim() ? { richtlinie: roh.richtlinie.trim() } : {}),
  };

  const art = PROZEDUREN.get(normKey(roh.prozedur));
  const nichtInterpretiert = (): TriggerZeile => ({
    ...basis,
    geparst: null,
    satz: `Nicht interpretiert: ${parameterRoh || '(keine Parameter)'}`,
  });
  if (!art) return nichtInterpretiert();

  // Ein einzelnes leeres Argument ist etwas anderes als „keine Argumente" —
  // deshalb wird der Rohtext auch dann gesplittet, wenn er leer aussieht.
  const args = parameterRoh.length > 0 ? parameterRoh.split('|') : [];
  const geparst =
    art === 'statusTvVb' ? parseStatusTvVb(args)
      : art === 'vorgEintragNeu' ? parseVorgEintragNeu(args)
        : art === 'vorgEintragMail' ? parseVorgEintragMail(args)
          : parseStatusSetzen(args);

  if (!geparst) return nichtInterpretiert();
  return { ...basis, geparst, satz: triggerSatz(geparst) };
}

/** Parst eine ganze Tabelle; Reihenfolge bleibt erhalten. */
export function parseTriggerTabelle(zeilen: readonly TriggerRohzeile[]): TriggerZeile[] {
  return zeilen.map(parseTriggerZeile);
}

/**
 * Alle Kürzel, die eine Trigger-Zeile referenziert — für die Import-Validierung
 * gegen den Kürzel-Katalog. Neben dem eigenen Kürzel sind das die
 * Negativ-Bedingungen (`ABB`, `YIRR`) und der Code eines Folge-Eintrags.
 *
 * Bewusst OHNE die Mail-Empfänger: `TIB`/`BIB`/`PFM` sind Zuständigkeits-Spalten
 * und Mailadressen, keine Vorgangskürzel — sie im Katalog zu suchen erzeugte nur
 * Falschmeldungen.
 */
export function referenzierteKuerzel(zeile: TriggerZeile): string[] {
  const out: string[] = [];
  const add = (k: string | null | undefined): void => {
    const t = (k ?? '').trim();
    if (t && !out.includes(t)) out.push(t);
  };
  add(zeile.kuerzel);
  const p = zeile.geparst;
  if (p?.art === 'statusTvVb') {
    add(p.ohneTvKuerzel);
    add(p.ohneVerbundKuerzel);
  }
  if (p?.art === 'vorgEintragNeu') add(p.code);
  return out;
}
