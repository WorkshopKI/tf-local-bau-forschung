/**
 * Die **kanonischen Felder** des Katalogs — die App-eigenen Projektionen
 * (`status`, `verbund_status`, `vb_phase`) und die vier Datumsfelder, die
 * app-weit auf einen kanonischen Key gemappt sind.
 *
 * Eigene Datei, weil zwei sehr verschiedene Stellen sie brauchen: der
 * Auslieferungs-Seed (`seed.ts`) baut daraus die Fassung, und der
 * To-do-Regelsatz (`todo-regeln.seed.ts`) muss wissen, wie ein Kürzel im Katalog
 * HEISST. Lägen sie weiter in `seed.ts`, importierte der Seed die Regeln und die
 * Regeln den Seed — ein Laufzeit-Zyklus.
 *
 * `ebene`/`quelleKey` steuern, aus welchem Record (Verbund vs. Antrag) und unter
 * welchem Key gelesen wird — insb. `verbund_status`, das der Verbund-Record
 * unter `status` führt (`VB_FIELD_MAP` im Merger).
 *
 * Die Datumsfelder tragen zusätzlich ihren `code` aus dem Fachsystem: die
 * Spalten `D_AAE`/`D_AZ1_1`/`D_ABB`/`D_VBE` sind app-weit auf kanonische Felder
 * gemappt (`CANONICAL_FIELD_NAME_ALIASES`). Genau deshalb fehlen diese Codes im
 * Code-Katalog — sonst stünden zwei Katalog-Einträge auf derselben Spalte und
 * jedes Ereignis zählte doppelt (siehe {@link KANONISCHE_CODE_FELDER}).
 */
import type { StatusFeldEintrag } from './typen';

export const KANONISCHE_FELDER: readonly StatusFeldEintrag[] = [
  // `rollen: []` = neutral, also unter jeder Rollenwahl sichtbar. Die drei
  // Wert-Felder sind unsere eigenen Projektionen und gehören niemandem; bei den
  // Datumsfeldern steht die Rolle in der Kürzel-Zuarbeit (AAE=PA, ABB=QS,
  // AZ1/VBE=neutral).
  { feldId: 'status', label: 'TV-Status', typ: 'wert', ebene: 'tv', kategorieId: 'tv.antragsbearbeitung', rollen: [], prominenzDefault: 'normal', aktiv: true, unkuratiert: false },
  { feldId: 'verbund_status', label: 'Verbund-Status', typ: 'wert', ebene: 'verbund', quelleKey: 'status', herkunft: 'verbund-record', kategorieId: 'vb.antragsbearbeitung', rollen: [], prominenzDefault: 'normal', aktiv: true, unkuratiert: false },
  { feldId: 'vb_phase', label: 'Verbund-Phase (Fördervariante)', typ: 'wert', ebene: 'tv', kategorieId: 'tv.antragsbearbeitung', rollen: [], prominenzDefault: 'nebensaechlich', aktiv: true, unkuratiert: false },
  { feldId: 'antragsdatum', label: 'Antragseingang', typ: 'datum', ebene: 'tv', code: 'AAE', kategorieId: 'tv.antragsbearbeitung', rollen: ['pa'], zahPhaseId: 'eingang', prominenzDefault: 'meilenstein', aktiv: true, unkuratiert: false },
  { feldId: 'erstentscheidung', label: 'Vorläufige Erstentscheidung', typ: 'datum', ebene: 'tv', code: 'AZ1', kategorieId: 'tv.antragsbearbeitung', rollen: [], zahPhaseId: 'entscheidung', prominenzDefault: 'meilenstein', aktiv: true, unkuratiert: false },
  { feldId: 'bewilligung_datum', label: 'Bewilligung', typ: 'datum', ebene: 'tv', code: 'ABB', kategorieId: 'tv.antragsbearbeitung', rollen: ['qs'], zahPhaseId: 'begleitung', prominenzDefault: 'meilenstein', aktiv: true, unkuratiert: false },
  { feldId: 'vn_eingang_datum', label: 'VN-Eingang (Begleitphase)', typ: 'datum', ebene: 'tv', code: 'VBE', kategorieId: 'tv.verwendungsnachweis', rollen: [], zahPhaseId: 'begleitung', prominenzDefault: 'normal', aktiv: true, unkuratiert: false },
];

/**
 * Code → feldId des kanonischen Feldes, das ihn führt (`AAE` → `antragsdatum`).
 *
 * Die eine Wahrheit darüber, welcher Code **nicht** als eigenes `D_`-Feld in
 * einen Katalog gehört. Wer diese Liste umgeht, erzeugt zwei Felder für
 * dasselbe Ereignis: eines mit dem Wert (das kanonische, weil es die
 * Kollisionsregel der Feld-Auflösung gewinnt) und eines mit dem Code (das nie
 * einen Wert trägt). Alles, was am Code hängt — Navigator, Wächter, Relevanz,
 * To-do-Regeln — bekommt dann für dieses Ereignis dauerhaft „nicht gesetzt" zur
 * Antwort.
 */
export const KANONISCHE_CODE_FELDER: ReadonlyMap<string, string> = new Map(
  KANONISCHE_FELDER.filter(f => f.code !== undefined).map(f => [f.code!, f.feldId]),
);
