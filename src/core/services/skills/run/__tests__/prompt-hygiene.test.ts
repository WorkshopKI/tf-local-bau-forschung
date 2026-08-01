/**
 * Prompt-Hygiene am GERENDERTEN Prompt (Prompt-Audit 2026-07).
 *
 * Der Convention-Guard `keine-elidierte-wortlaut-vorgabe` prüft Quelltext-ZEILEN. Die
 * teuersten Defekte des Audits entstehen aber erst beim Zusammensetzen: `composeSkillPrompt`
 * fügt bis zu acht Blöcke aneinander (Template, Tweak, Formale Vorgaben, teilStruktur,
 * Vortext, Modifier, Zusatz-Vorgabe, Teil-Vorgabe). Ein Widerspruch zwischen zwei davon —
 * oder eine Überschrift, deren Slot leer bleibt — steht in KEINER einzelnen Quellzeile.
 *
 * Diese Suite rendert die echten A–G-Skills mit ihren echten Regeln und prüft
 * Eigenschaften, die für jeden Prompt gelten müssen. Sie ersetzt keinen Modell-Lauf:
 * strukturelle Korrektheit ist testbar, die Wirkung auf die Laufzeit nicht.
 */
import { describe, it, expect } from 'vitest';
import { composeSkillPrompt, type SkillRunInput } from '../run-skill';
import {
  SEED_SKILL,
  SEED_REGELN,
  SEED_SKILLS_BG,
  SEED_REGELN_BG,
} from '@/core/services/skills/registry/seed';
import type { QualitaetsRegel, SkillRecord } from '@/core/services/skills/registry/types';

const ALLE_REGELN: QualitaetsRegel[] = [...SEED_REGELN, ...SEED_REGELN_BG];
const ALLE_SKILLS: SkillRecord[] = [SEED_SKILL, ...SEED_SKILLS_BG];

/**
 * BEWUSST ohne Markdown-Überschriften: die „keine leere Überschrift"-Prüfung unten
 * unterscheidet sonst nicht zwischen einer Struktur-Überschrift des Prompts und einer
 * Überschrift aus dem eingebetteten VB-Text. Geprüft werden soll der Prompt-Rahmen.
 */
const VB = 'Ausgangslage: ein Beispieltext.\n\nLösungsweg: noch ein Absatz.';

function regelnFuer(skill: SkillRecord): QualitaetsRegel[] {
  return skill.regelIds
    .map(id => ALLE_REGELN.find(r => r.id === id))
    .filter((r): r is QualitaetsRegel => r !== undefined);
}

/** Realistischer Einzellauf: alle deklarierten Slots gefüllt, kein Modifier. */
function baseInput(overrides: Partial<SkillRunInput> = {}): SkillRunInput {
  return {
    stammdaten: '- Förderkennzeichen (Verbund): 16KN000000\n- Akronym: BEISPIEL',
    vbMarkdown: VB,
    vorherigeAbschnitte: 'Keine — es sind noch keine früheren Abschnitte freigegeben.',
    ...overrides,
  } as SkillRunInput;
}

function render(skill: SkillRecord, input: SkillRunInput = baseInput()): string {
  return composeSkillPrompt(skill, regelnFuer(skill), input, VB);
}

describe('Prompt-Hygiene — gerenderte A–G-Prompts', () => {
  it('kein ungefüllter Slot-Platzhalter bleibt stehen', () => {
    for (const skill of ALLE_SKILLS) {
      expect(render(skill), skill.id).not.toMatch(/\{\{[a-zA-Z]+\}\}/);
    }
  });

  // Muster 5 des Audits: eine Überschrift, die etwas verspricht und nichts liefert.
  // Das Modell muss dann entscheiden, ob es etwas übersehen hat. Traf vor dem Fix bei
  // jedem frischen Gutachten JEDEN Abschnitt („Bereits freigegebene frühere Abschnitte").
  it('keine Überschrift ohne Inhalt', () => {
    const ebene = (z: string): number => z.match(/^(#{2,3})\s+\S/)?.[1]?.length ?? 0;
    for (const skill of ALLE_SKILLS) {
      const zeilen = render(skill).split('\n');
      zeilen.forEach((zeile, i) => {
        const eigene = ebene(zeile);
        if (eigene === 0) return;
        const naechsterInhalt = zeilen.slice(i + 1).find(z => z.trim().length > 0);
        expect(naechsterInhalt, `${skill.id}: „${zeile}" hat keinen Inhalt`).toBeDefined();
        // Eine TIEFERE Überschrift ist gültiger Inhalt (Verschachtelung: „## Ausgabeformat"
        // trägt „### Quellenanalyse"). Leer ist die Überschrift erst, wenn direkt eine
        // gleich- oder höherrangige folgt.
        const folgeEbene = ebene(naechsterInhalt ?? '');
        expect(folgeEbene === 0 || folgeEbene > eigene,
          `${skill.id}: „${zeile}" wird direkt von „${naechsterInhalt}" gefolgt — kein Inhalt dazwischen`)
          .toBe(true);
      });
    }
  });

  // Muster 2: eine Anweisung, die auf Information verweist, die im Prompt nicht steht.
  // Das Modell kann sie weder befolgen noch verifizieren und sucht die Referenz.
  it('keine Forderung, die auf nicht mitgeliefertes Material verweist', () => {
    for (const skill of ALLE_SKILLS) {
      const prompt = render(skill);
      expect(prompt, skill.id).not.toContain('die hinterlegten');
      expect(prompt, skill.id).not.toContain('siehe Anlage');
    }
  });

  // Bug-Klasse 13 am fertigen Prompt: verlangt er einen Wortlaut literal, darf der
  // Wortlaut nicht zitiert-und-abgeschnitten dastehen — und der Prompt muss sagen,
  // dass er absichtlich mitten im Satz endet.
  it('literale Wortlaut-Vorgaben stehen unzitiert und lösen das Satz-Ende auf', () => {
    for (const skill of ALLE_SKILLS) {
      const prompt = render(skill);
      const zeilen = prompt.split('\n');
      const verdaechtig = zeilen.filter(z =>
        /(exakt|wörtlich|wortgetreu|unverändert)/i.test(z) && /(…|\.\.\.)\s*[“”„»«"']/.test(z));
      expect(verdaechtig, `${skill.id}: ${verdaechtig.join(' | ')}`).toHaveLength(0);

      if (prompt.includes('mit genau diesem Wortlaut beginnen')
        || prompt.includes('beginnt mit genau diesem Wortlaut')) {
        expect(prompt, skill.id).toContain('endet absichtlich mitten im Satz');
      }
    }
  });

  // Muster 3, der häufigste Befund des Audits: zwei Blöcke fordern Gegenteiliges und
  // der Vorrang steht nur im Code-Kommentar — den sieht das Modell nicht.
  it('fordert ein Block JSON, wo ein anderer Fließtext verlangt, benennt er seinen Vorrang', () => {
    for (const skill of ALLE_SKILLS) {
      const prompt = render(skill);
      const fordertJson = prompt.includes('AUSSCHLIESSLICH ein JSON-Array');
      const fordertFliesstext = /Fließtext/i.test(prompt);
      if (!fordertJson || !fordertFliesstext) continue;
      expect(prompt, `${skill.id}: JSON- und Fließtext-Forderung ohne Vorrang-Angabe`)
        .toContain('Vorrang');
    }
  });

  // Gegenprobe: die Prüfung oben ist nur etwas wert, wenn sie den echten Defekt fängt.
  // Vor dem Fix lieferte `buildVorherigeAbschnitte` einen Leerstring, und genau diese
  // Form entstand — deshalb gibt die Funktion heute eine ausdrückliche Auskunft zurück.
  it('erkennt die leere Überschrift, wenn der Slot doch leer bliebe', () => {
    const b = SEED_SKILLS_BG.find(s => s.id === 'gutachten-ausgangslage')!;
    const mitLeeremSlot = render(b, baseInput({ vorherigeAbschnitte: '' }));
    const zeilen = mitLeeremSlot.split('\n');
    const i = zeilen.findIndex(z => z.startsWith('## Bereits freigegebene frühere Abschnitte'));
    expect(i).toBeGreaterThan(-1);
    const naechsterInhalt = zeilen.slice(i + 1).find(z => z.trim().length > 0);
    expect(naechsterInhalt).toMatch(/^## /); // → leere Überschrift, die der Test oben ablehnt
  });

  it('der Formale-Vorgaben-Block enthält keine leeren Aufzählungspunkte', () => {
    for (const skill of ALLE_SKILLS) {
      expect(render(skill).split('\n').filter(z => /^-\s*$/.test(z)), skill.id).toHaveLength(0);
    }
  });

  // Die strukturierte Ausgabe ist 2026-08 aus den GA-Skills entfernt (Migration
  // `ga-teilstruktur-entfernen-2026-08`): sie hängte einen autoritativen JSON-Block an,
  // dessen Schlüssel-Reihenfolge aus dem Seed stammte und jeder kuratierten Umsortierung
  // der Teile im Prompt-Text widersprach — und dessen Ergebnis der automatische
  // Feinschliff ohnehin verwarf (`applyLektorat` setzt `teile: undefined`).
  it('kein Gutachten-Prompt verlangt mehr eine JSON-Ausgabe des finalen Textes', () => {
    for (const skill of ALLE_SKILLS) {
      expect(skill.teilStruktur, `${skill.id} trägt wieder teilStruktur`).toBeUndefined();
      expect(render(skill), skill.id).not.toContain('AUSSCHLIESSLICH ein JSON-Array');
    }
  });

  // Teil-Generierung (Abschnitt B): die Teil-Vorgabe überstimmt das Template. Steht das
  // nicht im Prompt, muss das Modell subsumieren, ob auch der Inhaltskontrakt gemeint ist.
  it('die Teil-Vorgabe benennt ihren Vorrang über Umfang, Struktur UND Inhalt', () => {
    const b = SEED_SKILLS_BG.find(s => s.id === 'gutachten-ausgangslage')!;
    const prompt = render(b, baseInput({ teilAufgabe: 'Schreibe nur den ersten Teil.' }));
    expect(prompt).toContain('## Teil-Vorgabe (überstimmt Umfang, Struktur und Inhaltsangaben oben)');
    expect(prompt.indexOf('## Teil-Vorgabe')).toBeGreaterThan(prompt.indexOf('### Finaler Text'));
  });
});
