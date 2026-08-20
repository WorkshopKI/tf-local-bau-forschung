/**
 * Schnüren + Lesen eines Kuratur-Pakets. Rein (keine IO, kein `new Date()` —
 * der Zeitstempel kommt von aussen).
 *
 * Gelesen wird über dieselben toleranten Normalisierer wie die Bestands-Bündel
 * (`normalizeRegistryFile` / `normalizeBaustein`): unbekannte Felder fallen weg,
 * fehlende defaulten, kaputte Einträge werden übersprungen statt zu werfen. Ein
 * von Hand editiertes Paket darf die Verwaltung nicht lahmlegen.
 *
 * Die Versions-**Historie** wird beim Schnüren entfernt: sie gehört dem Stand,
 * auf dem sie entstanden ist. Das Ziel führt seine eigene fort (siehe
 * `einspielen.ts`) — sonst überschriebe ein Import die Nachvollziehbarkeit
 * genau des Standes, den er ablöst.
 */
import { normalizeRegistryFile } from '../registry/storage';
import { normalizeBaustein } from '../textbausteine/storage';
import type { SkillRecord, SkillRegistryFile } from '../registry/types';
import type { TextbausteinKatalog, TextbausteinRecord } from '../textbausteine/types';
import { KURATUR_PAKET_KIND, type KuraturPaket, type PaketAuswahl } from './typen';

/** Alles mitnehmen — Vorbelegung des Export-Dialogs. */
export const ALLES: PaketAuswahl = { skills: true, regeln: true, workflows: true, bausteine: true };

function ohneSkillHistorie(skill: SkillRecord): SkillRecord {
  const { historie: _drop, ...rest } = skill;
  return rest;
}

function ohneBausteinHistorie(baustein: TextbausteinRecord): TextbausteinRecord {
  return { ...baustein, historie: [] };
}

/**
 * Schnürt den gewählten Ausschnitt des kuratierten Standes zu einem Paket.
 * `katalog` darf `null` sein (Katalog nicht geladen) — dann bleibt `bausteine` leer.
 */
export function schnuerePaket(
  file: SkillRegistryFile,
  katalog: TextbausteinKatalog | null,
  auswahl: PaketAuswahl,
  meta: { erstellt_am: string; quelle?: string },
): KuraturPaket {
  return {
    kind: KURATUR_PAKET_KIND,
    version: 1,
    erstellt_am: meta.erstellt_am,
    ...(meta.quelle ? { quelle: meta.quelle } : {}),
    skills: auswahl.skills ? file.skills.map(ohneSkillHistorie) : [],
    regeln: auswahl.regeln ? [...file.regeln] : [],
    workflows: auswahl.workflows ? [...(file.workflows ?? [])] : [],
    bausteine: auswahl.bausteine && katalog ? katalog.bausteine.map(ohneBausteinHistorie) : [],
  };
}

/**
 * Validiert + normalisiert rohes JSON zu einem Paket. `null` bei falscher
 * Struktur (fremdes `kind`, kein Objekt, unlesbare Registry-Sektion).
 */
export function parseKuraturPaket(raw: unknown): KuraturPaket | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const p = raw as Record<string, unknown>;
  if (p.kind !== KURATUR_PAKET_KIND) return null;

  const probe = normalizeRegistryFile({
    version: 1,
    updated_at: '',
    skills: Array.isArray(p.skills) ? p.skills : [],
    regeln: Array.isArray(p.regeln) ? p.regeln : [],
    workflows: Array.isArray(p.workflows) ? p.workflows : [],
  });
  if (!probe) return null;

  const bausteine = (Array.isArray(p.bausteine) ? p.bausteine : [])
    .map(normalizeBaustein)
    .filter((b): b is TextbausteinRecord => b !== null);

  return {
    kind: KURATUR_PAKET_KIND,
    version: 1,
    erstellt_am: typeof p.erstellt_am === 'string' ? p.erstellt_am : '',
    ...(typeof p.quelle === 'string' && p.quelle ? { quelle: p.quelle } : {}),
    skills: probe.skills,
    regeln: probe.regeln,
    workflows: probe.workflows ?? [],
    bausteine,
  };
}

/** Anzahl Einträge im Paket (für Dialog-Zähler). */
export function paketUmfang(paket: KuraturPaket): {
  skills: number; regeln: number; workflows: number; bausteine: number;
} {
  return {
    skills: paket.skills.length,
    regeln: paket.regeln.length,
    workflows: paket.workflows.length,
    bausteine: paket.bausteine.length,
  };
}
