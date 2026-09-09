/**
 * **Ein Anzeige-Modell für zwei Fristsysteme** — rein, ohne IO und ohne React.
 *
 * Die App beantwortet „ist das zu spät?" auf zwei Wegen, und sie meinen
 * Verschiedenes:
 *
 * | | Zieltage je Status | Meilenstein-Sollwoche |
 * |---|---|---|
 * | Frage | Liegt der Vorgang zu lange still? | Ist ein Termin ab Eingang gerissen? |
 * | Gepflegt in | Katalog-Fassung (gilt mit dem Speichern) | Meilenstein-Plan (gilt erst mit der FREIGABE) |
 * | Gerechnet von | `pruefeStillstand` | `bewertung.ts` |
 *
 * Bis v4.86 stand dafür je ein Widget auf der Startseite, nebeneinander, ohne
 * dass eines sagte, aus welchem System seine Warnung kommt. Zwei Zahlen zur
 * selben Frage, zwei Pflegeorte, zwei Freigabe-Begriffe — das ist der Punkt, an
 * dem ein Nutzer nicht mehr weiß, wo er etwas abstellt.
 *
 * **Zusammen gezeigt, nicht zusammen gerechnet.** Dieses Modul rechnet nichts:
 * es nimmt die Ergebnisse beider vorhandener Evaluatoren entgegen und bringt sie
 * auf eine gemeinsame Zeile. Ein gemeinsamer Rechenweg wäre falsch — die beiden
 * messen nicht dasselbe. Was sie teilen, ist nur die Antwort „so viele Tage über
 * dem, was vorgesehen war", und genau das ist der Sortierschlüssel.
 *
 * Jede Zeile trägt ihre **Herkunft** (`marke`). Ohne sie wäre die Liste eine
 * Sammlung anonymer Warnungen, die niemand abstellen kann.
 */
import type { WaechterErgebnis } from '@/core/status';
import type { MeilensteinKnoten, MstZustand, VerbundMeilensteine } from '@/core/meilensteine';
import { MS_TAG } from '@/core/utils/zeitEinheiten';


/** Aus welchem Fristsystem ein Anlass stammt. */
export type FristArt = 'zieltag' | 'meilenstein';

/** Eine Zeile der Fristen-Liste. */
export interface FristAnlass {
  /** Stabil über beide Quellen — Verbund allein genügt nicht, ein Verbund kann
   *  gleichzeitig stillstehen und einen Meilenstein reißen. */
  id: string;
  verbundId: string;
  akronym: string;
  art: FristArt;
  /** Die Herkunft als kurzes Wort für die Zeile: `Zieltag` bzw. die MST-Nummer. */
  marke: string;
  /** Was los ist — Status, halb offenes Kürzel-Paar oder Meilenstein-Bezeichnung. */
  grund: string;
  /**
   * Tage **über** dem Vorgesehenen; negativ = so viele Tage bleiben noch.
   * `null` = nicht bezifferbar (Meilenstein ohne lesbares Soll-Datum).
   *
   * Der einzige Wert, den beide Systeme vergleichbar liefern — und deshalb der
   * Sortierschlüssel. Er ist NICHT die Frist selbst: der Stillstands-Wächter
   * misst Liegezeit gegen Zieltage, der Meilenstein einen Termin gegen heute.
   */
  ueberTage: number | null;
  /** Frist gerissen bzw. Stillstand festgestellt (rot) — sonst steht sie bevor (gelb). */
  gerissen: boolean;
  /**
   * Wie viele **weitere** Anlässe desselben Verbunds diese Zeile mitvertritt
   * (0/undefined = keine). Wird von `buendleNachVerbund` gesetzt.
   */
  weitere?: number;
}

/**
 * Ein hängender Vorgang wird eine Zeile.
 *
 * Erwartet ausschließlich Ergebnisse mit `urteil === 'haengt'`; `unbewertet`
 * zählt der Aufrufer separat, weil es kein Alarm ist, sondern eine Aussage über
 * die Belastbarkeit der Zahl daneben (so hielt es schon „Hängt fest").
 */
export function zieltagAnlass(
  verbundId: string, akronym: string, statusRoh: string, w: WaechterErgebnis,
): FristAnlass {
  return {
    id: `zieltag:${verbundId}`,
    verbundId,
    akronym,
    art: 'zieltag',
    marke: 'Zieltag',
    grund: w.paar ? `${w.paar.gesetzt} gesetzt, ${w.paar.fehlt} fehlt` : statusRoh,
    // Beide Angaben können fehlen; dann ist der Stillstand zwar festgestellt,
    // aber nicht bezifferbar — und eine erfundene Zahl wäre schlimmer als keine.
    ueberTage: w.tage !== null && w.zieltage !== null ? w.tage - w.zieltage : null,
    gerissen: true,
  };
}

/**
 * Die fälligen und gerissenen Meilensteine werden Zeilen.
 *
 * Übernimmt die Bewertung unverändert — die Schwellen („gerissen", „fällig" =
 * Soll in ≤ 7 Tagen) kommen aus der Engine und werden hier nicht nachgebaut.
 */
export function meilensteinAnlaesse(
  bewertungen: readonly VerbundMeilensteine[],
  knoten: readonly MeilensteinKnoten[],
  akronymVon: (verbundId: string) => string,
  heuteMs: number,
): FristAnlass[] {
  const byId = new Map(knoten.map(k => [k.id, k]));
  const out: FristAnlass[] = [];
  for (const b of bewertungen) {
    for (const e of b.ergebnisse) {
      if (!istOffen(e.zustand)) continue;
      const k = byId.get(e.knotenId);
      if (!k) continue;
      const sollMs = e.sollDatum ? new Date(e.sollDatum).getTime() : NaN;
      out.push({
        id: `meilenstein:${b.verbundId}:${k.id}`,
        verbundId: b.verbundId,
        akronym: akronymVon(b.verbundId),
        art: 'meilenstein',
        marke: k.nummer,
        grund: k.label,
        ueberTage: Number.isNaN(sollMs) ? null : Math.floor((heuteMs - sollMs) / MS_TAG),
        gerissen: e.zustand === 'gerissen',
      });
    }
  }
  return out;
}

function istOffen(z: MstZustand): z is Extract<MstZustand, 'gerissen' | 'faellig'> {
  return z === 'gerissen' || z === 'faellig';
}

/**
 * Die dringendsten zuerst: am weitesten über der Frist ganz oben.
 *
 * Nicht bezifferbare Anlässe (`ueberTage: null`) sinken ans Ende statt zu
 * verschwinden — sie sind festgestellt, nur nicht in Tagen ausdrückbar. Bei
 * gleichem Abstand entscheidet das Akronym, damit die Liste zwischen zwei
 * Renderings nicht springt.
 */
export function sortiereAnlaesse(anlaesse: readonly FristAnlass[]): FristAnlass[] {
  return [...anlaesse].sort((a, b) => {
    const ua = a.ueberTage ?? Number.NEGATIVE_INFINITY;
    const ub = b.ueberTage ?? Number.NEGATIVE_INFINITY;
    if (ua !== ub) return ub - ua;
    return a.akronym.localeCompare(b.akronym, 'de');
  });
}

/**
 * Bündelt die Anlässe je Verbund **und Quelle** — eine Zeile je Vorgang.
 *
 * Ein Verbund, der seit Jahren liegt, reißt nicht ein Problem, sondern einen
 * Meilenstein nach dem anderen: am echten Bestand trugen die acht sichtbaren
 * Zeilen des Widgets nur drei verschiedene Akronyme, während dasselbe Modul
 * seine Liste längst bündelte („DynaMaint · 5 offen"). Zwei Ansichten derselben
 * Sache dürfen nicht verschieden zählen.
 *
 * Getrennt nach `art`, weil Stillstand und Meilenstein zwei Systeme mit zwei
 * Pflegeorten sind — sie zusammenzuziehen nähme der Zeile ihre Herkunft.
 *
 * Erwartet eine bereits **sortierte** Liste (`sortiereAnlaesse`): dadurch ist
 * der erste Anlass je Verbund automatisch der dringendste, und die Einfüge-
 * Reihenfolge der Map hält die Sortierung. Hier wird deshalb bewusst nicht ein
 * zweites Mal sortiert.
 */
export function buendleNachVerbund(anlaesse: readonly FristAnlass[]): FristAnlass[] {
  const proVorgang = new Map<string, FristAnlass>();
  for (const a of anlaesse) {
    const schluessel = `${a.art}:${a.verbundId}`;
    const vorhanden = proVorgang.get(schluessel);
    if (vorhanden) {
      vorhanden.weitere = (vorhanden.weitere ?? 0) + 1;
      continue;
    }
    proVorgang.set(schluessel, { ...a, weitere: 0 });
  }
  return [...proVorgang.values()];
}

/**
 * Der sichtbare Ausschnitt — **beide Quellen kommen vor**, wenn beide etwas
 * haben (v4.134).
 *
 * Die Liste ist nach Abstand sortiert, und die Quellen liefern sehr ungleich
 * viel: am echten Bestand standen 36 Meilenstein-Anlässe gegen 16 Zieltage, und
 * in den sichtbaren acht Zeilen kam kein einziger Zieltag vor — die Kopfzeile
 * versprach „16 Zieltag", die Liste zeigte davon nichts. Das mit der Kopfzahl
 * zu beantworten (so hielt es v4.86) reicht nicht: eine Zahl ohne Zeile ist
 * kein Zugang zu der Sache, die sie zählt.
 *
 * Deshalb bekommt jede vorhandene Quelle **mindestens** `mindestens` Plätze,
 * bevor der Rest nach Dringlichkeit vergeben wird. Die Reihenfolge der
 * Ausgabe bleibt die der Eingabe — es wird ausgewählt, nicht umsortiert.
 */
export function sichtbareMischung(
  zeilen: readonly FristAnlass[], hoechstens: number, mindestens: number,
): FristAnlass[] {
  if (zeilen.length <= hoechstens) return [...zeilen];
  const gewaehlt = new Set<string>();
  for (const art of ['zieltag', 'meilenstein'] as const) {
    let n = 0;
    for (const z of zeilen) {
      if (n >= mindestens || gewaehlt.size >= hoechstens) break;
      if (z.art !== art) continue;
      gewaehlt.add(z.id);
      n += 1;
    }
  }
  for (const z of zeilen) {
    if (gewaehlt.size >= hoechstens) break;
    gewaehlt.add(z.id);
  }
  return zeilen.filter(z => gewaehlt.has(z.id));
}

/**
 * Wie viele Anlässe je Quelle — für die Kopfzeile.
 *
 * **Warum das dastehen muss.** Die Liste ist nach Abstand sortiert, und die
 * beiden Quellen liefern sehr ungleich viel: am echten Bestand standen 3 231
 * Meilenstein-Anlässe gegen eine Handvoll Stillstände, sodass in den sichtbaren
 * acht Zeilen kein einziger Stillstand vorkam. Eine gemeinsame Liste, die eine
 * ihrer Quellen unsichtbar macht, hält ihre Zusage nicht — also nennt die
 * Kopfzeile beide Zahlen, statt sie in der Sortierung verschwinden zu lassen.
 */
export function anlassBilanz(anlaesse: readonly FristAnlass[]): { zieltag: number; meilenstein: number } {
  let zieltag = 0;
  for (const a of anlaesse) if (a.art === 'zieltag') zieltag += 1;
  return { zieltag, meilenstein: anlaesse.length - zieltag };
}

/** Die Kopfzeile: Gesamtzahl und woraus sie sich zusammensetzt. */
export function bilanzText(anlaesse: readonly FristAnlass[]): string {
  const { zieltag, meilenstein } = anlassBilanz(anlaesse);
  if (zieltag === 0 && meilenstein === 0) return '';
  if (zieltag === 0) return `${meilenstein.toLocaleString('de-DE')} Meilenstein`;
  if (meilenstein === 0) return `${zieltag.toLocaleString('de-DE')} Zieltag`;
  return `${meilenstein.toLocaleString('de-DE')} Meilenstein · ${zieltag.toLocaleString('de-DE')} Zieltag`;
}

/** Die rechtsbündige Angabe einer Zeile. */
export function ueberTageText(ueberTage: number | null): string {
  if (ueberTage === null) return '—';
  if (ueberTage > 0) return `${ueberTage} T über`;
  if (ueberTage === 0) return 'heute';
  return `in ${-ueberTage} T`;
}
