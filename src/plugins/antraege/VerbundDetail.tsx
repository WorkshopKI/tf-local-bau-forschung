import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { X, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useStorage } from '@/core/hooks/useStorage';
import { useCollapsedSection } from '@/core/hooks/useCollapsedSection';
import {
  getAntrag,
  getVerbund,
  listAntraegeByVerbund,
  getVerbundHistoryByVerbund,
  loadSchema,
  listSchemas,
} from '@/core/services/csv';
import { getCanonicalLabel } from '@/core/services/csv/constants';
import type { Antrag, Verbund, VerbundHistorieEntry, CsvSchema } from '@/core/services/csv/types';
import { getStatusLabel, getStatusVariant } from '@/core/utils/status-mappings';
import { dominantStatus } from './groupAggregates';
import { isNetzwerkLead } from './netzwerk';
import { FieldHistoryModal } from './FieldHistoryModal';
import { VerbundAlleFelder } from './VerbundAlleFelder';
import { VerbundGlance, VerbundPartnerTabelle } from './alleFelder';
import { VerbundKopf } from './VerbundKopf';
import { TvDetailBlock } from './TvDetailBlock';
import { findFieldValue } from './fieldLookup';
import { readXsw } from './xsw';
import {
  isPseudoVerbundId,
  aktenzeichenFromPseudoVerbundId,
  buildPseudoVerbund,
  buildVerbundFromTeilantraege,
} from './pseudoVerbund';
import { useAntraegeStore } from './store';
import { useUnterprogrammLabels } from './useUnterprogrammLabels';
import { findAbgelehnteVorgaenger } from './vorgaengerAntraege';
import { AbgelehnteVorgaengerBanner } from './AbgelehnteVorgaengerBanner';
import { KurzfassungSection } from './kurzfassung/KurzfassungSection';
import { GutachtenSection } from './gutachten/GutachtenSection';
import { NachforderungenSection } from './nachforderungen/NachforderungenSection';
import type { KurzfassungContext } from './kurzfassung/types';
import { buildKurzfassungContext } from './kurzfassung/context-builder';
import { isGutachtenKurzfassungEnabled, isGutachtenWorkflowEnabled, isNfNachforderungenEnabled } from '@/config/feature-flags';

interface Props {
  verbundId: string;
  /** Wenn gesetzt: dieser TV wird beim Mounten automatisch in der TV-Liste
   *  expandiert. Aenderungen werden via useEffect in den internen State
   *  uebernommen, damit Wechsel zwischen TVs ueber URL/Liste auch nach
   *  Mount-Zeit greifen. */
  initialExpandedTvAz?: string;
  onClose: () => void;
  /** Wird ausgeloest, wenn ein Klick aus einer Sub-Section (z.B. Netzwerk-
   *  Mitglieder) auf einen Antrag in einem anderen Verbund navigieren will.
   *  Updatet die URL — der Container resolved den Verbund neu. Im selben
   *  Verbund fuehrt das zum prop-getriggerten Re-Sync von `expandedTvAz`. */
  onOpenAntrag: (aktenzeichen: string) => void;
}

/** Lesebreite-Cap für die Tabellen-/Lese-Sektionen (Header, Glance, Partner,
 *  Teilvorhaben, „Alle Felder", Historie). LINKSBÜNDIG (kein `mx-auto`) → gleiche
 *  linke Flucht wie die vollbreiten Texten-Werkstätten (Gutachten/NF). Cap-Wert =
 *  Handoff-Breite (`_design/handoff/alle-felder/felder.css` `.af-wrap`). */
const READ_COL = 'max-w-[1180px]';

function strOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

/** TV-Rolle für die TEILVORHABEN-Anzeige. Heuristik:
 *  - Netzwerk-Lead (Suffix 01/02 + vb_phase 1/2) → Konsortialführer
 *  - Erster TV in der Lead-First-Sortierung, falls kein expliziter Netzwerk-Lead → Konsortialführer
 *  - Alle anderen → Verbundpartner */
function tvRolle(tv: Antrag, idx: number, sorted: Antrag[]): string {
  if (isNetzwerkLead(tv)) return 'Konsortialführer';
  const anyLead = sorted.some(t => isNetzwerkLead(t));
  if (!anyLead && idx === 0) return 'Konsortialführer';
  return 'Verbundpartner';
}

export function VerbundDetail({
  verbundId,
  initialExpandedTvAz,
  onClose,
  onOpenAntrag,
}: Props): React.ReactElement {
  const storage = useStorage();
  // Deep-Link aus der Home-„Weitermachen"-Karte: `ziel` (gutachten|nf) scrollt
  // zur Sektion, `abschnitt` (nur GA) springt den Schritt (an GutachtenSection
  // durchgereicht). Query-Param — überlebt Liste-/URL-Navigation.
  const [searchParams] = useSearchParams();
  const zielParam = searchParams.get('ziel');
  const abschnittParam = searchParams.get('abschnitt') ?? undefined;
  // In-Memory-Slim-Liste des Programms — Quelle für die Vorgänger-Suche.
  const allAntraege = useAntraegeStore(s => s.antraege);
  const [verbund, setVerbund] = useState<Verbund | null>(null);
  const [antraege, setAntraege] = useState<Antrag[]>([]);
  const [history, setHistory] = useState<VerbundHistorieEntry[]>([]);
  const [schemas, setSchemas] = useState<CsvSchema[]>([]);
  const [sourceNames, setSourceNames] = useState<Record<string, string>>({});
  const [historyField, setHistoryField] = useState<string | null>(null);
  // Kompakt-Layout (v2.110): Kurzbeschreibung-Expand + aktiver Sprung-Nav-Eintrag.
  const [kbOpen, setKbOpen] = useState(false);
  const [activeJump, setActiveJump] = useState<string | null>(null);
  // Einklappbare Abschnitte (persistiert, Default offen): die „Antragsdaten"
  // (Stammdaten + Workflow + Teilvorhaben) und die Verbund-Historie. Erlaubt es,
  // beim Texten (Gutachten/NF) gezielt Platz freizuräumen.
  const [antragsdatenOpen, toggleAntragsdaten] = useCollapsedSection('verbund_antragsdaten_collapsed');
  const [historieOpen, toggleHistorie] = useCollapsedSection('verbund_historie_collapsed');
  // Unterprogramm-Labels (Code → Name) fuer die Stammdaten-Anzeige — statt der
  // nackten Nummer den sprechenden Namen. Hook vor dem fruehen Return halten.
  const unterprogrammLabels = useUnterprogrammLabels(antraege[0]?.programm_id ?? null);

  const isPseudo = isPseudoVerbundId(verbundId);

  // Default-Expansion: pseudo → automatisch der einzige TV (sonst waere die
  // Detailseite leer, weil die Stammdaten bei pseudo erst im TV-EckdatenCard
  // stecken). Echter Verbund → beim ERSTAUFRUF alle TVs collapsed (mehr
  // Uebersicht beim ersten Blick); der gezielt angeklickte TV
  // (`initialExpandedTvAz`) wird nicht vorab aufgeklappt.
  const [expandedTvAz, setExpandedTvAz] = useState<string | null>(() =>
    isPseudo ? aktenzeichenFromPseudoVerbundId(verbundId) : null,
  );
  // Merkt den zuletzt gezeigten Verbund, um „Erstaufruf eines Verbundes"
  // (collapsed) von „Navigation IM selben Verbund" (Prop honorieren) zu trennen.
  const lastVerbundIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (isPseudo) {
      setExpandedTvAz(aktenzeichenFromPseudoVerbundId(verbundId));
      lastVerbundIdRef.current = verbundId;
      return;
    }
    const isErstaufruf = lastVerbundIdRef.current !== verbundId;
    lastVerbundIdRef.current = verbundId;
    // Erstaufruf dieses Verbundes → alle TVs collapsed; spaetere Navigation im
    // selben Verbund expandiert den angeklickten TV.
    setExpandedTvAz(isErstaufruf ? null : initialExpandedTvAz ?? null);
  }, [verbundId, initialExpandedTvAz, isPseudo]);

  useEffect(() => {
    let cancelled = false;

    async function loadSchemasFor(tvs: Antrag[]): Promise<void> {
      if (tvs.length === 0 || cancelled) return;
      const lead = tvs[0]!;
      const ids = new Set<string>();
      for (const tv of tvs) {
        for (const sid of Object.values(tv._field_sources ?? {})) ids.add(sid);
      }
      const names: Record<string, string> = {};
      const loaded: CsvSchema[] = [];
      for (const id of ids) {
        const s = await loadSchema(storage.idb, id);
        if (s) {
          names[id] = s.csv_source_name;
          loaded.push(s);
        }
      }
      const all = await listSchemas(storage.idb, lead.programm_id);
      if (cancelled) return;
      const byId = new Map<string, CsvSchema>();
      for (const s of all) byId.set(s.id, s);
      for (const s of loaded) byId.set(s.id, s);
      setSourceNames(names);
      setSchemas([...byId.values()]);
    }

    (async () => {
      if (isPseudo) {
        // Standalone-Antrag: synthetischer Verbund, einziger TV expandiert.
        const az = aktenzeichenFromPseudoVerbundId(verbundId);
        const a = await getAntrag(storage.idb, az);
        if (cancelled) return;
        if (!a) {
          setVerbund(null);
          setAntraege([]);
          setHistory([]);
          return;
        }
        setVerbund(buildPseudoVerbund(a));
        setAntraege([a]);
        setHistory([]);
        await loadSchemasFor([a]);
        return;
      }

      const v = await getVerbund(storage.idb, verbundId);
      const a = await listAntraegeByVerbund(storage.idb, verbundId);
      const h = await getVerbundHistoryByVerbund(storage.idb, verbundId);
      if (cancelled) return;
      // Lead-First-Sort: Netzwerk-Lead-TVs (Suffix 01/02 + vb_phase 1/2) zuerst,
      // dann nach Aktenzeichen aufsteigend.
      const sorted = [...a].sort((x, y) => {
        const xLead = isNetzwerkLead(x);
        const yLead = isNetzwerkLead(y);
        if (xLead !== yLead) return xLead ? -1 : 1;
        return x.aktenzeichen.localeCompare(y.aktenzeichen);
      });
      // Der `verbuende`-Store ist nur ein abgeleiteter Aggregat-Cache der
      // Anträge. Fehlt der Cache-Record (leerer/veralteter Store, Bug-Klasse
      // Cold-Start-Refresh), die TVs sind aber da → Header aus den TVs
      // synthetisieren statt „nicht gefunden". `dominantStatus`/Lead-Fallbacks
      // weiter unten füllen Status/Akronym/Titel.
      if (!v && sorted.length > 0) {
        console.warn(
          `[verbund-detail] verbuende-Cache-Record für ${verbundId} fehlt — Header aus ${sorted.length} TV(s) abgeleitet (Cache leer/veraltet)`,
        );
      }
      setVerbund(v ?? (sorted.length > 0 ? buildVerbundFromTeilantraege(verbundId, sorted) : null));
      setAntraege(sorted);
      setHistory(h.sort((x, y) => y.geaendert_am.localeCompare(x.geaendert_am)));
      await loadSchemasFor(sorted);
    })();
    return () => { cancelled = true; };
  }, [verbundId, storage.idb, isPseudo]);

  // Deep-Link-Scroll: nach dem Laden einmalig zur Ziel-Sektion scrollen. Best-
  // effort (Anker fehlt bei deaktiviertem Flag → No-Op); pro (Verbund, Ziel) nur
  // einmal, damit ein Re-Render nicht erneut wegscrollt.
  const scrolledForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!verbund || !zielParam) return;
    const marker = `${verbundId}:${zielParam}`;
    if (scrolledForRef.current === marker) return;
    scrolledForRef.current = marker;
    const t = setTimeout(() => {
      try { document.getElementById(zielParam)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch { /* ignore */ }
    }, 200);
    return () => clearTimeout(t);
  }, [verbund, verbundId, zielParam]);

  const historyCounts = useMemo<Record<string, number>>(() => ({}), []);

  // Frühere abgelehnte/zurückgezogene Einreichungen desselben Kurznamens
  // (klammer-tolerant). Hook läuft unbedingt (vor dem Early-Return), guardet
  // intern auf fehlenden Verbund.
  const vorgaenger = useMemo(() => {
    if (!verbund) return [];
    const rawAkronym = strOrNull(verbund.akronym) ?? strOrNull(antraege[0]?.akronym);
    return findAbgelehnteVorgaenger({
      currentVerbundId: verbund.verbund_id,
      currentAkronym: rawAkronym,
      currentAktenzeichen: new Set(antraege.map(a => a.aktenzeichen)),
      antraege: allAntraege,
    });
  }, [verbund, antraege, allAntraege]);

  if (!verbund) {
    return (
      <PanelShell onClose={onClose}>
        <div className="py-10 text-[13px] text-[var(--tf-text-tertiary)]">
          {isPseudo
            ? `Antrag ${aktenzeichenFromPseudoVerbundId(verbundId)} nicht gefunden.`
            : `Verbund ${verbundId} nicht gefunden.`}
        </div>
      </PanelShell>
    );
  }

  const lead = antraege[0];
  const verbundStatus = strOrNull(verbund.status);
  const displayStatus = verbundStatus ?? dominantStatus(antraege, null);
  const akronym = strOrNull(verbund.akronym) ?? strOrNull(lead?.akronym) ?? verbund.verbund_id;
  const titel = strOrNull(verbund.titel) ?? strOrNull(lead?.titel);
  // Verbund hat keine Custom-Felder → T_XSW vom Lead-TV ziehen (Verbund≈Lead).
  const leadXsw = readXsw(lead);
  const antragsteller = strOrNull(lead?.antragsteller);
  // Unterprogramm: Label statt Nummer (Fallback Nummer, falls kein Label bekannt).
  const unterprogrammCode = strOrNull(lead?.unterprogramm_id);
  const unterprogramm = unterprogrammCode
    ? unterprogrammLabels.get(unterprogrammCode) ?? unterprogrammCode
    : null;
  // Zuwendung-CSV-Spalten folgen spaeter; bis dahin Placeholder. Verbund-
  // Aggregat soll Summe ueber alle TVs werden, pro TV der einzelne Wert.
  const zuwendungPlaceholder = 'wird noch ergänzt';

  // Verbund-Kurzbeschreibung aus dem Lead-TV. `vb_inhalt` (CSV-Spalte
  // VB_INHALT, Label "Inhalt / Kurzzusammenfassung") ist auf Verbund-Ebene
  // i.d.R. identisch ueber alle TVs hinweg — Lead-Wert reicht. TvDetailBlock
  // rendert das Feld nicht mehr, um Duplikation zu vermeiden.
  const vorhabenInhalt = lead ? strOrNull(findFieldValue(lead, [
    'vb_inhalt', 'vb inhalt', 'vorhaben_inhalt', 'vorhabeninhalt', 'beschreibung', 'kurzbeschreibung',
    'inhalt_kurzzusammenfassung', 'kurzzusammenfassung',
  ])) : null;

  // Stepper-Daten: der Kopf-Stepper ist Verbund-Ebene (amtliches Aggregat),
  // unabhängig davon, welcher TV in der Liste gerade expandiert ist.
  const stepperStatus = displayStatus;

  // Kopf-Beschreibung: Titel + Kurzzusammenfassung (VB_INHALT) in EINEM Block
  // (exakte Duplikate zusammengefasst) — löst die frühere separate
  // „Kurzbeschreibung"-Sektion ab. 3-Zeilen-Clamp via `kbOpen` im VerbundKopf.
  const beschreibung = (() => {
    const parts = [titel, vorhabenInhalt].filter((v): v is string => !!v);
    const uniq = parts.filter((v, i) => parts.indexOf(v) === i);
    return uniq.length > 0 ? uniq.join(' ') : null;
  })();

  // Header-Aktenzeichen: bei pseudo zeigt die echte Aktenzeichen-ID, nicht die
  // __pseudo__-Synthetik.
  const headerId = isPseudo ? aktenzeichenFromPseudoVerbundId(verbundId) : verbund.verbund_id;

  // Gutachten/Kurzfassung läuft auf Verbund-Ebene (eine VB pro Verbund). Key +
  // Förderkennzeichen = Verbund-ID (bzw. echtes Az bei Solo/pseudo). knownIds =
  // Verbund-ID + alle TV-Aktenzeichen (alle gelten in der Aufnahmefläche als
  // zugehörig — VB wird oft je TV mit eigenem FKZ eingereicht).
  // Lead-first sortierte TVs + Verbund → KurzfassungContext (eine Quelle, von
  // Einzellauf UND Batch genutzt). `verbund.verbund_id` als letzter Akronym-
  // Fallback hält die Ausgabe byte-identisch zum bisherigen Inline-Aufbau.
  const kurzfassungCtx: KurzfassungContext = buildKurzfassungContext(
    verbund, antraege, headerId, verbund.verbund_id,
  );

  // Sprung-Navigation (Kompakt): nur Anker für tatsächlich gerenderte Sektionen
  // (Pseudo-Verbund hat keine Stammdaten/TV; Gutachten/NF nur bei aktivem Flag).
  const gutachtenSichtbar = isGutachtenWorkflowEnabled() || isGutachtenKurzfassungEnabled();
  const jumpItems = ([
    !isPseudo ? { id: 'stamm', label: 'Stammdaten' } : null,
    !isPseudo ? { id: 'tv', label: 'Teilvorhaben' } : null,
    gutachtenSichtbar ? { id: 'gutachten', label: '↓ Gutachten' } : null,
    isNfNachforderungenEnabled() ? { id: 'nf', label: '↓ Nachforderungen' } : null,
  ].filter(Boolean)) as { id: string; label: string }[];
  const jump = (id: string): void => {
    setActiveJump(id);
    // stamm/tv liegen im konditional gerenderten Antragsdaten-Body — bei
    // eingeklapptem Block erst aufklappen, dann nach dem Render scrollen
    // (gutachten/nf brauchen das nicht: deren id sitzt auf dem äußeren Wrapper).
    if ((id === 'stamm' || id === 'tv') && !antragsdatenOpen) {
      toggleAntragsdaten();
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
      return;
    }
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <PanelShell onClose={onClose}>
      {/* VERBUND-KOPF (Phase 6): Identität + Beschreibung + Eckdaten + amtlicher
          5-Stationen-Stepper. Der Stepper ersetzt das frühere Status-Badge. */}
      <div className={READ_COL}>
        <VerbundKopf
          akronym={akronym}
          headerId={headerId}
          beschreibung={beschreibung}
          xsw={leadXsw}
          beschreibungOffen={kbOpen}
          onToggleBeschreibung={() => setKbOpen(o => !o)}
          stepperStatus={stepperStatus}
          tvs={antraege}
          unterprogramm={unterprogramm}
        />
      </div>

      {/* VORGÄNGER-HINWEIS — frühere abgelehnte/zurückgezogene Einreichungen
          desselben Kurznamens. Kompakt 1-zeilig, Klick öffnet die Vollansicht. */}
      {vorgaenger.length > 0 ? (
        <div className={READ_COL}>
          <AbgelehnteVorgaengerBanner vorgaenger={vorgaenger} onOpenAntrag={onOpenAntrag} />
        </div>
      ) : null}

      {/* SPRUNG-NAVIGATION (sticky) — schneller Sprung zu Gutachten/Nachforderungen
          ohne langes Scrollen. Klebt im PanelShell-Scrollcontainer unter der
          Close-Bar (top-[34px]); scrollt per scrollIntoView (Container-agnostisch,
          Sektionen tragen scroll-mt-[80px]). */}
      {jumpItems.length >= 2 ? (
        <div
          className="sticky top-[34px] z-20 -mx-6 mb-4 px-4 flex items-stretch overflow-x-auto"
          style={{ background: 'var(--tf-bg)', borderBottom: '0.5px solid var(--tf-border)' }}
        >
          {jumpItems.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => jump(item.id)}
              className={`px-2.5 py-2.5 text-[12.5px] whitespace-nowrap border-b-2 -mb-px transition-colors ${
                activeJump === item.id
                  ? 'text-[var(--tf-primary)] border-[var(--tf-primary)] font-medium'
                  : 'text-[var(--tf-text-secondary)] border-transparent hover:text-[var(--tf-primary)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      {/* ANTRAGSDATEN — einklappbarer Sammel-Block (Stammdaten + Workflow +
          Teilvorhaben). Nur echte Verbuende; bei pseudo (Standalone) stecken die
          Stammdaten im TvDetailBlock (doppelte Anzeige vermeiden). Beim Texten
          (Gutachten/NF) laesst sich der Block wegklappen — mehr Platz fuer die
          Artefakt-Abschnitte. */}
      {!isPseudo ? (
        <div className={`mb-4 ${READ_COL}`}>
          <button
            type="button"
            onClick={toggleAntragsdaten}
            aria-expanded={antragsdatenOpen}
            className="flex items-center gap-1.5 w-full text-left mb-2"
          >
            <ChevronRight
              size={15}
              className="text-[var(--tf-text-tertiary)] transition-transform duration-200 shrink-0"
              style={{ transform: antragsdatenOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
            />
            <h3 className="text-[16px] font-medium text-[var(--tf-text)]">Antragsdaten</h3>
            <span className="ml-auto text-[11.5px] text-[var(--tf-text-tertiary)] truncate pl-2">
              {antragsteller ? `${antragsteller} · ` : ''}{antraege.length} Teilvorhaben
            </span>
          </button>
          {antragsdatenOpen ? (
            <>
              {/* AUF EINEN BLICK (Glance) — kuratiertes Fakten-Raster, ersetzt den
                  bisherigen Stammdaten-Block. id="stamm" bleibt als Sprung-Anker. */}
              <div id="stamm" className="mb-4 scroll-mt-[80px]">
                <VerbundGlance tvs={antraege} verbundId={verbund.verbund_id} unterprogramm={unterprogramm} />
              </div>

              {/* VERBUNDPARTNER — eine Zeile pro TV statt der Slash-Suppe. */}
              <div className="mb-4">
                <VerbundPartnerTabelle tvs={antraege} />
              </div>

              {/* TEILVORHABEN — expandable Rows mit Inline-Detail. */}
              <div id="tv" className="mb-4 scroll-mt-[80px]">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">
                    Teilvorhaben
                  </h3>
                  <span className="text-[11px] text-[var(--tf-text-tertiary)]">·</span>
                  <span className="text-[11px] text-[var(--tf-text-tertiary)] tabular-nums">{antraege.length}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {antraege.map((tv, idx) => {
                    const tvAntragsteller = strOrNull(tv.antragsteller) ?? '—';
                    const tvStatus = strOrNull(tv.status);
                    const rolle = tvRolle(tv, idx, antraege);
                    const isExpanded = expandedTvAz === tv.aktenzeichen;
                    return (
                      <div key={tv.aktenzeichen}>
                        <button
                          type="button"
                          onClick={() => setExpandedTvAz(isExpanded ? null : tv.aktenzeichen)}
                          aria-expanded={isExpanded}
                          className={`w-full text-left rounded-[var(--tf-radius)] px-3 py-2 transition-colors ${
                            isExpanded
                              ? 'bg-[var(--tf-primary)]/5'
                              : 'hover:bg-[var(--tf-bg-secondary)]'
                          }`}
                          style={{
                            border: '0.5px solid var(--tf-border)',
                            borderLeftWidth: isExpanded ? '2px' : '0.5px',
                            borderLeftColor: isExpanded ? 'var(--tf-primary)' : 'var(--tf-border)',
                          }}
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="shrink-0 text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)] tabular-nums w-8 pt-0.5">
                              TV {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[13px] font-medium text-[var(--tf-text)] truncate" title={tvAntragsteller}>
                                {tvAntragsteller}
                              </div>
                              <div className="text-[11.5px] text-[var(--tf-text-tertiary)] mt-0.5">
                                {rolle} · <span className="font-mono">{tv.aktenzeichen}</span>
                                {' '}· Zuwendung: {zuwendungPlaceholder}
                              </div>
                            </div>
                            {tvStatus ? (
                              <Badge
                                variant={getStatusVariant(tvStatus)}
                                className="shrink-0 min-w-[100px] justify-center whitespace-nowrap"
                              >
                                {getStatusLabel(tvStatus)}
                              </Badge>
                            ) : null}
                            <span className="shrink-0 text-[var(--tf-text-tertiary)] pt-0.5">
                              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </span>
                          </div>
                        </button>
                        {isExpanded ? (
                          <div
                            className="mt-3 mb-3 ml-3 pl-4 pb-2"
                            style={{ borderLeft: '2px solid var(--tf-primary)' }}
                          >
                            <TvDetailBlock aktenzeichen={tv.aktenzeichen} onOpenAntrag={onOpenAntrag} />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : null}
        </div>
      ) : (
        // Pseudo-Verbund: TV-Detail direkt (kein Sammel-Block, keine Liste).
        // Der Status-Stepper sitzt bereits im VerbundKopf.
        <div className={READ_COL}>
          {expandedTvAz ? (
            <div className="mb-6">
              <TvDetailBlock aktenzeichen={expandedTvAz} onOpenAntrag={onOpenAntrag} />
            </div>
          ) : null}
        </div>
      )}

      {/* GUTACHTEN — Verbund-Ebene, oberhalb der Felder-Liste (nur dev). Der
          Workflow A–G (gutachtenWorkflow) loest die Kurzfassung-Sektion ab;
          else-if-Praezedenz, damit in dev (beide Flags true) nur EINE Sektion
          mountet. */}
      {isGutachtenWorkflowEnabled() ? (
        <div id="gutachten" className="mt-6 pt-6 scroll-mt-[80px]" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
          <GutachtenSection ctx={kurzfassungCtx} initialAbschnittId={abschnittParam} />
        </div>
      ) : isGutachtenKurzfassungEnabled() ? (
        <div id="gutachten" className="mt-6 pt-6 scroll-mt-[80px]" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
          <KurzfassungSection ctx={kurzfassungCtx} />
        </div>
      ) : null}

      {/* NACHFORDERUNGEN — Verbund-Ebene, eigener Artefakt-Typ (nur dev). Eigene
          Sektion (kein else-if zur Gutachten-Sektion): NF ist ein anderes Artefakt. */}
      {isNfNachforderungenEnabled() && (
        <div id="nf" className="mt-6 pt-6 scroll-mt-[80px]" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
          <NachforderungenSection ctx={kurzfassungCtx} />
        </div>
      )}

      {/* ALLE FELDER (Verbund-Aggregat) — nur fuer echte Verbuende. Bei pseudo
          waere das ein Duplikat von TvDetailBlock.AlleFelderSection. */}
      {!isPseudo && antraege.length > 0 ? (
        <div className={`mt-6 pt-6 ${READ_COL}`} style={{ borderTop: '0.5px solid var(--tf-border)' }}>
          <VerbundAlleFelder
            tvs={antraege}
            schemas={schemas}
            sourceNames={sourceNames}
            historyCounts={historyCounts}
            onOpenHistory={setHistoryField}
          />
        </div>
      ) : null}

      {/* Verbund-Historie — nur fuer echte Verbuende (pseudo hat keine). */}
      {!isPseudo ? (
        <div className={`mt-6 pt-6 ${READ_COL}`} style={{ borderTop: '0.5px solid var(--tf-border)' }}>
          <button
            type="button"
            onClick={toggleHistorie}
            aria-expanded={historieOpen}
            className="flex items-center gap-1.5 w-full text-left mb-2"
          >
            <ChevronRight
              size={15}
              className="text-[var(--tf-text-tertiary)] transition-transform duration-200 shrink-0"
              style={{ transform: historieOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
            />
            <h2 className="text-[16px] font-medium text-[var(--tf-text)]">
              Verbund-Historie
            </h2>
            {history.length > 0 ? (
              <span className="ml-auto text-[11.5px] text-[var(--tf-text-tertiary)] tabular-nums pl-2">{history.length}</span>
            ) : null}
          </button>
          {historieOpen ? (
            history.length === 0 ? (
            <div className="text-[12.5px] text-[var(--tf-text-tertiary)] italic">
              Noch keine Verbund-Änderungen erfasst.
            </div>
          ) : (
            <div style={{ border: '0.5px solid var(--tf-border)', borderRadius: 8 }}>
              {history.map((h, i) => (
                <div
                  key={h.id}
                  className="px-3 py-2 text-[12.5px]"
                  style={{ borderTop: i === 0 ? undefined : '0.5px solid var(--tf-border)' }}
                >
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-[11.5px] text-[var(--tf-text-tertiary)] tabular-nums">
                      {formatDateTime(h.geaendert_am)}
                    </span>
                    <span className="font-medium text-[var(--tf-text)]">{getCanonicalLabel(h.feld)}</span>
                    <span className="text-[var(--tf-text-tertiary)]">→</span>
                  </div>
                  <div className="mt-0.5 text-[12px]">
                    <span className="font-mono line-through text-[var(--tf-text-tertiary)]">{str(h.alt_wert)}</span>
                    <span className="mx-2 text-[var(--tf-text-tertiary)]">→</span>
                    <span className="font-mono text-[var(--tf-text)]">{str(h.neu_wert)}</span>
                  </div>
                  {h.csv_schema_id ? (
                    <div className="mt-0.5 text-[10.5px] text-[var(--tf-text-tertiary)] font-mono">
                      Quelle: {h.csv_schema_id}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )
          ) : null}
        </div>
      ) : null}

      {/* Field-History-Modal — fuer Verbund-Felder am Lead-TV. */}
      {lead && !isPseudo ? (
        <FieldHistoryModal
          aktenzeichen={lead.aktenzeichen}
          feld={historyField}
          onClose={() => setHistoryField(null)}
        />
      ) : null}
    </PanelShell>
  );
}

function PanelShell({ onClose, children }: { onClose: () => void; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex-1 min-w-0 h-full overflow-y-auto" style={{ borderLeft: '0.5px solid var(--tf-border)' }}>
      <div className="sticky top-0 z-10 flex justify-end px-4 pt-3 pb-1 bg-[var(--tf-bg)]">
        <button
          type="button"
          onClick={onClose}
          className="text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
          aria-label="Detail schließen"
        >
          <X size={18} />
        </button>
      </div>
      <div className="px-6 pb-8">{children}</div>
    </div>
  );
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('de-DE');
  } catch {
    return iso;
  }
}

function str(v: unknown): string {
  if (v === undefined || v === null || v === '') return '—';
  if (typeof v === 'string') return v;
  return String(v);
}
