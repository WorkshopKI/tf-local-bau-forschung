/**
 * Reine Katalog-Operationen für den Verwaltungs-Tab — ein Record rein/raus, der Rest
 * (Fassungen, Freigabe, Rollback) liegt im Service (`textbausteine/versionierung.ts`).
 *
 * UI-frei + ohne IDB, damit die Kollisions- und Upsert-Logik (auch der Import-Pfad
 * hängt dran) ohne DOM testbar bleibt.
 */
import {
  bearbeiteBaustein, extractPlatzhalter,
  type AenderungsKontext, type BausteinArtefaktTyp, type NfScope,
  type TextbausteinKatalog, type TextbausteinRecord,
} from '@/core/services/skills';

/** Ersetzt den Record mit gleicher `id`, hängt sonst an. Reihenfolge bleibt stabil. */
export function upsertBaustein(
  katalog: TextbausteinKatalog, rec: TextbausteinRecord,
): TextbausteinKatalog {
  const idx = katalog.bausteine.findIndex(b => b.id === rec.id);
  const bausteine = idx >= 0
    ? katalog.bausteine.map((b, i) => (i === idx ? rec : b))
    : [...katalog.bausteine, rec];
  return { ...katalog, bausteine };
}

/** Findet einen Baustein per ID. */
export function findeBaustein(katalog: TextbausteinKatalog, id: string): TextbausteinRecord | undefined {
  return katalog.bausteine.find(b => b.id === id);
}

/** Scope aus dem ID-Präfix (nur für NF sinnvoll): `G…` → Verbund, `T…` → TV. */
export function scopeAusId(id: string): NfScope | undefined {
  const t = id.trim().toUpperCase();
  if (t.startsWith('G')) return 'verbund';
  if (t.startsWith('T')) return 'tv';
  return undefined;
}

export interface NeuerBausteinEingabe {
  id: string;
  artefaktTyp: BausteinArtefaktTyp;
  scope?: NfScope;
  thema: string;
  kategorie: string;
  aspekte: string[];
  stichworte: string[];
  text: string;
}

/**
 * Baut einen NEUEN Baustein — immer als `entwurf`, Version 1, mit Baseline-Historie
 * (`historie[0]` ≙ Record). Platzhalter deterministisch aus dem Text.
 */
export function neuerBaustein(eingabe: NeuerBausteinEingabe, kontext: AenderungsKontext): TextbausteinRecord {
  const rec: TextbausteinRecord = {
    id: eingabe.id.trim(),
    artefaktTyp: eingabe.artefaktTyp,
    ...(eingabe.scope ? { scope: eingabe.scope } : {}),
    thema: eingabe.thema.trim(),
    kategorie: eingabe.kategorie.trim(),
    aspekte: eingabe.aspekte,
    stichworte: eingabe.stichworte,
    text: eingabe.text,
    platzhalter: extractPlatzhalter(eingabe.text),
    status: 'entwurf',
    version: 1,
    historie: [],
    geaendertAm: kontext.zeitpunkt,
    ...(kontext.userId ? { geaendertVon: kontext.userId } : {}),
  };
  return {
    ...rec,
    historie: [{
      version: 1,
      thema: rec.thema,
      kategorie: rec.kategorie,
      text: rec.text,
      aspekte: [...rec.aspekte],
      stichworte: [...rec.stichworte],
      status: 'entwurf',
      geaendertAm: kontext.zeitpunkt,
      ...(kontext.userId ? { geaendertVon: kontext.userId } : {}),
      ...(kontext.begruendung ? { begruendung: kontext.begruendung } : {}),
    }],
  };
}

/**
 * Übernahme eines Import-Kandidaten in den Katalog. Existiert die ID schon, wird der
 * bestehende Baustein als **neue Version** bearbeitet (der Import bleibt eine
 * Fassung, kein zweiter Datensatz) — sonst ein neuer `entwurf`. Der bestehende Status
 * bleibt dabei erhalten (Bearbeitung ändert den Status nicht): ein bereits
 * freigegebener Baustein wird durch eine Text-Korrektur aus Word NICHT unfreigegeben,
 * ein Entwurf bleibt Entwurf.
 */
export function uebernehmeKandidat(
  katalog: TextbausteinKatalog, eingabe: NeuerBausteinEingabe, kontext: AenderungsKontext,
): TextbausteinKatalog {
  const bestehend = findeBaustein(katalog, eingabe.id.trim());
  if (bestehend) {
    const aktualisiert = bearbeiteBaustein(bestehend, {
      thema: eingabe.thema.trim(),
      kategorie: eingabe.kategorie.trim(),
      text: eingabe.text,
      aspekte: eingabe.aspekte,
      stichworte: eingabe.stichworte,
    }, kontext);
    return upsertBaustein(katalog, aktualisiert);
  }
  return upsertBaustein(katalog, neuerBaustein(eingabe, kontext));
}
