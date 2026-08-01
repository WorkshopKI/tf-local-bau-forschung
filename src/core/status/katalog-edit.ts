/**
 * Reine Transformationen einer Katalog-Version fürs Cockpit-Inline-Edit. Jede
 * Funktion liefert eine neue Version (nie in-place); id/feldId bleiben stabil.
 */
import type {
  MappingVersion, NaechsterSchrittRegel, Rolle, StatusFeldEintrag, StatusKategorie,
  StatusWertEintrag, TodoRegel, ZahPhase,
} from './typen';
import { erzeugtZyklus } from './kategorien';
import { normKey } from './normalisierung';
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

export function aendereRegel(
  version: MappingVersion, id: string, patch: Partial<NaechsterSchrittRegel>,
): MappingVersion {
  return {
    ...version,
    regeln: version.regeln.map(r => (r.id === id ? { ...r, ...patch, id: r.id } : r)),
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
  version: MappingVersion, katalog: readonly StatusCodeEintrag[],
): MappingVersion {
  const index = baueStatusCodeIndex(katalog);
  return {
    ...version,
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
 * Verschiebt eine Regel um eine Position in der Kaskade.
 *
 * **Die Reihenfolge wird komplett neu vergeben** (10, 20, 30 …) statt zwei
 * Werte zu tauschen: importierte oder von Hand gepflegte Fassungen können
 * Lücken und Doppelwerte tragen, und ein Tausch zweier gleicher Zahlen wäre
 * eine Aktion, die sichtbar nichts tut.
 */
export function verschiebeTodoRegel(
  version: MappingVersion, id: string, richtung: -1 | 1,
): MappingVersion {
  const sortiert = [...(version.todoRegeln ?? [])].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const i = sortiert.findIndex(r => r.id === id);
  const ziel = i + richtung;
  if (i < 0 || ziel < 0 || ziel >= sortiert.length) return version;
  const [bewegt] = sortiert.splice(i, 1);
  sortiert.splice(ziel, 0, bewegt!);
  return {
    ...version,
    todoRegeln: sortiert.map((r, n) => ({ ...r, reihenfolge: (n + 1) * 10 })),
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
