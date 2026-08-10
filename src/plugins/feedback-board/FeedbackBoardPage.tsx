// Feedback-Tickets (Redesign v3.12, Handoff _design/handoff/feedback-redesign).
//
// Drei Nutzerziele, an denen sich der Aufbau ausrichtet:
//   1. Ersteller: Was ist mit MEINEM Ticket, wie lange dauert es, wie ändere ich es?
//   2. Entwickler: Status/Aufwand/Zuständigkeit setzen, ohne die Ansicht zu wechseln.
//   3. Beide: funktioniert auch bei 100–500 Tickets.
//
// Der Aufbau von oben nach unten:
//   Kopf        Titel · Zähler gesamt/neu/in Arbeit · Glocke · Budget ·
//               [Rollen-Umschalter] · Verwaltung · Hilfe · „Neues Ticket"
//   Smart Views rollenabhängige Pillen mit Zähler + rotem Alarmpunkt
//   Toolbar     Filter-Schalter · Suche · „24 von 312" · Sortieren · Anzeige · Board/Liste
//   Inhalt      Facetten (206px) | Board bzw. Liste | Detail-Panel
//
// Die Seite hält Zustand und verdrahtet — gerechnet wird in den reinen Modulen
// (smartViews/boardFilter/boardZahlen/boardSpalten), gemerkt in useBoardAnsicht.

import { useCallback, useEffect, useMemo, useState } from 'react';
// Icon-Vokabular der App (docs/architecture/ui-muster.md): `Filter` = Filter,
// `List`/`SquareKanban` = Ansichten, `Inbox` = Eingang/Verwaltung. Bis v3.23
// stand hier `SlidersHorizontal` für den Filter (heißt app-weit „Darstellung"),
// `Columns3` für die Board-Ansicht (heißt app-weit „Spaltenauswahl") und
// `Settings2` für die Verwaltung (verspricht Seiten-Einstellungen).
import { Filter, Inbox, List, Search, SquareKanban, Plus } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import { useMeineFeedbackIdentitaet } from '@/core/hooks/useMeineFeedbackIdentitaet';
import { MasterDetailLayout } from '@/components/master-detail';
import { PageHeader } from '@/components/ui/PageHeader';
import { ScopeTabs } from '@/components/ui/ScopeTabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DarstellungDropdown } from '@/components/ui/DarstellungDropdown';
import { ViewModeToggle, type ViewModeOption } from '@/components/ui/ViewModeToggle';
// Direkt an den Quellmodulen statt am Barrel: das Barrel zieht `FeedbackPanel` mit,
// und das laedt `@/plugins.config` — die Plugin-Liste fuehrt zurueck auf diese Seite
// (Laufzeit-Zyklus). Ohne die Sammel-Zeile ist der Weg jedes Symbols direkt.
import { BudgetBadge } from '@/components/feedback/BudgetBadge';
import { FeedbackSortSelect } from '@/components/feedback/FeedbackSortSelect';
import { NotificationBell } from '@/components/feedback/NotificationBell';
import { useUnreadReplies } from '@/components/feedback/useUnreadReplies';
import { useUnreadComments } from '@/components/feedback/useUnreadComments';
import { useFeedbackNavStore } from '@/components/feedback/feedbackNavStore';
import { useFeedbackDialog } from '@/components/feedback/useFeedbackDialog';
import { FeedbackKanbanEinstellungen } from '@/components/feedback/FeedbackKanbanEinstellungen';
import { feedbackAuthorLabel } from '@/components/feedback/feedbackUi';
import {
  getFeedbackList, istArchiviert, istMeineId, istMeinTicket, loadFeedbackConfig,
} from '@/core/services/feedback';
import type { FeedbackConfig, FeedbackItem, FeedbackStatus } from '@/core/types/feedback';
import { DEFAULT_FEEDBACK_CONFIG } from '@/core/types/feedback';
import { STATUS_LABELS } from '@/components/feedback/constants';
import { feedbackNummer } from '@/components/feedback/feedbackUi';
import { canManageFeedback } from '@/config/feature-flags';
import { SeitenHilfeButton } from '@/components/help/SeitenHilfeButton';
import { FeedbackVerwaltungDialog } from './verwaltung/FeedbackVerwaltungDialog';
import { useAutoCollectFeedback } from './verwaltung/useAutoCollectFeedback';
import { filterAndSortBoard, scopeBoard } from './boardFilter';
import { kopfZaehler, zaehleFacetten } from './boardZahlen';
import {
  SICHT_ALLE, findeView, sichtKannStatus, startViewKey, viewsFuerRolle, type BoardRolle,
} from './smartViews';
import { beschraenkeAuf, LEERE_AUSWAHL, schalte, zuBewegen, type Auswahl } from './auswahl';
import { gruppiere } from './gruppierung';
import {
  baueBoardAchsen, dichteAusSchluessel, gruppierungAusSchluessel, type BoardAchseId,
} from './darstellungsAchsen';
import { useBoardAnsicht, type Ansicht } from './useBoardAnsicht';
import { RollenPille } from './RollenPille';
import { BulkLeiste } from './ticket/BulkLeiste';
import { Swimlane } from './ticket/Swimlane';
import { FacettenLeiste, type FacettenAuswahl } from './ticket/FacettenLeiste';
import { TicketBoard, type BoardSicht } from './ticket/TicketBoard';
import { TicketListe } from './ticket/TicketListe';
import { TicketDetail } from './ticket/TicketDetail';
import { TicketToast } from './ticket/TicketToast';
import { useTicketAktionen } from './ticket/useTicketAktionen';
import type { TicketKontext, TicketPatch } from './ticket/typen';
import './ticketsystem.css';

const LEERE_FACETTEN: FacettenAuswahl = { typ: '', status: '', bereich: '' };

const ANSICHT_MODI: readonly ViewModeOption<Ansicht>[] = [
  { mode: 'liste', label: 'Liste', Icon: List },
  { mode: 'board', label: 'Board', Icon: SquareKanban },
];

export function FeedbackBoardPage(): React.ReactElement {
  const storage = useStorage();
  // Sammelt die persönlichen Feedback-/Stimmen-/Kommentar-Outboxen der
  // read-only-Nutzer ein (einmal pro App-Session, self-gated: ohne verbundene
  // User-Wurzel bzw. ohne Schreibrecht ein No-op). Hing bis v2.363 am
  // Kurator-Plugin — ohne diesen Aufruf versiegte prod-Feedback still.
  useAutoCollectFeedback();
  const { profile } = useProfile();
  const kuerzel = useMeinKuerzel();
  const ich = useMeineFeedbackIdentitaet();
  const meId = ich.schreibId;
  const meName = profile?.name && profile.name !== 'anonymous' ? profile.name : kuerzel;
  const darfVerwalten = canManageFeedback(profile?.is_kurator === true || profile?.is_admin === true);
  const oeffneErfassung = useFeedbackDialog(s => s.openDialog);

  const ansicht = useBoardAnsicht();
  const [tickets, setTickets] = useState<FeedbackItem[]>([]);
  const [config, setConfig] = useState<FeedbackConfig>(DEFAULT_FEEDBACK_CONFIG);
  const [viewKey, setViewKey] = useState<string>('');
  const [facetten, setFacetten] = useState<FacettenAuswahl>(LEERE_FACETTEN);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [auswahl, setAuswahl] = useState<Auswahl>(LEERE_AUSWAHL);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [verwaltungOffen, setVerwaltungOffen] = useState(false);

  // Rolle: aus dem Recht abgeleitet. Wer verwalten darf, sieht die
  // Entwickler-Sicht und kann per Umschalter in die Nutzer-Sicht schauen, um zu
  // prüfen, was beim Ersteller ankommt. Ohne Recht gibt es den Umschalter nicht —
  // eine Dev-Sicht mit wirkungslosen Bedienelementen wäre irreführend.
  const rolle: BoardRolle = darfVerwalten && !ansicht.nutzerVorschau ? 'entwickler' : 'nutzer';
  const views = viewsFuerRolle(rolle);
  const view = findeView(rolle, viewKey || startViewKey(rolle));
  // Rollenwechsel: die Sichten heißen anders — zurück auf die Startsicht der Rolle.
  useEffect(() => { setViewKey(startViewKey(rolle)); }, [rolle]);

  const reload = useCallback(async (silent = false): Promise<void> => {
    if (!silent) setLoading(true);
    try {
      const [items, cfg] = await Promise.all([getFeedbackList(storage), loadFeedbackConfig(storage)]);
      setTickets(items);
      setConfig(cfg);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [storage]);

  useEffect(() => { void reload(); }, [reload]);
  // Deep-Link von einem read-only Widget (z.B. Feedback-Kanban der Startseite).
  useEffect(() => {
    const pending = useFeedbackNavStore.getState().consumePendingTicket();
    if (pending) setSelectedId(pending);
  }, []);
  useEffect(() => {
    const handler = (): void => { void reload(true); };
    window.addEventListener('feedback-updated', handler);
    return () => window.removeEventListener('feedback-updated', handler);
  }, [reload]);
  useEffect(() => {
    const onVisible = (): void => { if (document.visibilityState === 'visible') void reload(true); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reload]);

  const handleChanged = useCallback(() => {
    setRefreshKey(k => k + 1);
    void reload(true);
  }, [reload]);

  const aktionen = useTicketAktionen(handleChanged, meId, meName ?? undefined);

  // Eine Statusänderung kann das Ticket aus der aktiven Sicht TRAGEN — in
  // „Alles offen" ist genau das der Normalfall für „umgesetzt". Ohne diesen
  // Zusatz sah die Karte aus wie verloren: sie verließ ihre Bahn und tauchte in
  // keiner anderen auf. Der Hinweis sitzt hier, weil nur die Seite die Sicht
  // kennt — Karten-Menü, Ziehen, Bulk-Leiste und Detail teilen ihn sich dadurch.
  const mitSichtHinweis = useCallback((patch: TicketPatch, meldung: string): string => {
    const ziel = patch.kurator_status;
    if (!ziel || sichtKannStatus(view, ziel)) return meldung;
    return `${meldung} · nicht in der Sicht „${view.label}"`;
  }, [view]);

  const aendere = useCallback((t: FeedbackItem, patch: TicketPatch, meldung: string): void => {
    aktionen.aendere(t, patch, mitSichtHinweis(patch, meldung));
  }, [aktionen.aendere, mitSichtHinweis]);

  const aendereViele = useCallback((
    ts: readonly FeedbackItem[], patch: TicketPatch, meldung: string,
  ): void => {
    aktionen.aendereViele(ts, patch, mitSichtHinweis(patch, meldung));
  }, [aktionen.aendereViele, mitSichtHinweis]);

  // Archivierte sind für alle unsichtbar; Verwalter dürfen sie zum Aufräumen einblenden.
  const archivSichtbar = darfVerwalten && ansicht.zeigeArchiv;
  const basis = useMemo(
    () => (archivSichtbar ? tickets : tickets.filter(t => !istArchiviert(t.kurator_status))),
    [tickets, archivSichtbar],
  );

  const { count: unread, isUnread, markSeen: markAntwortSeen } = useUnreadReplies(basis, ich);
  const { neuFuer, markSeen: markKommentareSeen } = useUnreadComments(basis, ich);
  const markSeen = useCallback((t: FeedbackItem): void => {
    markAntwortSeen(t);
    markKommentareSeen(t);
  }, [markAntwortSeen, markKommentareSeen]);

  // „heute" einmal je Render-Zyklus statt in der reinen Sicht-Logik: die bleibt
  // damit ohne Uhr und testbar.
  const heute = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const smartCtx = useMemo(
    () => ({ ich, heute, istUngelesen: isUnread }),
    [ich, heute, isUnread],
  );

  const zaehler = useMemo(() => kopfZaehler(basis), [basis]);

  // Die Sicht-Menge: Grundlage für Facettenzahlen UND das „von 312" im Zähler.
  const inSicht = useMemo(() => scopeBoard(basis, view, smartCtx), [basis, view, smartCtx]);
  const facettenZahlen = useMemo(() => zaehleFacetten(inSicht), [inSicht]);

  const gefiltert = useMemo(
    () => filterAndSortBoard(
      inSicht,
      { view, ctx: smartCtx, ...facetten, query, sort: ansicht.sort },
      config,
    ),
    [inSicht, view, smartCtx, facetten, query, ansicht.sort, config],
  );

  const viewItems = useMemo(() => views.map(v => {
    const treffer = basis.filter(t => v.passt(t, smartCtx));
    const alarm = v.alert ? treffer.filter(t => v.alert!(t, smartCtx)).length : 0;
    return {
      key: v.key,
      label: v.label,
      count: treffer.length,
      trailing: alarm > 0
        ? (
          <span className="min-w-[17px] h-[17px] px-[5px] rounded-full bg-[var(--tf-fb-problem)] text-[var(--tf-on-primary)] text-[10px] font-medium inline-grid place-items-center">
            {alarm}
          </span>
        )
        : undefined,
    };
  }), [views, basis, smartCtx]);

  // Wählbare Zuständige: wer im Bestand schon vorkommt (Autoren + bereits
  // Zugewiesene). Bewusst kein Personen-Verzeichnis — das Feedback-System kennt
  // keins, und eine gepflegte Liste wäre sofort veraltet.
  //
  // Die EIGENEN Schreibweisen fallen raus: ein Bestand enthält denselben Menschen
  // als Profilnamen, als Kürzel und als Kürzel-mit-Leerzeichen. Ungefiltert stand
  // ich dreimal in der Liste — einmal als „Mir zuweisen" und dreimal als Fremder.
  // `istMeineId` erkennt alle drei (NFC, getrimmt, case-insensitiv).
  const personen = useMemo(() => {
    const set = new Set<string>();
    for (const t of tickets) {
      if (t.assignee) set.add(t.assignee);
      const a = feedbackAuthorLabel(t);
      if (a) set.add(a);
    }
    return [...set]
      .filter(p => !istMeineId(p, ich))
      .sort((a, b) => a.localeCompare(b, 'de'));
  }, [tickets, ich]);

  const oeffne = useCallback((t: FeedbackItem) => setSelectedId(t.id), []);
  const istMeins = useCallback((t: FeedbackItem) => istMeinTicket(t, ich), [ich]);
  const schalteAuswahl = useCallback((id: string) => setAuswahl(a => schalte(a, id)), []);
  const leereAuswahl = useCallback(() => setAuswahl(LEERE_AUSWAHL), []);

  // Was nicht mehr sichtbar ist, kann auch nicht mehr gemeint sein: sonst
  // änderte die Bulk-Leiste Tickets, die niemand vor sich hat. `beschraenkeAuf`
  // liefert bei „nichts entfernt" die EINGABE zurück — sonst entstünde hier bei
  // jedem Render eine neue Menge und der Effekt liefe endlos.
  const sichtbareIds = useMemo(() => gefiltert.map(t => t.id), [gefiltert]);
  useEffect(() => {
    setAuswahl(a => beschraenkeAuf(a, sichtbareIds));
  }, [sichtbareIds]);

  const darfZiehen = darfVerwalten && rolle === 'entwickler';

  const ziehePer = useCallback((gezogeneId: string, zielStatus: FeedbackStatus): void => {
    const ids = zuBewegen(auswahl, gezogeneId);
    const tickets = gefiltert.filter(t => ids.includes(t.id) && t.kurator_status !== zielStatus);
    if (tickets.length === 0) return;
    const label = STATUS_LABELS[zielStatus];
    if (tickets.length === 1 && tickets[0]) {
      aendere(tickets[0], { kurator_status: zielStatus }, `#${feedbackNummer(tickets[0])} → ${label}`);
      return;
    }
    aendereViele(tickets, { kurator_status: zielStatus }, `${tickets.length} Tickets → ${label}`);
    leereAuswahl();
  }, [auswahl, gefiltert, aendere, aendereViele, leereAuswahl]);

  const ctx: TicketKontext = useMemo(() => ({
    rolle,
    darfVerwalten,
    istMeins,
    istUngelesen: isUnread,
    neueKommentare: neuFuer,
    personen,
    meineId: meId,
    aendere,
    aendereViele,
    kommentiere: aktionen.kommentiere,
    oeffne,
    offeneId: selectedId,
    auswahl,
    schalteAuswahl,
    ziehePer,
    darfZiehen,
  }), [
    rolle, darfVerwalten, istMeins, isUnread, neuFuer, personen, meId,
    aendere, aendereViele, aktionen.kommentiere,
    oeffne, selectedId, auswahl, schalteAuswahl, ziehePer, darfZiehen,
  ]);

  const gewaehlteTickets = useMemo(
    () => gefiltert.filter(t => auswahl.has(t.id)),
    [gefiltert, auswahl],
  );

  // Esc-Kaskade: erst die Auswahl, dann das Detail-Panel. Ohne Reihenfolge
  // schlösse ein Esc beides und man müsste die Auswahl neu treffen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const ziel = e.target as HTMLElement | null;
      if (ziel && (ziel.tagName === 'INPUT' || ziel.tagName === 'TEXTAREA' || ziel.isContentEditable)) return;
      if (e.key === 'Escape') {
        if (auswahl.size > 0) { leereAuswahl(); return; }
        if (selectedId) setSelectedId(undefined);
        return;
      }
      if (!selectedId) return;
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); blaettere(1); }
      if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); blaettere(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const index = gefiltert.findIndex(t => t.id === selectedId);
  const selected = index >= 0 ? gefiltert[index] : undefined;
  const blaettere = useCallback((schritt: number) => {
    const naechstes = gefiltert[index + schritt];
    if (naechstes) setSelectedId(naechstes.id);
  }, [gefiltert, index]);

  const facettenAktiv = !!(facetten.typ || facetten.status || facetten.bereich);
  const filterAktiv = !!query || facettenAktiv;

  const darstellungsAchsen = useMemo(
    () => baueBoardAchsen({
      gruppierung: ansicht.gruppierung,
      dichte: ansicht.dichte,
      zeigeArchiv: ansicht.zeigeArchiv,
      darfVerwalten,
    }),
    [ansicht.gruppierung, ansicht.dichte, ansicht.zeigeArchiv, darfVerwalten],
  );
  const setzeDarstellung = useCallback((id: BoardAchseId, key: string): void => {
    if (id === 'gruppierung') ansicht.setGruppierung(gruppierungAusSchluessel(key));
    else if (id === 'dichte') ansicht.setDichte(dichteAusSchluessel(key));
    else ansicht.setZeigeArchiv(key === 'ein');
  }, [ansicht]);

  const gruppen = useMemo(
    () => gruppiere(gefiltert, ansicht.gruppierung),
    [gefiltert, ansicht.gruppierung],
  );

  // Was die aktive Sicht überhaupt zeigen kann — damit eine Bahn wie UMGESETZT
  // in „Alles offen" sagen kann, dass sie unerreichbar ist, statt „0" zu melden.
  const boardSicht: BoardSicht = useMemo(() => ({
    label: view.label,
    kannStatus: (status: FeedbackStatus) => sichtKannStatus(view, status),
    zeigeAlle: () => setViewKey(SICHT_ALLE),
  }), [view]);

  const zeigeMenge = (menge: readonly FeedbackItem[]): React.ReactNode => (
    ansicht.ansicht === 'board'
      ? (
        <TicketBoard
          tickets={menge}
          lanes={ansicht.kanban.lanes}
          farbmodus={ansicht.kanban.farbmodus}
          dichte={ansicht.dichte}
          ctx={ctx}
          sicht={boardSicht}
        />
      )
      : <TicketListe tickets={menge} ctx={ctx} />
  );

  const inhalt = ((): React.ReactNode => {
    if (loading) {
      return <p className="text-[12.5px] text-[var(--tf-text-tertiary)] text-center py-8">Lade…</p>;
    }
    if (gefiltert.length === 0) {
      return (
        <div className="fb-leer">
          Keine Tickets in dieser Sicht.
          {filterAktiv && (
            <button
              type="button"
              className="fb-mehr-laden"
              onClick={() => { setQuery(''); setFacetten(LEERE_FACETTEN); }}
            >
              Filter zurücksetzen
            </button>
          )}
        </div>
      );
    }
    if (gruppen.length > 0) {
      return (
        <div className="fb-lanes">
          {gruppen.map(g => (
            <Swimlane key={g.key} label={g.label} anzahl={g.tickets.length}>
              {zeigeMenge(g.tickets)}
            </Swimlane>
          ))}
        </div>
      );
    }
    return zeigeMenge(gefiltert);
  })();

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-60px)] overflow-hidden">
      <div className="shrink-0 px-8 pt-6">
        <PageHeader
          title="Feedback-Tickets"
          meta={darfVerwalten && (
            <RollenPille
              nutzerVorschau={ansicht.nutzerVorschau}
              onChange={ansicht.setNutzerVorschau}
            />
          )}
          subtitle={
            <>
              <b className="text-[var(--tf-text-secondary)]">{zaehler.gesamt}</b> gesamt{'  ·  '}
              <b className="text-[var(--tf-text-secondary)]">{zaehler.neu}</b> neu{'  ·  '}
              <b className="text-[var(--tf-text-secondary)]">{zaehler.inArbeit}</b> in Arbeit
            </>
          }
          actions={
            <div className="flex items-center gap-3">
              <NotificationBell count={unread} onClick={() => setViewKey('meine')} />
              <BudgetBadge refreshKey={refreshKey} bar />
              {darfVerwalten && (
                <button
                  type="button"
                  onClick={() => setVerwaltungOffen(true)}
                  title="Feedback-Verwaltung — Inbox, FAQ, Sponsoring, Einstellungen"
                  aria-label="Feedback-Verwaltung öffnen"
                  className="h-8 w-8 grid place-items-center rounded-[var(--tf-radius)] cursor-pointer text-[var(--tf-text-tertiary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)] transition-colors"
                  style={{ border: '0.5px solid var(--tf-border-hover)' }}
                >
                  <Inbox size={15} />
                </button>
              )}
              <Button size="sm" onClick={() => oeffneErfassung()}>
                <Plus size={13} aria-hidden /> Neues Ticket
              </Button>
              {/* Hilfe als LETZTES Element der Kopf-Aktionen — so wie auf jeder
                  anderen Seite (docs/architecture/ui-muster.md). Das Board war
                  bis v3.23 der einzige Ausreißer. */}
              <SeitenHilfeButton pluginId="feedback-board" />
            </div>
          }
          className="mb-4"
        />

        {/* Smart Views — der Einstieg ist nie „alle 500" */}
        <div className="mb-3">
          <ScopeTabs
            variant="pills-solid"
            items={viewItems}
            activeKey={view.key}
            onChange={setViewKey}
            aria-label="Sicht"
          />
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          {/* Derselbe Filter-Auslöser wie auf den Förderanträgen: `Filter`, 32×32,
              gefüllt solange die Leiste offen ist, und ein Punkt, wenn bei
              geschlossener Leiste Facetten gesetzt sind. Der Suchtext zählt NICHT
              mit — er hat sein eigenes sichtbares Feld daneben. */}
          <Button
            variant={ansicht.facettenOffen ? 'default' : 'outline'}
            size="sm"
            onClick={ansicht.toggleFacetten}
            aria-pressed={ansicht.facettenOffen}
            aria-label={facettenAktiv ? 'Filter (aktiv)' : 'Filter'}
            title={ansicht.facettenOffen ? 'Filterleiste ausblenden' : 'Filterleiste einblenden'}
            className="relative h-8 w-8 p-0"
          >
            <Filter size={13} />
            {facettenAktiv && !ansicht.facettenOffen ? (
              <span
                aria-hidden="true"
                className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full"
                style={{ background: 'var(--tf-primary)' }}
              />
            ) : null}
          </Button>
          <div className="relative flex-1 min-w-[260px] max-w-[520px]">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--tf-text-tertiary)] pointer-events-none" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Suchen: Titel, Text, #Nummer, Person …"
              className="pl-7 h-8 w-full text-[12.5px]"
            />
          </div>
          <span className="text-[11.5px] text-[var(--tf-text-tertiary)] tabular-nums whitespace-nowrap">
            {gefiltert.length} von {inSicht.length}
          </span>

          {/* Rechte Gruppe, von links nach rechts nach Häufigkeit: der
              Ansichtswechsel ist der tägliche Griff und steht deshalb vorn;
              Gruppierung, Dichte und „Archivierte" fasst EIN Menü zusammen,
              wie auf den Förderanträgen. */}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <ViewModeToggle
              value={ansicht.ansicht}
              onChange={ansicht.setAnsicht}
              options={ANSICHT_MODI}
              ariaLabel="Board oder Liste"
            />
            <FeedbackSortSelect value={ansicht.sort} onChange={ansicht.setSort} />
            <DarstellungDropdown
              achsen={darstellungsAchsen}
              onChange={setzeDarstellung}
              titel="Gruppierung, Anzeige-Dichte und archivierte Tickets"
              className="h-8"
            />
            {ansicht.ansicht === 'board' && (
              <FeedbackKanbanEinstellungen config={ansicht.kanban} onChange={ansicht.setKanban} />
            )}
          </div>
        </div>
      </div>

      {/* Inhalt: Facetten | Board/Liste | Detail */}
      {/* Die Breiten-Vorgabe kommt von RECHTS: das Detail ist die schmale Spur,
          das Board bekommt den Rest — und behält ihn beim Fenster-Resize.
          Andersherum (Liste = 460px-Sidebar, der Default des Shells) blieb dem
          Board neben den 206px Facetten weniger als EINE Spaltenbreite.
          Schlüssel-Bump, weil eine gemerkte 460 den neuen Weg sonst überstimmt. */}
      <MasterDetailLayout
        listWidthKey="teamflow_feedback_board_list_width_v2"
        detailDefaultWidth={452}
        detailMinWidth={380}
        onCloseDetail={() => setSelectedId(undefined)}
        detail={selected ? (
          <TicketDetail
            key={selected.id}
            t={selected}
            ctx={ctx}
            config={config}
            meId={meId}
            meName={meName ?? undefined}
            onClose={() => setSelectedId(undefined)}
            onChanged={handleChanged}
            onPrev={index > 0 ? () => blaettere(-1) : undefined}
            onNext={index >= 0 && index < gefiltert.length - 1 ? () => blaettere(1) : undefined}
            unread={isUnread(selected)}
            neueKommentare={neuFuer(selected)}
            markSeen={markSeen}
          />
        ) : undefined}
        list={(
          <div className={`fb-ticket${auswahl.size > 0 ? ' auswahl' : ''}`}>
            {ansicht.facettenOffen && (
              <FacettenLeiste
                zaehler={facettenZahlen}
                auswahl={facetten}
                onChange={teil => setFacetten(a => ({ ...a, ...teil }))}
              />
            )}
            <div className="flex-1 min-w-0 flex flex-col relative">
              {inhalt}
              {gewaehlteTickets.length > 0 && (
                <BulkLeiste gewaehlt={gewaehlteTickets} ctx={ctx} onLeeren={leereAuswahl} />
              )}
            </div>
          </div>
        )}
      />

      {aktionen.toast && (
        <TicketToast toast={aktionen.toast} onClose={aktionen.schliesseToast} />
      )}

      {darfVerwalten && (
        <FeedbackVerwaltungDialog
          open={verwaltungOffen}
          onClose={() => setVerwaltungOffen(false)}
          tickets={tickets}
          config={config}
          onChanged={handleChanged}
        />
      )}
    </div>
  );
}
