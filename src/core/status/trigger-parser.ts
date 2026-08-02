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
 * **Die Argumente von `TRG_TVs_Status_TV_VB` stehen an acht festen Positionen**
 * und werden von VORN gelesen; fehlende Schluss-Pipes heißen „Argument fehlt".
 * Bis v2.379 las der Parser von beiden Enden her, weil die Pipe-Anzahl aus einem
 * Screenshot geschätzt war. Die echte Datei entscheidet die Frage: `<59|ABB|||||40`
 * hat sieben Argumente und bedeutet „TV-Status 40, VB-Status unverändert" — von
 * hinten gelesen käme das Gegenteil heraus. Alle 14 Fixture-Zeilen der Seed-Doku
 * ergeben unter beiden Lesarten denselben Satz; nur die Kurz- und Langformen
 * unterscheiden sich, und dort hat die Datei recht.
 *
 * **Kommas trennen UND-Listen** (Legacy-Doku, Blatt „Erklärung Prozedur"): in den
 * Argumenten 2–6 steht `ABB,AB,AK4` für „hat kein ABB und kein AB und kein AK4".
 * Ungesplittet suchte die App ein Kürzel dieses Namens und fände nie eines.
 *
 * Rein und deterministisch: keine IO, keine Uhr.
 */
import { normKey } from './normalisierung';
import { MAIL_ROLLE, ROLLE_LABEL } from './rollen';
import type { StatusVergleich, TextbausteinEintrag, TriggerParam, TriggerZeile } from './typen';

/**
 * Textbaustein-Kennung → Klartext, für die Anzeige. Schlüssel ist `normKey` der
 * Kennung. Wird in `triggerSatz` nur ERGÄNZEND gelesen: ohne Legende bleibt der
 * Satz genau der, der auch gespeichert ist.
 */
export type TextbausteinLegende = ReadonlyMap<string, string>;

/**
 * Legende aus den gepflegten Einträgen einer Fassung bauen. Leere Liste ⇒
 * `undefined`, damit die Aufrufer den Fall „keine Legende" nicht selbst prüfen
 * müssen und der gespeicherte Satz unverändert durchgereicht wird.
 */
export function baueLegende(
  eintraege: readonly TextbausteinEintrag[] | undefined,
): TextbausteinLegende | undefined {
  if (!eintraege || eintraege.length === 0) return undefined;
  const map = new Map<string, string>();
  for (const e of eintraege) {
    const k = normKey(e.kennung);
    if (k && !map.has(k)) map.set(k, e.text);
  }
  return map.size > 0 ? map : undefined;
}

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
 * Ein Bedingungs-Argument in seine Kürzel zerlegen: `ABB,AB,AK4` → drei Einträge.
 *
 * Die Schreibweise bleibt, wie sie in der Datei steht — kleingeschrieben wird nur
 * für Joins (`normKey`), nie für die Anzeige. Doppelte Nennungen fallen weg,
 * damit derselbe Grund nicht zweimal im Satz steht.
 */
export function kuerzelListe(roh: string | undefined): string[] {
  const out: string[] = [];
  for (const teil of (roh ?? '').split(',')) {
    const t = teil.trim();
    if (t.length > 0 && !out.some(v => normKey(v) === normKey(t))) out.push(t);
  }
  return out;
}

/**
 * Die Aufzählungsform einer UND-Liste, mit dem passenden Bindewort davor:
 * `kein ABB` bzw. `keines von ABB, AB, AK4` (am TV), `YIRR` bzw. `eines von …`
 * (am Verbund, wo die Verneinung schon im Satzanfang steckt).
 */
function listePhrase(kuerzel: readonly string[], stelle: 'tv' | 'verbund'): string {
  if (kuerzel.length === 1) return stelle === 'tv' ? `kein ${kuerzel[0]}` : kuerzel[0]!;
  return `${stelle === 'tv' ? 'keines' : 'eines'} von ${kuerzel.join(', ')}`;
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

/**
 * Die acht Positionen von `TRG_TVs_Status_TV_VB`, von vorn gezählt:
 * 0 Status-Vergleich · 1 ohne-TV-Kürzel · 2 ohne-Verbund-Kürzel ·
 * 3–5 weitere Bedingungen · 6 neuer TV-Status · 7 neuer VB-Status.
 */
const POS_STATUS_TV = 6;
const POS_STATUS_VB = 7;

function parseStatusTvVb(args: string[]): TriggerParam | null {
  // Feste Positionen, von vorn. Fehlende Schluss-Argumente sind fehlende
  // Argumente (= unverändert), überzählige wandern sichtbar nach `weitere`.
  const statusTv = parseStatus(args[POS_STATUS_TV]);
  const statusVb = parseStatus(args[POS_STATUS_VB]);
  // Eine Zeile dieser Prozedur, die keinen der beiden Status setzt, tut nichts —
  // dann halten wir sie für etwas anderes und deuten sie lieber gar nicht.
  if (statusTv === null && statusVb === null) return null;
  return {
    art: 'statusTvVb',
    status: parseStatusVergleich(args[0] ?? ''),
    ohneTvKuerzel: kuerzelListe(args[1]),
    ohneVerbundKuerzel: kuerzelListe(args[2]),
    weitere: [...args.slice(3, POS_STATUS_TV), ...args.slice(POS_STATUS_VB + 1)]
      .flatMap(a => kuerzelListe(a)),
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
  if (p.ohneTvKuerzel.length > 0) {
    bedingungen.push(`TV hat ${listePhrase(p.ohneTvKuerzel, 'tv')}`);
  }
  if (p.ohneVerbundKuerzel.length > 0) {
    bedingungen.push(`kein TV des Verbunds hat ${listePhrase(p.ohneVerbundKuerzel, 'verbund')}`);
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

/**
 * Empfänger mit Rolle beschriften, wo wir sie kennen: `TIB` → `TIB (FB)`.
 *
 * Adressen und Platzhalter (`#TB1`) bleiben unangetastet — eine erfundene Rolle
 * wäre schlimmer als keine.
 */
function empfaengerPhrase(roh: string): string {
  const rolle = MAIL_ROLLE[normKey(roh)];
  return rolle ? `${roh} (${ROLLE_LABEL[rolle]})` : roh;
}

/**
 * Die deutsche Satzform eines geparsten Triggers.
 *
 * @param legende Optionale Textbaustein-Legende. Fehlt sie, steht nur die
 *   Kennung da — dieselbe Ausgabe wie beim Import, damit gespeicherter und
 *   gerenderter Satz nie ohne Grund auseinanderlaufen.
 */
export function triggerSatz(p: TriggerParam, legende?: TextbausteinLegende): string {
  switch (p.art) {
    case 'statusTvVb':
      return satzStatusTvVb(p);
    case 'vorgEintragNeu':
      return `Vorgangseintrag ${p.code} anlegen (${ebenePhrase(p.ebene)}, ${p.tage >= 0 ? '+' : ''}${p.tage} Tage).`;
    case 'vorgEintragMail': {
      const cc = p.cc ? `, CC ${empfaengerPhrase(p.cc)}` : '';
      const klartext = legende?.get(normKey(p.textbaustein));
      const baustein = klartext
        ? `${textbausteinName(p.textbaustein)} — ${klartext}`
        : textbausteinName(p.textbaustein);
      return `Mail an ${empfaengerPhrase(p.empfaenger)}, Textbaustein ${baustein}${cc}.`;
    }
    case 'statusSetzen':
      return `Setze ${statusEbenePhrase(p.ebene)} auf ${p.status}.`;
  }
}

/**
 * Der anzuzeigende Satz einer Zeile: mit Legende neu gerendert, ohne sie der
 * gespeicherte. Die eine Stelle, die alle Anzeigen benutzen — sonst zeigte die
 * Liste die Kennung und das Popover den Klartext.
 */
export function triggerSatzVon(zeile: TriggerZeile, legende?: TextbausteinLegende): string {
  return zeile.geparst && legende ? triggerSatz(zeile.geparst, legende) : zeile.satz;
}

// --- Einstieg ----------------------------------------------------------------

/** Rohzeile, wie sie aus der XLSX kommt. */
export interface TriggerRohzeile {
  /** Spalte „Richtlinie"/„Programm". Pflicht — siehe `TriggerZeile.programm`. */
  programm: string;
  kuerzel: string;
  folge: string | number;
  prozedur: string;
  parameter: string;
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
    programm: roh.programm.normalize('NFC').trim(),
    kuerzel,
    folge: Number.isInteger(folgeZahl) ? folgeZahl : 0,
    prozedur: roh.prozedur.trim(),
    parameterRoh,
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
 * Negativ-Bedingungen (`ABB`, `YIRR`), die noch nicht gedeuteten Argumente der
 * Positionen 4–6 und der Code eines Folge-Eintrags.
 *
 * Die `weitere`-Argumente sind mit drin, obwohl wir ihre BEDEUTUNG nicht kennen:
 * ihre Kürzel kennt der Katalog sehr wohl, und was danach an Unbekanntem
 * übrigbleibt, ist genau die Liste, die mit der Fachseite zu klären ist.
 *
 * Bewusst OHNE die Mail-Empfänger: `TIB`/`BIB`/`PFM` sind Zuständigkeits-Spalten
 * und Mailadressen, keine Vorgangskürzel — sie im Katalog zu suchen erzeugte nur
 * Falschmeldungen (ihre Rollen stehen in `MAIL_ROLLE`).
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
    for (const k of p.ohneTvKuerzel) add(k);
    for (const k of p.ohneVerbundKuerzel) add(k);
    for (const k of p.weitere) add(k);
  }
  if (p?.art === 'vorgEintragNeu') add(p.code);
  return out;
}
