/**
 * Welcher Container gehört zu dem Schlüssel in der Adresse?
 *
 * Die Detailseite rendert immer einen Verbund-Container — auch für einen
 * Standalone-Antrag (dann als Pseudo-Verbund mit einem TV). Die Route trägt aber
 * je nach Aufrufer ein Aktenzeichen (`/antraege/16DS260261`) oder eine
 * Verbund-Nummer (`/antraege/verbund/ZDS26026`). Diese Ableitung entscheidet aus
 * der schon geladenen Listen-Projektion, was zu tun ist.
 *
 * Ihr dritter Zweig ist ein **Heilmittel**: landet eine Verbund-Nummer im
 * Aktenzeichen-Slot, wurde daraus bis v4.82 ein exakter IDB-Key-Get auf
 * `antraege` — der fand nichts, und der Nutzer sah „Antrag ZDS26026 nicht
 * gefunden." Ein Schlüssel, den die Liste als Verbund-Nummer kennt, ist keine
 * Sackgasse, sondern ein Verbund. Das rettet alte Lesezeichen und die
 * Browser-History; die Fehlermeldung bleibt für wirklich unbekannte Schlüssel.
 *
 * Rein und ohne Store-Import, damit die Ableitung ohne Rendering prüfbar ist.
 */
import { pseudoVerbundIdFor } from './pseudoVerbund';

/** Nur die zwei Felder, auf die die Ableitung schaut. */
export interface DetailKandidat {
  aktenzeichen: string;
  verbund_id?: string;
}

export interface DetailAuswahl {
  /** Container, den `VerbundDetail` lädt (echt oder Pseudo). */
  verbundId: string;
  /** TV, das aufgeklappt startet — falls die Adresse eines nennt. */
  expanded: string | undefined;
}

function nichtLeer(s: unknown): s is string {
  return typeof s === 'string' && s.length > 0;
}

interface Fund {
  /** Der Antrag, dessen Aktenzeichen der Schlüssel ist. */
  treffer: DetailKandidat | undefined;
  /** Mindestens ein Antrag führt den Schlüssel als seinen Verbund. */
  istVerbundNummer: boolean;
}

/**
 * EIN Durchlauf über die Projektion (~14k Einträge): beide Fragen zugleich —
 * ist der Schlüssel ein Aktenzeichen, oder ist er eine Verbund-Nummer?
 *
 * Der `break` beim Aktenzeichen-Treffer lässt `istVerbundNummer` womöglich auf
 * `false` stehen, obwohl später noch ein Verbund dieses Namens käme. Das ist
 * gewollt: ein exaktes Aktenzeichen gewinnt bei beiden Verbrauchern ohnehin.
 */
function sucheSchluessel(antraege: readonly DetailKandidat[], schluessel: string): Fund {
  let treffer: DetailKandidat | undefined;
  let istVerbundNummer = false;
  for (const a of antraege) {
    if (a.aktenzeichen === schluessel) { treffer = a; break; }
    if (!istVerbundNummer && a.verbund_id === schluessel) istVerbundNummer = true;
  }
  return { treffer, istVerbundNummer };
}

/** Was der Schlüssel bezeichnet — sofern die Liste ihn überhaupt kennt. */
export type SchluesselArt = 'antrag' | 'verbund' | 'unbekannt';

/**
 * Wofür steht dieser Schlüssel?
 *
 * Dieselbe Frage wie in {@link loeseDetailAuf}, nur ohne den Routen-Teil der
 * Antwort — der Assistent braucht sie, um dem Faktenblock die richtige Entität
 * zu geben. Bewusst hier und nicht dort nachgebaut: eine zweite Handtabelle
 * neben dieser Schleife drifte garantiert von ihr weg, und das Heilmittel unten
 * war schon einmal die Lehre eines Bugs.
 *
 * **Aktenzeichen zuerst.** Ein Schlüssel, den die Liste als Aktenzeichen kennt,
 * ist ein Antrag — auch wenn irgendwo eine Verbund-Nummer gleichen Namens
 * stünde. Sonst änderte sich Verhalten, das heute richtig ist.
 */
export function artDesSchluessels(
  antraege: readonly DetailKandidat[],
  schluessel: string,
): SchluesselArt {
  if (!nichtLeer(schluessel)) return 'unbekannt';
  const { treffer, istVerbundNummer } = sucheSchluessel(antraege, schluessel);
  if (treffer) return 'antrag';
  return istVerbundNummer ? 'verbund' : 'unbekannt';
}

export function loeseDetailAuf(
  antraege: readonly DetailKandidat[],
  selectedAz: string | null,
  selectedVerbundId: string | null,
): DetailAuswahl | null {
  if (nichtLeer(selectedVerbundId)) {
    return { verbundId: selectedVerbundId, expanded: selectedAz ?? undefined };
  }
  if (!nichtLeer(selectedAz)) return null;

  const { treffer, istVerbundNummer } = sucheSchluessel(antraege, selectedAz);

  if (treffer) {
    return nichtLeer(treffer.verbund_id)
      ? { verbundId: treffer.verbund_id, expanded: selectedAz }
      : { verbundId: pseudoVerbundIdFor(selectedAz), expanded: selectedAz };
  }
  // Heilmittel (siehe Modulkopf): kein Antrag dieses Namens, aber Teilanträge,
  // die ihn als ihren Verbund führen. Kein `expanded` — der Schlüssel benennt
  // den Verbund, nicht eines seiner Teilvorhaben.
  if (istVerbundNummer) return { verbundId: selectedAz, expanded: undefined };

  // Unbekannt: bleibt der Pseudo-Verbund. Die Detailseite versucht den IDB-Get
  // (die Projektion kann hinter dem Voll-Store liegen) und sagt sonst, dass es
  // diesen Antrag nicht gibt.
  return { verbundId: pseudoVerbundIdFor(selectedAz), expanded: selectedAz };
}
