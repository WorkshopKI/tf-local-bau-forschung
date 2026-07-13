/**
 * „Neue Anträge für dich" ist seit v2.238 ein echtes Katalog-Widget (vorher
 * eine hart verdrahtete Home-Sonder-Sektion). Diese Tests sichern die
 * Katalog-Anbindung ab: verfügbar + Haupt-Bereich + flag-gebundene Sichtbarkeit,
 * KEIN Detail-Formular (art 'keine' → kein Stift), Opt-in wie alle v1.1-Widgets
 * (nicht im Default, per reconcileVerfuegbareWidgets als `sichtbar: false`
 * nachgezogen). Der Renderer selbst hängt an der compile-time-erzwungenen
 * `Record<WidgetTyp, …>`-Exhaustiveness in HomeWidgetStack (RENDERERS).
 */
import { describe, expect, it } from 'vitest';
import { WIDGET_KATALOG } from '../widgetCatalog';
import { defaultHomeWidgetConfig, reconcileVerfuegbareWidgets } from '../homeWidgetsStore';
import { hatWidgetDetailConfig } from '../types';

describe('neue-antraege — Katalog-Eintrag', () => {
  const eintrag = WIDGET_KATALOG['neue-antraege'];

  it('ist verfügbar, in der Hauptspalte, mit Icon + flag-gebundener Sichtbarkeit', () => {
    expect(eintrag.verfuegbar).toBe(true);
    expect(eintrag.bereich).toBe('haupt');
    expect(eintrag.icon).toBeTruthy();
    expect(typeof eintrag.sichtbarWenn).toBe('function');
  });

  it('hat keine Detail-Config (art "keine" → kein Stift, keine Aufklapp-Zeile)', () => {
    const cfg = eintrag.defaultConfig();
    expect(cfg).toEqual({ art: 'keine' });
    expect(hatWidgetDetailConfig(cfg)).toBe(false);
  });
});

describe('neue-antraege — Opt-in wie die übrigen v1.1-Widgets', () => {
  it('steht NICHT im Default (heutiges Default-Verhalten unverändert)', () => {
    const cfg = defaultHomeWidgetConfig();
    expect(cfg.widgets.some(w => w.typ === 'neue-antraege')).toBe(false);
  });

  it('wird per reconcile als sichtbar:false in Bestands-Configs nachgezogen', () => {
    const ohne = defaultHomeWidgetConfig();
    const nachgezogen = reconcileVerfuegbareWidgets(ohne);
    const neu = nachgezogen.widgets.find(w => w.typ === 'neue-antraege');
    expect(neu).toBeDefined();
    expect(neu!.sichtbar).toBe(false);
    expect(neu!.bereich).toBe('haupt');
    expect(neu!.config).toEqual({ art: 'keine' });
  });

  it('reconcile ist idempotent (kein Duplikat beim zweiten Lauf)', () => {
    const einmal = reconcileVerfuegbareWidgets(defaultHomeWidgetConfig());
    const zweimal = reconcileVerfuegbareWidgets(einmal);
    const anzahl = zweimal.widgets.filter(w => w.typ === 'neue-antraege').length;
    expect(anzahl).toBe(1);
  });
});
