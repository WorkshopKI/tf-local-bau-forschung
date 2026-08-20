/**
 * Datenmodell des **Kuratur-Pakets** — ein portables Bündel des GESAMTEN
 * kuratierten Standes (Skills + Regeln + Workflows + Textbausteine), um einen
 * Stand von einem Rechner auf einen anderen Daten-Share zu übertragen.
 *
 * Abgrenzung zu den Einzel-Bündeln (`skill-bundle.ts` / `workflow-bundle.ts`):
 * die tragen EINEN Skill bzw. EINEN Workflow und legen bei ID-Kollision bewusst
 * eine **Kopie** an (dort ist der Zweck „nimm diesen einen Prompt mit"). Das
 * Paket trägt den ganzen Stand und kann je Eintrag **aktualisieren** — sonst
 * entstünde beim Übertragen von 23 Skills ein Ziel voller Doubletten.
 *
 * Wie die Einzel-Bündel enthält es ausschließlich kuratierte Registry-Inhalte,
 * **nie** Antragsdaten (kein generierter Text, keine VB, kein FKZ).
 *
 * Transport ist eine Datei, die von Hand mitgenommen wird — auf dem Share
 * entsteht durch das Paket KEINE neue Datei.
 */
import type { QualitaetsRegel, SkillRecord, WorkflowDef } from '../registry/types';
import type { TextbausteinRecord } from '../textbausteine/types';

export const KURATUR_PAKET_KIND = 'teamflow-kuratur-paket';

/** Die vier Arten von Einträgen, die ein Paket trägt. */
export type PaketArt = 'skill' | 'regel' | 'workflow' | 'baustein';

/** Reihenfolge für Anzeige + Einspielen (Regeln VOR Skills: `regelIds` sollen auflösen). */
export const PAKET_ARTEN: readonly PaketArt[] = ['regel', 'skill', 'workflow', 'baustein'];

/** Zustand eines Paket-Eintrags gegenüber dem Ziel-Stand. */
export type PaketZustand = 'neu' | 'geaendert' | 'identisch';

/**
 * Was mit einem Eintrag geschehen soll.
 *  - `uebernehmen`   — im Ziel anlegen (nur bei `neu`)
 *  - `aktualisieren` — vorhandenen Eintrag fortschreiben (neue Fassung, alte bleibt in der Historie)
 *  - `kopie`         — als zusätzlichen Eintrag mit neuer ID anlegen (Bestands-Semantik der Einzel-Bündel)
 *  - `ueberspringen` — nichts tun
 */
export type Entscheidung = 'uebernehmen' | 'aktualisieren' | 'kopie' | 'ueberspringen';

/** Inhalt einer `kuratur-paket-*.json`. */
export interface KuraturPaket {
  kind: typeof KURATUR_PAKET_KIND;
  version: 1;
  /** ISO-Zeitstempel des Schnürens (reine Information). */
  erstellt_am: string;
  /** Woher das Paket stammt, z.B. der Build-Label („ZAH local") — reine Information. */
  quelle?: string;
  /** Skills OHNE Versions-Historie (das Ziel führt seine eigene fort). */
  skills: SkillRecord[];
  regeln: QualitaetsRegel[];
  workflows: WorkflowDef[];
  /** Textbausteine OHNE Historie. Leer, wenn der Katalog nicht mitgenommen wurde. */
  bausteine: TextbausteinRecord[];
}

/** Welche Gruppen beim Schnüren mitgenommen werden. */
export interface PaketAuswahl {
  skills: boolean;
  regeln: boolean;
  workflows: boolean;
  bausteine: boolean;
}

/** Eine Zeile der Import-Vorschau: was ist es, wie steht es zum Ziel, was ist vorgeschlagen. */
export interface PaketZeile {
  art: PaketArt;
  id: string;
  /** Anzeigename (Skill/Regel/Workflow-Name bzw. Baustein-Thema). */
  name: string;
  zustand: PaketZustand;
  /** Vorbelegte Entscheidung (der Nutzer darf sie ändern). */
  vorschlag: Entscheidung;
  /** Alle für diese Zeile zulässigen Entscheidungen (inkl. `vorschlag`). */
  moeglich: Entscheidung[];
  /** Fassung im Paket (Regeln haben keine → `undefined`). */
  paketVersion?: number;
  /** Fassung im Ziel, falls dort vorhanden. */
  zielVersion?: number;
}

/** Entscheidungen je Zeile, gekeyt über `zeilenSchluessel`. */
export type Entscheidungen = Record<string, Entscheidung>;

/** Stabiler Schlüssel einer Zeile (`art` + `id` — IDs sind nur je Art eindeutig). */
export function zeilenSchluessel(art: PaketArt, id: string): string {
  return `${art}:${id}`;
}

/** Zählwerk einer Art. */
export interface ArtZaehler {
  neu: number;
  aktualisiert: number;
  kopiert: number;
  uebersprungen: number;
}

/** Was das Einspielen getan hat — Grundlage der Ergebnis-Meldung. */
export interface EinspielBericht {
  proArt: Record<PaketArt, ArtZaehler>;
  gesamt: ArtZaehler;
  /**
   * Schritte, die beim Aktualisieren von Workflows entfallen sind (im Ziel
   * vorhanden, im Paket nicht mehr). Sichtbar machen statt still schlucken.
   */
  entfalleneSchritte: number;
  /** Bausteine, deren Freigabe-Status sich durch den Import ändert. */
  statuswechsel: number;
  /** True, wenn die Registry geschrieben werden muss (sonst: kein Write nötig). */
  registryGeaendert: boolean;
  /** True, wenn der Textbaustein-Katalog geschrieben werden muss. */
  katalogGeaendert: boolean;
}

/** Wer/wann — plus die injizierte ID-Quelle (das Modul bleibt rein). */
export interface EinspielKontext {
  /** ISO-Zeitstempel des Vorgangs. */
  zeitpunkt: string;
  /** Bearbeiter-Kürzel (`useMeinKuerzel`, Pitfall #27) — optional. */
  userId?: string;
  /** Begründung, die in die Fassungs-Historie geschrieben wird. */
  begruendung?: string;
  newId: () => string;
}

export function leererZaehler(): ArtZaehler {
  return { neu: 0, aktualisiert: 0, kopiert: 0, uebersprungen: 0 };
}
