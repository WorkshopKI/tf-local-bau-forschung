import { describe, it, expect } from 'vitest';
import { werkstattNachwirkung } from '../werkstattNachwirkung';

describe('werkstattNachwirkung', () => {
  it('schweigt, wenn die Version gleich blieb (nichts gespeichert)', () => {
    expect(werkstattNachwirkung({ versionVorher: 12, versionNachher: 12, abschnittStatus: 'entwurf' })).toBeNull();
  });

  it('schweigt bei unbekannter Version (kein Skill am Schritt)', () => {
    expect(werkstattNachwirkung({ versionVorher: null, versionNachher: 3, abschnittStatus: 'entwurf' })).toBeNull();
    expect(werkstattNachwirkung({ versionVorher: 3, versionNachher: null, abschnittStatus: 'entwurf' })).toBeNull();
  });

  it('bietet beim Entwurf das Neu-Erzeugen an und nennt beide Versionen', () => {
    const r = werkstattNachwirkung({ versionVorher: 12, versionNachher: 13, abschnittStatus: 'entwurf' });
    expect(r?.aktion).toBe('neu-erzeugen');
    expect(r?.text).toContain('v13');
    expect(r?.text).toContain('v12');
  });

  it('erzeugt bei einem freigegebenen Abschnitt NICHTS neu, sondern bietet Erneut-Öffnen', () => {
    const r = werkstattNachwirkung({ versionVorher: 4, versionNachher: 5, abschnittStatus: 'freigegeben' });
    expect(r?.aktion).toBe('erneut-oeffnen');
    expect(r?.text).toContain('bleibt unverändert');
  });

  it('bietet beim leeren Abschnitt keine Aktion an (der Generieren-Knopf steht dort ohnehin)', () => {
    const r = werkstattNachwirkung({ versionVorher: 1, versionNachher: 2, abschnittStatus: 'leer' });
    expect(r?.aktion).toBeNull();
    expect(r?.text).toContain('v2');
  });

  it('schweigt bei einer RÜCKWÄRTS laufenden Version (Fremd-Reload, kein eigener Save)', () => {
    expect(werkstattNachwirkung({ versionVorher: 9, versionNachher: 7, abschnittStatus: 'entwurf' })).toBeNull();
  });
});
