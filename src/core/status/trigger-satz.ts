/**
 * Die **Satzform** einer Trigger-Zeile: aus geparsten Parametern wird der
 * deutsche Satz, den die Status-Erklärung und der Vorgangs-Navigator anzeigen.
 *
 * Getrennt vom Parsen (`trigger-parser.ts`), weil es zwei Verantwortungen sind:
 * dort Rohzeile → `TriggerParam`, hier `TriggerParam` → Text. Die Richtung ist
 * einseitig — der Parser importiert von hier, nie umgekehrt.
 *
 * **Der Satz entsteht als Segment-Liste, nicht als String.** Die Anzeige will
 * wissen, welches Zeichen im Satz ein Kürzel (`ABB`) und welches ein Statuscode
 * (`59`) ist, um beides erklären zu können. Aus dem fertigen Satz ist das nicht
 * mehr herauszulesen: `Setze TV-Status (211) auf 74.` trägt die Bezugsdatei-
 * Nummer und den Statuscode nebeneinander, der Textbaustein-Klartext bringt
 * beliebige Prosa mitten in den Satz, und eine nicht interpretierte Zeile trägt
 * ihren Rohparameter. Ein Muster über den fertigen Text müsste all das raten.
 *
 * `triggerSatz` ist deshalb nur noch die Verkettung von `triggerSegmente` — es
 * gibt genau eine Stelle, an der die Grammatik entsteht.
 *
 * Rein und deterministisch: keine IO, keine Uhr.
 */
import { normKey } from './normalisierung';
import { MAIL_ROLLE, ROLLE_LABEL } from './rollen';
import type { TextbausteinEintrag, TriggerParam, TriggerZeile } from './typen';

/**
 * Ein Stück Trigger-Satz. `text` ist immer das, was dasteht — die Verkettung
 * aller `text` ergibt den Satz, Zeichen für Zeichen.
 *
 * Die nicht-`text`-Arten sagen nur, WAS dort steht; was es BEDEUTET, schlägt
 * `trigger-erklaerung.ts` gegen die Katalog-Fassung nach. Dieses Modul kennt
 * keinen Katalog (es läuft beim Datei-Heilen, lange bevor eine Fassung geladen
 * ist).
 */
export type TriggerSegment =
  | { art: 'text'; text: string }
  /** Kürzel des Fachsystems in Originalschreibweise (`ABB`, `ÄT`, `XAAE`). */
  | { art: 'kuerzel'; text: string; code: string; herkunft: KuerzelHerkunft }
  /** Amtlicher Statuscode (`59`, `31`, `74`). */
  | { art: 'status'; text: string; code: number }
  /** Bezugsdatei-Nummer aus C16 (`210`/`211`) — NICHT der Statuscode. */
  | { art: 'ebene'; text: string; nummer: string }
  /** Mail-Empfänger (`TIB`, `BIB`) — Zuständigkeitsspalte, kein Vorgangskürzel. */
  | { art: 'empfaenger'; text: string; token: string };

/**
 * Woher ein Kürzel im Satz stammt — entscheidet, wie ehrlich die Erklärung sein
 * darf, wenn der Katalog es nicht führt.
 *
 * `bedingung`/`folge` stehen an gedeuteten Positionen: dort ist „steht nicht im
 * Katalog" eine Aussage. `weiteres` stammt aus den Argumenten, deren Bedeutung
 * die Legacy-Doku nicht abdeckt — dort weiß die App nicht einmal sicher, dass es
 * ein Kürzel IST, und schweigt deshalb.
 */
export type KuerzelHerkunft = 'bedingung' | 'folge' | 'weiteres';

const t = (text: string): TriggerSegment => ({ art: 'text', text });
const kuerzelSeg = (code: string, herkunft: KuerzelHerkunft): TriggerSegment =>
  ({ art: 'kuerzel', text: code, code, herkunft });
const statusSeg = (code: number): TriggerSegment =>
  ({ art: 'status', text: String(code), code });
const ebeneSeg = (nummer: string): TriggerSegment =>
  ({ art: 'ebene', text: nummer, nummer });

/** Gruppen mit einem Trenner verketten — das Segment-Pendant zu `join`. */
function verbinde(gruppen: readonly TriggerSegment[][], trenner: string): TriggerSegment[] {
  return gruppen.flatMap((g, i) => (i === 0 ? g : [t(trenner), ...g]));
}

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

/**
 * Die „Bezugsdatei"-Nummern aus C16. 210 steht an Verbund-Codes (`XAAE`),
 * 211 an Teilvorhaben-Codes — die Zuarbeit belegt beides mit je einem Beispiel
 * (`AAE/3` mit `XAAE|210|0`, `ABA/1` mit `211|74` und der Lesart „TV-Status").
 * Die Zuordnung ist damit **erschlossen, nicht belegt** — sie steht auf der
 * Verifikationsliste. Unbekannte Nummern werden roh beschriftet statt geraten.
 */
const EBENEN_KURZ: ReadonlyMap<string, 'VB' | 'TV'> = new Map([
  ['210', 'VB'],
  ['211', 'TV'],
]);

/**
 * Unsere Lesart einer Bezugsdatei-Nummer; `null` = unbekannte Nummer.
 *
 * Die eine Stelle, an der diese Zuordnung steht. Der Parameter-Import stellt die
 * `zuordnung`-Zeilen der Zuarbeit daneben, statt eine zweite Tabelle anzulegen —
 * so wird aus „erschlossen" beim ersten echten Import „belegt" oder „widerlegt".
 */
export function ebeneVonNummer(roh: string): 'VB' | 'TV' | null {
  return EBENEN_KURZ.get(roh.trim()) ?? null;
}

/** „TV-Ebene 211" bzw. „Ebene 999" — die Nummer bleibt immer sichtbar. */
function ebenePhrase(roh: string): TriggerSegment[] {
  const nummer = roh.trim();
  const kurz = EBENEN_KURZ.get(nummer);
  return [t(kurz ? `${kurz}-Ebene ` : 'Ebene '), ebeneSeg(nummer)];
}

/** „TV-Status (211)" bzw. „Status (Ebene 999)". */
function statusEbenePhrase(roh: string): TriggerSegment[] {
  const nummer = roh.trim();
  const kurz = EBENEN_KURZ.get(nummer);
  return kurz
    ? [t(`${kurz}-Status (`), ebeneSeg(nummer), t(')')]
    : [t('Status (Ebene '), ebeneSeg(nummer), t(')')];
}

/**
 * Die Aufzählungsform einer UND-Liste, mit dem passenden Bindewort davor:
 * `kein ABB` bzw. `keines von ABB, AB, AK4` (am TV), `YIRR` bzw. `eines von …`
 * (am Verbund, wo die Verneinung schon im Satzanfang steckt).
 */
function listePhrase(kuerzel: readonly string[], stelle: 'tv' | 'verbund'): TriggerSegment[] {
  const einzeln = kuerzel.map(k => [kuerzelSeg(k, 'bedingung')]);
  if (kuerzel.length === 1) {
    return stelle === 'tv' ? [t('kein '), ...einzeln[0]!] : einzeln[0]!;
  }
  return [t(stelle === 'tv' ? 'keines von ' : 'eines von '), ...verbinde(einzeln, ', ')];
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

/**
 * Trägt die Zeile Bedingungen, aber keinen Zielstatus? Dann ist sie eine
 * **Zulässigkeitsprüfung**: sie sagt, unter welchen Umständen das Kürzel gesetzt
 * werden darf, und lässt den Status, wie er ist.
 */
export function istZulaessigkeit(p: TriggerParam): boolean {
  if (p.art !== 'statusTvVb') return false;
  if (p.statusTv !== null || p.statusVb !== null) return false;
  return p.status !== null
    || p.ohneTvKuerzel.length > 0
    || p.ohneVerbundKuerzel.length > 0
    || p.weitere.length > 0;
}

function satzStatusTvVb(p: Extract<TriggerParam, { art: 'statusTvVb' }>): TriggerSegment[] {
  const bedingungen: TriggerSegment[][] = [];
  if (p.status) {
    const wort = p.status.op === '<' ? 'vor' : p.status.op === '>' ? 'nach' : 'ist';
    bedingungen.push([t(`VB-Status ${wort} `), statusSeg(p.status.code)]);
  }
  if (p.ohneTvKuerzel.length > 0) {
    bedingungen.push([t('TV hat '), ...listePhrase(p.ohneTvKuerzel, 'tv')]);
  }
  if (p.ohneVerbundKuerzel.length > 0) {
    bedingungen.push([
      t('kein TV des Verbunds hat '), ...listePhrase(p.ohneVerbundKuerzel, 'verbund'),
    ]);
  }
  for (const w of p.weitere) {
    bedingungen.push([t('weiteres Argument „'), kuerzelSeg(w, 'weiteres'), t('"')]);
  }

  // Zulässigkeitsprüfung: Bedingungen ja, Statuswechsel nein. Der Satz muss das
  // sagen — „setze " mit leerer Wirkung wäre eine Lüge mit Grammatikfehler.
  if (istZulaessigkeit(p)) {
    return [
      t('Kürzel nur zulässig, wenn '), ...verbinde(bedingungen, ', '),
      t('; Status bleibt unverändert.'),
    ];
  }

  const wirkung: TriggerSegment[][] = [];
  if (p.statusTv !== null) wirkung.push([t('TV-Status '), statusSeg(p.statusTv)]);
  if (p.statusVb !== null) wirkung.push([t('VB-Status '), statusSeg(p.statusVb)]);
  // Die Groß-Schreibung am Satzanfang steckt im Literal, nicht in einem
  // `toUpperCase()` auf dem fertigen Satz — segmentweise gäbe es dafür keine
  // verlässliche erste Stelle.
  const setze = (gross: boolean): TriggerSegment[] =>
    [t(gross ? 'Setze ' : 'setze '), ...verbinde(wirkung, ' und ')];

  return bedingungen.length > 0
    ? [t('Wenn '), ...verbinde(bedingungen, ', '), t(' → '), ...setze(false), t('.')]
    : [...setze(true), t('.')];
}

/**
 * Empfänger mit Rolle beschriften, wo wir sie kennen: `TIB` → `TIB (FB)`.
 *
 * Adressen und Platzhalter (`#TB1`) bleiben unangetastet — eine erfundene Rolle
 * wäre schlimmer als keine, und ohne bekannte Rolle bleibt das Token blanker
 * Text (nichts zu erklären, also keine Erklär-Geste).
 */
function empfaengerPhrase(roh: string): TriggerSegment[] {
  const rolle = MAIL_ROLLE[normKey(roh)];
  return rolle
    ? [{ art: 'empfaenger', text: roh, token: roh }, t(` (${ROLLE_LABEL[rolle]})`)]
    : [t(roh)];
}

/**
 * Die deutsche Satzform eines geparsten Triggers, in ihre erklärbaren Stücke
 * zerlegt. **Die eine Stelle, an der die Grammatik entsteht.**
 *
 * @param legende Optionale Textbaustein-Legende. Fehlt sie, steht nur die
 *   Kennung da — dieselbe Ausgabe wie beim Import, damit gespeicherter und
 *   gerenderter Satz nie ohne Grund auseinanderlaufen. Der aufgelöste Klartext
 *   bleibt EIN Text-Segment: es ist Fremdprosa, in der nichts zu deuten ist.
 */
export function triggerSegmente(
  p: TriggerParam, legende?: TextbausteinLegende,
): TriggerSegment[] {
  switch (p.art) {
    case 'statusTvVb':
      return satzStatusTvVb(p);
    case 'vorgEintragNeu':
      return [
        t('Vorgangseintrag '), kuerzelSeg(p.code, 'folge'), t(' anlegen ('),
        ...ebenePhrase(p.ebene),
        t(`, ${p.tage >= 0 ? '+' : ''}${p.tage} Tage).`),
      ];
    case 'vorgEintragMail': {
      const klartext = legende?.get(normKey(p.textbaustein));
      const baustein = klartext
        ? `${textbausteinName(p.textbaustein)} — ${klartext}`
        : textbausteinName(p.textbaustein);
      return [
        t('Mail an '), ...empfaengerPhrase(p.empfaenger),
        t(`, Textbaustein ${baustein}`),
        ...(p.cc ? [t(', CC '), ...empfaengerPhrase(p.cc)] : []),
        t('.'),
      ];
    }
    case 'statusSetzen':
      return [
        t('Setze '), ...statusEbenePhrase(p.ebene), t(' auf '), statusSeg(p.status), t('.'),
      ];
  }
}

/** Die Textform: nichts als die Verkettung der Segmente. */
export function triggerSatz(p: TriggerParam, legende?: TextbausteinLegende): string {
  return alsText(triggerSegmente(p, legende));
}

/** Segmente → Satz. Die einzige erlaubte Richtung. */
export function alsText(segmente: readonly TriggerSegment[]): string {
  return segmente.map(s => s.text).join('');
}

/**
 * Die anzuzeigenden Segmente einer Zeile. Die eine Stelle, die alle Anzeigen
 * benutzen — sonst zeigte die Liste die Kennung und das Popover den Klartext.
 *
 * **Ohne Legende wird trotzdem neu gebaut**, anders als bis v2.398: die Legende
 * kommt erst mit dem Parameter-Blatt, das die meisten Installationen gar nicht
 * importiert haben. Ein `&& legende` wie in der alten `triggerSatzVon` machte
 * dort JEDE Zeile zu einem einzigen Text-Segment — also nirgends eine Erklärung,
 * genau wo sie am meisten fehlt.
 *
 * Der Selbstabgleich hält die alte Zusage dennoch: weicht die Verkettung ohne
 * Legende vom gespeicherten Satz ab (Sidecar aus einer Fassung mit anderer
 * Grammatik), gilt der GESPEICHERTE — als ein Segment, ohne Erklärungen. Lieber
 * keine Deutung als eine, die zum angezeigten Satz nicht passt.
 */
export function triggerSegmenteVon(
  zeile: TriggerZeile, legende?: TextbausteinLegende,
): TriggerSegment[] {
  if (!zeile.geparst) return [t(zeile.satz)];
  const segmente = triggerSegmente(zeile.geparst, legende);
  if (!legende && alsText(segmente) !== zeile.satz) return [t(zeile.satz)];
  return segmente;
}

/**
 * Der anzuzeigende Satz einer Zeile. Verkettung der Segmente — es gibt keinen
 * zweiten Weg zum Text, also kann er von der Anzeige nicht abweichen.
 */
export function triggerSatzVon(zeile: TriggerZeile, legende?: TextbausteinLegende): string {
  return alsText(triggerSegmenteVon(zeile, legende));
}
