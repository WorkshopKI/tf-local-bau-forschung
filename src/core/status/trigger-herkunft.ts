/**
 * Die Trigger-Tabelle **von der anderen Seite gelesen**: wodurch entsteht dieser
 * Status?
 *
 * Der Navigator (`navigator.ts`) und die Herleitung beantworten „warum steht
 * DIESER Antrag hier" — sie gehen vom Vorgang aus. Im Statuswert-Detail steht die
 * umgekehrte Frage: „wodurch entsteht DIESER Status", und die ist im Termin die
 * häufigere. Sie ist die belegbare Antwort auf jede Abgrenzungsfrage („wie
 * unterscheiden sich 31, 33 und 34?"): das Fachsystem liefert nur die
 * Bezeichnung, die Trigger-Tabelle sagt, welche Kürzel den Wert setzen.
 *
 * **Keine zweite Auswertung.** Satzform kommt aus `trigger-satz.ts`, Bedeutung
 * aus `trigger-erklaerung.ts` — dieselben Bausteine wie im Herleitungs-Popover,
 * damit der Nutzer den Satz wiedererkennt. Hier wird nur ausgewählt und
 * gebündelt.
 *
 * **Nach Kürzel gruppiert, Richtlinien zusammengefasst.** Dasselbe Kürzel steht
 * in bis zu neun Richtlinien mit demselben Satz; eine Zeile je Programm wäre
 * neunmal dieselbe Aussage. Wirkt es je Richtlinie verschieden, stehen die
 * Sätze getrennt da — mit den Richtlinien an jedem.
 *
 * Rein und deterministisch: keine IO, keine Uhr.
 */
import { kuerzelIndex } from './feld-zugriff';
import { normKey } from './normalisierung';
import { rollenLabel } from './rollen';
import { sonderKuerzel } from './sonderkuerzel';
import { alsText, ebeneVonNummer, triggerSegmenteVon, type TextbausteinLegende } from './trigger-satz';
import { erklaereSegmente, type ErklaerKatalog, type ErklaertesSegment } from './trigger-erklaerung';
import type { TriggerParam, TriggerZeile } from './typen';

/** Welche Ebene der Weg setzt. `unbekannt` = Bezugsdatei-Nummer nicht gedeutet. */
export type HerkunftEbene = 'TV' | 'VB' | 'beides' | 'unbekannt';

/** Ein Weg zu diesem Status: ein Satz, die Ebene, und wo er gilt. */
export interface HerkunftWirkung {
  /** Der Satz in seinen erklärbaren Stücken — Verkettung ergibt den Satz. */
  segmente: ErklaertesSegment[];
  ebene: HerkunftEbene;
  /** Richtlinien, in denen dieser Weg besteht, aufsteigend. */
  programme: string[];
}

/** Ein setzendes Kürzel mit allem, was es an diesem Status tut. */
export interface HerkunftGruppe {
  /** Kürzel in Originalschreibweise, wie die Trigger-Tabelle es führt. */
  kuerzel: string;
  /** Bezeichnung aus dem Kürzel-Katalog; ohne Eintrag das Kürzel selbst. */
  label: string;
  /** `AB/FB` bzw. `alle` — dieselbe Schreibweise wie im Navigator (Pitfall #43). */
  rollenText: string;
  /** Das Kürzel steht in der Trigger-Tabelle, aber nicht im Kürzel-Katalog. */
  unbekannt: boolean;
  wirkungen: HerkunftWirkung[];
}

export interface StatusHerkunft {
  gruppen: HerkunftGruppe[];
  /** Trigger-Zeilen, die zu diesem Status führen — die geprüfte Menge. */
  zeilen: number;
  /** Richtlinien, in denen es überhaupt einen Weg gibt, aufsteigend. */
  programme: string[];
}

/** Setzt dieser Parameter den Status `code`? Und auf welcher Ebene? */
function setztStatus(p: TriggerParam, code: number): HerkunftEbene | null {
  if (p.art === 'statusSetzen') {
    if (p.status !== code) return null;
    return ebeneVonNummer(p.ebene) ?? 'unbekannt';
  }
  if (p.art !== 'statusTvVb') return null;
  const tv = p.statusTv === code;
  const vb = p.statusVb === code;
  if (tv && vb) return 'beides';
  if (tv) return 'TV';
  if (vb) return 'VB';
  return null;
}

/** Programme aufsteigend, numerisch wo möglich — die Reihenfolge der Zuarbeit. */
function sortiereProgramme(werte: Iterable<string>): string[] {
  return [...werte].sort((a, b) => a.localeCompare(b, 'de', { numeric: true }));
}

/**
 * „in 131, 133 und 137" bzw. „in Richtlinie 131". Der Satz entsteht hier und
 * nicht in der Anzeige — sonst wäre er in der node-only Testumgebung nicht
 * prüfbar (dieselbe Regel wie bei den Trigger-Sätzen).
 *
 * Eine leere Liste ergibt einen leeren Text: „in " ohne Nennung wäre ein
 * Satzfragment, und die Anzeige soll dann nichts schreiben.
 */
export function richtlinienSatz(programme: readonly string[]): string {
  if (programme.length === 0) return '';
  if (programme.length === 1) return `in Richtlinie ${programme[0]}`;
  const kopf = programme.slice(0, -1).join(', ');
  return `in ${kopf} und ${programme[programme.length - 1]}`;
}

/**
 * Alle Wege zu einem Statuscode. Rein — dieselbe Eingabe, dieselbe Ausgabe.
 *
 * @param trigger  Die volle Tabelle. Bewusst NICHT auf ein Programm eingeschränkt:
 *   die Frage gilt dem Statuswert, nicht einem Vorgang, und je Richtlinie setzen
 *   ihn andere Kürzel — genau das soll sichtbar werden (wie `wirkungZeilen` im
 *   Glossar).
 * @param katalog  Fassungs-Ausschnitt für Bezeichnung, Rollen und die
 *   Zeichen-Erklärungen.
 */
export function herkunftZuStatus(
  trigger: readonly TriggerZeile[], code: number,
  katalog: ErklaerKatalog, legende?: TextbausteinLegende,
): StatusHerkunft {
  const felder = kuerzelIndex(katalog.felder);
  // Zwei Ebenen Bündelung: außen das Kürzel, innen der Satz. Der Schlüssel innen
  // ist der TEXT, nicht die Rohzeile — zwei Richtlinien mit gleicher Wirkung
  // sollen eine Zeile ergeben, zwei mit verschiedener Wirkung zwei.
  const proKuerzel = new Map<string, {
    kuerzel: string;
    saetze: Map<string, { segmente: ErklaertesSegment[]; ebene: HerkunftEbene; programme: Set<string> }>;
  }>();
  const alleProgramme = new Set<string>();
  let zeilen = 0;

  for (const z of trigger) {
    if (!z.geparst) continue;
    const ebene = setztStatus(z.geparst, code);
    if (ebene === null) continue;
    const key = normKey(z.kuerzel);
    if (!key) continue;

    zeilen += 1;
    const programm = z.programm.trim();
    if (programm) alleProgramme.add(programm);

    const roh = triggerSegmenteVon(z, legende);
    const text = alsText(roh);
    let gruppe = proKuerzel.get(key);
    if (!gruppe) {
      gruppe = { kuerzel: z.kuerzel, saetze: new Map() };
      proKuerzel.set(key, gruppe);
    }
    const satz = gruppe.saetze.get(text);
    if (satz) {
      // Dieselbe Wirkung in einer weiteren Richtlinie. Deutet eine Zeile die
      // Ebene und die andere nicht, gilt die gedeutete — „unbekannt" ist ein
      // Nichtwissen, das eine belegte Angabe nicht überschreiben darf.
      if (satz.ebene === 'unbekannt' && ebene !== 'unbekannt') satz.ebene = ebene;
      if (programm) satz.programme.add(programm);
    } else {
      gruppe.saetze.set(text, {
        segmente: erklaereSegmente(katalog, roh, felder),
        ebene,
        programme: new Set(programm ? [programm] : []),
      });
    }
  }

  const gruppen: HerkunftGruppe[] = [...proKuerzel.values()].map(g => {
    const feld = felder.get(normKey(g.kuerzel));
    return {
      kuerzel: g.kuerzel,
      label: feld?.label?.trim() || sonderKuerzel(g.kuerzel)?.label || g.kuerzel,
      rollenText: feld ? rollenLabel(feld) : 'alle',
      unbekannt: feld === undefined,
      wirkungen: [...g.saetze.values()]
        .map(s => ({ segmente: s.segmente, ebene: s.ebene, programme: sortiereProgramme(s.programme) }))
        // Der breiteste Weg zuerst: er ist der Regelfall, die Ausnahme steht
        // darunter. Bei Gleichstand der Satz, damit die Ausgabe stabil bleibt.
        .sort((a, b) => b.programme.length - a.programme.length
          || alsText(a.segmente).localeCompare(alsText(b.segmente), 'de')),
    };
  }).sort((a, b) => a.kuerzel.localeCompare(b.kuerzel, 'de'));

  return { gruppen, zeilen, programme: sortiereProgramme(alleProgramme) };
}
