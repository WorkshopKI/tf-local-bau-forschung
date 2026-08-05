/**
 * Reine Transformationen einer Katalog-Version fürs Cockpit-Inline-Edit. Jede
 * Funktion liefert eine neue Version (nie in-place); id/feldId bleiben stabil.
 */
import type {
  MappingVersion, Rolle, StatusFeldEintrag, StatusKategorie,
  StatusWertEintrag, TextbausteinEintrag, TodoRegel, ZahPhase, ZahPhaseId,
} from './typen';
import { erzeugtZyklus } from './kategorien';
import { normKey } from './normalisierung';
import { regelsatzVon } from './regelsatz';
import { rollenVonFeld } from './rollen';
import { baueStatusCodeIndex, findeStatusCode, type StatusCodeEintrag } from './status-codes';
import { SEED_CODE_ZU_ZAH_PHASE, SEED_MARKER_CODES } from './zah-phasen';

export function aendereWert(
  version: MappingVersion, id: string, patch: Partial<StatusWertEintrag>,
): MappingVersion {
  return {
    ...version,
    werte: version.werte.map(w => (w.id === id ? { ...w, ...patch, id: w.id, feldId: w.feldId } : w)),
  };
}

export function aendereFeld(
  version: MappingVersion, feldId: string, patch: Partial<StatusFeldEintrag>,
): MappingVersion {
  return {
    ...version,
    felder: version.felder.map(f => (f.feldId === feldId ? { ...f, ...patch, feldId: f.feldId } : f)),
  };
}

/** Übernimmt einen kuratierten Wert (aus dem Unkuratiert-Puffer promoted). */
export function fuegeWertHinzu(version: MappingVersion, wert: StatusWertEintrag): MappingVersion {
  if (version.werte.some(w => w.id === wert.id)) return aendereWert(version, wert.id, wert);
  return { ...version, werte: [...version.werte, wert] };
}

/** Übernimmt ein Feld (aus der Seed-Erweiterung oder der Spalten-Entdeckung). */
export function fuegeFeldHinzu(version: MappingVersion, feld: StatusFeldEintrag): MappingVersion {
  if (version.felder.some(f => f.feldId === feld.feldId)) {
    return aendereFeld(version, feld.feldId, feld);
  }
  return { ...version, felder: [...version.felder, feld] };
}

// --- Kategoriebaum ----------------------------------------------------------

export function fuegeKategorieHinzu(
  version: MappingVersion, kategorie: StatusKategorie,
): MappingVersion {
  const bestand = version.kategorien ?? [];
  if (bestand.some(k => k.id === kategorie.id)) return version;
  return { ...version, kategorien: [...bestand, kategorie] };
}

/**
 * Ändert eine Kategorie. Ein `elternId`-Patch, der einen Zyklus erzeugen würde,
 * wird **verworfen** (der Rest des Patches greift trotzdem) — der Editor lässt
 * so einen Griff schlicht ins Leere laufen, statt den Baum zu zerlegen.
 */
export function aendereKategorie(
  version: MappingVersion, id: string, patch: Partial<StatusKategorie>,
): MappingVersion {
  const bestand = version.kategorien ?? [];
  return {
    ...version,
    kategorien: bestand.map(k => {
      if (k.id !== id) return k;
      const sicher = { ...patch };
      if ('elternId' in sicher && erzeugtZyklus(bestand, id, sicher.elternId ?? null)) {
        delete sicher.elternId;
      }
      return { ...k, ...sicher, id: k.id };
    }),
  };
}

/**
 * Entfernt eine Kategorie und hinterlässt **keine toten Verweise**: Kinder
 * rücken an den Elternknoten nach, Felder der Kategorie verlieren ihre
 * Zuordnung (und erscheinen damit unter „Nicht zugeordnet").
 *
 * Zum bloßen Ausblenden ist `aendereKategorie(..., { aktiv: false })` gedacht —
 * das erhält die Zuordnung.
 */
export function entferneKategorie(version: MappingVersion, id: string): MappingVersion {
  const bestand = version.kategorien ?? [];
  const weg = bestand.find(k => k.id === id);
  if (!weg) return version;
  return {
    ...version,
    kategorien: bestand
      .filter(k => k.id !== id)
      .map(k => (k.elternId === id ? { ...k, elternId: weg.elternId } : k)),
    felder: version.felder.map(f => {
      if (f.kategorieId !== id) return f;
      const { kategorieId: _weg, ...rest } = f;
      return rest;
    }),
  };
}

// --- Seed-Erweiterung -------------------------------------------------------

export interface ErgaenzungsErgebnis {
  version: MappingVersion;
  neueFelder: number;
  neueKategorien: number;
}

/**
 * Ergänzt eine Fassung um Kategorien und Felder aus der Auslieferung, **ohne
 * einen einzigen bestehenden Eintrag anzufassen**.
 *
 * Der Katalog ist versionierte Team-Kuration: eine neue Auslieferung darf
 * Handarbeit der PL nicht überschreiben. Deshalb gilt „was es schon gibt,
 * bleibt wie es ist" — auch dann, wenn der Seed es inzwischen anders sieht.
 * Wer eine Auslieferungs-Fassung zurückholen will, nimmt den JSON-Import.
 *
 * Rein und idempotent: zweimal angewandt ändert der zweite Lauf nichts.
 */
export function ergaenzeSeedFelder(
  version: MappingVersion,
  seedFelder: readonly StatusFeldEintrag[],
  seedKategorien: readonly StatusKategorie[],
): ErgaenzungsErgebnis {
  const bekannteKategorien = new Set((version.kategorien ?? []).map(k => k.id));
  const neueKategorien = seedKategorien.filter(k => !bekannteKategorien.has(k.id));
  const bekannteFelder = new Set(version.felder.map(f => f.feldId));
  const neueFelder = seedFelder.filter(f => !bekannteFelder.has(f.feldId));

  if (neueKategorien.length === 0 && neueFelder.length === 0) {
    return { version, neueFelder: 0, neueKategorien: 0 };
  }
  return {
    version: {
      ...version,
      kategorien: [...(version.kategorien ?? []), ...neueKategorien.map(k => ({ ...k }))],
      felder: [...version.felder, ...neueFelder.map(f => ({ ...f }))],
    },
    neueFelder: neueFelder.length,
    neueKategorien: neueKategorien.length,
  };
}

// --- Vorgangssystem: Referenz-Importe in die Fassung übernehmen -------------

/**
 * Übernimmt einen importierten Status-Code-Katalog in eine Fassung.
 *
 * Wirkt auf die **Statuswerte**: jeder Wert, dessen Rohtext auf einen Code des
 * Imports joint, bekommt Code, Varianten und — sofern noch nicht kuratiert —
 * die ZAH-Phase des Auslieferungs-Schnitts. Zieltage und von Hand umgehängte
 * Phasen bleiben stehen; ein Import ist eine Aktualisierung der Fremddaten,
 * keine Rücksetzung unserer Kuration.
 *
 * Werte, die der neue Katalog nicht mehr kennt, **verlieren ihren Code nicht**.
 * Ein unvollständiges Blatt würde sonst reihenweise Anträge auf „nicht im
 * Katalog" zurückwerfen; der Diff hat die entfallenen Einträge vorher genannt,
 * die Entscheidung darüber gehört in die Vorschau, nicht in diese Funktion.
 *
 * Rein und idempotent.
 */
export function uebernimmStatusCodes(
  version: MappingVersion,
  katalog: readonly StatusCodeEintrag[],
  textbausteine: readonly TextbausteinEintrag[] = [],
): MappingVersion {
  const index = baueStatusCodeIndex(katalog);
  return {
    ...version,
    // Die Textbaustein-Legende kommt aus demselben Blatt. Leer heißt „das Blatt
    // führte keine" — dann bleibt die gepflegte Legende stehen, statt von einem
    // Import ohne diese Zeilen gelöscht zu werden.
    ...(textbausteine.length > 0 ? { textbausteine: textbausteine.map(t => ({ ...t })) } : {}),
    werte: version.werte.map(w => {
      const treffer = findeStatusCode(w.wert, index);
      if (!treffer) return w;
      const { code, varianten } = treffer.eintrag;
      const marker = SEED_MARKER_CODES.has(code);
      return {
        ...w,
        code,
        ...(varianten.length > 0 ? { varianten: [...varianten] } : {}),
        // Nur setzen, wo die PL noch nichts entschieden hat.
        ...(w.zahPhaseId === undefined
          ? { zahPhaseId: SEED_CODE_ZU_ZAH_PHASE.get(code) ?? null }
          : {}),
        ...(marker ? { marker: true } : {}),
      };
    }),
  };
}

/** Was einer Fassung aus der Vorgangssystem-Auslieferung fehlt. */
export interface VorgangssystemLuecke {
  /** Aktive Statuswerte ohne Code-Zuordnung, für die die Auslieferung einen hat. */
  werteOhneCode: number;
  /** Die ZAH-Phasen-Tabelle fehlt ganz. */
  phasenFehlen: boolean;
  /** Codes, die doppelt geführt werden — kanonisches Feld UND eigenes `D_`-Feld. */
  doppelteCodes: number;
  /** Die To-do-Kaskade fehlt ganz (Fassung aus der Zeit vor dem Regelsatz). */
  todoRegelnFehlen: boolean;
}

/**
 * Codes, die eine Fassung doppelt führt: einmal am kanonischen Feld, einmal als
 * eigenes `D_`-Feld.
 *
 * Der Auslieferungs-Seed schließt diese vier Codes aus (`AAE`, `ABB`, `AZ1`,
 * `VBE` — siehe `KANONISCHE_CODE_FELDER`); ein „Nachziehen" mit der
 * ungefilterten Code-Liste hat sie in Bestandsfassungen trotzdem angelegt.
 * Sichtbar wird das erst spät und dann falsch: den Wert trägt das kanonische
 * Feld (es gewinnt die Kollisionsregel der Feld-Auflösung), den Code das
 * `D_`-Feld — und der Navigator schlägt vor, einen längst gesetzten
 * Antragseingang zu setzen. Schlimmer noch bei `ABB`: fast jede
 * Trigger-Bedingung lautet „TV hat kein ABB", und die wäre dann immer erfüllt.
 */
export function kanonischeCodeDoppel(
  version: MappingVersion, kanonisch: ReadonlyMap<string, string>,
): string[] {
  const doppelt: string[] = [];
  for (const [code, feldId] of kanonisch) {
    const traeger = version.felder.filter(f => f.code === code || f.feldId === feldId);
    if (traeger.length > 1) doppelt.push(code);
  }
  return doppelt;
}

/**
 * Räumt die doppelt geführten Codes auf: der Code wandert ans kanonische Feld
 * (dort steht der Wert), das überzählige `D_`-Feld fällt weg.
 *
 * **Das ist bewusst ein Entfernen, kein Zusammenführen.** Das `D_`-Feld hat nie
 * einen Wert getragen; was daran kuratiert wurde (Ordner, Rang), beschreibt ein
 * Ereignis, das die App längst über das kanonische Feld führt. Es stehenzulassen
 * hieße, zwei Wahrheiten über denselben Vorgang zu behalten.
 *
 * Idempotent: gibt dieselbe Referenz zurück, wenn es nichts zu tun gibt.
 */
export function entdoppleKanonischeCodes(
  version: MappingVersion, kanonisch: ReadonlyMap<string, string>,
): MappingVersion {
  const betroffen = new Set(kanonischeCodeDoppel(version, kanonisch));
  if (betroffen.size === 0) return version;
  const zielFeldId = new Map([...kanonisch].map(([code, feldId]) => [feldId, code]));
  return {
    ...version,
    felder: version.felder
      // Das kanonische Feld bekommt (oder behält) den Code …
      .map(f => {
        const code = zielFeldId.get(f.feldId);
        return code !== undefined && betroffen.has(code) ? { ...f, code } : f;
      })
      // … und alles andere, was denselben Code trägt, fällt weg.
      .filter(f => !(f.code !== undefined && betroffen.has(f.code)
        && kanonisch.get(f.code) !== f.feldId)),
  };
}

/**
 * Was der Fassung aus der Auslieferung fehlt — **ohne** etwas zu ändern.
 *
 * Nötig, weil der Seed nur beim allerersten Start greift: eine Installation, die
 * schon eine kuratierte Fassung führt, bekommt Codes und ZAH-Phasen sonst nie zu
 * sehen und zeigt „0 Statuswerte mit Code". Genau dieselbe Lücke gibt es bei den
 * Feldern (`ergaenzeSeedFelder`) und bei den Bezeichnungen (`uebernimmSeedTexte`).
 */
export function vorgangssystemLuecke(
  version: MappingVersion,
  auslieferung: readonly StatusCodeEintrag[],
  kanonisch: ReadonlyMap<string, string>,
): VorgangssystemLuecke {
  const index = baueStatusCodeIndex(auslieferung);
  return {
    werteOhneCode: version.werte
      .filter(w => w.aktiv && w.code === undefined && findeStatusCode(w.wert, index) !== null)
      .length,
    phasenFehlen: (version.zahPhasen ?? []).length === 0,
    doppelteCodes: kanonischeCodeDoppel(version, kanonisch).length,
    todoRegelnFehlen: (version.todoRegeln ?? []).length === 0,
  };
}

/**
 * Zieht die Vorgangssystem-Auslieferung in eine Bestandsfassung nach: Codes,
 * Varianten, ZAH-Phasen-Zuordnung und die Phasen-Tabelle.
 *
 * Additiv wie {@link ergaenzeSeedFelder}: nichts Kuratiertes wird überschrieben
 * (ein von Hand gesetzter `zahPhaseId`, gepflegte `zieltage`, eine umbenannte
 * Phase bleiben). Idempotent — ein zweiter Lauf ändert nichts mehr.
 */
export function ergaenzeVorgangssystemSeed(
  version: MappingVersion,
  auslieferung: readonly StatusCodeEintrag[],
  phasen: readonly ZahPhase[],
  kanonisch: ReadonlyMap<string, string>,
  todoRegeln: readonly TodoRegel[] = [],
): MappingVersion {
  // Entdoppeln zuerst: solange zwei Felder denselben Code führen, ist jede
  // Aussage über diesen Code eine Münze mit zwei Seiten.
  const bereinigt = entdoppleKanonischeCodes(version, kanonisch);
  const mitCodes = uebernimmStatusCodes(bereinigt, auslieferung);
  // Phasen und Regeln nur ANLEGEN, nie ersetzen: eine gepflegte Kaskade darf
  // ein Nachziehen nicht auf den Auslieferungsstand zurückwerfen.
  return {
    ...mitCodes,
    ...((mitCodes.zahPhasen ?? []).length === 0 ? { zahPhasen: phasen.map(p => ({ ...p })) } : {}),
    ...((mitCodes.todoRegeln ?? []).length === 0 && todoRegeln.length > 0
      ? { todoRegeln: todoRegeln.map(r => ({ ...r, zustaendig: [...r.zustaendig] })) }
      : {}),
  };
}

/**
 * Setzt Zieltage an vielen Statuswerten in EINEM Schritt.
 *
 * Kein Ersatz für {@link aendereWert}, sondern dessen Sammel-Form: 60 einzelne
 * Aufrufe wären 60 `setState`-Runden, von denen der Save-Lock die meisten
 * verwürfe (Pitfall #16/#20). Werte, die die Map nicht nennt, bleiben unberührt.
 */
export function setzeZieltage(
  version: MappingVersion, zieltage: ReadonlyMap<string, number>,
): MappingVersion {
  if (zieltage.size === 0) return version;
  return {
    ...version,
    werte: version.werte.map(w => {
      const neu = zieltage.get(w.id);
      return neu === undefined ? w : { ...w, zieltage: neu };
    }),
  };
}

/**
 * Setzt ZAH-Phasen an vielen Statusfeldern in EINEM Schritt.
 *
 * Das Feld-Pendant zu {@link setzeZieltage}, aus demselben Grund: 46 einzelne
 * `aendereFeld`-Aufrufe wären 46 `setState`-Runden (Pitfall #16/#20). Felder,
 * die die Map nicht nennt, bleiben unberührt — die Übernahme ist eine Auswahl,
 * kein Rundumschlag.
 */
export function setzeFeldPhasen(
  version: MappingVersion, phasen: ReadonlyMap<string, ZahPhaseId>,
): MappingVersion {
  if (phasen.size === 0) return version;
  return {
    ...version,
    felder: version.felder.map(f => {
      const neu = phasen.get(f.feldId);
      return neu === undefined ? f : { ...f, zahPhaseId: neu };
    }),
  };
}

/** Was der ausgelieferte Regelsatz gegenüber der Fassung anders sagt. */
export interface TodoRegelDrift {
  /** Seed-Regeln, die die Fassung gar nicht führt. */
  neu: string[];
  /** Ids in beiden, deren Inhalt auseinanderläuft (Bedingung, Rolle, Text …). */
  geaendert: string[];
  /** Noch aktive Regeln, die der Seed nicht mehr führt. */
  entfallen: string[];
}

/** Vergleichsform einer Regel — ohne die Felder, die nur die Anzeige betreffen. */
function regelKern(r: TodoRegel): string {
  return JSON.stringify({
    reihenfolge: r.reihenfolge, bedingung: r.bedingung, todo: r.todo,
    zustaendig: [...r.zustaendig].sort(), wartetAuf: r.wartetAuf ?? null,
    sperrt: [...(r.sperrt ?? [])].sort(), sperrtNicht: [...(r.sperrtNicht ?? [])].sort(),
    // Regelsatz, Sperr-Geltung und Strang entscheiden mit, WO eine Regel wirkt —
    // zöge die Auslieferung eine Regel in einen anderen Satz oder Strang um,
    // bliebe das ohne sie eine stille Änderung. Der `strang` ist seit v2.412
    // dabei: er bestimmt, welche Sperren die Regel erfassen.
    regelsatz: regelsatzVon(r), giltFuer: [...(r.giltFuer ?? [])].sort(),
    strang: r.strang ?? '',
  });
}

/**
 * Drift zwischen der gepflegten Kaskade und dem Auslieferungsstand.
 *
 * Braucht es, weil der Regelsatz **wächst**: die Fachabstimmung hat Sperren
 * ergänzt und eine Regel nach Rollen geteilt. Ohne Nachzieh-Weg liefe jede
 * bestehende Installation weiter auf dem Stand ihres ersten Seeds — sichtbar
 * wäre das nirgends.
 */
export function todoRegelDrift(
  version: MappingVersion,
  seed: readonly TodoRegel[],
  entfalleneIds: readonly string[],
): TodoRegelDrift {
  const bestand = new Map((version.todoRegeln ?? []).map(r => [r.id, r]));
  const neu: string[] = [];
  const geaendert: string[] = [];
  for (const s of seed) {
    const b = bestand.get(s.id);
    if (!b) neu.push(s.id);
    else if (regelKern(b) !== regelKern(s)) geaendert.push(s.id);
  }
  const entfallen = entfalleneIds.filter(id => bestand.get(id)?.aktiv === true);
  return { neu, geaendert, entfallen };
}

/**
 * Zieht den ausgelieferten Regelsatz in eine Fassung nach.
 *
 * Anders als {@link ergaenzeVorgangssystemSeed} **ersetzt** das die gelieferten
 * Regeln — sonst käme eine korrigierte Bedingung nie an. Das ist deshalb eine
 * ausdrückliche Aktion mit vorher sichtbarer Bilanz, keine automatische.
 *
 * Drei Sorten, drei Behandlungen:
 * - Seed-Regel, die die Fassung nicht kennt ⇒ **anlegen**.
 * - Seed-Regel, die beide kennen ⇒ **ersetzen** (die Auslieferung ist für ihre
 *   eigenen Regeln maßgeblich; eine PL-Änderung daran geht verloren und steht
 *   deshalb in der Bilanz).
 * - Id, die der Seed nicht (mehr) führt ⇒ **unangetastet**, außer sie steht in
 *   `entfalleneIds`: dann `aktiv: false`. Invalidieren statt löschen.
 */
export function zieheTodoRegelnNach(
  version: MappingVersion,
  seed: readonly TodoRegel[],
  entfalleneIds: readonly string[],
): MappingVersion {
  const ausSeed = new Map(seed.map(r => [r.id, r]));
  const entfallen = new Set(entfalleneIds);
  const behalten = (version.todoRegeln ?? [])
    .filter(r => !ausSeed.has(r.id))
    .map(r => (entfallen.has(r.id) ? { ...r, aktiv: false } : r));
  return {
    ...version,
    todoRegeln: [
      ...seed.map(r => ({
        ...r,
        zustaendig: [...r.zustaendig],
        ...(r.sperrt ? { sperrt: [...r.sperrt] } : {}),
        ...(r.sperrtNicht ? { sperrtNicht: [...r.sperrtNicht] } : {}),
      })),
      ...behalten,
    ].sort((a, b) => a.reihenfolge - b.reihenfolge),
  };
}

/**
 * Der Code-Katalog, gegen den ein Import verglichen wird: die **Auslieferung**,
 * überlagert von dem, was die Fassung inzwischen pflegt (zusätzliche Varianten).
 *
 * Bewusst nicht nur aus `version.werte` abgeleitet: dort stehen nur Codes, für
 * die im Bestand auch ein Statuswert beobachtet wurde. Codes wie 11 (Skizze),
 * 88 (Sonderstatus) oder 93/94 (Partner) kämen dann bei jedem Import als „neu"
 * durch, obwohl die App sie längst kennt — eine Diff-Zeile, die nichts bedeutet,
 * ist schlimmer als keine.
 */
export function aktuellerStatusCodeKatalog(
  version: MappingVersion, auslieferung: readonly StatusCodeEintrag[],
): StatusCodeEintrag[] {
  const proCode = new Map<number, StatusCodeEintrag>(
    auslieferung.map(e => [e.code, { ...e, varianten: [...e.varianten] }]),
  );
  for (const w of version.werte) {
    if (w.code === undefined) continue;
    const bestand = proCode.get(w.code);
    const varianten = new Set([...(bestand?.varianten ?? []), ...(w.varianten ?? [])]);
    proCode.set(w.code, {
      code: w.code,
      text: bestand?.text ?? w.wert,
      varianten: [...varianten],
    });
  }
  return [...proCode.values()].sort((a, b) => a.code - b.code);
}

// --- Abgleich mit der Kürzel-Zuarbeit ---------------------------------------

/** Eine Abweichung zwischen Fassung und Auslieferung — für die Vorschau. */
export interface TextAbweichung {
  feldId: string;
  code?: string;
  altesLabel: string;
  neuesLabel: string;
  alteRollen: readonly Rolle[];
  neueRollen: readonly Rolle[];
}

/**
 * Wo weichen Bezeichnung oder Rollen einer Fassung von der Auslieferung ab?
 *
 * Nur diese beiden Angaben, denn nur sie sind **Fremddaten**: sie stammen aus
 * der Kürzel-Zuarbeit des Fachsystems, nicht aus unserer Kuration. Ordner,
 * Prominenz, Spine-Phase und Rang bleiben außen vor — das sind Entscheidungen
 * der PL, die eine Auslieferung nicht zurücksetzen darf.
 *
 * Rein: liefert nur den Befund, ändert nichts.
 */
export function seedTextAbweichungen(
  version: MappingVersion,
  seedFelder: readonly StatusFeldEintrag[],
): TextAbweichung[] {
  const seed = new Map(seedFelder.map(f => [f.feldId, f]));
  const treffer: TextAbweichung[] = [];
  for (const f of version.felder) {
    const s = seed.get(f.feldId);
    if (!s) continue;
    const alteRollen = rollenVonFeld(f);
    const neueRollen = rollenVonFeld(s);
    const labelAnders = f.label !== s.label;
    const rollenAnders = alteRollen.join('/') !== neueRollen.join('/');
    if (!labelAnders && !rollenAnders) continue;
    treffer.push({
      feldId: f.feldId,
      ...(s.code ? { code: s.code } : {}),
      altesLabel: f.label,
      neuesLabel: s.label,
      alteRollen,
      neueRollen,
    });
  }
  return treffer;
}

/**
 * Übernimmt Bezeichnung und Rollen der Auslieferung in eine Fassung — und sonst
 * nichts. Gibt dieselbe Referenz zurück, wenn es nichts zu tun gibt (idempotent).
 */
export function uebernimmSeedTexte(
  version: MappingVersion,
  seedFelder: readonly StatusFeldEintrag[],
): MappingVersion {
  const betroffen = new Set(seedTextAbweichungen(version, seedFelder).map(a => a.feldId));
  if (betroffen.size === 0) return version;
  const seed = new Map(seedFelder.map(f => [f.feldId, f]));
  return {
    ...version,
    felder: version.felder.map(f => {
      if (!betroffen.has(f.feldId)) return f;
      const s = seed.get(f.feldId)!;
      // `zustaendigkeit` fällt weg: sonst bliebe der abgelöste Wert stehen und
      // widerspräche den frisch gesetzten Rollen im Export.
      const { zustaendigkeit: _abgeloest, ...rest } = f;
      return { ...rest, label: s.label, rollen: [...rollenVonFeld(s)] };
    }),
  };
}

/**
 * Legt eine To-do-Regel an — ans Ende **ihres** Regelsatzes.
 *
 * **Ein Regelsatz ≠ AB startet immer stillgelegt.** `pflege`-Daten liegen für
 * alle Build-Varianten in derselben Datei: eine aktive FB-Regel würde von jeder
 * Installation unter v2.391 als AB-Regel mitgewertet, weil deren Engine das Feld
 * `regelsatz` nicht kennt. Das Freischalten ist deshalb eine eigene, bewusste
 * Handlung im Editor und keine Eigenschaft des Anlegens.
 */
export function fuegeTodoRegelHinzu(
  version: MappingVersion, regel: TodoRegel,
): MappingVersion {
  const bestand = version.todoRegeln ?? [];
  if (bestand.some(r => r.id === regel.id)) return version;
  const satz = regelsatzVon(regel);
  const letzte = bestand
    .filter(r => regelsatzVon(r) === satz)
    .reduce((max, r) => Math.max(max, r.reihenfolge), 0);
  return {
    ...version,
    todoRegeln: [...bestand, {
      ...regel,
      reihenfolge: letzte + 10,
      aktiv: satz === 'ab' ? regel.aktiv : false,
    }],
  };
}

/**
 * Die Kürzel, die eine Rolle setzt — die Rollen-Fassung von
 * `AB_DASHBOARD_RELEVANZ`.
 *
 * Für den AB gibt es eine kuratierte Liste (die Spaltenauswahl der Mappe); für
 * die anderen Rollen gibt es keine, und eine zu erfinden hieße raten. Der
 * Kürzel-Katalog weiß es aber bereits: die Zuarbeit führt je Code, wer ihn setzt.
 *
 * **Neutrale Felder zählen NICHT mit.** `rollenVonFeld` liefert dort ein leeres
 * Array, was „jeder darf setzen" heißt (Pitfall #43) — als Relevanz-Vorschlag
 * gelesen wäre das „alle 143 neutralen Codes ankreuzen", und der Vorschlag
 * verlöre jeden Zuschnitt.
 */
export function codesMitRolle(version: MappingVersion, rolle: Rolle): string[] {
  const out: string[] = [];
  for (const f of version.felder) {
    if (f.code === undefined) continue;
    const rollen = rollenVonFeld(f);
    if (rollen.length > 0 && rollen.includes(rolle)) out.push(f.code);
  }
  return out;
}

/** Ändert eine To-do-Regel; Id und Reihenfolge bleiben unangetastet. */
export function aendereTodoRegel(
  version: MappingVersion, id: string, patch: Partial<TodoRegel>,
): MappingVersion {
  return {
    ...version,
    todoRegeln: (version.todoRegeln ?? []).map(r => (
      r.id === id ? { ...r, ...patch, id: r.id, reihenfolge: r.reihenfolge } : r
    )),
  };
}

/**
 * Verschiebt eine Regel um eine Position in **ihrer** Kaskade.
 *
 * **Die Reihenfolge wird komplett neu vergeben** (10, 20, 30 …) statt zwei
 * Werte zu tauschen: importierte oder von Hand gepflegte Fassungen können
 * Lücken und Doppelwerte tragen, und ein Tausch zweier gleicher Zahlen wäre
 * eine Aktion, die sichtbar nichts tut.
 *
 * **Nur innerhalb des eigenen Regelsatzes** (seit v2.390). Über alle Sätze
 * hinweg zu nummerieren hieße, dass ein Klick im AB-Tab die Regel an einer
 * FB-Regel vorbeischiebt, die dort gar nicht steht — die Aktion sähe wirkungslos
 * aus und wäre es nicht. Dass die Nummern sich zwischen den Sätzen doppeln, ist
 * harmlos: der Treffer-Pass sieht immer nur einen Satz, und der Sperr-Pass ist
 * ein Vollscan ohne Ordnung.
 */
export function verschiebeTodoRegel(
  version: MappingVersion, id: string, richtung: -1 | 1,
): MappingVersion {
  const alle = version.todoRegeln ?? [];
  const regel = alle.find(r => r.id === id);
  if (!regel) return version;
  const satz = regelsatzVon(regel);
  const sortiert = alle
    .filter(r => regelsatzVon(r) === satz)
    .sort((a, b) => a.reihenfolge - b.reihenfolge);
  const i = sortiert.findIndex(r => r.id === id);
  const ziel = i + richtung;
  if (i < 0 || ziel < 0 || ziel >= sortiert.length) return version;
  const [bewegt] = sortiert.splice(i, 1);
  sortiert.splice(ziel, 0, bewegt!);
  const neueNummer = new Map(sortiert.map((r, n) => [r.id, (n + 1) * 10]));
  return {
    ...version,
    todoRegeln: alle.map(r => {
      const nummer = neueNummer.get(r.id);
      return nummer === undefined ? r : { ...r, reihenfolge: nummer };
    }),
  };
}

/**
 * Wie viele Felder eine Code-Liste zusätzlich als relevant markieren würde.
 * Zählt nur, was sich wirklich ändert — die Anzeige soll keine Aktion anbieten,
 * die nichts tut.
 */
export function relevanzLuecke(
  version: MappingVersion, codes: readonly string[],
): number {
  const gesucht = new Set(codes.map(normKey));
  return version.felder.filter(
    f => f.code !== undefined && gesucht.has(normKey(f.code)) && f.relevant !== true,
  ).length;
}

/**
 * Setzt die Relevanz-Häkchen für eine Code-Liste.
 *
 * **Nimmt nie eines weg.** Die Listen sind rollen-typisch (der AB-Vorschlag,
 * später ein FB-Vorschlag); zwei nacheinander angewandte Vorschläge sollen sich
 * ergänzen, nicht gegenseitig löschen. Wer ein Häkchen wieder loswerden will,
 * klickt es einzeln weg.
 *
 * Idempotent: gibt dieselbe Referenz zurück, wenn nichts zu tun ist.
 */
export function markiereRelevanz(
  version: MappingVersion, codes: readonly string[],
): MappingVersion {
  if (relevanzLuecke(version, codes) === 0) return version;
  const gesucht = new Set(codes.map(normKey));
  return {
    ...version,
    felder: version.felder.map(f => (
      f.code !== undefined && gesucht.has(normKey(f.code)) ? { ...f, relevant: true } : f
    )),
  };
}
