/**
 * Die ZAH-Phasen: kuratierbare Verfahrensschritte, ihr Auslieferungs-Stand und
 * das Register, aus dem die App den gerade geltenden Schnitt liest.
 *
 * **Warum es diese Achse gibt**: das Fachsystem kennt keine Phasen. Es kennt
 * Status-Codes (11 Skizze … 99 Schlussvermerk) und ist damit fertig. Die Phase
 * ist die Lesebrille der App — Gruppierung, Filter, Sortierung — und wird
 * deshalb ehrlich als App-Erfindung benannt statt als amtlicher Zustand
 * ausgegeben. `VB_PHASE` heißt trotz des Namens etwas ganz anderes: die
 * Fördervariante (`vb-phase-mappings.ts`).
 *
 * **Warum eine Tabelle statt einer Code-Bereichs-Regel**: die Codes sind nur
 * grob geordnet. 32 (ablehnungsreif) liegt vor 34 (bearbeitungsreif), 50/51
 * (Bewilligungsentwurf/-reif) vor 59 (bewilligt), aber 70–75 (Ablehnung,
 * Rücknahmeempfehlung, Widerspruch) gehören wieder zur Entscheidung. Jede
 * Bereichsregel bräuchte mehr Ausnahmen als Regeln.
 *
 * **Phase ≠ Rolle.** Neben der fachlichen Prüfung (FB) läuft die administrative
 * (AB) — parallel, nicht nacheinander; der Kürzel-Katalog zeigt es an seinen
 * durchgehenden Paaren (AK4/AT4, ARK/ART, ABLK/ABLT). Eine Phase
 * „Administrative Prüfung" neben „Fachprüfung" wäre falsch modelliert: ein TV
 * wäre ständig in beiden. Die Phase sagt WO im Verfahren, die Rolle WER dran ist.
 *
 * **Der Schnitt wird in der App kuratiert** (seit v2.409). Ein früherer Modulkopf
 * verbot das: `prod` lädt keine Katalog-Fassung, ein in `pl` geänderter Schnitt
 * wäre eine zweite stille Wahrheit. Der Einwand gilt weiter — er wiegt nur
 * leichter als der Grund dagegen: die Abstimmung mit AB und FB hat ergeben, dass
 * der Zuschnitt strittig ist und mehrfach geändert wird, und ein Release je
 * Iteration ist dafür zu langsam. Aufgelöst wird der Widerspruch so:
 *
 * - `dev`, `pl`, `kurator`, `as` und `local` führen den kuratierten Schnitt
 *   (`statusCockpit` an); nur `prod` läuft auf dem Seed unten und verhält sich
 *   damit **exakt wie zuvor**. Dorthin kommt ein neuer Schnitt über den nächsten
 *   Release.
 * - Die Seite „Zu klären" bleibt, was sie war: das Werkzeug, mit dem der Schnitt
 *   im Team besprochen wird (`docs/architecture/klaerung.md`). Sie ist der Weg
 *   zum Konsens, der Baum-Editor der Weg zur Wirkung.
 *
 * **Das Register unten hat genau EINEN Schreibweg**: `snapshot.ts`, an derselben
 * Stelle, an der auch die Kategorien-Map gesetzt wird (Konventionstest
 * `zah-phasen-snapshot-single-writer`). Ohne gesetzten Snapshot — früher Boot,
 * `prod`, Tests — liefern alle Leser den Seed, nie eine leere Liste.
 *
 * Rein und deterministisch: keine IO, keine Uhr.
 */
import type { GeltendeZahPhase, ZahPhase, ZahPhaseId } from './typen';

/**
 * Der ausgelieferte Phasen-Schnitt. Bildet den Stand vor der Kuratierbarkeit
 * exakt ab: `zieltageRelevant` war die Menge `ZIELTAGE_PHASEN` (Eingang bis
 * Entscheidung).
 *
 * **Eine Phase sagt nichts mehr über die Arbeitsliste** (seit v4.87). Sie trug
 * dafür bis v4.86 ein Feld `kategorieVorgabe`; damit steuerte der bewegliche
 * Schnitt die feste Achse, und ein Umhängen verschob Anträge zwischen Reitern
 * (v3.25: 448 Stück, unbemerkt). Die Arbeitsliste hängt jetzt am Code
 * (`CODE_ZU_ARBEITSLISTE` in `kategorie-ableitung.ts`); was die Phase trägt,
 * steht unten und wirkt auf Anzeige, Zieltage und Fristlauf.
 *
 * Zehnerlücken in `reihenfolge` für spätere Einschübe. Die Ids sind **stabil und
 * opak** — eine eingeschobene Phase ändert keine bestehende Id, und der Nutzer
 * sieht 1…n als Anzeige aus der Reihenfolge, nie als Schlüssel.
 *
 * `begleitung` → `begleitung` und nicht `bewilligt`: nach der Bewilligung läuft
 * die VN-/ZB-Prüfung, und die hat eine andere Zuständigkeit (ZTP/PFM statt
 * TIB/BIB) — genau dafür gibt es die Kategorie.
 *
 * **`fristLaeuft` bildet die Auslieferung NICHT ab** — es ist die eine Stelle,
 * an der v3.6 das Verhalten ändert. Das Vorgangs-Board zählte `entscheidung`
 * bisher als laufend; die Antragsfrist misst aber die Bearbeitung bis zur
 * Entscheidung, und danach läuft sie ins Leere. Zwischen Bewilligung und
 * Verwendungsnachweis läuft ohnehin keine.
 */
export const SEED_ZAH_PHASEN: readonly GeltendeZahPhase[] = [
  {
    id: 'eingang', reihenfolge: 10, label: 'Eingang',
    zieltageRelevant: true, fristLaeuft: true,
  },
  {
    // Im Auftrag zur Stoppuhr nicht belegt (er kannte fünf Phasen, es sind
    // sechs). `true`, weil sie zur Antragsphase gehört: Nachforderung und
    // Vollständigkeitsprüfung sind laufende Bearbeitung.
    id: 'vollstaendigkeit', reihenfolge: 20, label: 'Vollständigkeit',
    zieltageRelevant: true, fristLaeuft: true,
  },
  {
    // „Prüfung" heißt bewusst nicht „Fachprüfung": sie umfasst den fachlichen
    // UND den administrativen Strang (siehe Modulkopf).
    id: 'pruefung', reihenfolge: 30, label: 'Prüfung',
    zieltageRelevant: true, fristLaeuft: true,
  },
  {
    // Offener Punkt der Fachabstimmung: die Phase bündelt „bewilligungsreif"
    // (wartet auf uns) mit „Ablehnung"/„Widerruf" (Entscheidung gefallen).
    // Angehalten gilt für beide. Wer sie trennen will, teilt die Phase — genau
    // dafür ist der Schnitt kuratierbar.
    id: 'entscheidung', reihenfolge: 40, label: 'Entscheidung',
    zieltageRelevant: true, fristLaeuft: false,
  },
  {
    // `false` heißt hier nicht „keine Frist": die Begleitphase hat ihre eigene
    // (VN-Eingang + 6 Monate), und die rechnet `berechneFrist` getrennt.
    id: 'begleitung', reihenfolge: 50, label: 'Begleitung',
    zieltageRelevant: false, fristLaeuft: false,
  },
  {
    id: 'abgeschlossen', reihenfolge: 60, label: 'Abgeschlossen',
    zieltageRelevant: false, fristLaeuft: false,
  },
];

/** Beschriftung der Marker-Gruppe (Status ohne Phase). */
export const ZAH_MARKER_LABEL = 'Marker (ohne Phase)';

/**
 * Anzeige-Reihenfolge der AUSGELIEFERTEN Phasen.
 *
 * @deprecated Nur noch Seed-Baustein. Wer den geltenden Schnitt braucht, nimmt
 * `zahPhasenVon()` — sonst steht die Stelle dauerhaft auf der Auslieferung,
 * während der Rest der App die kuratierte Fassung zeigt.
 */
export const ZAH_PHASEN_REIHENFOLGE: readonly ZahPhaseId[] = SEED_ZAH_PHASEN.map(p => p.id);

/**
 * Beschriftungen der AUSGELIEFERTEN Phasen.
 *
 * @deprecated Nur noch Seed-Baustein — siehe {@link ZAH_PHASEN_REIHENFOLGE}.
 * Für eine Beschriftung `zahPhaseLabel(id)`.
 */
export const ZAH_PHASE_LABEL: Readonly<Record<ZahPhaseId, string>> =
  Object.fromEntries(SEED_ZAH_PHASEN.map(p => [p.id, p.label]));

/**
 * Der ausgelieferte Phasen-Schnitt: Status-Code → ZAH-Phase.
 *
 * Codes, die hier fehlen, sind **Marker** (29 Irrläufer, 88 Sonderstatus, 93
 * assoziierter Partner, 94 internationaler Partner): sie laufen als Kennzeichen
 * neben dem Verfahren mit und bekommen bewusst keine Phase.
 */
export const SEED_CODE_ZU_ZAH_PHASE: ReadonlyMap<number, ZahPhaseId> = new Map<number, ZahPhaseId>([
  [11, 'eingang'],
  [31, 'eingang'],

  [33, 'vollstaendigkeit'],
  [34, 'vollstaendigkeit'],
  [35, 'vollstaendigkeit'],
  [36, 'vollstaendigkeit'],
  [37, 'vollstaendigkeit'],

  [38, 'pruefung'],
  [39, 'pruefung'],
  [40, 'pruefung'],

  [32, 'entscheidung'],
  [50, 'entscheidung'],
  [51, 'entscheidung'],
  [70, 'entscheidung'],
  [71, 'entscheidung'],
  [72, 'entscheidung'],
  [75, 'entscheidung'],

  [59, 'begleitung'],
  [89, 'begleitung'],
  [92, 'begleitung'],
  [95, 'begleitung'],
  [97, 'begleitung'],

  [73, 'abgeschlossen'],
  [90, 'abgeschlossen'],
  [91, 'abgeschlossen'],
  [99, 'abgeschlossen'],
]);

/** Marker-Codes: bewusst ohne Phase, nicht „vergessen". */
export const SEED_MARKER_CODES: ReadonlySet<number> = new Set([29, 88, 93, 94]);

/**
 * Code → Phase plus Marker-Menge, wie eine Fassung sie führt. Wird
 * hereingereicht statt importiert, wo eine Fassung den Seed überschreiben kann.
 */
export interface PhasenSchnitt {
  codeZuPhase: ReadonlyMap<number, ZahPhaseId>;
  markerCodes: ReadonlySet<number>;
}

/** Der ausgelieferte Schnitt als {@link PhasenSchnitt}. */
export const SEED_PHASEN_SCHNITT: PhasenSchnitt = {
  codeZuPhase: SEED_CODE_ZU_ZAH_PHASE,
  markerCodes: SEED_MARKER_CODES,
};

// --- Register: welcher Schnitt gilt gerade? ---------------------------------

let phasenSnapshot: readonly GeltendeZahPhase[] | null = null;
let schnittSnapshot: PhasenSchnitt | null = null;
let generation = 0;

/**
 * Setzt (oder löscht mit `null`) die geltende Phasen-Tabelle.
 *
 * **Nur `snapshot.ts` ruft das.** Ein zweiter Schreibweg wäre eine zweite
 * Wahrheit über denselben Schnitt — und weil das Register Modul-global ist,
 * eine, die je nach Import-Reihenfolge gewinnt. Tests nehmen
 * {@link resetZahPhasenSnapshotFuerTests}.
 */
export function setZahPhasenSnapshot(phasen: readonly ZahPhase[] | null | undefined): void {
  phasenSnapshot = phasen && phasen.length > 0 ? normalisiere(phasen) : null;
  generation++;
}

/** Setzt (oder löscht mit `null`) den geltenden Code→Phase-Schnitt. Siehe oben. */
export function setCodePhasenSnapshot(schnitt: PhasenSchnitt | null): void {
  schnittSnapshot = schnitt;
  generation++;
}

/**
 * Zählt bei jedem Setzen hoch. Verbraucher, die ihre Ableitung merken
 * (`useMemo`), hängen sie hieran — sonst zeigt eine Komponente nach dem
 * Umhängen im Baum-Editor weiter ihren Stand vom Mounten, obwohl die Daten
 * längst stimmen.
 */
export function zahPhasenGeneration(): number {
  return generation;
}

/** Räumt beide Register. Der EINZIGE weitere Schreibweg — nur für Tests. */
export function resetZahPhasenSnapshotFuerTests(): void {
  phasenSnapshot = null;
  schnittSnapshot = null;
  generation++;
}

/**
 * Ergänzt fehlende Felder aus dem Seed und sortiert nach `reihenfolge`.
 *
 * Bestandsfassungen tragen nur `{id, label, reihenfolge}` — `zieltageRelevant`
 * kam bis v2.409 aus dem Code. Es hier zu ergänzen spart die Migration: eine
 * alte Fassung verhält sich weiter wie zuvor, und eine im Editor gespeicherte
 * trägt die Felder ab dann selbst.
 *
 * Eine Phase mit unbekannter Id und ohne Angaben bekommt `zieltageRelevant:
 * false` — „wir wissen es nicht" statt einer geratenen Frist.
 *
 * `fristLaeuft` fällt dagegen auf `true` zurück, und zwar in dieselbe Richtung,
 * die das Vorgangs-Board schon fuhr („Phase unbekannt → altes Kriterium"): eine
 * laufende Uhr ist sichtbar und korrigierbar, eine stillschweigend angehaltene
 * nimmt Arbeit aus jeder Liste, ohne dass es jemand merkt.
 *
 * **Die Felder werden einzeln genannt, nicht gespreadet.** Eine Fassung vor
 * v4.87 trägt ein `kategorieVorgabe`, und ein Spread schleppte es durch jedes
 * Speichern weiter — ein totes Feld in der Datei, das beim nächsten Lesen wie
 * eine Angabe aussieht. Es fällt hier ersatzlos weg (Read-Time-Migration); ein
 * Reader gibt es ohnehin nicht mehr.
 */
function normalisiere(phasen: readonly ZahPhase[]): GeltendeZahPhase[] {
  const seed = new Map(SEED_ZAH_PHASEN.map(p => [p.id, p]));
  return [...phasen]
    .map(p => {
      const s = seed.get(p.id);
      return {
        id: p.id,
        label: p.label,
        reihenfolge: p.reihenfolge,
        zieltageRelevant: p.zieltageRelevant ?? s?.zieltageRelevant ?? false,
        fristLaeuft: p.fristLaeuft ?? s?.fristLaeuft ?? true,
      };
    })
    .sort((a, b) => a.reihenfolge - b.reihenfolge);
}

/**
 * Die geltenden Phasen in Anzeige-Reihenfolge: **ausdrücklich übergeben** schlägt
 * **Snapshot** schlägt **Seed**. Liefert nie eine leere Liste.
 *
 * Der Vorrang ist bewusst so herum: das Cockpit arbeitet am Entwurf und muss
 * dessen Phasen sehen, nicht die zuletzt veröffentlichten.
 */
export function zahPhasenVon(phasen?: readonly ZahPhase[]): readonly GeltendeZahPhase[] {
  if (phasen && phasen.length > 0) return normalisiere(phasen);
  return phasenSnapshot ?? SEED_ZAH_PHASEN;
}

/** Der geltende Code→Phase-Schnitt (Snapshot, sonst Auslieferung). */
export function geltenderSchnitt(): PhasenSchnitt {
  return schnittSnapshot ?? SEED_PHASEN_SCHNITT;
}

/** Phase eines Status-Codes nach dem geltenden Schnitt; `null` = Marker/unbekannt. */
export function phaseFuerCode(code: number): ZahPhaseId | null {
  return geltenderSchnitt().codeZuPhase.get(code) ?? null;
}

/** Läuft dieser Code als Kennzeichen neben dem Verfahren? */
export function istMarkerCode(code: number): boolean {
  return geltenderSchnitt().markerCodes.has(code);
}

/**
 * Sortier-Rang einer Phase für Gruppierungen. Marker (`null`/`undefined`) und
 * verwaiste Zuordnungen sinken ans Ende — sie stehen neben dem Verfahren, nicht
 * darin.
 */
export function zahPhaseRang(
  id: ZahPhaseId | null | undefined, phasen?: readonly ZahPhase[],
): number {
  if (!id) return Number.MAX_SAFE_INTEGER;
  return zahPhasenVon(phasen).find(p => p.id === id)?.reihenfolge ?? Number.MAX_SAFE_INTEGER;
}

/**
 * Beschriftung einer Phase. `null` und **verwaiste** Ids (die Fassung führt die
 * Phase nicht mehr) bekommen dieselbe Marker-Beschriftung: beides heißt für den
 * Leser „steht neben dem Verfahren". Gezählt werden die Verwaisten trotzdem —
 * `verwaisteZuordnungen` in `zah-phasen-edit.ts`.
 */
export function zahPhaseLabel(
  id: ZahPhaseId | null | undefined, phasen?: readonly ZahPhase[],
): string {
  if (!id) return ZAH_MARKER_LABEL;
  return zahPhasenVon(phasen).find(p => p.id === id)?.label ?? ZAH_MARKER_LABEL;
}

/**
 * Läuft in dieser Phase die Bearbeitungsfrist?
 *
 * `null`/`undefined` (Marker, kein Katalog-Treffer) und verwaiste Ids liefern
 * `true` — dieselbe Richtung wie {@link normalisiere}: nicht wissen heißt nicht
 * anhalten. Wer die Uhr anhalten will, sagt es im Katalog.
 */
export function fristLaeuftVon(
  id: ZahPhaseId | null | undefined, phasen?: readonly ZahPhase[],
): boolean {
  if (!id) return true;
  return zahPhasenVon(phasen).find(p => p.id === id)?.fristLaeuft ?? true;
}
