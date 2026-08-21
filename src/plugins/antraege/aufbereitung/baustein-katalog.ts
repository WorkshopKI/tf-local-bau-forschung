/**
 * Der Katalog der KI-Bausteine — EINE Tabelle statt sechs Kopien pro Belang.
 *
 * Vorher trug jeder Baustein seine Eigenschaften verstreut: zwei `useState` im Hook
 * (Skill + UI-Zustand), ein Zweig im Lade-Effekt, einer in „Neu aufbereiten", einer in
 * der Rehydrierung, einer im Lauf, ein Cache-Präfix im Löschpfad. Ein neuer Baustein
 * war damit eine Änderung an acht Stellen, und die Fix-Serie der letzten Releases hing
 * genau daran: es genügte, EINE davon zu vergessen.
 *
 * Hier steht jeder Baustein einmal. Wer einen hinzufügt, ergänzt einen Eintrag —
 * Hook, Rehydrierung und Cache-Löschung ziehen sich ihre Arbeit selbst daraus.
 *
 * Bewusst hook-frei und ohne IDB-Zugriff: der Katalog ist Daten (plus je ein
 * Lauf-Adapter), damit er in Node getestet werden kann.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { SkillRecord } from '@/core/services/skills';
import {
  AUFBEREITUNG_ASPEKTE_SKILL, AUFBEREITUNG_ASPEKTE_SKILL_ID,
  AUFBEREITUNG_STECKBRIEF_SKILL, AUFBEREITUNG_STECKBRIEF_SKILL_ID,
  AUFBEREITUNG_ZAHLEN_SKILL, AUFBEREITUNG_ZAHLEN_SKILL_ID,
  AUFBEREITUNG_GLOSSAR_SKILL, AUFBEREITUNG_GLOSSAR_SKILL_ID,
  AUFBEREITUNG_VERWERTUNG_SKILL, AUFBEREITUNG_VERWERTUNG_SKILL_ID,
  AUFBEREITUNG_RECHERCHE_PROMPT_SKILL, AUFBEREITUNG_RECHERCHE_PROMPT_SKILL_ID,
} from '@/core/services/skills';
import type { AITransport } from '@/core/services/ai/transports/streamlit';
import type { KiRolle } from '@/core/services/ai/modell-katalog';
import {
  aspekteCacheKey, glossarCacheKey, steckbriefCacheKey, verwertungCacheKey, zahlenCacheKey,
  type BausteinResult,
} from './bausteine';
import { computeAspekteBaustein, type AspektMapping } from './aspekte';
import { computeSteckbriefBaustein, type SteckbriefDaten } from './steckbrief';
import { computeZahlenBaustein, type ZahlenDaten } from './zahlen';
import { computeGlossarBaustein, type GlossarDaten } from './glossar';
import { computeVerwertungBaustein, type VerwertungDaten } from './verwertung';
import {
  computeRecherchePromptBaustein, recherchePromptCacheKey, type RecherchePromptDaten,
} from './recherche-prompt';
import type { VbSektion } from './gliederung';
import type { BekannteStammwerte } from './recherche-leak';

/** Die sechs KI-Bausteine der Aufbereitungs-Seite. */
export type AufbereitungBausteinId =
  | 'recherchePrompt' | 'aspekte' | 'steckbrief' | 'zahlen' | 'glossar' | 'verwertung';

/** Id → Datentyp. Die eine Stelle, an der die Zuordnung steht. */
export interface BausteinDatenMap {
  recherchePrompt: RecherchePromptDaten;
  aspekte: AspektMapping;
  steckbrief: SteckbriefDaten;
  zahlen: ZahlenDaten;
  glossar: GlossarDaten;
  verwertung: VerwertungDaten;
}

/**
 * Alles, was ein Baustein-Lauf braucht. Eine gemeinsame Hülle, weil die fünf
 * Gliederungs-Bausteine und der Recherche-Prompt unterschiedliche Parameter ziehen
 * (`gliederung` vs. `bekannteWerte`) — der Adapter im Katalog nimmt sich, was er braucht.
 */
export interface BausteinLaufDeps {
  idb: IDBStore;
  transport: AITransport;
  skill: SkillRecord;
  antragKey: string;
  gliederung: VbSektion[];
  /** Korpus (VB + narrative Zusatzdokumente) — die Bausteine laufen auf ihm, nicht auf der VB allein. */
  korpus: string;
  bekannteWerte: BekannteStammwerte;
  opts: { force?: boolean; ziel?: KiRolle; ueberStandardCap?: boolean };
}

export interface BausteinEintrag<K extends AufbereitungBausteinId> {
  id: K;
  /** Seed-Skill — Fallback, solange die Registry nichts Kuratiertes liefert. */
  seedSkill: SkillRecord;
  /** Skill-ID für den Registry-Lookup. */
  skillId: string;
  /** kv-Cache-Key (pro Antrag + Korpus-Hash). Trägt zugleich die Präfix-Ableitung fürs Löschen. */
  cacheKey: (antragKey: string, vbHash: string) => string;
  /** EIN Lauf dieses Bausteins über den (injizierten, internen) Transport. */
  lauf: (deps: BausteinLaufDeps) => Promise<BausteinResult<BausteinDatenMap[K]>>;
}

/**
 * Reihenfolge = Lauf-Reihenfolge. `recherchePrompt` steht ZUERST, damit der Prüfer die
 * externe Deep Research (5–10 Min) starten kann, während die übrigen weiterlaufen.
 * Das ist die einzige Stelle, an der diese Reihenfolge festgelegt wird.
 */
export const BAUSTEIN_KATALOG: { [K in AufbereitungBausteinId]: BausteinEintrag<K> } = {
  recherchePrompt: {
    id: 'recherchePrompt',
    seedSkill: AUFBEREITUNG_RECHERCHE_PROMPT_SKILL,
    skillId: AUFBEREITUNG_RECHERCHE_PROMPT_SKILL_ID,
    cacheKey: recherchePromptCacheKey,
    lauf: d => computeRecherchePromptBaustein(
      d.idb, d.transport, d.skill, d.antragKey, d.korpus, d.bekannteWerte, d.opts,
    ),
  },
  aspekte: {
    id: 'aspekte',
    seedSkill: AUFBEREITUNG_ASPEKTE_SKILL,
    skillId: AUFBEREITUNG_ASPEKTE_SKILL_ID,
    cacheKey: aspekteCacheKey,
    lauf: d => computeAspekteBaustein(
      d.idb, d.transport, d.skill, d.antragKey, d.gliederung, d.korpus, d.opts,
    ),
  },
  steckbrief: {
    id: 'steckbrief',
    seedSkill: AUFBEREITUNG_STECKBRIEF_SKILL,
    skillId: AUFBEREITUNG_STECKBRIEF_SKILL_ID,
    cacheKey: steckbriefCacheKey,
    lauf: d => computeSteckbriefBaustein(
      d.idb, d.transport, d.skill, d.antragKey, d.gliederung, d.korpus, d.opts,
    ),
  },
  zahlen: {
    id: 'zahlen',
    seedSkill: AUFBEREITUNG_ZAHLEN_SKILL,
    skillId: AUFBEREITUNG_ZAHLEN_SKILL_ID,
    cacheKey: zahlenCacheKey,
    lauf: d => computeZahlenBaustein(
      d.idb, d.transport, d.skill, d.antragKey, d.gliederung, d.korpus, d.opts,
    ),
  },
  glossar: {
    id: 'glossar',
    seedSkill: AUFBEREITUNG_GLOSSAR_SKILL,
    skillId: AUFBEREITUNG_GLOSSAR_SKILL_ID,
    cacheKey: glossarCacheKey,
    lauf: d => computeGlossarBaustein(
      d.idb, d.transport, d.skill, d.antragKey, d.gliederung, d.korpus, d.opts,
    ),
  },
  verwertung: {
    id: 'verwertung',
    seedSkill: AUFBEREITUNG_VERWERTUNG_SKILL,
    skillId: AUFBEREITUNG_VERWERTUNG_SKILL_ID,
    cacheKey: verwertungCacheKey,
    lauf: d => computeVerwertungBaustein(
      d.idb, d.transport, d.skill, d.antragKey, d.gliederung, d.korpus, d.opts,
    ),
  },
};

/** Die Bausteine in Lauf-Reihenfolge (Objekt-Schlüssel-Reihenfolge = Deklarations-Reihenfolge). */
export const BAUSTEIN_IDS = Object.keys(BAUSTEIN_KATALOG) as AufbereitungBausteinId[];

/**
 * kv-Präfixe der Baustein-Caches eines Antrags (alle Korpus-Hashes).
 *
 * Abgeleitet aus dem echten Cache-Key mit einem Platzhalter-Hash, statt die Präfixe
 * ein zweites Mal zu tippen: so kann ein Key seine Form ändern (der Recherche-Prompt
 * trägt z.B. eine Schema-Version im Pfad), ohne dass der Löschpfad still danebenliegt.
 */
export function bausteinCachePraefixe(antragKey: string): string[] {
  // Ein Zeichen, das in keinem djb2-Hash vorkommt — so laesst sich der Praefix
  // sauber vom variablen Hash-Teil abschneiden.
  const PLATZHALTER = '#';
  const ausKatalog = BAUSTEIN_IDS.map(id => {
    const key = BAUSTEIN_KATALOG[id].cacheKey(antragKey, PLATZHALTER);
    return key.slice(0, key.indexOf(PLATZHALTER));
  });
  // Der Struktur-Lauf importierter externer Recherchen ist KEIN Katalog-Baustein
  // (er haengt am Hash des EXTERNEN Textes, nicht am Korpus) — sein Cache gehoert
  // aber zum selben Antrag und muss beim „neu berechnen" mit weg.
  return [...ausKatalog, `aufbereitung:${antragKey}:recherche-import:`];
}

/** Loescht die Baustein-Caches eines Antrags (alle Korpus-Hashes) — fuer „KI-Bausteine neu berechnen". */
export async function loescheBausteinCaches(idb: IDBStore, antragKey: string): Promise<void> {
  for (const praefix of bausteinCachePraefixe(antragKey)) {
    const keys = await idb.keys(praefix).catch(() => [] as string[]);
    for (const k of keys) await idb.delete(k).catch(() => {});
  }
}
