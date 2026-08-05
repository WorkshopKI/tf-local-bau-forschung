/**
 * Drei Befunde, die vor der AB-Runde ausgerechnet sein müssen.
 *
 * Sie beantworten keine Fachfrage — sie machen sie **beantwortbar**. Eine Runde,
 * die über „trifft R4 eigentlich je zu?" diskutiert, verbraucht die knappste
 * Ressource des Termins mit etwas, das eine Messung in Sekunden klärt.
 *
 * - **PreCheck-Lücke** — Vorgänge auf 34 („bearbeitungsreif") ohne Vermerk. K2
 *   hat belegt, dass 34 von `PC+`/`XPC+` gesetzt wird; ein 34 ohne Vermerk ist
 *   deshalb erklärungsbedürftig. Getrennt nach Fördervariante, weil DL und NW
 *   laut Seed gar keinen PreCheck haben — dort ist der Fall unauffällig.
 * - **Feldpflege** — wie oft `AVK`/`AAR` überhaupt gefüllt sind und wie oft
 *   zusammen mit `VV`. Trifft eine Regel nie zu, sind das zwei grundverschiedene
 *   Gründe: das Feld wird nicht gepflegt, oder der Zwischenzustand ist im
 *   Nacht-Export nie sichtbar. Aus der Zahl folgt hier NICHTS — sie sagt nur,
 *   welche der beiden Fragen der Termin zu beantworten hat.
 * - **Verdeckte Regel** — wer eine Regel schlägt, die zutrifft, aber nicht
 *   gewinnt. Ohne die verdeckende Regel ist „52 von 65" wertlos.
 *
 * **Keine zweite Auswertung.** Die Kaskaden-Zahlen kommen aus dem
 * `TodoErgebnis`, das die Engine ohnehin liefert (`weitereTreffer`), nicht aus
 * einem eigenen `pruefeBedingung`-Lauf — dieselbe Begründung wie in
 * `regel-wirkung.ts` (Pitfall #41).
 *
 * Rein: keine IO, keine Uhr, kein React.
 */
import { BEISPIELE_MAX } from './fb-erhebung';
import { findeStatusCode } from './status-codes';
import { getAntragstypBucket, type AntragstypBucket } from '@/core/utils/vb-phase-mappings';
import type { FeldVorkommen } from './feld-aufloesung';
import type { TodoErgebnis } from './todo-engine';

/** Ein Vorgang, wie ihn ein `jederVorgang`-Durchgang liefert — plus sein Urteil. */
export interface TerminFall {
  aktenzeichen: string;
  /** Roher Status-Text aus dem Antrags-Record. */
  statusRoh: unknown;
  /** Roher `vb_phase`-Wert — die Fördervariante. */
  vbPhaseRoh: unknown;
  vorkommen: readonly FeldVorkommen[];
  /** Ergebnis des AB-Regelsatzes für diesen Vorgang. */
  ergebnis: TodoErgebnis;
}

/** Eine Gruppe mit Anzahl und Beispielen — die Form aller Blöcke hier. */
export interface BefundGruppe {
  /** Was die Gruppe ausmacht (Variantenname, Regel-Id …). */
  schluessel: string;
  /** Klartext für die Anzeige. */
  label: string;
  anzahl: number;
  /** Bis zu {@link BEISPIELE_MAX} Aktenzeichen — damit die Zahl prüfbar wird. */
  beispiele: string[];
}

/** (a) Vorgänge auf 34 ohne PreCheck-Vermerk, getrennt nach Fördervariante. */
export interface PrecheckLuecke {
  /** Alle Vorgänge auf Status 34 — der Nenner. */
  auf34: number;
  /** Davon ohne `PC+` UND ohne `XPC+`. */
  ohneVermerk: number;
  /**
   * Die Fälle mit PreCheck-Pflicht (FuE, DS) — nur die sind ein Befund. Für DL
   * und NW gibt es laut Seed gar keinen PreCheck.
   */
  mitPflicht: BefundGruppe[];
  ohnePflicht: BefundGruppe[];
}

/** (b) Wie oft ein Feld gefüllt ist und wie oft zusammen mit einem zweiten. */
export interface FeldPaar {
  feldId: string;
  vergleichFeldId: string;
  /** Vorgänge mit gefülltem `feldId`. */
  gefuellt: number;
  /** Davon zusätzlich mit gefülltem `vergleichFeldId`. */
  auchVergleich: number;
  beispieleNurFeld: string[];
}

/** (c) Wer eine Regel verdeckt, die zutrifft, aber nicht gewinnt. */
export interface VerdeckungsBefund {
  regelId: string;
  /** Vorgänge, bei denen die Regel zutrifft (Sieger ∪ weitereTreffer). */
  trifftZu: number;
  gewinnt: number;
  /** Wer stattdessen gewinnt, häufigste zuerst. */
  verdeckerVon: BefundGruppe[];
  /**
   * Vorgänge, bei denen eine Sperre greift — sie zählen in KEINER der beiden
   * Zahlen mit. Das ist Absicht (Sperren sind keine Kaskadenfrage), muss aber
   * dastehen, sonst sucht jemand die Differenz.
   */
  unterSperre: number;
}

export interface TerminBefunde {
  /** Ausgewertete Vorgänge — ohne sie ist keine Zahl darunter einzuordnen. */
  gesamt: number;
  precheck: PrecheckLuecke;
  feldpaare: FeldPaar[];
  verdeckung: VerdeckungsBefund;
}

/** Trägt der Vorgang zu diesem Feld einen Wert? Leere erzeugen kein Vorkommen. */
function hatFeld(vorkommen: readonly FeldVorkommen[], feldId: string): boolean {
  return vorkommen.some(v => v.feld.feldId === feldId && v.wert.trim() !== '');
}

/** Beispiel anhängen, solange Platz ist. */
function merke(liste: string[], aktenzeichen: string): void {
  if (liste.length < BEISPIELE_MAX) liste.push(aktenzeichen);
}

/** Zähler + Beispiele je Schlüssel, in eine sortierte Gruppenliste. */
class Sammler {
  private readonly proSchluessel = new Map<string, { label: string; anzahl: number; beispiele: string[] }>();

  add(schluessel: string, label: string, aktenzeichen: string): void {
    const g = this.proSchluessel.get(schluessel);
    if (g) { g.anzahl += 1; merke(g.beispiele, aktenzeichen); } else {
      this.proSchluessel.set(schluessel, { label, anzahl: 1, beispiele: [aktenzeichen] });
    }
  }

  /** Häufigste zuerst; bei Gleichstand alphabetisch — dieselbe Eingabe, dieselbe Ausgabe. */
  gruppen(): BefundGruppe[] {
    return [...this.proSchluessel.entries()]
      .map(([schluessel, g]) => ({ schluessel, ...g }))
      .sort((a, b) => b.anzahl - a.anzahl || a.schluessel.localeCompare(b.schluessel, 'de'));
  }
}

/** Fördervarianten mit PreCheck (FuE = 3, DS = 5) — siehe `todo-regeln.seed.ts`. */
const MIT_PRECHECK_BUCKETS: readonly AntragstypBucket[] = ['FuE', 'DS'];

/**
 * Rechnet die drei Blöcke in EINEM Durchgang über die bereits bewerteten Fälle.
 * Rein; dieselbe Eingabe liefert dieselbe Ausgabe.
 *
 * @param statusCode Der Code, dessen PreCheck-Lücke gemessen wird (34).
 * @param precheckFelder Die Feld-Ids, deren Fehlen die Lücke ausmacht (`D_PC+`,
 *   `D_XPC+`) — vom Aufrufer über `todoFeld()` aufgelöst, nie als Literal
 *   (Pitfall #44).
 * @param paare Feld-Paare für Block (b), ebenfalls aufgelöst.
 * @param regelId Die Regel, deren Verdecker gesucht werden (`r8`).
 */
export function erhebeTerminBefunde(
  faelle: Iterable<TerminFall>,
  opts: {
    statusCode: number;
    precheckFelder: readonly string[];
    paare: readonly { feldId: string; vergleichFeldId: string }[];
    regelId: string;
  },
): TerminBefunde {
  const mitPflicht = new Sammler();
  const ohnePflicht = new Sammler();
  const verdecker = new Sammler();
  const paarZaehler = opts.paare.map(p => ({
    ...p, gefuellt: 0, auchVergleich: 0, beispieleNurFeld: [] as string[],
  }));

  let gesamt = 0;
  let auf34 = 0;
  let ohneVermerk = 0;
  let trifftZu = 0;
  let gewinnt = 0;
  let unterSperre = 0;

  for (const f of faelle) {
    gesamt += 1;

    // --- (a) PreCheck-Lücke -------------------------------------------------
    if (findeStatusCode(f.statusRoh)?.eintrag.code === opts.statusCode) {
      auf34 += 1;
      if (!opts.precheckFelder.some(id => hatFeld(f.vorkommen, id))) {
        ohneVermerk += 1;
        const bucket = getAntragstypBucket(f.vbPhaseRoh);
        const label = bucket ?? 'ohne Variante';
        if (bucket !== null && MIT_PRECHECK_BUCKETS.includes(bucket)) {
          mitPflicht.add(label, label, f.aktenzeichen);
        } else {
          ohnePflicht.add(label, label, f.aktenzeichen);
        }
      }
    }

    // --- (b) Feldpflege -----------------------------------------------------
    for (const p of paarZaehler) {
      if (!hatFeld(f.vorkommen, p.feldId)) continue;
      p.gefuellt += 1;
      if (hatFeld(f.vorkommen, p.vergleichFeldId)) p.auchVergleich += 1;
      else merke(p.beispieleNurFeld, f.aktenzeichen);
    }

    // --- (c) Verdeckung -----------------------------------------------------
    // Sieger ∪ weitereTreffer ist die Menge der zutreffenden Regeln: der
    // Treffer-Pass bricht beim Sieger nicht ab und schreibt ihn nie in
    // `weitereTreffer` (todo-engine.ts).
    if (f.ergebnis.gesperrtDurch.length > 0) unterSperre += 1;
    if (f.ergebnis.regelId === opts.regelId) {
      trifftZu += 1;
      gewinnt += 1;
    } else if (f.ergebnis.weitereTreffer.some(t => t.regelId === opts.regelId)) {
      trifftZu += 1;
      // `regelId` kann hier nicht null sein: wäre nichts getroffen worden, wäre
      // `weitereTreffer` leer.
      const sieger = f.ergebnis.regelId ?? '—';
      verdecker.add(sieger, f.ergebnis.beschreibung ?? sieger, f.aktenzeichen);
    }
  }

  return {
    gesamt,
    precheck: {
      auf34,
      ohneVermerk,
      mitPflicht: mitPflicht.gruppen(),
      ohnePflicht: ohnePflicht.gruppen(),
    },
    feldpaare: paarZaehler.map(p => ({
      feldId: p.feldId,
      vergleichFeldId: p.vergleichFeldId,
      gefuellt: p.gefuellt,
      auchVergleich: p.auchVergleich,
      beispieleNurFeld: p.beispieleNurFeld,
    })),
    verdeckung: {
      regelId: opts.regelId,
      trifftZu,
      gewinnt,
      verdeckerVon: verdecker.gruppen(),
      unterSperre,
    },
  };
}
