/**
 * Die Vorbedingungen einer C16-Trigger-Zeile auswerten — die **einzige** Heimat
 * dieser Logik.
 *
 * Herausgelöst aus `navigator.ts` (dort war sie modul-privat), weil ausser dem
 * Nächster-Schritt-Navigator auch die **Verlaufsableitung** dieselben
 * Bedingungen prüft. Die beiden fragen dasselbe aus zwei Richtungen:
 *
 * - Der Navigator fragt **vorwärts**: „welches Kürzel dürfte jetzt gesetzt
 *   werden?" — Kontext ist der heutige Datenstand.
 * - Der Verlauf fragt **rückwärts**: „hat die Regel gegriffen, als das Kürzel
 *   gesetzt wurde?" — Kontext ist der Stand an genau diesem Tag.
 *
 * Das Prädikat ist beide Male dasselbe; verschieden ist nur, womit man es füttert.
 * Ein zweiter Auswerter liefe unweigerlich auseinander (Komma-UND-Listen,
 * NFC-Normalisierung, die Behandlung ungedeuteter Argumente) — deshalb genau
 * dieser eine, wie bei den `Bedingung`-Bäumen in `bedingung.ts` (Pitfall #41).
 *
 * **Drei Ehrlichkeits-Regeln**, aus dem Navigator übernommen und hier zu Hause:
 *
 * 1. Was sich nicht auswerten lässt, ist `unpruefbar` — **nie** `verletzt` und
 *    nie stillschweigend `erfuellt`. Ein fehlender Katalog-Eintrag heisst nicht,
 *    dass die Spalte leer ist, sondern dass wir sie nicht lesen können.
 * 2. Komma-Listen sind UND-Listen, und jedes Kürzel darin ist eine **eigene**
 *    Bedingung mit eigenem Urteil. Ein unbekanntes macht nur SEINEN Teil
 *    unprüfbar, nicht die ganze Zeile.
 * 3. Die Argumente der Positionen 3–5 (`weitere`) sind ungedeutet. Sie zählen
 *    als `unpruefbar` und nennen sich beim Namen — sie wegzulassen behauptete
 *    eine Vollständigkeit, die der Parser nicht hat.
 *
 * Rein und deterministisch: keine IO, keine Uhr.
 */
import { normKey } from './normalisierung';
import { sonderKuerzel } from './sonderkuerzel';
import type { KuerzelIndex } from './feld-zugriff';
import type { TriggerParam } from './typen';

/** Wie eine einzelne Vorbedingung ausgegangen ist. */
export type BedingungsUrteil = 'erfuellt' | 'verletzt' | 'unpruefbar';

/** Wogegen geprüft wird. Der Aufrufer bestimmt den Zeitpunkt, nicht dieses Modul. */
export interface TriggerKontext {
  /** normKey(Kürzel) → Katalog-Feld. Fehlt der Eintrag, ist die Spalte unlesbar. */
  felderNachCode: KuerzelIndex;
  /** normKey der Kürzel, die auf **dieser** Ebene ein Datum tragen. */
  gesetztTv: ReadonlySet<string>;
  /** normKey der Kürzel, die in **irgendeinem** Teilvorhaben ein Datum tragen. */
  gesetztVerbund: ReadonlySet<string>;
  /** Status zum Prüfzeitpunkt; `null` ⇒ die Status-Bedingung ist `unpruefbar`. */
  statusCode: number | null;
  /**
   * ISO-Tag, auf den sich `gesetztTv`/`gesetztVerbund` beziehen. Nur für den
   * Wortlaut der Gründe: ohne ihn heisst es „ist bereits gesetzt" (Gegenwart,
   * Navigator), mit ihm „war am … bereits gesetzt" (Rückschau, Verlauf). Eine
   * Rückschau, die in der Gegenwartsform spricht, liest sich wie eine Aussage
   * über heute.
   */
  zeitpunkt?: string;
}

/** Das Ergebnis über ALLE Bedingungen einer Zeile. */
export interface BedingungsBefund {
  urteil: BedingungsUrteil;
  /** Je nicht erfüllter bzw. nicht prüfbarer Bedingung ein Satz. Nie leer bei
   *  `verletzt`/`unpruefbar` — Schweigen wäre hier dasselbe wie Raten. */
  gruende: string[];
}

/** Verletzt schlägt unprüfbar schlägt erfüllt — das schlechteste Urteil gewinnt. */
export function schlechtestes(urteile: readonly BedingungsUrteil[]): BedingungsUrteil {
  if (urteile.includes('verletzt')) return 'verletzt';
  if (urteile.includes('unpruefbar')) return 'unpruefbar';
  return 'erfuellt';
}

/** „war/ist bereits gesetzt" — je nachdem, ob ein Zeitpunkt mitgereicht wurde. */
function gesetztSatz(kuerzel: string, wo: string, zeitpunkt: string | undefined): string {
  return zeitpunkt
    ? `${kuerzel} war am ${zeitpunkt} ${wo}bereits gesetzt.`
    : `${kuerzel} ist ${wo}bereits gesetzt.`;
}

/**
 * Eine Negativ-Bedingung („TV hat kein ABB") auswerten.
 *
 * Kennt der Katalog das Kürzel nicht, ist die Bedingung **nicht prüfbar** — und
 * zwar in beide Richtungen: ein fehlender Katalog-Eintrag heisst nicht, dass die
 * Spalte leer ist, sondern nur, dass wir sie nicht lesen können.
 */
function pruefeOhne(kuerzel: string, art: 'TV' | 'Verbund', k: TriggerKontext): {
  urteil: BedingungsUrteil; grund: string | null;
} {
  const key = normKey(kuerzel);
  if (!k.felderNachCode.has(key)) {
    // Ein katalogfremdes Kürzel, das die Fachseite erklärt hat, bleibt ebenfalls
    // unprüfbar — es gibt keine Spalte, in die man sehen könnte. Nur der Grund
    // ist ein anderer, und der gehört dann auch dagestanden.
    const sonder = sonderKuerzel(kuerzel);
    return {
      urteil: 'unpruefbar',
      grund: sonder
        ? `${kuerzel}: ${sonder.label} — „ohne ${kuerzel}" nicht prüfbar.`
        : `Kürzel ${kuerzel} steht nicht im Katalog — „ohne ${kuerzel}" nicht prüfbar.`,
    };
  }
  const gesetzt = art === 'TV' ? k.gesetztTv : k.gesetztVerbund;
  if (gesetzt.has(key)) {
    return {
      urteil: 'verletzt',
      grund: gesetztSatz(kuerzel, art === 'TV' ? '' : 'im Verbund ', k.zeitpunkt),
    };
  }
  return { urteil: 'erfuellt', grund: null };
}

/**
 * Die Vorbedingungen EINER Trigger-Zeile.
 *
 * Nur `statusTvVb` führt überhaupt welche; die drei anderen Prozeduren sind
 * unbedingt und kommen deshalb als `erfuellt` ohne Gründe zurück.
 */
export function pruefeTriggerBedingungen(p: TriggerParam, k: TriggerKontext): BedingungsBefund {
  if (p.art !== 'statusTvVb') return { urteil: 'erfuellt', gruende: [] };

  const urteile: BedingungsUrteil[] = [];
  const gruende: string[] = [];
  const nimm = (u: BedingungsUrteil, grund: string | null): void => {
    urteile.push(u);
    if (grund) gruende.push(grund);
  };

  if (p.status) {
    if (k.statusCode === null) {
      // Zwei sehr verschiedene Gründe für dieselbe Lücke: vorwärts kennt der
      // Katalog den aktuellen Wert nicht, rückwärts ist vor dem ersten belegten
      // Wechsel noch gar keiner da. „Steht nicht im Katalog" wäre am
      // Kettenanfang schlicht falsch — und der Leser sucht dann im Katalog.
      nimm('unpruefbar', k.zeitpunkt
        ? 'Vor diesem Termin ist kein Statuswechsel belegt — die Status-Bedingung ist nicht prüfbar.'
        : 'Aktueller Status steht nicht im Katalog — Status-Bedingung nicht prüfbar.');
    } else {
      const { op, code } = p.status;
      const ok = op === '<' ? k.statusCode < code : op === '>' ? k.statusCode > code : k.statusCode === code;
      const wort = op === '<' ? 'vor' : op === '>' ? 'nach' : 'gleich';
      nimm(ok ? 'erfuellt' : 'verletzt', ok ? null : `Status ${k.statusCode} ist nicht ${wort} ${code}.`);
    }
  }
  // Komma-Listen sind UND-Listen: jedes Kürzel ist eine eigene Bedingung mit
  // eigenem Urteil. Ein unbekanntes macht nur SEINEN Teil unprüfbar, nicht die
  // ganze Zeile — sonst nähme ein einziger Katalog-Ausreißer dem Nutzer auch
  // die Aussage über die übrigen.
  for (const kuerzel of p.ohneTvKuerzel) {
    const r = pruefeOhne(kuerzel, 'TV', k);
    nimm(r.urteil, r.grund);
  }
  for (const kuerzel of p.ohneVerbundKuerzel) {
    const r = pruefeOhne(kuerzel, 'Verbund', k);
    nimm(r.urteil, r.grund);
  }
  for (const w of p.weitere) {
    const sonder = sonderKuerzel(w);
    nimm('unpruefbar', sonder
      ? `Weiteres Argument „${w}": ${sonder.label} — seine Wirkung an dieser Stelle ist ungedeutet.`
      : `Weiteres Argument „${w}" ist nicht gedeutet.`);
  }

  return { urteil: schlechtestes(urteile), gruende };
}
