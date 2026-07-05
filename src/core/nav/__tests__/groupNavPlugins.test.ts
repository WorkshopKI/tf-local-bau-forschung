import { describe, it, expect } from 'vitest';
import type { ComponentType } from 'react';
import type { TeamFlowPlugin } from '@/core/types/plugin';
import { groupNavPlugins, navVisiblePlugins } from '../groupNavPlugins';

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
    expect(groups.system).toEqual([]);
    expect(groups.kuration).toEqual([]);
  });

  it('trennt die system-Gruppe von workflow/tools', () => {
    const plugins = [
      plugin({ id: 'home', category: 'workflow', order: 0 }),
      plugin({ id: 'suche', category: 'workflow', order: 8 }),
      plugin({ id: 'skill-verwaltung-kuration', category: 'system', order: 10 }),
      plugin({ id: 'einstellungen', category: 'system', order: 20 }),
    ];
    const groups = groupNavPlugins(plugins);
    expect(groups.workflow.map(p => p.id)).toEqual(['home', 'suche']);
    expect(groups.system.map(p => p.id)).toEqual(['skill-verwaltung-kuration', 'einstellungen']);
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
