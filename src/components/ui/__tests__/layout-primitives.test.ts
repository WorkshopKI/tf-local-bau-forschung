import { describe, it, expect } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PageHeader } from '../PageHeader';
import { StatusBadge, StatusDot } from '../StatusBadge';
import { FilterChip } from '../FilterChip';
import { ScopeTabs, type ScopeTabItem } from '../ScopeTabs';

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
