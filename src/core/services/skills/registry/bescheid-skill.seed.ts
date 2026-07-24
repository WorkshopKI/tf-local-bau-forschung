/**
 * RNE-/ABL-Füll-Skills + WorkflowDefs (Artefakt-Engine, Draft).
 *
 * Rücknahmeempfehlung (RNE) und Ablehnung (ABL) folgen exakt dem NF-Muster
 * ([nf-skill.seed.ts](./nf-skill.seed.ts)): gegebene Bausteine **wortgetreu**, nur
 * Platzhalter füllen / Alternativen wählen — der Rechtstext wird NIE umformuliert
 * (Pitfall #34). Der Unterschied ist allein die Rahmung des Bescheids; die tragenden
 * Gründe kommen aus dem kuratierten Baustein-Katalog (Typ `rne`/`abl`), eingespeist
 * über den `{{nfBausteine}}`-Slot (schon in `INHALTS_SLOTS` → dokument-tragend →
 * intern, Pitfall #30).
 *
 * Beide als **Draft** (`aktiv:false`, WorkflowDef `freigabe:'entwurf'`): auf dem
 * geteilten Share wäre ein aktiver Skill/Workflow sofort teamweit live.
 */
import type { QualitaetsRegel, SkillModifierKey, SkillRecord, WorkflowDef } from './types';

const SEED_TS = '2026-07-24T00:00:00.000Z';

export const RNE_SKILL_ID = 'zim-rne-fueller';
export const ABL_SKILL_ID = 'zim-abl-fueller';

/** Gemeinsamer Modifier-Satz (wie NF): erneut/kürzer/länger über die Bausteine. */
const BESCHEID_MODIFIERS: Record<SkillModifierKey, string> = {
  neu: 'Prüfe die zugeordneten Bausteine erneut auf Passung — gleiche Quellenbasis, gleiche Wortgetreuheit.',
  kuerzer: 'Beschränke dich auf die tragenden Gründe — entferne Bausteine zu Nebenaspekten. '
    + 'Die verbleibenden Bausteine bleiben wortgetreu (nicht kürzen).',
  laenger: 'Ergänze weitere zutreffende Bausteine aus den vorgegebenen — keine eigenen Formulierungen.',
};

interface BescheidSpec {
  id: string;
  name: string;
  /** Artefakt-Bezeichnung im Prompt (z. B. „Rücknahmeempfehlung"). */
  artefakt: string;
  /** Ein Satz, der die Rahmung des Bescheids erklärt. */
  rahmung: string;
}

function bescheidPrompt(spec: BescheidSpec): string {
  return `Erstelle die tragenden Gründe einer **${spec.artefakt}** zu einem ZIM-Teilvorhaben auf Basis der vorgegebenen Bausteine.

${spec.rahmung}

## Stammdaten des Antrags
{{stammdaten}}

## Gesamtvorhaben-Kontext (Verbund)
{{verbundKontext}}

## Teilvorhaben (Quelle der Analyse)
{{tvKontext}}

## Vorgegebene Textbausteine (ausschließlich diese verwenden, wortgetreu)
{{nfBausteine}}

## Aufgabe & Kontrakt
1. Verwende AUSSCHLIESSLICH die vorgegebenen Bausteine — wähle keine anderen und erfinde keine.
2. **Fülle ausschließlich die Platzhalter** des jeweiligen Bausteins und **wähle bei Alternativen die zutreffende Variante**.

Regeln:
- **Wortgetreu:** Verwende die Baustein-Texte EXAKT wie vorgegeben. Formuliere den Rechtstext NIEMALS um, kürze ihn nicht und ergänze keine eigenen Sätze.
- **Platzhalter-Typen:** \`…\`/\`...\` = freie Einsetzung aus dem Antrag; \`{a / b / c}\` = genau EINE Alternative wählen; \`{…}\` = optionaler Einschub (behalten, wenn zutreffend, sonst ersatzlos streichen); \`x €\`/Zahlen = konkreten Wert aus dem Antrag einsetzen.
- **Streng quellenbasiert:** Nutze ausschließlich Inhalte des Antrags. Fehlende Angaben kennzeichne wörtlich mit „[Im Antrag nicht genannt]".
- Es bleiben **keine** ungefüllten Platzhalter (\`…\`, \`{…}\`, \`x €\`) im finalen Text.

## Ausgabeformat (genau diese drei Abschnitte, jeweils mit der ###-Überschrift)
### Quellenanalyse
Die tragenden Gründe — je mit kurzem Beleg-Zitat aus dem Antrag und der verwendeten Baustein-ID.

### Entwurf
Je Grund: Baustein-ID + der Baustein mit eingesetzten Platzhaltern (Arbeitsstand).

### Finaler Text
Die fertigen tragenden Gründe — wortgetreuer Baustein-Text mit gefüllten Platzhaltern.`;
}

function bescheidSystemPrompt(artefakt: string): string {
  return `Du bist ein erfahrener Sachbearbeiter für ZIM-Forschungsanträge und formulierst die tragenden Gründe einer ${artefakt} `
    + 'aus vorgegebenen Textbausteinen. Du verwendest die Bausteine WORTGETREU und füllst ausschließlich deren Platzhalter '
    + 'bzw. wählst bei Alternativen die zutreffende Variante. Antworte ausschließlich auf Deutsch und halte dich exakt an das vorgegebene Ausgabeformat.';
}

/** Baut einen Bescheid-Füll-Skill (RNE/ABL). Regel-Bindung = NF-Platzhalter-/Meta-Tor (reuse). */
function bescheidSkill(spec: BescheidSpec): SkillRecord {
  return {
    id: spec.id,
    name: spec.name,
    beschreibung: `Füllt die Platzhalter vorgegebener ${spec.artefakt}-Bausteine wortgetreu aus der Antragsanalyse (Auswahl trifft der Mensch in der Werkbank).`,
    version: 1,
    promptTemplate: bescheidPrompt(spec),
    systemPrompt: bescheidSystemPrompt(spec.artefakt),
    maxTokens: 3072,
    modifiers: BESCHEID_MODIFIERS,
    regelIds: ['nf-keine-platzhalter', 'nf-keine-meta'],
    slots: ['stammdaten', 'verbundKontext', 'tvKontext', 'nfBausteine'],
    aktiv: false,
    geaendert_am: SEED_TS,
  };
}

export const SEED_RNE_SKILL: SkillRecord = bescheidSkill({
  id: RNE_SKILL_ID,
  name: 'Rücknahmeempfehlung (Füllung)',
  artefakt: 'Rücknahmeempfehlung',
  rahmung: 'Die Rücknahmeempfehlung legt dem Antragsteller nahe, den Antrag zurückzunehmen, und nennt die tragenden Gründe.',
});

export const SEED_ABL_SKILL: SkillRecord = bescheidSkill({
  id: ABL_SKILL_ID,
  name: 'Ablehnung (Füllung)',
  artefakt: 'Ablehnung',
  rahmung: 'Die Ablehnung bescheidet den Antrag negativ und nennt die tragenden Gründe.',
});

/** RNE-/ABL-WorkflowDefs — je ein Lauf PRO Teilvorhaben (`ebene:'tv'`), Draft. */
export const RNE_DEF: WorkflowDef = {
  id: 'zim-rne',
  name: 'ZIM-Rücknahmeempfehlung',
  version: 1,
  artefaktTyp: 'rne',
  ebene: 'tv',
  aktiv: false,
  freigabe: 'entwurf',
  steps: [{ id: 'RNE', nr: 'RNE', kurz: 'RNE', label: 'Rücknahmeempfehlung', skillId: RNE_SKILL_ID, gateExpr: 'immer', kontextBedarf: 'voll' }],
};

export const ABL_DEF: WorkflowDef = {
  id: 'zim-abl',
  name: 'ZIM-Ablehnung',
  version: 1,
  artefaktTyp: 'abl',
  ebene: 'tv',
  aktiv: false,
  freigabe: 'entwurf',
  steps: [{ id: 'ABL', nr: 'ABL', kurz: 'ABL', label: 'Ablehnung', skillId: ABL_SKILL_ID, gateExpr: 'immer', kontextBedarf: 'voll' }],
};

/** Beide Bescheid-Skills + WorkflowDefs (Draft) — für den SEED_REGISTRY-Merge. */
export const SEED_BESCHEID_SKILLS: SkillRecord[] = [SEED_RNE_SKILL, SEED_ABL_SKILL];
export const SEED_BESCHEID_WORKFLOWS: WorkflowDef[] = [RNE_DEF, ABL_DEF];
/** Bescheid-Skills bringen keine eigenen Regeln mit (reuse der NF-Tore). */
export const SEED_BESCHEID_REGELN: QualitaetsRegel[] = [];
