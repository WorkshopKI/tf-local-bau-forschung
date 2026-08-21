/**
 * **Welchen Klartext trägt eine Journal-Spalte — und gilt er für DIESEN Antrag?**
 *
 * Das Journal führt die ROHE Exportspalte (`D_AB`, `STATUS_VB`). Wer daraus eine
 * Bezeichnung machen will, stolpert über zwei Dinge, die beide gemessen sind:
 *
 * **1. Nicht jede Spalte steht als `feldId` im Katalog.** Am echten Bestand
 * (260 journalfähige Spalten, Fassung 25) trafen 257 direkt — und drei nicht:
 * `D_AAE`, `D_ABB` und `D_AZ1_1`. Sie sind app-weit auf **kanonische** Felder
 * gemappt (`CANONICAL_FIELD_NAME_ALIASES`) und fehlen deshalb bewusst im
 * Code-Katalog, sonst stünden zwei Einträge auf derselben Spalte
 * (`KANONISCHE_CODE_FELDER`). Sie über `code` bzw. den Alias zu suchen ist kein
 * Namens-Kniff, sondern der Weg, den die App ohnehin geht.
 *
 * **2. Dieselbe Abkürzung bedeutet je Projektform etwas anderes.** `AB` heißt in
 * DL „Bewilligungsempfehlung durch Haushaltsbeauftragte", in FuE/NW/EP
 * „bewilligungsreif/Akte an Euronorm" — 58 der 509 Codes gehen so auseinander.
 * Nachgeschlagen wird deshalb über `kuerzelAuskunft(code, form)` und nicht flach
 * (Guard `kuerzel-nie-flach`); darüber legt `ueberlagereKuration` den Wortlaut
 * der Fassung, damit dieselbe Seite nicht zwei Namen für dasselbe Kürzel zeigt
 * (Guard `kuerzel-text-folgt-der-kuration`).
 *
 * Rein: keine IO, keine Uhr. Der Aufrufer baut die Auflösung EINMAL aus der
 * aktiven Fassung und reicht sie durch.
 */
import { CANONICAL_FIELD_NAME_ALIASES } from '@/core/services/csv/constants';
import {
  kuerzelAuskunft, kuerzelIndex, nachschlageformVonVbPhase, ueberlagereKuration,
  type KuerzelIndex,
} from '@/core/status';
import { normKey } from '@/core/status/normalisierung';
import type { StatusFeldEintrag } from '@/core/status/typen';

/**
 * Die beiden Status-Spalten tragen kein `D_` und keinen Kürzel-Code; ihre
 * kanonischen Gegenstücke stehen im Katalog. Zwei Zeilen statt einer Handtabelle
 * mit Klartexten — die stünden sonst neben denen des Katalogs und liefen
 * auseinander.
 */
const KANONISCHE_SPALTEN: Readonly<Record<string, string>> = {
  STATUS_TV: 'status',
  STATUS_VB: 'verbund_status',
};

/** Nachschlage-Indizes einer Fassung, einmal gebaut. */
export interface SpaltenAufloesung {
  nachFeldId: ReadonlyMap<string, StatusFeldEintrag>;
  nachCode: KuerzelIndex;
}

export function baueSpaltenAufloesung(
  felder: readonly StatusFeldEintrag[],
): SpaltenAufloesung {
  const nachFeldId = new Map<string, StatusFeldEintrag>();
  for (const f of felder) if (!nachFeldId.has(f.feldId)) nachFeldId.set(f.feldId, f);
  return { nachFeldId, nachCode: kuerzelIndex(felder) };
}

/**
 * Das Katalog-Feld hinter einer Journal-Spalte — vier Wege, in dieser Reihenfolge:
 * kanonische Status-Spalte, `feldId`, Kürzel-Code, app-weiter Spalten-Alias.
 */
export function feldFuerSpalte(
  aufloesung: SpaltenAufloesung, spalte: string,
): StatusFeldEintrag | undefined {
  const roh = spalte.normalize('NFC').trim();
  const gross = roh.toUpperCase();

  const kanonisch = KANONISCHE_SPALTEN[gross];
  if (kanonisch) {
    const treffer = aufloesung.nachFeldId.get(kanonisch);
    if (treffer) return treffer;
  }

  const direkt = aufloesung.nachFeldId.get(roh);
  if (direkt) return direkt;

  if (gross.startsWith('D_')) {
    const perCode = aufloesung.nachCode.get(normKey(roh.slice(2)));
    if (perCode) return perCode;
  }

  const alias = CANONICAL_FIELD_NAME_ALIASES[normKey(roh)];
  return alias ? aufloesung.nachFeldId.get(alias) : undefined;
}

/** Was über eine Journal-Spalte gesagt werden kann. */
export interface SpaltenAuskunft {
  /** Klartext; `null` = weder Fassung noch Katalog kennen die Spalte. */
  bezeichnung: string | null;
  /**
   * Gilt die Bezeichnung sicher für diesen Antrag? `false` heißt: die
   * Projektform ist unbekannt UND die Formen sagen Verschiedenes — die Anzeige
   * schreibt das dazu, statt eine der Bedeutungen als die richtige auszugeben.
   */
  eindeutig: boolean;
}

/**
 * Klartext einer Journal-Spalte für einen Antrag.
 *
 * `vbPhase` ist Pflicht — auch als `undefined`, denn „ich kenne die Projektform
 * nicht" ist eine andere Frage als „egal". Ohne Kürzel-Code (die beiden
 * Status-Spalten) bleibt es beim Label der Fassung: eine Projektform-Bedeutung
 * gibt es dort nicht.
 */
export function spaltenAuskunft(
  aufloesung: SpaltenAufloesung, spalte: string, vbPhase: unknown,
): SpaltenAuskunft {
  const feld = feldFuerSpalte(aufloesung, spalte);
  const code = feld?.code ?? (spalte.toUpperCase().startsWith('D_') ? spalte.slice(2) : undefined);
  if (code === undefined) {
    return { bezeichnung: feld?.label.trim() || null, eindeutig: true };
  }
  const auskunft = ueberlagereKuration(
    kuerzelAuskunft(code, nachschlageformVonVbPhase(vbPhase)), feld?.label,
  );
  return {
    bezeichnung: auskunft.bezeichnung ?? (feld?.label.trim() || null),
    // Ohne Katalog-Treffer trägt das Label der Fassung die Auskunft — die kennt
    // keine Projektform-Unterschiede und behauptet auch keine.
    eindeutig: auskunft.bezeichnung === null ? true : auskunft.eindeutig,
  };
}
