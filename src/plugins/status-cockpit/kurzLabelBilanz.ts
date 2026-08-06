/**
 * Die **Kurzlabel-Bilanz**: welche Statuswerte tragen keine kuratierte
 * Kurzform — und wie sehr fällt das im Bestand auf?
 *
 * Die Reihenfolge ist die Aussage. Alphabetisch sortiert stünde `abgebrochen`
 * (12 Vorkommen) über `Sonderstatus` (20 716), und ein Kurator arbeitet die
 * Liste von oben ab. Deshalb absteigend nach Vorkommen, mit einer
 * Deckungsangabe daneben: „die 20 häufigsten decken 92 %" sagt, wann es reicht.
 *
 * **Die Einheit heißt „Vorkommen", nicht „Zeilen" oder „Anträge".**
 * `zaehleVorkommen` (cockpit-berechnung.ts) zählt je (Feld, Wert) die
 * VERBÜNDE, und der Schlüssel ist feld-skopiert: ein Verbund, dessen TV- und
 * Verbund-Status übereinstimmen, zählt zweimal. Für einen Anteil ist das
 * unschädlich, solange Zähler und Nenner dieselbe Einheit haben — als
 * Bestandsgröße wäre die Summe falsch. Der Name hält das offen.
 *
 * **Gruppiert wird nach CODE**, nicht nach Wert-Id: die Kuration hängt am Code
 * (`setzeKurzLabel`), weil derselbe Code unter `status` und `verbund_status`
 * steht. Werte ohne amtlichen Code haben nichts zu kuratieren — sie fallen auf
 * den gekürzten Bezeichner und stehen nicht in dieser Liste.
 *
 * Rein: keine IO, keine Uhr, kein React. Heißt bewusst nicht `kurzLabelPflege`
 * — ein Geschwister-Modul, das sich von `KurzLabelPflege.tsx` nur im Casing
 * unterscheidet, kollidiert unter Windows (TS1261, CLAUDE.md „File Naming").
 */
import { STATUS_CODE_KATALOG, KURZLABEL_MAX, wertId } from '@/core/status';
import type { StatusWertEintrag } from '@/core/status';
import type { LabelHerkunft } from '@/core/utils/status-wert-labels';

export interface KurzLabelZeile {
  code: number;
  /** Amtliche Bezeichnung — das, was gekürzt werden soll. Kennt die
   *  Auslieferung den Code nicht (frisch aus der Zuarbeit importiert), der
   *  Rohwert der Fassung. */
  voll: string;
  /** Die geltende Kurzform (leer, wenn keine gepflegt ist). */
  kurz: string;
  /** Aus der Fassung, aus der Auslieferung, oder gar nicht gepflegt. */
  herkunft: LabelHerkunft;
  /** Zeichenzahl der geltenden Kurzform — `0`, wenn keine da ist. */
  laenge: number;
  /** Über {@link KURZLABEL_MAX}: die Pille bricht um. */
  zuLang: boolean;
  /** Summe über beide Wert-Felder. */
  vorkommen: number;
}

export interface KurzLabelBilanz {
  /** Absteigend nach Vorkommen. Enthält ALLE Codes, nicht nur die offenen —
   *  die Liste ist auch die Kontrolle über das schon Gepflegte. */
  zeilen: readonly KurzLabelZeile[];
  /** Nenner jeder Prozentangabe: Summe über alle Codes. */
  gesamtVorkommen: number;
  /** Was noch offen ist. */
  ohneKurz: { anzahl: number; vorkommen: number };
  /** Wie viele geltende Kurzformen die Warngrenze reißen. */
  zuLang: number;
  /** Welchen Anteil der Vorkommen die `n` häufigsten OFFENEN Zeilen abdecken
   *  (0…1). Ohne offene Zeilen: 1 — es ist nichts mehr zu tun. */
  abdeckung: (n: number) => number;
}

/** Was die Auslieferung für einen Code vorsieht. */
const AUSLIEFERUNG = new Map(STATUS_CODE_KATALOG.map(e => [e.code, e]));

export function baueKurzLabelBilanz(
  werte: readonly StatusWertEintrag[],
  vorkommen: ReadonlyMap<string, number>,
): KurzLabelBilanz {
  const proCode = new Map<number, { kuratiert: string; roh: string; vorkommen: number }>();
  for (const w of werte) {
    if (w.code === undefined) continue;
    const bisher = proCode.get(w.code) ?? { kuratiert: '', roh: '', vorkommen: 0 };
    proCode.set(w.code, {
      // Erster gepflegter Wert gewinnt — `setzeKurzLabel` schreibt ohnehin in
      // jede Zeile desselben Codes, ein Unterschied wäre ein Altbestand.
      kuratiert: bisher.kuratiert || (w.kurzLabel?.trim() ?? ''),
      roh: bisher.roh || w.label?.trim() || w.wert,
      vorkommen: bisher.vorkommen + (vorkommen.get(wertId(w.feldId, w.wert)) ?? 0),
    });
  }

  const zeilen: KurzLabelZeile[] = [];
  for (const [code, s] of proCode) {
    const amtlich = AUSLIEFERUNG.get(code);
    const ausKatalog = amtlich?.kurz.trim() ?? '';
    const kurz = s.kuratiert || ausKatalog;
    const herkunft: LabelHerkunft = s.kuratiert ? 'fassung' : ausKatalog ? 'katalog' : 'ohne';
    zeilen.push({
      code,
      // Ein Code, den die Auslieferung nicht kennt, kommt aus der Zuarbeit —
      // dann steht der Rohwert der Fassung da statt einer leeren Zeile.
      voll: amtlich?.text ?? s.roh,
      kurz,
      herkunft,
      laenge: kurz.length,
      zuLang: kurz.length > KURZLABEL_MAX,
      vorkommen: s.vorkommen,
    });
  }
  // Zweiter Schlüssel Code: bei gleichem Vorkommen (oft 0) soll die Liste
  // zwischen zwei Aufrufen nicht springen.
  zeilen.sort((a, b) => b.vorkommen - a.vorkommen || a.code - b.code);

  const gesamtVorkommen = zeilen.reduce((n, z) => n + z.vorkommen, 0);
  const offen = zeilen.filter(z => z.herkunft === 'ohne');
  const offenVorkommen = offen.reduce((n, z) => n + z.vorkommen, 0);

  return {
    zeilen,
    gesamtVorkommen,
    ohneKurz: { anzahl: offen.length, vorkommen: offenVorkommen },
    zuLang: zeilen.filter(z => z.zuLang).length,
    abdeckung: (n: number) => {
      if (offen.length === 0 || offenVorkommen === 0) return 1;
      const summe = offen.slice(0, n).reduce((s, z) => s + z.vorkommen, 0);
      return summe / offenVorkommen;
    },
  };
}
