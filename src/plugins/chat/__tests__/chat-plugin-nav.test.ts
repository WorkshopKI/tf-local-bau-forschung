import { describe, it, expect } from 'vitest';
import { chatPlugin } from '../index';
import { ChatRedirect } from '../ChatRedirect';
import { navVisiblePlugins } from '@/core/nav/groupNavPlugins';

describe('chat-Plugin (Phase 4: Assistent-Panel in der Suche)', () => {
  it('ist aus der Nav ausgeblendet, Route bleibt /chat', () => {
    expect(chatPlugin.hideFromNav).toBe(true);
    expect(chatPlugin.route).toBe('/chat');
    expect(chatPlugin.id).toBe('chat');
  });

  it('taucht nicht in den nav-sichtbaren Plugins auf', () => {
    const ids = navVisiblePlugins([chatPlugin]).map(p => p.id);
    expect(ids).not.toContain('chat');
    expect(ids).toEqual([]);
  });

  it('ChatRedirect leitet auf die Suche mit offenem Panel um', () => {
    const el = ChatRedirect();
    const props = el.props as { to: string; replace?: boolean };
    expect(props.to).toBe('/suche?assistent=1');
    expect(props.replace).toBe(true);
  });
});
