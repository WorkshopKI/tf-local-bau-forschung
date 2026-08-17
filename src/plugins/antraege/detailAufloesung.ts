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

export function loeseDetailAuf(
  antraege: readonly DetailKandidat[],
  selectedAz: string | null,
  selectedVerbundId: string | null,
): DetailAuswahl | null {
  if (nichtLeer(selectedVerbundId)) {
    return { verbundId: selectedVerbundId, expanded: selectedAz ?? undefined };
  }
  if (!nichtLeer(selectedAz)) return null;

  // EIN Durchlauf über die Projektion (~14k Einträge): beide Fragen zugleich —
  // ist der Schlüssel ein Aktenzeichen, oder ist er eine Verbund-Nummer?
  let treffer: DetailKandidat | undefined;
  let istVerbundNummer = false;
  for (const a of antraege) {
    if (a.aktenzeichen === selectedAz) { treffer = a; break; }
    if (!istVerbundNummer && a.verbund_id === selectedAz) istVerbundNummer = true;
  }

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
