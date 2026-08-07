/**
 * Die C16-Trigger-Tabelle als **Regelquelle der Verlaufsableitung**.
 *
 * Bis v3.22 rechnete der Verlauf gegen die 41 Regeln der Kürzel-Zuarbeit. Die
 * sind von einer einzelnen Bearbeiterin für ein eigenes Excel-Dashboard
 * aufgestellt, erklärtermassen unvollständig, und decken gemessen genau **eine**
 * Projektform (NW). C16 ist der Export aus dem laufenden Fachsystem — die
 * tatsächliche Konfiguration statt einer Beobachtung. Seit v3.23 ist sie die
 * alleinige Regelquelle.
 *
 * **Zwei Schlüssel, die sich nicht decken.** Die Zuarbeit sagt „dieses Kürzel in
 * dieser PROJEKTFORM setzt diesen Status", C16 sagt „dieses Kürzel in dieser
 * RICHTLINIE setzt unter diesen Umständen diesen Status". Der Wechsel ist
 * deshalb kein Datentausch, sondern ein anderer Nachschlag: gefiltert wird über
 * `triggerFuerProgramm` (`FM_NUMMER` → `unterprogramm_id`, Pitfall #44), nie
 * über ein Ersatz-Programm. Die Projektform bleibt für die **Bezeichnung**
 * zuständig (Kürzel × Projektform, `kuerzelAuskunft`) — nur für die Regel nicht
 * mehr.
 *
 * **Setzebene und Wirkungsebene sind zwei Dinge.** Wo ein Kürzel gesetzt wird,
 * sagt sein `X`-Präfix (`ebeneVonCode`, beim Katalogbau in `feld.ebene`
 * eingefroren). Worauf es wirkt, sagt die Regel: `statusTv` und `statusVb`
 * stehen an festen Positionen und werden unabhängig voneinander gefüllt. `ABB`
 * trägt kein `X`, wird am Teilvorhaben gesetzt und kippt über `statusVb`
 * trotzdem den Verbund. Der `scope: null`-Fall der Zuarbeit (12 von 41 Regeln)
 * entfällt damit ersatzlos — C16 lässt die Ebene nie offen.
 *
 * **Zeilen eines Kürzels sind ALTERNATIVEN, keine gemeinsame Bedingung** — die
 * Lesart des Navigators, hier unverändert: `AAE` führt je eine Zeile für `<59`
 * und `<99`. Verletzt die eine, kann die andere trotzdem greifen.
 *
 * Rein und deterministisch: keine IO, keine Uhr.
 */
import { normKey } from '../normalisierung';
import { triggerFuerProgramm } from '../trigger-share';
import { ebeneVonNummer, istZulaessigkeit } from '../trigger-satz';
import type { TriggerZeile } from '../typen';
import type { SpurArt } from './typen';

/** Nachschlag normKey(Kürzel) → die Zeilen dieses Kürzels, in Folge-Reihenfolge. */
export type C16Index = ReadonlyMap<string, readonly TriggerZeile[]>;

export interface C16Regeln {
  index: C16Index;
  /** Warum der Index leer ist — die Anzeige muss beide Fälle auseinanderhalten. */
  lage: 'regeln' | 'programm-unbekannt' | 'programm-ohne-regeln';
  /** Zeilen, die nur eine Zulässigkeit prüfen und keinen Status setzen. */
  nurZulaessigkeit: number;
  /** Zeilen des Programms, die der Parser nicht deuten konnte. */
  nichtInterpretiert: number;
}

/**
 * Setzt diese Zeile einen Status auf DIESER Ebene? `null` = nein.
 *
 * `statusSetzen` (`TRG.Status.TV.VB`) trägt die Ebene als Bezugsdatei-Nummer
 * (210 = Verbund, 211 = Teilvorhaben, erschlossen und nicht belegt — siehe
 * `ebeneVonNummer`). Eine unbekannte Nummer setzt **nichts**: eine geratene
 * Ebene wäre ein Statuswechsel auf der falschen Bahn.
 */
export function zielStatusFuer(zeile: TriggerZeile, art: SpurArt): number | null {
  const p = zeile.geparst;
  if (!p) return null;
  if (p.art === 'statusTvVb') return art === 'tv' ? p.statusTv : p.statusVb;
  if (p.art !== 'statusSetzen') return null;
  const ebene = ebeneVonNummer(p.ebene);
  if (ebene === null) return null;
  return (ebene === 'TV') === (art === 'tv') ? p.status : null;
}

/** Trägt die Zeile überhaupt einen Zielstatus — auf irgendeiner Ebene? */
function setztIrgendwas(zeile: TriggerZeile): boolean {
  return zielStatusFuer(zeile, 'tv') !== null || zielStatusFuer(zeile, 'verbund') !== null;
}

/**
 * Baut den Index für EIN Programm.
 *
 * Aufgenommen werden nur Zeilen, die einen Status setzen. Eine reine
 * Zulässigkeitsprüfung („Kürzel nur setzbar, wenn …") beschreibt, was das
 * Fachsystem beim Eingeben zulässt — sie erklärt keinen Statuswechsel und hätte
 * in einer Bahn nichts zu suchen. Gezählt wird sie trotzdem, damit „nicht
 * aufgenommen" nicht mit „gibt es nicht" verwechselt wird.
 */
export function baueC16Regeln(
  trigger: readonly TriggerZeile[], programm: string | null,
): C16Regeln {
  const p = (programm ?? '').trim();
  if (p === '') {
    return { index: new Map(), lage: 'programm-unbekannt', nurZulaessigkeit: 0, nichtInterpretiert: 0 };
  }
  const eigene = triggerFuerProgramm(trigger, p);
  if (eigene.length === 0) {
    return { index: new Map(), lage: 'programm-ohne-regeln', nurZulaessigkeit: 0, nichtInterpretiert: 0 };
  }

  const m = new Map<string, TriggerZeile[]>();
  let nurZulaessigkeit = 0;
  let nichtInterpretiert = 0;
  for (const z of eigene) {
    if (!z.geparst) { nichtInterpretiert += 1; continue; }
    if (!setztIrgendwas(z)) {
      if (z.geparst.art === 'statusTvVb' && istZulaessigkeit(z.geparst)) nurZulaessigkeit += 1;
      continue;
    }
    const key = normKey(z.kuerzel);
    if (!key) continue;
    const liste = m.get(key);
    if (liste) liste.push(z); else m.set(key, [z]);
  }
  for (const liste of m.values()) liste.sort((a, b) => a.folge - b.folge);

  return {
    index: m,
    lage: m.size > 0 ? 'regeln' : 'programm-ohne-regeln',
    nurZulaessigkeit,
    nichtInterpretiert,
  };
}

/** Die Zeilen eines Kürzels; leere Liste, wenn C16 keine führt. */
export function zeilenFuer(index: C16Index, kuerzel: string): readonly TriggerZeile[] {
  return index.get(normKey(kuerzel)) ?? [];
}

/** Setzt irgendeine Zeile dieses Kürzels einen VERBUND-Status? */
export function wirktAufVerbund(index: C16Index, kuerzel: string): boolean {
  return zeilenFuer(index, kuerzel).some(z => zielStatusFuer(z, 'verbund') !== null);
}

/**
 * Welche Statuscodes kann die Ableitung auf dieser Ebene überhaupt erreichen?
 *
 * Entscheidet in `segmente.ts`, ob eine Abweichung ein `widerspruch` ist (es
 * gäbe eine Regel, sie ist nur nicht belegt) oder bloss `nicht_ableitbar` (kein
 * Weg führt dorthin). Ohne die Unterscheidung stünden beide unter einer Zahl,
 * und die wäre so gross, dass niemand hinsieht.
 */
export function erreichbareCodes(index: C16Index, art: SpurArt): ReadonlySet<number> {
  const out = new Set<number>();
  for (const zeilen of index.values()) {
    for (const z of zeilen) {
      const code = zielStatusFuer(z, art);
      if (code !== null) out.add(code);
    }
  }
  return out;
}
