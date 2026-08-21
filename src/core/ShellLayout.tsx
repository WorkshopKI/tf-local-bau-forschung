import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from 'zustand';
import * as Icons from 'lucide-react';
import type { TeamFlowPlugin } from '@/core/types/plugin';
import { keyboardService } from '@/core/services/keyboard';
import { CommandPalette } from '@/components/ui/CommandPalette';
import type { CommandItem } from '@/components/ui/CommandPalette';
import { useDarkMode } from '@/core/hooks/useDarkMode';
import {
  MOBILE_BREAKPOINT,
  effektiverModus,
  umgeschalteteWahl,
  type SidebarModus,
} from '@/core/nav/sidebarModus';
import { SyncStatusIndicator } from '@/components/ui/SyncStatusIndicator';
import { BridgeStatusIndicator } from '@/components/ui/BridgeStatusIndicator';
import { CsvFreshnessIndicator } from '@/components/ui/CsvFreshnessIndicator';
import { BridgeDisconnectHint } from '@/components/ui/BridgeDisconnectHint';
import { EinklappButton } from '@/components/ui/EinklappIcon';
import { KiConnectPromptDialog } from '@/core/components/KiConnectPromptDialog';
import { useTourContext } from '@/core/hooks/useTour';
import { useProfile } from '@/core/hooks/useProfile';
import { TOUR_STEPS } from '@/core/components/tour/tourSteps';
import { TourOverlay } from '@/core/components/tour/TourOverlay';
import { FeedbackButton } from '@/components/feedback';
import {
  groupNavPlugins, navVisiblePlugins, sichtbareGruppenItems,
  NAV_GRUPPEN_LABEL, type NavGroupKey,
} from '@/core/nav/groupNavPlugins';
import { useCollapsedSection } from '@/core/hooks/useCollapsedSection';
import { useStorage } from '@/core/hooks/useStorage';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { useModulFreischaltung } from '@/core/hooks/useModulFreischaltung';
import { useAuslastungFrei, useKuratorFrei } from '@/core/modul-freischaltung';
import { useKuratorSeiten } from '@/core/hooks/useKuratorSeiten';
import { useSichtbar } from '@/core/hooks/useSichtbar';
import { seiteId } from '@/core/sichtbarkeit';
import { useSmbStatus } from '@/core/hooks/useSmbStatus';
import { useKuratorActivityTracker } from '@/core/hooks/useKuratorActivityTracker';
import { useBrowserKontextmenue } from '@/core/hooks/useBrowserKontextmenue';
import { ensureDefaultProgramm } from '@/core/services/csv';
import { getDatenShareHandle } from '@/core/services/infrastructure/smb-handle';
import { SmbBanner } from '@/core/components/SmbBanner';
import { OfflineBanner } from '@/core/OfflineBanner';
import { ModellEskalationHinweis } from '@/core/components/ModellEskalationHinweis';
import { StartupDataUpdateBanner } from '@/core/components/StartupDataUpdateBanner';
import { useEmbeddingKorpusAbgleich } from '@/core/hooks/useEmbeddingKorpusAbgleich';
import { useHeartbeat } from '@/core/services/presence';
import { useBridgeHeartbeat } from '@/core/hooks/useBridgeHeartbeat';
import { DataUpdateBanners } from '@/plugins/csv-sources-kuration/components/DataUpdateBanners';
import { useAnfrageAnonAktivierung } from '@/plugins/anfragen/useAnfrageAnonAktivierung';
import { ProgrammSwitcher } from '@/core/components/ProgrammSwitcher';
import { FooterSettingsButton } from '@/core/components/FooterSettingsButton';
import { UeberDieAppDialog } from '@/core/components/changelog/UeberDieAppDialog';
import { useUeberAppDialog } from '@/core/components/changelog/useUeberAppDialog';
import { useHilfeFensterFolgt } from '@/components/help/useHilfeFensterFolgt';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { pluginIdToRoute, routeToPluginId } from '@/core/routes';
import { runtimeConfig } from '@/config/runtime-config';
import {
  isKuratorMenusEnabled,
  isCsvAutoRefreshEnabled,
  isDataShareEnabled,
  isGutachtenWorkflowEnabled,
  isGutachtenKurzfassungEnabled,
  isAssistentPanelEnabled,
  menuLabel,
} from '@/config/feature-flags';
import { AssistentPanelHost } from '@/plugins/chat/assistent/AssistentPanelHost';
import { AssistentSpine } from '@/plugins/chat/assistent/AssistentSpine';
import { assistentPanelUiStore, SPINE_WIDTH } from '@/plugins/chat/assistent/panelUiStore';
import { sucheAssistentUiStore } from '@/plugins/suche/assistentPanel';
import { backupGutachtenStateToPersonal } from '@/core/services/personal-storage/gutachten-backup';
import { BuildInfo } from '@/core/components/BuildInfo';
import { useAutoSmbRefresh } from '@/dev-fixtures/useAutoSmbRefresh';

interface ShellLayoutProps {
  plugins: TeamFlowPlugin[];
  children: React.ReactNode;
}

const SIDEBAR_WIDTH_KEY = 'teamflow_sidebar_width';
const SIDEBAR_MODE_KEY = 'teamflow_sidebar_mode';
const SIDEBAR_DEFAULT = 220;
const SIDEBAR_MIN = 140;
const SIDEBAR_MAX = 360;
const SIDEBAR_RAIL_WIDTH = 52;

function loadSidebarWidth(): number {
  try {
    const v = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
    if (Number.isFinite(v) && v >= SIDEBAR_MIN && v <= SIDEBAR_MAX) return v;
  } catch { /* ignore */ }
  return SIDEBAR_DEFAULT;
}

function loadSidebarModus(): SidebarModus {
  try {
    if (localStorage.getItem(SIDEBAR_MODE_KEY) === 'rail') return 'rail';
  } catch { /* ignore */ }
  return 'expanded';
}

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

function getIcon(name: string): IconComponent {
  const icon = (Icons as Record<string, unknown>)[name];
  if (typeof icon === 'object' && icon !== null) return icon as IconComponent;
  return Icons.HelpCircle;
}

/** Holt das Bereichs-Menü-Label aus der Runtime-Config (falls Bereichs-Plugin), sonst den Plugin-Default-Namen. */
function displayName(plugin: TeamFlowPlugin): string {
  switch (plugin.id) {
    case 'antraege':    return menuLabel('antraege', plugin.name);
    case 'dokumente':   return menuLabel('dokumente', plugin.name);
    default:            return plugin.name;
  }
}

export function ShellLayout({ plugins, children }: ShellLayoutProps): React.ReactElement {
  const { profile } = useProfile();
  // Runtime-Gate: Kurator-Modus nur aktiv wenn Profil *und* Build-Flag stimmen.
  // Build-Time-Filter in `plugins.config.ts:45` entfernt `category: 'kuration'`
  // — der Runtime-Check hier schützt zusätzlich Plugins die `kuratorOnly: true`
  // mit anderer Kategorie kombinieren (falls künftig eingeführt) und ignoriert
  // Legacy-Profile aus Dev-Builds die versehentlich mit Prod-Build geöffnet werden.
  // v3.0: zusaetzlich zur Profil-Flagge zaehlt die Freischaltung. In Builds ohne
  // Kurator-Schloss (dev/local) ist `useKuratorFrei()` konstant true — dort bleibt
  // es exakt beim bisherigen Verhalten.
  const kuratorFrei = useKuratorFrei();
  const auslastungFrei = useAuslastungFrei();
  // Der Ausdruck selbst wohnt in `useKuratorSeiten` — er stand bis v4.119
  // zweimal von Hand da (hier und im Routen-Schutz), und ein dritter Aufrufer
  // fragte nur die halbe Bedingung ab.
  const isKurator = useKuratorSeiten();
  const sichtbar = useSichtbar();
  const location = useLocation();
  const navigate = useNavigate();

  const visiblePlugins = useMemo(() => {
    return plugins.filter(p => {
      const kuratorOnly = p.kuratorOnly ?? p.adminOnly;
      if (kuratorOnly && !isKurator) return false;
      // Laufzeit-Schloss (moduleAuth). Deckt Sidebar, Command-Palette und
      // Shortcuts in einem Zug ab — alle leiten sich von visiblePlugins ab.
      if (p.modulSchloss === 'auslastung' && !auslastungFrei) return false;
      if (p.modulSchloss === 'kurator' && !kuratorFrei) return false;
      // Beta/Experte (v4.111). Bewusst an DERSELBEN Stelle wie die Sperren
      // darüber, obwohl es keine Sperre ist: Sidebar, Command-Palette und
      // Shortcuts leiten sich alle von `visiblePlugins` ab, ein zweiter
      // Filter-Ort liefe garantiert auseinander. Die ROUTE bleibt registriert —
      // verborgen heißt „nicht in der Navigation", nicht „gesperrt" (wie
      // `hideFromNav`), damit Lesezeichen und Deep-Links weiter tragen.
      if (!sichtbar(seiteId(p.id))) return false;
      return true;
    });
  }, [plugins, isKurator, auslastungFrei, kuratorFrei, sichtbar]);

  const activeId = routeToPluginId(location.pathname) ?? 'home';
  // Offen-Zustand des Suche-Panels: die Spine steht hier im Shell, das Panel
  // rendert die Suchseite — beide lesen denselben Store.
  const sucheAssistentOffen = useStore(sucheAssistentUiStore, s => s.open);
  const ueberAppOffen = useUeberAppDialog(s => s.open);
  const ueberAppSchliessen = useUeberAppDialog(s => s.close);
  // Ein Mount für die ganze App: das Hilfe-Fenster (falls offen) folgt der Seite.
  // Im SeitenHilfeButton ginge das nicht — der rendert `null`, wo ein Doc fehlt.
  useHilfeFensterFolgt();
  // Die BEWUSSTE Wahl des Nutzers — der einzige Wert, der persistiert wird.
  const [nutzerModus, setNutzerModus] = useState<SidebarModus>(loadSidebarModus);
  const [isMobile, setIsMobile] = useState(false);
  // Im schmalen Fenster ist die Leiste eine Schublade; dieses Flag hält fest, ob
  // der Nutzer sie dort gerade aufgezogen hat. Es überlebt weder das Verbreitern
  // noch den Neustart — sonst rastet ein einmal schmales Fenster die Schiene
  // dauerhaft ein (bis v2.371 der Fall: 20 unbeschriftete Icons ohne Rückweg).
  const [schubladeOffen, setSchubladeOffen] = useState(false);
  const sidebarMode = effektiverModus({ nutzerWahl: nutzerModus, schmalesFenster: isMobile, schubladeOffen });
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(loadSidebarWidth);
  const [sidebarDragging, setSidebarDragging] = useState(false);

  const { umschalten: darkUmschalten } = useDarkMode();
  const darkUmschaltenRef = useRef(darkUmschalten);
  useEffect(() => { darkUmschaltenRef.current = darkUmschalten; }, [darkUmschalten]);

  // Fensterbreite live statt aus `isMobile`: so bleibt der Callback stabil und
  // taugt für den Tastatur-Effekt unten (leere Deps).
  const toggleSidebar = useCallback((): void => {
    if (window.innerWidth < MOBILE_BREAKPOINT) {
      setSchubladeOffen(v => !v);
      return;
    }
    setNutzerModus(umgeschalteteWahl);
  }, []);

  // Sidebar-Breite per Drag-Handle anpassen.
  const sidebarDragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const onSidebarResizeMouseDown = useCallback((e: React.MouseEvent): void => {
    e.preventDefault();
    sidebarDragRef.current = { startX: e.clientX, startWidth: sidebarWidth };
    setSidebarDragging(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent): void => {
      const drag = sidebarDragRef.current;
      if (!drag) return;
      const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, drag.startWidth + (ev.clientX - drag.startX)));
      setSidebarWidth(next);
    };
    const onUp = (): void => {
      sidebarDragRef.current = null;
      setSidebarDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [sidebarWidth]);

  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth)); } catch { /* ignore */ }
  }, [sidebarWidth]);

  // Bewusst `nutzerModus`, NICHT `sidebarMode`: der vom Fenster erzwungene
  // Schienen-Modus darf die Wahl fürs breite Fenster nicht überschreiben.
  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_MODE_KEY, nutzerModus); } catch { /* ignore */ }
  }, [nutzerModus]);

  const tour = useTourContext();
  const storage = useStorage();
  const kuratorSession = useKuratorSession();
  const modulFreischaltung = useModulFreischaltung();
  const smbStatus = useSmbStatus();
  const initActiveProgramm = useActiveProgramm(s => s.init);

  useKuratorActivityTracker();
  // Der Rechtsklick zeigt app-weit nur noch etwas, wo er etwas kann: Menüs der
  // App, Eingabefelder, markierter Text — sonst nichts (useBrowserKontextmenue).
  useBrowserKontextmenue();
  useAutoSmbRefresh(storage.idb);
  // Einmalige Auto-Freischaltung des Anonymisierer-Skills auf Bestands-Shares
  // (Recall-Gate bestanden → Seed aktiv:true, aber mergeMissingSeeds überschreibt
  // bestehende registry.json nie). Läuft nach Share-Grant für schreibberechtigte Clients.
  useAnfrageAnonAktivierung();

  // Die Daten-Update-Banner (neuer Datenbestand + neue CSV-Quellen) + der
  // zugehörige Snapshot-Watcher leben jetzt im `DataUpdateBanners`-Koordinator
  // (siehe <main> unten) — er hält beide Hooks und fasst konkurrierende CTAs zu
  // EINER Aktion zusammen.

  // v2.29: Auslastungs-Embedding-Korpus beim Start vom Daten-Share laden
  // (Cold-Start-Selbstheilung), nicht erst beim Navigieren ins Modul. Self-gated
  // auf isAuslastungEnabled() (pl + dev) + SMB-online.
  useEmbeddingKorpusAbgleich();

  // v2.59: Presence-Heartbeat — schreibt periodisch `ZAH/online-status.json` in
  // den persoenlichen Ordner (jede Variante, best-effort). Quelle fuer den
  // PL-„Online"-Tab. Self-gated (Flag + persoenlicher Handle), NO-OP sonst.
  useHeartbeat();

  // Live-Verbindungsstatus der internen KI (Streamlit-Bridge): faengt den
  // geschlossenen KI-Tab in ~3 s ab und treibt Homepage-Karte, Sidebar-Indikator
  // und den Trennungs-Hinweis. Passiv (öffnet nie selbst einen Tab).
  useBridgeHeartbeat();

  const goToPlugin = useCallback((pluginId: string) => {
    // Beim Wechsel zu einem Listen-Plugin clearet der jeweilige Route-Param-
    // Effekt (fehlender Param → null) den Detail-State im Store automatisch.
    navigate(pluginIdToRoute(pluginId));
  }, [navigate]);

  // Scroll-Restoration: bei Pfadwechsel oben starten
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Start SMB-polling once. Demo-Variante (kein fester Pfad, keine User-Auswahl)
  // nutzt das SMB-Layer nicht und soll auf evtl. verwaiste Handles aus parallelen
  // Builds nicht reagieren.
  //
  // v3.0: Der Rehydrate der Kurator-Session ist von hier nach App.tsx gewandert —
  // er muss VOR den Plugin-onInit-Hooks laufen, sonst sieht ein gesperrtes Modul
  // seine gueltige Freischaltung nicht. Hier waere er zu spaet (die Shell mountet
  // erst nach der Passwort-Wall).
  useEffect(() => {
    if (!isDataShareEnabled()) return;
    smbStatus.startPolling(storage.idb);
    void (async () => {
      const h = await getDatenShareHandle(storage.idb);
      if (h) {
        await ensureDefaultProgramm(storage.idb).catch(() => undefined);
      }
      // Active-Programm-Store init: liest profile.activeProgrammId, fällt auf
      // erstes Programm zurück. Idempotent — kann ohne Profile aufgerufen werden.
      await initActiveProgramm(storage.idb, profile);
    })();
    return () => { smbStatus.stopPolling(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // v2.78.1: Einmaliger Catch-up-Sweep — spiegelt vorhandenen Gutachten-/
  // Workflow-Stand aus der IDB in den persönlichen Ordner, damit auch VOR dem
  // Mirror-Feature (oder offline) erzeugte Records browser-wechsel-fest werden.
  // Self-gated (Flag + Handle + Permission), best-effort, non-blocking.
  useEffect(() => {
    if (!isGutachtenWorkflowEnabled() && !isGutachtenKurzfassungEnabled()) return;
    void backupGutachtenStateToPersonal(storage.idb).catch(() => undefined);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const h = window.setInterval(() => {
      kuratorSession.tick(storage.idb);
      modulFreischaltung.tick(storage.idb);
    }, 60_000);
    return () => window.clearInterval(h);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wenn das Profil später hydriert (asynchron in useProfileProvider), den
  // Active-Programm-State nochmal anstoßen, damit die persistierte ID greift.
  // init() ist idempotent.
  useEffect(() => {
    if (!profile) return;
    void initActiveProgramm(storage.idb, profile);
  }, [profile, initActiveProgramm, storage.idb]);

  // Nav-sichtbare, nach `order` sortierte Plugins — Quelle der Command-Palette-
  // Nav-Items. `hideFromNav`-Plugins (Chat ab Phase 4, Feedback-Board) fallen
  // raus, damit sie keinen Nav-Command erzeugen; ihre Routen bleiben erreichbar.
  const sortedPlugins = useMemo(() => navVisiblePlugins(visiblePlugins), [visiblePlugins]);

  // Assistent öffnen: shell-weites Dock überall — AUSSER auf der Suche, die
  // ihren eigenen Voll-Chat (`ChatPanelHost`) besitzt. Auf `/suche` schaltet der
  // Eintrag dieses Panel direkt; von anderen Seiten aus (kein Flag) führt der
  // `?assistent=1`-Deep-Link hin. So bleibt es bei genau einem Panel pro Seite
  // (das schlanke Dock ist auf `/suche` nicht gemountet, siehe Render unten) —
  // die SPINE dagegen steht auf JEDER Seite, sie schaltet nur je Route ein
  // anderes Panel.
  const hasSuchePlugin = plugins.some(p => p.id === 'suche');
  const assistentEntryAvailable = isAssistentPanelEnabled() || hasSuchePlugin;
  const openAssistent = useCallback((): void => {
    if (activeId === 'suche') {
      sucheAssistentUiStore.getState().setOpen(true);
    } else if (isAssistentPanelEnabled()) {
      assistentPanelUiStore.getState().setOpen(true);
    } else if (hasSuchePlugin) {
      navigate('/suche?assistent=1');
    }
  }, [activeId, navigate, hasSuchePlugin]);

  const commandItems = useMemo((): CommandItem[] => {
    const isMac = navigator.platform.includes('Mac');
    const mod = isMac ? '⌘' : 'Ctrl+';
    // Echte, registrierte Nav-Kürzel (siehe Registrierungs-Effekt). Nur diese
    // Ziele tragen ein Label — keine erfundenen Strg+1…7 (browser-reserviert).
    const navShortcutLabel: Record<string, string> = { home: `${mod}⇧H`, antraege: `${mod}⇧F`, einstellungen: `${mod}⇧E` };
    const items: CommandItem[] = [];
    sortedPlugins.forEach((p) => {
      // Gruppen-Überschrift wie in der Sidebar (EINE Quelle) — die unbeschriftete
      // Arbeits-Gruppe läuft in der Palette unter „Navigation".
      items.push({ id: `nav-${p.id}`, label: displayName(p), category: NAV_GRUPPEN_LABEL[p.category] ?? 'Navigation', shortcut: navShortcutLabel[p.id], action: () => goToPlugin(p.id) });
    });
    // Einstellungen tragen `hideFromNav` (sie sitzen als Zahnrad in der Fußzeile)
    // und fallen damit aus `sortedPlugins` — ohne diesen Eintrag wären sie über
    // Strg+K nicht mehr auffindbar.
    if (visiblePlugins.some(p => p.id === 'einstellungen')) {
      items.push({
        id: 'nav-einstellungen',
        label: 'Einstellungen',
        category: NAV_GRUPPEN_LABEL.tools ?? 'Navigation',
        shortcut: navShortcutLabel.einstellungen,
        action: () => goToPlugin('einstellungen'),
      });
    }
    // Assistent öffnen: routen-bewusst (shell-weites Dock überall außer Suche;
    // dort/ohne Flag der `?assistent=1`-Deep-Link) — siehe `openAssistent`.
    if (assistentEntryAvailable) {
      items.push({ id: 'act-assistent', label: 'Assistent öffnen', category: 'Navigation', action: openAssistent });
    }
    items.push({ id: 'act-dark', label: 'Dark Mode umschalten', category: 'Einstellungen', shortcut: `${mod}⇧D`, action: darkUmschalten });
    items.push({ id: 'act-sidebar', label: 'Sidebar ein-/einklappen', category: 'Einstellungen', shortcut: `${mod}/`, action: toggleSidebar });
    return items;
  }, [sortedPlugins, visiblePlugins, goToPlugin, toggleSidebar, darkUmschalten, assistentEntryAvailable, openAssistent]);

  useEffect(() => {
    keyboardService.init();
    // mod+k öffnet die Command Palette (bewusst öffnen-only statt Toggle — ein
    // wiederholter Keydown darf sie nie wieder zuklappen; Schließen via escape /
    // Backdrop / Auswahl).
    keyboardService.register('mod+k', () => setCmdPaletteOpen(true), { description: 'Command Palette', category: 'Global' });
    keyboardService.register('mod+/', toggleSidebar, { description: 'Sidebar toggle', category: 'Global' });
    // Über den Ref, weil `darkUmschalten` am Profil hängt und dieser Effekt
    // bewusst nur einmal registriert (leere Deps).
    keyboardService.register('mod+shift+d', () => darkUmschaltenRef.current(), { description: 'Dark Mode toggle', category: 'Global' });
    keyboardService.register('escape', () => setCmdPaletteOpen(false), { description: 'Schließen', category: 'Global' });
    return () => { keyboardService.unregister('mod+k'); keyboardService.unregister('mod+/'); keyboardService.unregister('mod+shift+d'); keyboardService.unregister('escape'); };
  }, []);

  // Navigations-Kürzel (Strg+Umschalt+…) — nur für sichtbare Ziele registriert,
  // browser-sicher gewählt (H/F/E/K sind auf Chrome + Edge nicht reserviert).
  // Weitere Ziele bleiben über die Command Palette (Strg+K) erreichbar.
  useEffect(() => {
    const navShortcuts: Array<{ combo: string; pluginId: string; description: string }> = [
      { combo: 'mod+shift+h', pluginId: 'home', description: 'Home öffnen' },
      { combo: 'mod+shift+f', pluginId: 'antraege', description: 'Förderanträge öffnen' },
      { combo: 'mod+shift+e', pluginId: 'einstellungen', description: 'Einstellungen öffnen' },
    ];
    const registered: string[] = [];
    for (const s of navShortcuts) {
      if (!visiblePlugins.some(p => p.id === s.pluginId)) continue;
      keyboardService.register(s.combo, () => goToPlugin(s.pluginId), { description: s.description, category: 'Navigation' });
      registered.push(s.combo);
    }
    if (isAssistentPanelEnabled()) {
      keyboardService.register('mod+shift+k', openAssistent, { description: 'Assistent-Panel öffnen', category: 'Navigation' });
      registered.push('mod+shift+k');
    }
    return () => { for (const combo of registered) keyboardService.unregister(combo); };
  }, [visiblePlugins, goToPlugin, openAssistent]);

  useEffect(() => {
    const check = (): void => {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT;
      setIsMobile(mobile);
      // Schublade beim Verlassen des schmalen Fensters schließen, damit ein
      // späterer Wechsel zurück wieder eingeklappt startet. Gleicher Wert →
      // React bricht das Re-Render selbst ab.
      if (!mobile) setSchubladeOffen(false);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const grouped = useMemo(() => groupNavPlugins(visiblePlugins), [visiblePlugins]);
  // Zuklappbar sind die drei Gruppen, die nicht jeder täglich braucht (alle
  // Standard offen): „In Erprobung" soll getestet werden, wer sie nicht braucht,
  // räumt sie einmal weg — „Kuration" trifft nur, wer freigeschaltet ist, und
  // „Developer" nur, wer an der App selbst baut. Die beiden obersten Gruppen
  // bleiben fest: der tägliche Weg räumt sich nicht weg.
  const [erprobungOffen, toggleErprobung] = useCollapsedSection('teamflow_nav_erprobung');
  const [kurationOffen, toggleKuration] = useCollapsedSection('teamflow_nav_kuration');
  const [werkbankOffen, toggleWerkbank] = useCollapsedSection('teamflow_nav_werkbank');

  const renderNavItem = (plugin: TeamFlowPlugin): React.ReactElement => {
    const Icon = getIcon(plugin.icon);
    const isActive = plugin.id === activeId;
    const isRail = sidebarMode === 'rail';
    return (
      <button key={plugin.id}
        onClick={() => { goToPlugin(plugin.id); if (isMobile) setSchubladeOffen(false); }}
        title={isRail ? displayName(plugin) : undefined}
        aria-current={isActive ? 'page' : undefined}
        // „Desk & Blatt": das aktive Item ist ein kleines weißes Blatt (bg + Haarlinie),
        // das sich von der transparenten Sidebar auf dem grauen Desk abhebt — ersetzt
        // die frühere Primary-Light-Füllung + linke Akzent-Kante. Base-Border transparent
        // (box-border) hält die Zeilenhöhe zwischen aktiv/inaktiv konstant.
        className={`flex items-center w-full py-[8px] rounded-[var(--tf-radius)] border-[0.5px] border-transparent text-[13.5px] transition-colors cursor-pointer ${
          isRail ? 'justify-center px-0' : 'gap-2.5 px-3'
        } ${
          isActive ? 'text-[var(--tf-text)] font-medium' : 'text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]'
        }`}
        style={isActive ? { background: 'var(--tf-nav-active-bg)', borderColor: 'var(--tf-nav-active-border)' } : undefined}>
        <Icon size={16} className={isActive ? 'opacity-80' : 'opacity-50'} />
        {!isRail && <span>{displayName(plugin)}</span>}
        {!isRail && plugin.navHint === 'global' && (
          <span className="ml-auto flex items-center" title="Änderungen wirken für alle Nutzer">
            <Icons.Globe size={13} className="text-[var(--tf-text-tertiary)]" />
          </span>
        )}
      </button>
    );
  };

  /**
   * Eine Sidebar-Gruppe: Trennlinie, optionale Überschrift, Einträge. `klapp`
   * macht die Überschrift zum Schalter („In Erprobung", „Kuration", „Developer").
   *
   * Im Rail (52 px) fallen Überschriften weg — und damit auch das Zuklappen,
   * sonst wären die Ziele dort unerreichbar.
   */
  const renderNavGruppe = (
    key: NavGroupKey,
    klapp?: { offen: boolean; onToggle: () => void },
  ): React.ReactElement | null => {
    const items = grouped[key];
    if (items.length === 0) return null;
    const isRail = sidebarMode === 'rail';
    const label = NAV_GRUPPEN_LABEL[key];
    const offen = isRail || klapp === undefined || klapp.offen;
    const sichtbar = sichtbareGruppenItems(items, offen, activeId);
    return (
      <div key={key} className="mt-3 pt-3" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
        {label !== null && !isRail && (klapp === undefined ? (
          <div className="px-3 mb-2">
            <span className="text-[10.5px] uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)]">{label}</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={klapp.onToggle}
            aria-expanded={klapp.offen}
            className="flex w-full items-center gap-1.5 px-3 mb-2 text-[10.5px] uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text-secondary)] transition-colors cursor-pointer"
          >
            <span>{label}</span>
            {!klapp.offen && (
              <span className="normal-case tracking-normal">· {items.length}</span>
            )}
            <Icons.ChevronDown
              size={12}
              className={`ml-auto shrink-0 transition-transform ${klapp.offen ? '' : '-rotate-90'}`}
            />
          </button>
        ))}
        {sichtbar.map(renderNavItem)}
      </div>
    );
  };

  // Assistent-Dock (dev-Flag): shell-weit außer auf der Suche, die ihren eigenen
  // Voll-Chat besitzt.
  const dockAktiv = isAssistentPanelEnabled() && activeId !== 'suche';
  // Die SPINE dagegen steht auf JEDER Seite, auf der es einen Assistenten gibt —
  // auf `/suche` schaltet sie den Voll-Chat der Seite (dort flag-unabhängig, der
  // Such-Chat ist in allen Varianten da). Steht sie, reserviert das Blatt rechts
  // SPINE_WIDTH (28px), sonst überlappt die fixe Spine Inhalt/Scrollbar. Sonst
  // nur der 12px-Desk-Rand.
  const sucheSpine = activeId === 'suche' && hasSuchePlugin;
  const spineAktiv = dockAktiv || sucheSpine;

  return (
    <>
      <CommandPalette open={cmdPaletteOpen} onClose={() => setCmdPaletteOpen(false)} items={commandItems} />
      <BridgeDisconnectHint />
      <KiConnectPromptDialog />
      <div className="flex h-screen flex-col overflow-hidden bg-[var(--tf-desk)]">
      <div className="flex flex-1 overflow-hidden">
        <aside
          data-tour="nav-sidebar"
          className={`flex flex-col bg-transparent overflow-hidden shrink-0 ${sidebarDragging ? '' : 'transition-[width] duration-200'}`}
          style={{ width: sidebarMode === 'expanded' ? sidebarWidth : SIDEBAR_RAIL_WIDTH }}
        >
          <div className={`flex items-center ${sidebarMode === 'expanded' ? 'justify-between pl-4 pr-1' : 'justify-center px-1'} pt-4 pb-2 shrink-0`}>
            {sidebarMode === 'expanded' && (
              <div>
                <span className="text-[15px] font-medium text-[var(--tf-text)]">{runtimeConfig.build.label}</span>
              </div>
            )}
            <EinklappButton
              gross
              offen={sidebarMode === 'expanded'}
              onClick={toggleSidebar}
              label={sidebarMode === 'expanded' ? 'Sidebar einklappen' : 'Sidebar ausklappen'}
            />
          </div>

          {sidebarMode === 'expanded' && <ProgrammSwitcher />}

          <nav className="flex-1 overflow-y-auto px-2 py-2 flex flex-col">
            {/* Täglicher Weg — ganz oben und bewusst OHNE Überschrift: was hier
                steht, braucht keine Ansage. Alles Weitere ist beschriftet. */}
            {grouped.workflow.length > 0 && (
              <div className="mb-1">{grouped.workflow.map(renderNavItem)}</div>
            )}
            {renderNavGruppe('tools')}
            {renderNavGruppe('erprobung', { offen: erprobungOffen, onToggle: toggleErprobung })}

            {/* Spacer schiebt die System-/Kuration-Gruppe an den unteren Rand.
                Kollabiert, wenn die Liste den Platz füllt → dann scrollt die nav. */}
            <div className="flex-1 min-h-[8px]" />

            {/* System-Gruppe: derzeit leer — Einstellungen sind `hideFromNav`
                (Zahnrad in der Fußzeile). Bleibt als Ablage für System-Seiten. */}
            {renderNavGruppe('system')}
            {renderNavGruppe('kuration', { offen: kurationOffen, onToggle: toggleKuration })}
            {/* Entwickler-Panels stehen GANZ unten und unter eigenem Namen: sie
                kuratieren nichts, sie sind Werkzeug am Bau. */}
            {renderNavGruppe('werkbank', { offen: werkbankOffen, onToggle: toggleWerkbank })}
          </nav>

          <div className="px-2 py-1.5 shrink-0 flex flex-col" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
            {sidebarMode === 'expanded' ? (
              <>
                {/* Zeile 1: Einstellungen (links) + Version (rechts, öffnet
                    „Über die App"). Beide Elemente stehen auf JEDER Seite gleich —
                    der frühere Home-Sonderfall „Neu hier?" ist in die Kopfzeile des
                    Hilfe-Dialogs gewandert. Feedback *geben* liegt auf dem globalen
                    FAB unten rechts. */}
                <div className="flex items-center gap-1">
                  <FooterSettingsButton
                    active={activeId === 'einstellungen'}
                    onOpen={() => goToPlugin('einstellungen')}
                  />
                  <div className="ml-auto"><BuildInfo /></div>
                </div>
                {/* Dünne Trennlinie zwischen den beiden Zeilen — volle Breite wie
                    die obere Fußzeilen-Kante (`-mx-2` hebt das Container-Padding auf). */}
                <div className="-mx-2 my-1.5" style={{ borderTop: '0.5px solid var(--tf-border)' }} />
                {/* Zeile 2: Status-Ampeln („Variante D": Punkt+Wort) gleichmäßig
                    über die verfügbare Breite verteilt — `justify-between` skaliert
                    responsiv mit der Sidebar-Breite, `gap-1` hält den Mindestabstand
                    beim Verschmälern. */}
                <div className="flex items-center justify-between gap-1">
                  <SyncStatusIndicator />
                  {/* CSV-Import-Stand — nur in Import-Rollen (pl/kurator/dev),
                      gleiches Gate wie „CSV-Quellen-Ordner" in den Einstellungen. */}
                  {(isCsvAutoRefreshEnabled() || isKuratorMenusEnabled()) && <CsvFreshnessIndicator />}
                  <BridgeStatusIndicator />
                </div>
              </>
            ) : (
              /* Rail (52 px): Zahnrad über den Ampeln, beide als reine Icons/Punkte.
                 Kompakter Innenabstand kommt aus den Komponenten selbst (`compact`). */
              <div className="flex flex-col items-center gap-1">
                <FooterSettingsButton
                  active={activeId === 'einstellungen'}
                  compact
                  onOpen={() => goToPlugin('einstellungen')}
                />
                <div className="flex items-center justify-center gap-0.5">
                  <SyncStatusIndicator compact />
                  {(isCsvAutoRefreshEnabled() || isKuratorMenusEnabled()) && <CsvFreshnessIndicator compact />}
                  <BridgeStatusIndicator compact />
                </div>
              </div>
            )}
          </div>
        </aside>

        {sidebarMode === 'expanded' && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Sidebar-Breite ändern"
            onMouseDown={onSidebarResizeMouseDown}
            className="shrink-0 w-[4px] cursor-col-resize hover:bg-[var(--tf-border-hover)] transition-colors"
          />
        )}

        {/* „Blatt": der Arbeitsbereich schwebt als abgerundetes weißes Blatt mit
            Haarlinie + dezentem Schatten über dem grauen Desk. Links bündig an der
            Sidebar (margin-left 0), Desk-Rand oben/rechts/unten. Scroll bleibt im
            inneren Container → das Blatt (rundum overflow-hidden) klippt an den Ecken. */}
        <main
          className="flex-1 flex flex-col min-w-0 overflow-hidden"
          style={{
            margin: spineAktiv ? `10px ${SPINE_WIDTH}px 10px 0` : '10px 12px 10px 0',
            borderRadius: '14px',
            border: '0.5px solid var(--tf-sheet-border)',
            background: 'var(--tf-sheet)',
            boxShadow: 'var(--tf-sheet-shadow)',
          }}
        >
          <OfflineBanner />
          {isDataShareEnabled() && (
            <SmbBanner status={smbStatus.status} lastCheck={smbStatus.lastCheck} idb={storage.idb} />
          )}
          {isDataShareEnabled() && <StartupDataUpdateBanner />}
          {(isDataShareEnabled() || isKuratorMenusEnabled() || isCsvAutoRefreshEnabled()) && <DataUpdateBanners />}
          {/* Rendert `null`, solange kein Lauf angehoben wurde — hier statt an
              jeder Arbeitsfläche, weil der Auto-Wechsel überall greift. */}
          <div className="px-4 pt-3 empty:hidden">
            <ModellEskalationHinweis />
          </div>
          <div className="flex-1 overflow-y-auto relative">
            {children}
          </div>
        </main>
      </div>
      </div>
      {(() => {
        if (!tour.isActive || tour.activeStep === null) return null;
        const step = TOUR_STEPS[tour.activeStep];
        if (!step) return null;
        return (
          <TourOverlay
            step={step}
            stepIndex={tour.activeStep}
            totalSteps={tour.totalSteps}
            onNext={tour.next}
            onPrev={tour.prev}
            onFinish={tour.finish}
          />
        );
      })()}
      {/* „Über die App" — EIN Mount für beide Auslöser (Versionsnummer in der
          Fußzeile, Link in jedem Seiten-Hilfe-Dialog). Siehe useUeberAppDialog. */}
      <UeberDieAppDialog open={ueberAppOffen} onClose={ueberAppSchliessen} />
      {!tour.isActive && <FeedbackButton />}
      {/* Schlankes Dock shell-weit — außer auf der Suche, die ihren eigenen
          Voll-Chat (ChatPanelHost) besitzt (kein Doppel-Panel). Es bringt seine
          Spine selbst mit. */}
      {dockAktiv && <AssistentPanelHost />}
      {/* Auf der Suche steht dieselbe Spine, schaltet aber den Voll-Chat der
          Seite. Das Panel rendert die Suchseite (in-flow neben der Tabelle),
          hier hängt nur der Streifen. */}
      {sucheSpine && (
        <AssistentSpine
          open={sucheAssistentOffen}
          onToggle={() => sucheAssistentUiStore.getState().toggle()}
        />
      )}
    </>
  );
}
