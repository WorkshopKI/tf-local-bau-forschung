/**
 * Anwenden eines Kuratur-Pakets auf den Ziel-Stand — rein (`zeitpunkt` und
 * `newId` werden hereingereicht, kein `Date.now()`, keine IO). Der Aufrufer
 * persistiert danach über die vorhandenen, self-gated Wege
 * (`writeSkillRegistry` / `writeTextbausteinKatalog`).
 *
 * Drei Invarianten tragen das Ganze:
 *
 * 1. **Aktualisieren verliert den Ziel-Stand nie.** Es entsteht eine neue
 *    Fassung (`version + 1`) und der bisherige Stand rückt in die Historie
 *    (`appendHistorie` / `mitFassung`). Wer ein Paket auf einen unbekannten
 *    Share spielt, kann jeden Eintrag über die Fassungsliste zurückholen.
 * 2. **Workflow-Schritt-IDs bleiben stabil.** `WorkflowRun.schritte` ist über
 *    `WorkflowStep.id` gekeyt — neue IDs würden laufende Gutachten verwaisen
 *    lassen. Beim Aktualisieren werden Schritte über `ankerKey` → `nr` →
 *    `label+skillId` zugeordnet und behalten die ID des Ziels.
 * 3. **Nichts wird überschrieben, was der Nutzer nicht gewählt hat.** Eine
 *    Entscheidung, die zum Zustand nicht passt (z.B. `uebernehmen` für einen
 *    vorhandenen Eintrag), fällt auf den sicheren Fall zurück statt zu raten.
 */
import { appendHistorie } from '../registry/versioning';
import { mitFassung } from '../textbausteine/versionierung';
import type {
  QualitaetsRegel, SkillRecord, SkillRegistryFile, WorkflowStep,
} from '../registry/types';
import type { TextbausteinKatalog, TextbausteinRecord } from '../textbausteine/types';
import {
  leererZaehler, zeilenSchluessel,
  type ArtZaehler, type EinspielBericht, type EinspielKontext, type Entscheidung,
  type Entscheidungen, type KuraturPaket, type PaketArt,
} from './typen';

/* -------------------------------------------------------------------------- */
/* Entscheidung je Eintrag                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Die tatsächlich ausgeführte Aktion. Passt die gewählte Entscheidung nicht zum
 * Zustand, wird konservativ korrigiert: fehlt das Gegenstück im Ziel, kann nur
 * angelegt werden; ist eines da, wird OHNE ausdrückliches `aktualisieren`/`kopie`
 * nichts angefasst.
 */
function effektiveAktion(gewaehlt: Entscheidung | undefined, vorhanden: boolean): Entscheidung {
  const wahl = gewaehlt ?? 'ueberspringen';
  if (wahl === 'ueberspringen') return 'ueberspringen';
  if (!vorhanden) return wahl === 'kopie' ? 'kopie' : 'uebernehmen';
  return wahl === 'uebernehmen' ? 'ueberspringen' : wahl;
}

function zaehle(z: ArtZaehler, aktion: Entscheidung): void {
  if (aktion === 'uebernehmen') z.neu++;
  else if (aktion === 'aktualisieren') z.aktualisiert++;
  else if (aktion === 'kopie') z.kopiert++;
  else z.uebersprungen++;
}

/* -------------------------------------------------------------------------- */
/* Workflow-Schritte                                                           */
/* -------------------------------------------------------------------------- */

interface SchrittErgebnis {
  steps: WorkflowStep[];
  /** Ziel-Schritte ohne Gegenstück im Paket — sie entfallen. */
  entfallen: number;
}

/** Ordnet einen Paket-Schritt einem noch offenen Ziel-Schritt zu (drei Stufen). */
function nimmZielSchritt(offen: WorkflowStep[], s: WorkflowStep): WorkflowStep | undefined {
  const stufen: Array<(z: WorkflowStep) => boolean> = [
    z => !!s.ankerKey && z.ankerKey === s.ankerKey,
    z => z.nr === s.nr,
    z => z.label === s.label && z.skillId === s.skillId,
  ];
  for (const passt of stufen) {
    const i = offen.findIndex(passt);
    if (i >= 0) return offen.splice(i, 1)[0];
  }
  return undefined;
}

/**
 * Baut die Schritt-Liste des einzuspielenden Workflows.
 *
 * `zielSteps` leer ⇒ neuer Workflow: die Paket-IDs bleiben erhalten, solange sie
 * nicht mit Schritten eines ANDEREN Ziel-Workflows kollidieren (`fremdeIds`) —
 * sonst gäbe es zwei Schritte gleicher ID in verschiedenen Abläufen und ein
 * `WorkflowRun` wüsste nicht, welcher gemeint ist. `alleNeu` erzwingt frische
 * IDs (Kopie-Pfad, Bestands-Semantik der Einzel-Bündel).
 */
export function uebernimmSchritte(
  paketSteps: WorkflowStep[],
  zielSteps: WorkflowStep[],
  fremdeIds: ReadonlySet<string>,
  newId: () => string,
  alleNeu: boolean,
): SchrittErgebnis {
  const offen = [...zielSteps];
  const idMap = new Map<string, string>();
  const belegt = new Set<string>();

  for (const s of paketSteps) {
    let finalId: string;
    if (alleNeu) {
      finalId = newId();
    } else {
      const ziel = nimmZielSchritt(offen, s);
      if (ziel) finalId = ziel.id;
      else if (!fremdeIds.has(s.id) && !belegt.has(s.id)) finalId = s.id;
      else finalId = newId();
    }
    belegt.add(finalId);
    idMap.set(s.id, finalId);
  }

  const steps = paketSteps.map((s): WorkflowStep => {
    const { parentStepId, qsZielStepId, ...rest } = s;
    const parent = parentStepId ? idMap.get(parentStepId) : undefined;
    const qsZiel = qsZielStepId ? idMap.get(qsZielStepId) : undefined;
    return {
      ...rest,
      id: idMap.get(s.id)!,
      ...(parent ? { parentStepId: parent } : {}),
      ...(qsZiel ? { qsZielStepId: qsZiel } : {}),
    };
  });

  return { steps, entfallen: offen.length };
}

/* -------------------------------------------------------------------------- */
/* Fortschreiben einzelner Records                                             */
/* -------------------------------------------------------------------------- */

function aktualisiereSkill(ziel: SkillRecord, ausPaket: SkillRecord, ctx: EinspielKontext): SkillRecord {
  const basis: SkillRecord = {
    ...ausPaket,
    version: ziel.version + 1,
    geaendert_am: ctx.zeitpunkt,
    // Die Historie des ZIELS wird fortgeschrieben — die des Pakets gehört dem
    // Stand, auf dem sie entstand, und reist deshalb gar nicht erst mit.
    historie: ziel.historie ?? [],
  };
  return { ...basis, historie: appendHistorie(basis, { userId: ctx.userId, begruendung: ctx.begruendung }) };
}

function aktualisiereBaustein(
  ziel: TextbausteinRecord, ausPaket: TextbausteinRecord, ctx: EinspielKontext,
): TextbausteinRecord {
  return mitFassung({
    ...ausPaket,
    version: ziel.version + 1,
    geaendertAm: ctx.zeitpunkt,
    ...(ctx.userId ? { geaendertVon: ctx.userId } : {}),
    historie: ziel.historie,
  }, ctx.begruendung);
}

function aktualisiereRegel(ziel: QualitaetsRegel, ausPaket: QualitaetsRegel, ctx: EinspielKontext): QualitaetsRegel {
  // `erstellt_am` gehört dem Ziel-Record — nur der Änderungsstempel wandert mit.
  return { ...ausPaket, erstellt_am: ziel.erstellt_am, geaendert_am: ctx.zeitpunkt };
}

/* -------------------------------------------------------------------------- */
/* Einspielen                                                                  */
/* -------------------------------------------------------------------------- */

export interface EinspielErgebnis {
  file: SkillRegistryFile;
  katalog: TextbausteinKatalog | null;
  bericht: EinspielBericht;
}

/**
 * Wendet die Entscheidungen an und liefert den neuen Stand beider Ablagen plus
 * einen Bericht. Reihenfolge: Regeln vor Skills (damit `regelIds` eines neuen
 * Skills im selben Durchgang auflösen), danach Workflows, danach Bausteine.
 *
 * Fehlt der Katalog (nicht geladen), gelten alle Baustein-Zeilen als
 * übersprungen — geschrieben wird nur, was auch gelesen wurde.
 */
export function wendePaketAn(
  file: SkillRegistryFile,
  katalog: TextbausteinKatalog | null,
  paket: KuraturPaket,
  entscheidungen: Entscheidungen,
  ctx: EinspielKontext,
): EinspielErgebnis {
  const proArt: Record<PaketArt, ArtZaehler> = {
    regel: leererZaehler(), skill: leererZaehler(), workflow: leererZaehler(), baustein: leererZaehler(),
  };
  let entfalleneSchritte = 0;
  let statuswechsel = 0;

  const wahl = (art: PaketArt, id: string): Entscheidung | undefined =>
    entscheidungen[zeilenSchluessel(art, id)];

  /* --- Regeln ------------------------------------------------------------ */
  const regeln = [...file.regeln];
  for (const r of paket.regeln) {
    const idx = regeln.findIndex(x => x.id === r.id);
    const aktion = effektiveAktion(wahl('regel', r.id), idx >= 0);
    zaehle(proArt.regel, aktion);
    if (aktion === 'uebernehmen') regeln.push(r);
    else if (aktion === 'aktualisieren') regeln[idx] = aktualisiereRegel(regeln[idx]!, r, ctx);
  }

  /* --- Skills ------------------------------------------------------------ */
  const skills = [...file.skills];
  for (const s of paket.skills) {
    const idx = skills.findIndex(x => x.id === s.id);
    const aktion = effektiveAktion(wahl('skill', s.id), idx >= 0);
    zaehle(proArt.skill, aktion);
    if (aktion === 'uebernehmen') skills.push(s);
    else if (aktion === 'aktualisieren') skills[idx] = aktualisiereSkill(skills[idx]!, s, ctx);
    else if (aktion === 'kopie') skills.push({ ...s, id: ctx.newId(), name: `${s.name} (importiert)` });
  }

  /* --- Workflows --------------------------------------------------------- */
  const workflows = [...(file.workflows ?? [])];
  for (const w of paket.workflows) {
    const idx = workflows.findIndex(x => x.id === w.id);
    const aktion = effektiveAktion(wahl('workflow', w.id), idx >= 0);
    zaehle(proArt.workflow, aktion);
    if (aktion === 'ueberspringen') continue;

    const ziel = idx >= 0 ? workflows[idx]! : null;
    const fremdeIds = new Set(
      workflows.filter(x => x.id !== w.id).flatMap(x => x.steps.map(st => st.id)),
    );
    const { steps, entfallen } = uebernimmSchritte(
      w.steps,
      aktion === 'aktualisieren' && ziel ? ziel.steps : [],
      fremdeIds,
      ctx.newId,
      aktion === 'kopie',
    );
    entfalleneSchritte += entfallen;

    if (aktion === 'aktualisieren' && ziel) {
      workflows[idx] = { ...w, version: ziel.version + 1, steps };
    } else if (aktion === 'kopie') {
      workflows.push({ ...w, id: ctx.newId(), name: `${w.name} (importiert)`, steps });
    } else {
      workflows.push({ ...w, steps });
    }
  }

  /* --- Textbausteine ----------------------------------------------------- */
  let bausteine = katalog ? [...katalog.bausteine] : [];
  for (const b of paket.bausteine) {
    if (!katalog) { zaehle(proArt.baustein, 'ueberspringen'); continue; }
    const idx = bausteine.findIndex(x => x.id === b.id);
    const aktion = effektiveAktion(wahl('baustein', b.id), idx >= 0);
    zaehle(proArt.baustein, aktion);
    if (aktion === 'uebernehmen') {
      bausteine.push(b);
    } else if (aktion === 'aktualisieren') {
      const ziel = bausteine[idx]!;
      if (ziel.status !== b.status) statuswechsel++;
      bausteine[idx] = aktualisiereBaustein(ziel, b, ctx);
    }
  }
  if (!katalog) bausteine = [];

  const gesamt = Object.values(proArt).reduce<ArtZaehler>((acc, z) => ({
    neu: acc.neu + z.neu,
    aktualisiert: acc.aktualisiert + z.aktualisiert,
    kopiert: acc.kopiert + z.kopiert,
    uebersprungen: acc.uebersprungen + z.uebersprungen,
  }), leererZaehler());

  const geaendert = (z: ArtZaehler): boolean => z.neu + z.aktualisiert + z.kopiert > 0;
  const registryGeaendert = geaendert(proArt.regel) || geaendert(proArt.skill) || geaendert(proArt.workflow);
  const katalogGeaendert = !!katalog && geaendert(proArt.baustein);

  return {
    file: registryGeaendert ? { ...file, skills, regeln, workflows } : file,
    katalog: katalog && katalogGeaendert ? { ...katalog, bausteine } : katalog,
    bericht: { proArt, gesamt, entfalleneSchritte, statuswechsel, registryGeaendert, katalogGeaendert },
  };
}
