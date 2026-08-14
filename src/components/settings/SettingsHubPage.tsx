/**
 * Seitenrahmen eines Hubs in der Einstellungs-Seitenform: Kopfzeile über die
 * volle Blattbreite, links die Navigationsspalte mit Suche, rechts das aktive
 * Panel.
 *
 * Hier lebt die Sprung-Mechanik GENAU EINMAL — Zähler, Scroll, stehende
 * Markierung, Abräumen beim nächsten Klick. Beide Wirte (Einstellungen,
 * Kuration) reichen nur ihre Panel-Registry herein; ein zweiter Nachbau wäre
 * ein zweiter Ort, an dem der Härtefall „Sprung ohne Scroll-Weg" kaputtgehen
 * kann (v4.32).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SeitenHilfeButton } from '@/components/help/SeitenHilfeButton';
import { SettingsNav } from './SettingsNav';
import { buildSearchIndex, type SettingsPanel } from './panels';
import {
  SettingsKopfStatusAnker,
  SettingsSprungProvider,
  type SettingsSprungZiel,
} from './settings-layout';

export function SettingsHubPage({
  titel,
  pluginId,
  panels,
}: {
  /** Überschrift der Seite — auch die Vorlese-Beschriftung des Suchfelds. */
  titel: string;
  /** Für die Seiten-Hilfe (`docs/feedback-kontext/<id>.md`). */
  pluginId: string;
  /** Flag-gefilterte Panel-Registry des Wirts. Nie leer. */
  panels: SettingsPanel[];
}): React.ReactElement {
  const [activePanel, setActivePanel] = useState(panels[0]?.id ?? '');

  // Sprung-Ziel der Suche/Deep-Links. Es steuert DREI Dinge: den Scroll hier,
  // die stehende Markierung am Ziel (`data-tf-treffer`) und — über den Kontext
  // — das Aufklappen der `SettingsKlappe`, in der das Ziel steckt. Der Zähler
  // macht denselben Treffer wiederholbar.
  const [sprung, setSprung] = useState<SettingsSprungZiel | null>(null);
  const sprungZaehler = useRef(0);
  // Als State, nicht als Ref: der Portal-Anker muss einen Re-Render auslösen,
  // sonst rendert der erste Durchlauf ohne Ziel und der Status bleibt leer.
  const [kopfStatusEl, setKopfStatusEl] = useState<HTMLDivElement | null>(null);

  const searchIndex = useMemo(() => buildSearchIndex(panels), [panels]);

  // Aktives Panel darf nach Flag-/Sichtbarkeitswechsel nicht ins Leere zeigen.
  const active = panels.find(p => p.id === activePanel) ?? panels[0]!;

  const goToSection = (panelId: string, sectionId: string): void => {
    setActivePanel(panelId);
    sprungZaehler.current += 1;
    setSprung({ id: sectionId, nr: sprungZaehler.current });
  };

  // Seitenwechsel per Navigation räumt eine stehende Markierung ab: sie gehört
  // zum Treffer, nicht zur Seite.
  const waehlePanel = (id: string): void => {
    setActivePanel(id);
    setSprung(null);
  };

  // Deep-Link von außerhalb: `?sektion=sec-widgets` springt Panel + Anker an,
  // `?panel=verzeichnisse` öffnet nur die Seite (die Redirects der alten
  // Kuration-Routen nutzen das). Einmal pro Wert behandeln (Ref), damit
  // spätere Panel-Wechsel nicht zurückgezogen werden.
  const [searchParams] = useSearchParams();
  const behandelt = useRef<string | null>(null);
  useEffect(() => {
    const sektion = searchParams.get('sektion');
    const panelParam = searchParams.get('panel');
    if (sektion == null && panelParam == null) return;
    const schluessel = `${panelParam ?? ''}|${sektion ?? ''}`;
    if (behandelt.current === schluessel) return;
    if (sektion != null) {
      const panel = panels.find(p => p.sections.some(s => s.id === sektion));
      if (panel) {
        behandelt.current = schluessel;
        goToSection(panel.id, sektion);
        return;
      }
    }
    if (panelParam != null && panels.some(p => p.id === panelParam)) {
      behandelt.current = schluessel;
      waehlePanel(panelParam);
    }
    // `goToSection`/`waehlePanel` sind stabil genug (nur setState + Ref) — als
    // Abhängigkeit würden sie den Effekt bei jedem Render neu bewerten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, panels]);

  // Scroll einen Tick nach dem Panel-Wechsel: erst dann ist das Ziel gemountet.
  // Bewusst `setTimeout` statt `requestAnimationFrame` — rAF ruht, solange das
  // Fenster nicht zeichnet (Hintergrund-Tab), der Sprung liefe dort ins Leere
  // und feuerte später nach. Die Klappe darum öffnet sich in ihrem eigenen
  // Effekt; ihr `<section id>`-Anker steht auch zugeklappt im DOM, der Sprung
  // braucht sie also nicht abzuwarten.
  //
  // `block: 'center'` statt `'start'`: so bleibt der Kartentitel über dem
  // Treffer im Bild — er sagt dem Nutzer, WO er gelandet ist.
  //
  // Die Markierung am Ziel setzt der Kontext (`useSprungTreffer`); abgeräumt
  // wird sie beim NÄCHSTEN Klick/Tastendruck. Der Listener wird im selben Tick
  // registriert wie der Scroll — das `pointerdown`, das den Sprung ausgelöst
  // hat, ist da längst durch und räumt sich nicht selbst ab.
  useEffect(() => {
    if (!sprung) return;
    const abraeumen = (): void => setSprung(null);
    const t = window.setTimeout(() => {
      document.getElementById(sprung.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.addEventListener('pointerdown', abraeumen, { once: true, capture: true });
      document.addEventListener('keydown', abraeumen, { once: true, capture: true });
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('pointerdown', abraeumen, { capture: true });
      document.removeEventListener('keydown', abraeumen, { capture: true });
    };
  }, [sprung]);

  return (
    <div className="px-8 pt-4 pb-6">
      {/* Kopfzeile über die volle Blattbreite, Rumpf darunter schmal: der
          Hilfe-Knopf steht auf jeder Seite am rechten Blattrand
          (ui-muster.md, Guard `hilfe-knopf-am-blattrand`). */}
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-[22px] font-medium text-[var(--tf-text)]">{titel}</h1>
        <div className="ml-auto shrink-0"><SeitenHilfeButton pluginId={pluginId} /></div>
      </div>

      <div className="grid grid-cols-[224px_1fr] items-start gap-0 max-w-[1280px]">
        <SettingsNav
          panels={panels}
          activePanel={active.id}
          onSelectPanel={waehlePanel}
          searchIndex={searchIndex}
          onGoToSection={goToSection}
          suchLabel={`${titel} durchsuchen`}
        />
        <div className="pl-7 min-w-0">
          <div className="flex items-start gap-4 pb-3.5 mb-3.5 border-b border-[var(--tf-border)]">
            <div className="min-w-0">
              <h2 className="text-[17px] font-medium leading-tight text-[var(--tf-text)]">{active.label}</h2>
              <p className="text-[12.5px] leading-[1.5] text-[var(--tf-text-secondary)] mt-0.5">
                {active.untertitel}
              </p>
            </div>
            {/* Status-Anker: gefüllt wird er von der Gruppe, die tatsächlich
                speichert (siehe SettingsKopfStatus) — sonst bleibt er leer. */}
            <div ref={setKopfStatusEl} className="ml-auto shrink-0 pt-0.5 empty:hidden" />
          </div>
          <SettingsKopfStatusAnker el={kopfStatusEl}>
            <SettingsSprungProvider ziel={sprung}>
              {active.render()}
            </SettingsSprungProvider>
          </SettingsKopfStatusAnker>
        </div>
      </div>
    </div>
  );
}
