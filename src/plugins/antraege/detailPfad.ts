/**
 * Der Weg zur Antrags-Detailseite — an EINER Stelle gebaut.
 *
 * Die Detailseite hat zwei Routen, und welche gilt, hängt an einer Bedingung:
 * `/antraege/verbund/<verbund_id>` für einen Verbund, `/antraege/<aktenzeichen>`
 * für ein einzelnes Teilvorhaben. Sechs Aufrufer bauten diese Entscheidung von
 * Hand nach — einer davon falsch: das Vorgangs-Board schickte die Verbund-Nummer
 * (`ZDS26026`) in den Aktenzeichen-Slot. Dort wird sie zum IDB-Primary-Key-Get
 * auf `antraege`, und weil es kein Aktenzeichen dieses Namens gibt, endete jeder
 * Klick in „Antrag ZDS26026 nicht gefunden." — ohne Rückweg.
 *
 * Ein Aufrufer muss also nicht mehr wissen, welche Route seine Daten treffen; er
 * gibt her, was er hat. Rein und ohne Router-Import, damit die Ableitung ohne
 * Rendering prüfbar ist.
 */
import { isPseudoVerbundId } from './pseudoVerbund';

/** Basis-Routen der Detailseite (auch der Rückweg-Fallback nutzt die erste). */
export const ANTRAEGE_ROUTE = '/antraege';
const VERBUND_ROUTE = '/antraege/verbund';

export interface DetailZiel {
  /** Verbund-Nummer, falls der Antrag zu einem Verbund gehört. */
  verbundId?: string | null;
  /** Aktenzeichen des Teilvorhabens. */
  aktenzeichen?: string | null;
  /** Sprung-Anker auf der Detailseite (`?ziel=meilensteine`). */
  ziel?: string;
}

/**
 * Der Pfad zur Detailseite.
 *
 * Ein Pseudo-Verbund (`__pseudo__…`) ist KEIN Verbund, sondern die synthetische
 * Hülle um einen Standalone-Antrag — er gehört nie in die Verbund-Route. Fehlen
 * beide Schlüssel, bleibt die Liste das ehrlichste Ziel.
 */
export function antragDetailPfad({ verbundId, aktenzeichen, ziel }: DetailZiel): string {
  const anker = ziel ? `?ziel=${encodeURIComponent(ziel)}` : '';
  if (typeof verbundId === 'string' && verbundId.length > 0 && !isPseudoVerbundId(verbundId)) {
    return `${VERBUND_ROUTE}/${encodeURIComponent(verbundId)}${anker}`;
  }
  if (typeof aktenzeichen === 'string' && aktenzeichen.length > 0) {
    return `${ANTRAEGE_ROUTE}/${encodeURIComponent(aktenzeichen)}${anker}`;
  }
  return ANTRAEGE_ROUTE;
}
