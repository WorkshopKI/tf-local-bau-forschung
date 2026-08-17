import { describe, it, expect } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PageHeader } from '../PageHeader';
import { StatusBadge, StatusDot } from '../StatusBadge';
import { FilterChip } from '../FilterChip';
import { ScopeTabs, type ScopeTabItem } from '../ScopeTabs';
import { DarstellungDropdown } from '../DarstellungDropdown';
import type { DarstellungAchse } from '../darstellungsAchsen';
import { LaneListe } from '../LaneListe';
import type { TfBahnSpalten } from '@/components/kanban/tfBoardBahn';

// Smoke-/Render-Tests der Layout-Primitive (Phase 2). Die Test-Suite läuft im
// node-Env ohne DOM und ohne JSX (Konvention: nur *.test.ts) → React.createElement
// + renderToStaticMarkup. Geprüft wird: rendert ohne Wurf, Props erscheinen,
// variant schaltet die Darstellung, Token-Klassen vorhanden.
const noop = (): void => {};

describe('PageHeader', () => {
  it('rendert Titel + canonical H1-Klassen', () => {
    const html = renderToStaticMarkup(h(PageHeader, { title: 'Förderanträge' }));
    expect(html).toContain('Förderanträge');
    expect(html).toContain('text-[22px]');
    expect(html).toContain('text-[var(--tf-text)]');
    expect(html).toContain('<h1');
  });

  it('rendert subtitle, meta und actions', () => {
    const html = renderToStaticMarkup(
      h(PageHeader, {
        title: 'Themen-Vektoren',
        subtitle: 'Embedding-Katalog aktuell halten',
        meta: h('span', null, 'Profil: THÜ'),
        actions: h('button', null, 'Export'),
      }),
    );
    expect(html).toContain('Embedding-Katalog aktuell halten');
    expect(html).toContain('Profil: THÜ');
    expect(html).toContain('Export');
    expect(html).toContain('ml-auto');
  });
});

describe('StatusDot / StatusBadge', () => {
  it('StatusDot trägt Farbe + a11y-Label', () => {
    const html = renderToStaticMarkup(h(StatusDot, { color: '#22c55e', title: 'Bewilligt' }));
    expect(html).toContain('background:#22c55e');
    expect(html).toContain('aria-label="Bewilligt"');
    expect(html).toContain('rounded-full');
  });

  it('StatusBadge zeigt Label und Punkt nur bei gesetzter Farbe', () => {
    const withColor = renderToStaticMarkup(h(StatusBadge, { label: 'Ablehnungsreif', color: '#ef4444' }));
    expect(withColor).toContain('Ablehnungsreif');
    expect(withColor).toContain('background:#ef4444');
    expect(withColor).toContain('rounded-full');

    const noColor = renderToStaticMarkup(h(StatusBadge, { label: 'Neu' }));
    expect(noColor).toContain('Neu');
    expect(noColor).not.toContain('background:');
  });
});

describe('FilterChip', () => {
  it('rendert Label, Wert und ✕ nur bei onRemove', () => {
    const removable = renderToStaticMarkup(
      h(FilterChip, { label: 'Kategorie', value: 'Bewilligt', onRemove: noop }),
    );
    expect(removable).toContain('Kategorie:');
    expect(removable).toContain('Bewilligt');
    expect(removable).toContain('<svg'); // X-Icon
    expect(removable).toContain('rounded-full');

    const plain = renderToStaticMarkup(h(FilterChip, { label: 'Status', value: 'Offen', onClick: noop }));
    expect(plain).toContain('Status:');
    expect(plain).not.toContain('<svg'); // kein X ohne onRemove
  });
});

describe('ScopeTabs', () => {
  const items: ScopeTabItem[] = [
    { key: 'offen', label: 'Offen', count: 1234 },
    { key: 'alle', label: 'Alle', count: 387 },
  ];

  it('variant=tabs: aktiver Tab unterstrichen, Zähler de-DE-formatiert', () => {
    const html = renderToStaticMarkup(h(ScopeTabs, { items, activeKey: 'offen', onChange: noop }));
    expect(html).toContain('Offen');
    expect(html).toContain('1.234'); // de-DE Tausendertrennung
    expect(html).toContain('border-b-2'); // Unterstrich-Variante
    expect(html).toContain('aria-selected="true"');
  });

  it('variant=pills: kompakte Pill-Darstellung statt Unterstrich', () => {
    const html = renderToStaticMarkup(
      h(ScopeTabs, { items, activeKey: 'alle', onChange: noop, variant: 'pills' }),
    );
    expect(html).toContain('h-[26px]'); // Pill-Höhe
    expect(html).toContain('bg-[var(--tf-primary-light)]'); // aktive Pill
    expect(html).not.toContain('border-b-2'); // kein Tab-Unterstrich
  });

  it('beide Varianten setzen role=tablist/tab', () => {
    const tabs = renderToStaticMarkup(h(ScopeTabs, { items, activeKey: 'offen', onChange: noop }));
    const pills = renderToStaticMarkup(h(ScopeTabs, { items, activeKey: 'offen', onChange: noop, variant: 'pills' }));
    expect(tabs).toContain('role="tablist"');
    expect(tabs).toContain('role="tab"');
    expect(pills).toContain('role="tablist"');
  });
});

describe('DarstellungDropdown', () => {
  const achsen: DarstellungAchse<'gruppierung' | 'archiv'>[] = [{
    id: 'gruppierung',
    art: 'segment',
    label: 'Gruppieren nach',
    options: [{ key: 'keine', label: 'Keine' }, { key: 'bereich', label: 'Bereich' }],
    value: 'keine',
    standard: 'keine',
  }];

  const mitSchalter: DarstellungAchse<'gruppierung' | 'archiv'>[] = [
    { ...achsen[0]!, value: 'bereich' },
    {
      id: 'archiv',
      art: 'schalter',
      anKey: 'ein',
      label: 'Archivierte zeigen',
      options: [{ key: 'aus', label: 'ausgeblendet' }, { key: 'ein', label: 'eingeblendet' }],
      value: 'ein',
      standard: 'aus',
    },
  ];

  it('trägt im Standardzustand nur seinen Namen — der Knopf bleibt schmal', () => {
    const html = renderToStaticMarkup(h(DarstellungDropdown, { achsen, onChange: noop }));
    expect(html).toContain('Ansicht');
    expect(html).not.toContain('Ansicht:');
    expect(html).not.toContain('Bereich');
  });

  it('hängt die abweichende Achse an den Knopf', () => {
    const html = renderToStaticMarkup(h(DarstellungDropdown, {
      achsen: [{ ...achsen[0]!, value: 'bereich' }],
      onChange: noop,
    }));
    expect(html).toContain('Ansicht:');
    expect(html).toContain('Bereich');
    // Eine einzelne Abweichung bekommt keinen Zähler.
    expect(html).not.toContain('+1');
  });

  it('zählt weitere Abweichungen als „+N" in der Primärfarbe, statt sie aufzureihen', () => {
    const html = renderToStaticMarkup(h(DarstellungDropdown, {
      achsen: mitSchalter, onChange: noop,
    }));
    expect(html).toContain('Bereich');
    expect(html).toContain('+1');
    expect(html).toContain('text-[var(--tf-primary)]');
    // Der zweite Wert steht NICHT ausgeschrieben am Knopf.
    expect(html).not.toContain('eingeblendet');
  });

  it('rendert das Menü erst beim Öffnen (geschlossen keine Kopfzeile)', () => {
    const html = renderToStaticMarkup(h(DarstellungDropdown, { achsen, onChange: noop }));
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain('Zurücksetzen');
  });
});

describe('LaneListe', () => {
  const optionen = [
    { key: 'neu', label: 'Neu', akzent: 'var(--tf-fb-lane-neu)' },
    { key: 'geplant', label: 'Geplant' },
    { key: 'fertig', label: 'Fertig' },
  ];
  // Gewählt = im Map, der Wert ist die Kartenspaltenzahl. „geplant" fehlt hier
  // absichtlich: eine abgewählte Zeile bleibt sichtbar, nur ohne Häkchen.
  const spaltenProKey = new Map<string, TfBahnSpalten>([['neu', 1], ['fertig', 3]]);

  it('rendert eine Zeile je Lane mit Sichtbar-Überschrift und Spalten-Schalter', () => {
    const html = renderToStaticMarkup(h(LaneListe, {
      options: optionen, spaltenProKey, onToggle: noop, onSpalten: noop,
    }));
    expect(html).toContain('Sichtbar');
    expect(html).toContain('Spalten');
    expect(html).toContain('Neu');
    expect(html).toContain('Geplant');
    // Häkchen-Slot ist auch bei abgewählter Zeile da, nur unsichtbar (Pitfall #14).
    expect(html).toContain('invisible');
  });

  // Der Schalter bietet jede Spaltenzahl an, für die das Primitiv eine Geometrie
  // hat — bis v4.21 waren es zwei. Ein Segment ohne Boden in `tf-board.css` wäre
  // wieder das Versprechen ohne Wirkung, das dem Board von v3.12 bis v3.45 als
  // toter 1|2-Schalter anhing.
  it('bietet je Zeile 1, 2 und 3 Kartenspalten an und markiert die gewählte', () => {
    const html = renderToStaticMarkup(h(LaneListe, {
      options: optionen, spaltenProKey, onToggle: noop, onSpalten: noop,
    }));
    // Drei Lanes × drei Segmente.
    expect(html.match(/Kartenspalten?"/g)?.length).toBe(9);
    expect(html).toContain('aria-label="Neu: 1 Kartenspalte"');
    expect(html).toContain('aria-label="Neu: 3 Kartenspalten"');
    // Genau ein gedrücktes Segment je gewählter Zeile („geplant" ist abgewählt).
    expect(html.match(/aria-pressed="true"/g)?.length).toBe(2);
    expect(html).toContain('aria-label="Fertig: 3 Kartenspalten" aria-pressed="true"');
  });

  // Ohne `onVerschiebe` bleibt die Liste, was sie für die Home-Widgets war:
  // keine Pfeile, keine „Folge"-Spalte, keine zusätzliche Zeilenbreite.
  it('zeigt ohne onVerschiebe keine Pfeile', () => {
    const html = renderToStaticMarkup(h(LaneListe, {
      options: optionen, spaltenProKey, onToggle: noop, onSpalten: noop,
    }));
    expect(html).not.toContain('Folge');
    expect(html).not.toContain('nach vorn');
    expect(html).not.toContain('nach hinten');
  });

  it('gibt mit onVerschiebe je Zeile ein Pfeilpaar und dämpft die Ränder', () => {
    const html = renderToStaticMarkup(h(LaneListe, {
      options: optionen, spaltenProKey, onToggle: noop, onSpalten: noop, onVerschiebe: noop,
    }));
    expect(html).toContain('Folge');
    // Ein Pfeilpaar je Zeile — drei Lanes, sechs beschriftete Knöpfe.
    expect(html.match(/aria-label="Lane /g)?.length).toBe(6);
    // Erste Zeile kann nicht weiter nach vorn, letzte nicht weiter nach hinten —
    // gedämpft statt entfernt, sonst rutschte die Zeile an den Rändern.
    // `title` steht in einem Attribut — das schließende Anführungszeichen ist
    // dort escaped.
    expect(html).toContain('„Neu&quot; steht schon ganz vorn');
    expect(html).toContain('„Fertig&quot; steht schon ganz hinten');
    // Die Zeile in der Mitte kann in beide Richtungen.
    expect(html).not.toContain('„Geplant&quot; steht schon');
  });
});

