import { describe, it, expect } from 'vitest';
import type { ComponentType } from 'react';
import type { TeamFlowPlugin } from '@/core/types/plugin';
import {
  groupNavPlugins, navVisiblePlugins, sichtbareGruppenItems, NAV_GRUPPEN_LABEL,
} from '../groupNavPlugins';

const Dummy = (() => null) as ComponentType;

function plugin(p: Partial<TeamFlowPlugin> & Pick<TeamFlowPlugin, 'id' | 'category' | 'order'>): TeamFlowPlugin {
  return { route: `/${p.id}`, name: p.id, icon: 'Circle', component: Dummy, ...p };
}

describe('groupNavPlugins', () => {
  it('sortiert innerhalb der Gruppen nach order aufsteigend', () => {
    const plugins = [
      plugin({ id: 'suche', category: 'workflow', order: 8 }),
      plugin({ id: 'home', category: 'workflow', order: 0 }),
      plugin({ id: 'antraege', category: 'workflow', order: 2 }),
    ];
    const groups = groupNavPlugins(plugins);
    expect(groups.workflow.map(p => p.id)).toEqual(['home', 'antraege', 'suche']);
  });

  it('filtert hideFromNav-Plugins aus allen Gruppen', () => {
    const plugins = [
      plugin({ id: 'home', category: 'workflow', order: 0 }),
      plugin({ id: 'chat', category: 'workflow', order: 9, hideFromNav: true }),
      plugin({ id: 'feedback-board', category: 'tools', order: 75, hideFromNav: true }),
    ];
    const groups = groupNavPlugins(plugins);
    expect(groups.workflow.map(p => p.id)).toEqual(['home']);
    expect(groups.tools).toEqual([]);
    expect(navVisiblePlugins(plugins).map(p => p.id)).toEqual(['home']);
  });

  it('lässt leere Gruppen leer (kein undefined)', () => {
    const groups = groupNavPlugins([plugin({ id: 'home', category: 'workflow', order: 0 })]);
    expect(groups.tools).toEqual([]);
    expect(groups.erprobung).toEqual([]);
    expect(groups.system).toEqual([]);
    expect(groups.kuration).toEqual([]);
  });

  it('trennt die system-Gruppe von workflow/tools', () => {
    const plugins = [
      plugin({ id: 'home', category: 'workflow', order: 0 }),
      plugin({ id: 'suche', category: 'workflow', order: 8 }),
      plugin({ id: 'irgendwas-system', category: 'system', order: 10 }),
    ];
    const groups = groupNavPlugins(plugins);
    expect(groups.workflow.map(p => p.id)).toEqual(['home', 'suche']);
    expect(groups.system.map(p => p.id)).toEqual(['irgendwas-system']);
  });

  it('verteilt die Seiten auf täglich / Werkzeuge / In Erprobung (Ist-Stand)', () => {
    // Seit v2.362 trennt die Sidebar drei sichtbare Blöcke. Die Reife-Aussage
    // steht am Manifest, NICHT am featureFlag — sonst wechselte eine Seite die
    // Gruppe als Nebenwirkung einer Flag-Änderung.
    const plugins = [
      plugin({ id: 'home', category: 'workflow', order: 0 }),
      plugin({ id: 'antraege', category: 'workflow', order: 2 }),
      plugin({ id: 'auslastung', category: 'workflow', order: 4 }),
      plugin({ id: 'suche', category: 'tools', order: 20 }),
      plugin({ id: 'skill-verwaltung-kuration', category: 'tools', order: 22 }),
      plugin({ id: 'feedback-board', category: 'tools', order: 24 }),
      plugin({ id: 'meilensteine', category: 'erprobung', order: 40 }),
      plugin({ id: 'anfragen', category: 'erprobung', order: 42 }),
      plugin({ id: 'map-foerderfaehig', category: 'erprobung', order: 44 }),
      plugin({ id: 'status-cockpit', category: 'erprobung', order: 46 }),
      plugin({ id: 'einstellungen', category: 'system', order: 60, hideFromNav: true }),
    ];
    const groups = groupNavPlugins(plugins);
    expect(groups.workflow.map(p => p.id)).toEqual(['home', 'antraege', 'auslastung']);
    expect(groups.tools.map(p => p.id)).toEqual(['suche', 'skill-verwaltung-kuration', 'feedback-board']);
    expect(groups.erprobung.map(p => p.id)).toEqual(['meilensteine', 'anfragen', 'map-foerderfaehig', 'status-cockpit']);
    expect(groups.system).toEqual([]);
  });

  it('beschriftet nur die Gruppen, die eine Ansage brauchen', () => {
    expect(NAV_GRUPPEN_LABEL.workflow).toBeNull();
    expect(NAV_GRUPPEN_LABEL.system).toBeNull();
    expect(NAV_GRUPPEN_LABEL.tools).toBe('Werkzeuge');
    expect(NAV_GRUPPEN_LABEL.erprobung).toBe('In Erprobung');
    expect(NAV_GRUPPEN_LABEL.kuration).toBe('Kuration');
  });
});

describe('sichtbareGruppenItems', () => {
  const items = [
    plugin({ id: 'meilensteine', category: 'erprobung', order: 40 }),
    plugin({ id: 'anfragen', category: 'erprobung', order: 42 }),
  ];

  it('zeigt aufgeklappt alles', () => {
    expect(sichtbareGruppenItems(items, true, 'home').map(p => p.id))
      .toEqual(['meilensteine', 'anfragen']);
  });

  it('zeigt zugeklappt nichts', () => {
    expect(sichtbareGruppenItems(items, false, 'home')).toEqual([]);
  });

  it('lässt zugeklappt die offene Seite stehen (Ortsangabe)', () => {
    expect(sichtbareGruppenItems(items, false, 'anfragen').map(p => p.id)).toEqual(['anfragen']);
  });

  it('kommt mit leerer Gruppe klar', () => {
    expect(sichtbareGruppenItems([], false, 'home')).toEqual([]);
  });

  it('füllt die kuration-Gruppe getrennt (Kurator-Builds)', () => {
    const plugins = [
      plugin({ id: 'home', category: 'workflow', order: 0 }),
      plugin({ id: 'feedback-kuration', category: 'kuration', order: 90 }),
    ];
    const groups = groupNavPlugins(plugins);
    expect(groups.kuration.map(p => p.id)).toEqual(['feedback-kuration']);
  });
});
