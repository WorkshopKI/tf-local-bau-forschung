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
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SeitenHilfeButton } from '@/components/help/SeitenHilfeButton';
import { useSichtbar } from '@/core/hooks/useSichtbar';
import { abschnittId, reiterId } from '@/core/sichtbarkeit';
import { SettingsNav } from './SettingsNav';
import { buildSearchIndex, type SettingsPanel } from './panels';
import {
  HubPluginContext,
  SettingsKopfStatusAnker,
  SettingsSprungProvider,
  type SettingsSprungZiel,
} from './settings-layout';

/**
 * Weg von einem Panel ins andere — fuer Uebersichts-Seiten, die auf ihre
 * eigenen Unterseiten zeigen („12 warten auf Pruefung → dorthin").
 *
 * Ohne das bliebe einem Panel nur `navigate('/kuration/…')`, also ein
 * Routen-Wechsel auf die eigene Seite: der Hub montierte neu und verloere den
 * Zustand, den der Nutzer gerade aufgebaut hat.
 */
interface HubNavigation {
  geheZuPanel: (panelId: string) => void;
  geheZuAbschnitt: (panelId: string, sectionId: string) => void;
}

const HubNavigationContext = createContext<HubNavigation | null>(null);

/**
 * Einen Deep-Link-Parameter zum Vergleichen bringen: getrimmt und klein.
 * `null`, wenn nach dem Trimmen nichts uebrig ist — `?sektion=` ohne Wert ist
 * dasselbe wie kein Parameter und darf keinen Hinweis ausloesen.
 *
 * Klein geschrieben, weil `?sektion=SEC-ACCOUNT` aus einer Mail oder einem
 * Wiki dieselbe Stelle meint wie `sec-account`; die Ids selbst sind ohnehin
 * durchgehend klein.
 */
function normId(roh: string | null | undefined): string | null {
  const s = roh?.trim().toLowerCase() ?? '';
  return s.length > 0 ? s : null;
}

export function useHubNavigation(): HubNavigation {
  const ctx = useContext(HubNavigationContext);
  if (!ctx) throw new Error('useHubNavigation nur innerhalb von SettingsHubPage');
  return ctx;
}

export function SettingsHubPage({
  titel,
  pluginId,
  panels: allePanels,
  hinweis,
}: {
  /** Überschrift der Seite — auch die Vorlese-Beschriftung des Suchfelds. */
  titel: string;
  /** Für die Seiten-Hilfe (`docs/feedback-kontext/<id>.md`). */
  pluginId: string;
  /** Flag-gefilterte Panel-Registry des Wirts. Nie leer. */
  panels: SettingsPanel[];
  /**
   * Eine Aussage über die GANZE Seite, unter der Kopfzeile und über der
   * Navigationsspalte — für die Kuration der Sperr-Hinweis. Gehört hierher und
   * nicht in die Panels: er gilt für alle gleichermaßen, und in jedem Panel
   * einzeln stünde er wieder viermal da.
   */
  hinweis?: React.ReactNode;
}): React.ReactElement {
  // Beta/Experte: EIN Schnitt für beide Hubs. Panels sind Reiter, Abschnitte
  // sind Abschnitte — und weil der Suchindex aus `panels` abgeleitet wird,
  // fallen Navigation und Trefferliste automatisch mit. Die Karten selbst
  // prüfen sich in `SettingsGruppe`/`SettingsOption` über denselben Kontext;
  // beide Wege lesen dieselbe Id, können also nicht auseinanderlaufen.
  const sichtbar = useSichtbar();
  const panels = useMemo(() => {
    // Ein Abschnitt fällt weg, wenn ihn die Achse verbirgt ODER sein Wirt
    // (`in`) schon weggefallen ist — sonst bliebe eine Klappe allein im
    // Suchindex stehen, während die Karte um sie herum verschwunden ist.
    const sichtbareAbschnitte = (sections: SettingsPanel['sections']): SettingsPanel['sections'] => {
      const geblieben = new Set<string>();
      return sections.filter(s => {
        if (!sichtbar(abschnittId(pluginId, s.id))) return false;
        if (s.in != null && !geblieben.has(s.in)) return false;
        geblieben.add(s.id);
        return true;
      });
    };
    return allePanels
      .filter(p => sichtbar(reiterId(pluginId, p.id)))
      .map(p => ({ ...p, sections: sichtbareAbschnitte(p.sections) }));
  }, [allePanels, pluginId, sichtbar]);

  const [activePanel, setActivePanel] = useState(panels[0]?.id ?? '');

  // Sprung-Ziel der Suche/Deep-Links. Es steuert DREI Dinge: den Scroll hier,
  // die stehende Markierung am Ziel (`data-tf-treffer`) und — über den Kontext
  // — das Aufklappen der `SettingsKlappe`, in der das Ziel steckt. Der Zähler
  // macht denselben Treffer wiederholbar.
  const [sprung, setSprung] = useState<SettingsSprungZiel | null>(null);
  const sprungZaehler = useRef(0);
  // Hat der Nutzer den Deep-Link-Hinweis durch eigene Bedienung abgeräumt?
  const [hinweisWeg, setHinweisWeg] = useState(false);
  // Ein Sprung, dessen Anker die Karte gerade nicht rendert (siehe Scroll-Effekt).
  const [fehlenderAnker, setFehlenderAnker] = useState<{ label: string; gruppe: string } | null>(null);
  // Als State, nicht als Ref: der Portal-Anker muss einen Re-Render auslösen,
  // sonst rendert der erste Durchlauf ohne Ziel und der Status bleibt leer.
  const [kopfStatusEl, setKopfStatusEl] = useState<HTMLDivElement | null>(null);

  const searchIndex = useMemo(() => buildSearchIndex(panels), [panels]);
  const hubNav = useMemo<HubNavigation>(
    () => ({
      geheZuPanel: (id: string) => waehlePanel(id),
      geheZuAbschnitt: (panelId: string, sectionId: string) => goToSection(panelId, sectionId),
    }),
    // Beide Funktionen sind stabil (nur setState + Ref) — als Abhaengigkeit
    // wuerden sie den Kontext bei jedem Render neu bauen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Aktives Panel darf nach Flag-/Sichtbarkeitswechsel nicht ins Leere zeigen.
  const active = panels.find(p => p.id === activePanel) ?? panels[0]!;

  const goToSection = (panelId: string, sectionId: string): void => {
    setActivePanel(panelId);
    sprungZaehler.current += 1;
    setSprung({ id: sectionId, nr: sprungZaehler.current });
    setHinweisWeg(true);
    setFehlenderAnker(null);
  };

  // Seitenwechsel per Navigation räumt eine stehende Markierung ab: sie gehört
  // zum Treffer, nicht zur Seite. Dasselbe gilt für den Deep-Link-Hinweis —
  // bis v4.116 hing er allein an der URL, die ein Panel-Wechsel nicht anfasst,
  // und stand darum auf jeder weiteren Seite ungefragt weiter.
  const waehlePanel = (id: string): void => {
    setActivePanel(id);
    setSprung(null);
    setHinweisWeg(true);
    setFehlenderAnker(null);
  };

  // Deep-Link von außerhalb: `?sektion=sec-widgets` springt Panel + Anker an,
  // `?panel=foerderprogramme` öffnet nur die Seite (die Redirects der alten
  // Kuration-Routen nutzen das). Einmal pro Wert behandeln (Ref), damit
  // spätere Panel-Wechsel nicht zurückgezogen werden.
  const [searchParams] = useSearchParams();
  const behandelt = useRef<string | null>(null);
  useEffect(() => {
    const sektion = normId(searchParams.get('sektion'));
    const panelParam = normId(searchParams.get('panel'));
    if (sektion == null && panelParam == null) return;
    const schluessel = `${panelParam ?? ''}|${sektion ?? ''}`;
    if (behandelt.current === schluessel) return;
    if (sektion != null) {
      const panel = panels.find(p => p.sections.some(s => s.id.toLowerCase() === sektion));
      const treffer = panel?.sections.find(s => s.id.toLowerCase() === sektion);
      if (panel && treffer) {
        behandelt.current = schluessel;
        goToSection(panel.id, treffer.id);
        return;
      }
    }
    const panelTreffer = panels.find(p => p.id.toLowerCase() === panelParam);
    if (panelTreffer) {
      behandelt.current = schluessel;
      waehlePanel(panelTreffer.id);
    }
    // `goToSection`/`waehlePanel` sind stabil genug (nur setState + Ref) — als
    // Abhängigkeit würden sie den Effekt bei jedem Render neu bewerten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, panels]);

  /**
   * Ein Deep-Link, der nicht ankommt — und der Grund dafür.
   *
   * Ohne diesen Zweig passierte schlicht nichts: der Link „funktioniert", nur
   * ohne Wirkung, und der Nutzer sucht auf der falschen Seite. Bis v4.116 deckte
   * der Hinweis genau EINEN Fall ab — eine Id, die die Beta-/Experten-Schalter
   * gerade verbergen. Alles andere fiel still durch: ein Tippfehler, ein
   * Abschnitt, den ein Feature-Flag oder ein Modulschloss aus der Registry
   * genommen hat, ein unbekannter `?panel=`-Wert. Ein Lesezeichen auf einen
   * Abschnitt, den der eigene Build nicht hat, landete wortlos auf Seite eins.
   */
  const zielHinweis = useMemo<{ art: 'verborgen' | 'unbekannt'; text: string } | null>(() => {
    const sektionRoh = searchParams.get('sektion')?.trim() ?? '';
    const sektion = normId(sektionRoh);
    if (sektion != null) {
      if (panels.some(p => p.sections.some(s => s.id.toLowerCase() === sektion))) return null;
      const verborgen = allePanels
        .flatMap(p => p.sections)
        .find(s => s.id.toLowerCase() === sektion);
      return verborgen
        ? { art: 'verborgen', text: verborgen.label }
        : { art: 'unbekannt', text: sektionRoh };
    }
    const panelRoh = searchParams.get('panel')?.trim() ?? '';
    const panelParam = normId(panelRoh);
    if (panelParam == null) return null;
    if (panels.some(p => p.id.toLowerCase() === panelParam)) return null;
    const verborgenesPanel = allePanels.find(p => p.id.toLowerCase() === panelParam);
    return verborgenesPanel
      ? { art: 'verborgen', text: verborgenesPanel.label }
      : { art: 'unbekannt', text: panelRoh };
  }, [searchParams, panels, allePanels]);

  // Ein neuer Link zeigt den Hinweis wieder — abgeräumt wird er erst durch
  // eine Bedienung im Hub (`waehlePanel` / `goToSection`).
  useEffect(() => {
    setHinweisWeg(false);
  }, [searchParams]);

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
      const ziel = document.getElementById(sprung.id);
      // Der Anker steht in der Registry, aber nicht im DOM: die Karte rendert
      // ihn nur unter einer LAUFZEIT-Bedingung, die die Registry nicht kennt
      // (das Fachprofil braucht ein aufgelöstes Kürzel). Bis v4.116 passierte
      // dann nichts — die Trefferliste schloss sich, es sah nach Wirkung aus,
      // und der Nutzer suchte auf der richtigen Seite vergeblich. Jetzt nennt
      // der Hinweis die Karte, die den Grund trägt.
      if (!ziel) {
        const eintrag = panels.flatMap(p => p.sections).find(s => s.id === sprung.id);
        if (eintrag) setFehlenderAnker({ label: eintrag.label, gruppe: eintrag.gruppe });
        return;
      }
      setFehlenderAnker(null);
      ziel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.addEventListener('pointerdown', abraeumen, { once: true, capture: true });
      document.addEventListener('keydown', abraeumen, { once: true, capture: true });
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('pointerdown', abraeumen, { capture: true });
      document.removeEventListener('keydown', abraeumen, { capture: true });
    };
  }, [sprung, panels]);

  return (
    <div className="px-8 pt-4 pb-6">
      {/* Kopfzeile über die volle Blattbreite, Rumpf darunter schmal: der
          Hilfe-Knopf steht auf jeder Seite am rechten Blattrand
          (ui-muster.md, Guard `hilfe-knopf-am-blattrand`). */}
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-[22px] font-medium text-[var(--tf-text)]">{titel}</h1>
        <div className="ml-auto shrink-0"><SeitenHilfeButton pluginId={pluginId} /></div>
      </div>

      {hinweis != null && <div className="max-w-[1280px]">{hinweis}</div>}

      {fehlenderAnker != null && (
        <div
          className="max-w-[1280px] mb-4 rounded-[var(--tf-radius)] px-3 py-2 text-[12.5px] leading-[1.5]"
          style={{ background: 'var(--tf-info-bg)', color: 'var(--tf-info-text)' }}
        >
          „{fehlenderAnker.label}" gehört zur Karte „{fehlenderAnker.gruppe}" und ist dort gerade
          nicht ausgefüllt — die Karte sagt, was dafür fehlt.
        </div>
      )}

      {zielHinweis != null && !hinweisWeg && (
        <div
          className="max-w-[1280px] mb-4 rounded-[var(--tf-radius)] px-3 py-2 text-[12.5px] leading-[1.5]"
          style={{ background: 'var(--tf-info-bg)', color: 'var(--tf-info-text)' }}
        >
          {zielHinweis.art === 'verborgen' ? (
            <>
              Der gesuchte Abschnitt „{zielHinweis.text}" ist gerade ausgeblendet. Er erscheint,
              sobald in „Mein Profil › Umfang der Oberfläche" der passende Schalter an ist.
            </>
          ) : (
            <>
              Der Link zeigt auf „{zielHinweis.text}" — diesen Abschnitt gibt es in dieser
              Programmfassung nicht. Vielleicht stammt er aus einer anderen Fassung oder hat sich
              ein Tippfehler eingeschlichen; die Suche links findet ihn, falls er umbenannt wurde.
            </>
          )}
        </div>
      )}

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
          <HubNavigationContext.Provider value={hubNav}>
            <HubPluginContext.Provider value={pluginId}>
              <SettingsKopfStatusAnker el={kopfStatusEl}>
                <SettingsSprungProvider ziel={sprung}>
                  {active.render()}
                </SettingsSprungProvider>
              </SettingsKopfStatusAnker>
            </HubPluginContext.Provider>
          </HubNavigationContext.Provider>
        </div>
      </div>
    </div>
  );
}
