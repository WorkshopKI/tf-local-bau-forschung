/**
 * Reine Transformationen einer Katalog-Version fürs Cockpit-Inline-Edit. Jede
 * Funktion liefert eine neue Version (nie in-place); id/feldId bleiben stabil.
 */
import type {
  MappingVersion, NaechsterSchrittRegel, Rolle, StatusFeldEintrag, StatusKategorie, StatusWertEintrag,
} from './typen';
import { erzeugtZyklus } from './kategorien';
import { rollenVonFeld } from './rollen';

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
