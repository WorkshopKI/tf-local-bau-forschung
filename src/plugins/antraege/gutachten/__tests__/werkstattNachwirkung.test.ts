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

  it('bietet beim Entwurf das Neu-Erzeugen an und nennt die Herkunft des TEXTES', () => {
    // Die Herkunft ist die am Lauf gestempelte Version, nicht die Registry-Version
    // beim Öffnen der Werkstatt: lag zwischen Generierung und Werkstatt-Besuch ein
    // Save, sind das zwei verschiedene Zahlen (v4.124).
    const r = werkstattNachwirkung({
      versionVorher: 12, versionNachher: 13, versionDesTextes: 11, abschnittStatus: 'entwurf',
    });
    expect(r?.aktion).toBe('neu-erzeugen');
    expect(r?.text).toContain('v13');
    expect(r?.text).toContain('v11');
    expect(r?.text).not.toContain('v12');
  });

  it('nennt beim Entwurf ohne gestempelte Version gar keine Herkunft', () => {
    const r = werkstattNachwirkung({ versionVorher: 12, versionNachher: 13, abschnittStatus: 'entwurf' });
    expect(r?.aktion).toBe('neu-erzeugen');
    expect(r?.text).toBe('Anweisung gespeichert (v13). Sie wirkt beim nächsten Erzeugen.');
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
