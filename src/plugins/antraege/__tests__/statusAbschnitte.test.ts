/**
 * Die sieben Abschnitte der Status-Gruppierung — Id, Kategorienmenge, Name.
 *
 * Hier steht die Tabelle, die A3 zugesagt hat: welcher Abschnitt 1:1 einer
 * Kategorie entspricht (und ihren Namen erbt), welcher eine Zusammenfassung ist
 * (und einen eigenen Namen trägt), und welcher am Rohwert hängt. Ohne diesen
 * Test wäre die Regel eine Absicht im Kommentar.
 */
import { describe, it, expect } from 'vitest';
import {
  STATUS_SECTIONS, STATUS_SECTION_ORDER, sectionOf, statusSectionLabel,
} from '../antragGroups';
import { KATEGORIE_TEXTE, AGGREGAT_TEXTE } from '@/core/utils/status-category-labels';
import type { StatusCategory } from '@/core/utils/status-canonical';

describe('Die sieben Abschnitte', () => {
  it('führt jede Kategorie in genau einem Abschnitt', () => {
    const alle = Object.keys(KATEGORIE_TEXTE) as StatusCategory[];
    for (const k of alle) {
      const treffer = STATUS_SECTIONS.filter(s => s.categories.includes(k));
      expect(treffer, k).toHaveLength(1);
    }
  });

  it('trägt die zugesagten Namen', () => {
    expect(STATUS_SECTION_ORDER.map(id => `${id} → ${statusSectionLabel(id)}`)).toEqual([
      'vor-entscheidung → Vor Entscheidung',
      'nachforderung → Wartet auf Antragsteller',
      'bewilligt → Bewilligt',
      'begleitung → Begleitung',
      'beendet → Beendet',
      'abgelehnt-zurueckgezogen → Abgelehnt/Zurückgezogen',
      'ohne-zuordnung → Ohne Zuordnung',
    ]);
  });

  it('1:1-Abschnitte ERBEN den Kategorienamen, statt einen zweiten zu führen', () => {
    for (const s of STATUS_SECTIONS) {
      if (s.categories.length !== 1) continue;
      expect(statusSectionLabel(s.id), s.id).toBe(KATEGORIE_TEXTE[s.categories[0]!].lang);
    }
  });

  it('Zusammenfassungen tragen einen Aggregatnamen', () => {
    expect(statusSectionLabel('vor-entscheidung')).toBe(AGGREGAT_TEXTE.vorEntscheidung.lang);
    expect(statusSectionLabel('beendet')).toBe(AGGREGAT_TEXTE.beendet.lang);
  });

  it('kein Abschnittsname deckt sich mit einer Kategoriebezeichnung, die er NICHT meint', () => {
    const kategorieNamen = new Map(
      (Object.keys(KATEGORIE_TEXTE) as StatusCategory[]).map(k => [KATEGORIE_TEXTE[k].lang, k]),
    );
    for (const s of STATUS_SECTIONS) {
      const gleichnamig = kategorieNamen.get(statusSectionLabel(s.id));
      if (gleichnamig === undefined) continue;
      // Wenn der Name einer Kategorie gehört, muss der Abschnitt GENAU diese meinen.
      expect(s.categories, `${s.id} heißt wie ${gleichnamig}`).toEqual([gleichnamig]);
    }
  });
});

describe('sectionOf', () => {
  it('sortiert die drei Vor-Entscheidungs-Kategorien in EINEN Abschnitt', () => {
    for (const s of ['beantragt', 'techn geprüft', 'bewilligungsreif']) {
      expect(sectionOf(s), s).toBe('vor-entscheidung');
    }
  });

  it('schneidet den amtlichen Negativ-Rohwert heraus — nicht die Kategorie', () => {
    expect(sectionOf('abgelehnt/zurückgezogen')).toBe('abgelehnt-zurueckgezogen');
    // „Schlussvermerk" ist dieselbe Kategorie, aber ein anderer Rohwert.
    expect(sectionOf('Schlussvermerk')).toBe('beendet');
  });

  it('Unbekanntes landet in „Ohne Zuordnung", nicht in einem Verfahrens-Abschnitt', () => {
    expect(sectionOf('fantasieStatus42')).toBe('ohne-zuordnung');
    expect(sectionOf('')).toBe('ohne-zuordnung');
  });
});
