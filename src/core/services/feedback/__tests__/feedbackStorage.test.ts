import { describe, expect, it } from 'vitest';
import { normalizeLegacyFields } from '../feedbackStorage';
import { makeFeedback } from './fixtures';

describe('normalizeLegacyFields', () => {
  it('ist Identity wenn kurator_status bereits gesetzt', () => {
    const item = makeFeedback({ kurator_status: 'umgesetzt', kurator_priority: 3 });
    const out = normalizeLegacyFields(item);
    expect(out).toBe(item); // Referenz-gleich, kein Re-Construct
  });

  it('mappt admin_status → kurator_status wenn fehlend', () => {
    // Bewusst kurator_status leer (undefined) setzen, sonst greift Identity-Path.
    const item = makeFeedback();
    // Override via cast — Migration-Pfad ist bewusst auch "nicht-default"-tolerant
    const legacy = { ...item, kurator_status: undefined as never, admin_status: 'umgesetzt' as const };
    const out = normalizeLegacyFields(legacy);
    expect(out.kurator_status).toBe('umgesetzt');
  });

  it('Default kurator_status="neu" wenn weder admin noch kurator gesetzt', () => {
    const item = makeFeedback();
    const legacy = { ...item, kurator_status: undefined as never };
    const out = normalizeLegacyFields(legacy);
    expect(out.kurator_status).toBe('neu');
  });

  it('mappt admin_priority + admin_notes wenn kurator-Felder leer', () => {
    const item = makeFeedback();
    const legacy = {
      ...item,
      kurator_status: undefined as never,
      admin_status: 'in_bearbeitung' as const,
      admin_priority: 5,
      admin_notes: 'alter Notizen-Text',
    };
    const out = normalizeLegacyFields(legacy);
    expect(out.kurator_status).toBe('in_bearbeitung');
    expect(out.kurator_priority).toBe(5);
    expect(out.kurator_notes).toBe('alter Notizen-Text');
  });

  // ── Entfallene Kategorie 'ux' → 'idea' (v2.289) ────────────────────────────

  it('migriert die entfallene Kategorie ux → idea', () => {
    const item = { ...makeFeedback({ kurator_status: 'neu' }), category: 'ux' as never };
    const out = normalizeLegacyFields(item);
    expect(out.category).toBe('idea');
  });

  it('schlüsselt die structured-Felder des UX-Typs um (pain→goal, better→idea)', () => {
    const item = {
      ...makeFeedback({ kurator_status: 'neu' }),
      category: 'ux' as never,
      structured: { pain: 'Zu viele Klicks', better: 'Direkt-Button' },
    };
    const out = normalizeLegacyFields(item);
    expect(out.structured).toEqual({ goal: 'Zu viele Klicks', idea: 'Direkt-Button' });
  });

  it('überschreibt vorhandene goal/idea-Werte nicht', () => {
    const item = {
      ...makeFeedback({ kurator_status: 'neu' }),
      category: 'ux' as never,
      structured: { goal: 'bereits gesetzt', pain: 'Zu viele Klicks' },
    };
    const out = normalizeLegacyFields(item);
    expect(out.structured).toEqual({ goal: 'bereits gesetzt' });
  });

  it('lässt Tickets ohne ux-Kategorie referenzgleich', () => {
    const item = makeFeedback({ kurator_status: 'neu', category: 'idea' });
    expect(normalizeLegacyFields(item)).toBe(item);
  });

  it('kurator-Felder gewinnen über admin-Felder bei Mischbestand', () => {
    const item = makeFeedback();
    const mixed = {
      ...item,
      kurator_status: undefined as never,
      kurator_priority: 7,
      admin_priority: 2,
    };
    const out = normalizeLegacyFields(mixed);
    expect(out.kurator_priority).toBe(7);
  });
});
