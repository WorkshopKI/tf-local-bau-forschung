import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, X, LayoutTemplate } from 'lucide-react';
import { dominantStatus } from './groupAggregates';
import { FieldHistoryModal } from './FieldHistoryModal';
import { VerbundAlleFelder } from './VerbundAlleFelder';
import { VerbundGlance } from './alleFelder';
import { verbundFelderStats } from './alleFelder/verbundMerge';
import { VerbundKopf } from './VerbundKopf';
import { KurzbeschreibungCard } from './KurzbeschreibungCard';
import { CollapsibleDataSection } from './CollapsibleDataSection';
import { TeilvorhabenListe } from './TeilvorhabenListe';
import { TvTitelCopyButton } from './TvTitelCopyButton';
import { VerbundHistorie } from './VerbundHistorie';
import { ArtefaktLeiste } from './artefakte/ArtefaktLeiste';
import { TvDetailBlock } from './TvDetailBlock';
import { findFieldValueAcross } from './fieldLookup';
import { readXsw } from './xsw';
import { isPseudoVerbundId, aktenzeichenFromPseudoVerbundId } from './pseudoVerbund';
import { useVerbundDetailData } from './useVerbundDetailData';
import { useAntraegeStore } from './store';
import { useUnterprogrammLabels } from './useUnterprogrammLabels';
import { findAbgelehnteVorgaenger } from './vorgaengerAntraege';
import { AbgelehnteVorgaengerBanner } from './AbgelehnteVorgaengerBanner';
import { KurzfassungSection } from './kurzfassung/KurzfassungSection';
import { GutachtenSection } from './gutachten/GutachtenSection';
import { NachforderungenSection } from './nachforderungen/NachforderungenSection';
import { WerkbankSection } from './werkbank/WerkbankSection';
import { WiderspruchSection } from './widerspruch/WiderspruchSection';
import type { KurzfassungContext } from './kurzfassung/types';
import { buildKurzfassungContext } from './kurzfassung/context-builder';
import { StatusDetailSection } from './status/StatusDetailSection';
import { MeilensteinSection } from './meilensteine/MeilensteinSection';
import { Button } from '@/components/ui/button';
import { isGutachtenKurzfassungEnabled, isGutachtenWorkflowEnabled, isNfNachforderungenEnabled, isAntragAufbereitungEnabled, isArtefaktWerkbankEnabled, isStatusCockpitEnabled, isMeilensteinMonitoringEnabled } from '@/config/feature-flags';

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
  /** Optionaler Rückweg links in der Kopfzeile — gesetzt, wenn der Antrag aus
   *  einer anderen Ansicht heraus geöffnet wurde (heute: aus der Suche). Ohne
   *  ihn bleibt der Platz leer und die Kopfzeile sieht aus wie bisher. */
  zurueck?: { label: string; onClick: () => void };
}

/** Lesebreite-Cap für die Lese-/Daten-Sektionen (Kopf, Glance, Partner,
 *  Teilvorhaben, „Alle Felder", Historie). LINKSBÜNDIG (kein `mx-auto`) → gleiche
 *  linke Flucht wie die vollbreiten Texten-Werkstätten (Gutachten/NF). Cap-Wert =
 *  Handoff-Breite (`_design/handoff/alle-felder/felder.css` `.af-wrap`). */
const READ_COL = 'max-w-[1180px]';

function strOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

/** Wortgleich? (trim + Whitespace kollabiert + case-insensitiv) — für den
 *  Untertitel-Dedup gegen die Kurzbeschreibungs-Karte. */
function sameText(a: string, b: string): boolean {
  const norm = (s: string): string => s.trim().replace(/\s+/g, ' ').toLowerCase();
  return norm(a) === norm(b);
}

export function VerbundDetail({
  verbundId,
  initialExpandedTvAz,
  onClose,
  onOpenAntrag,
  zurueck,
}: Props): React.ReactElement {
  // Deep-Link aus der Home-„Weitermachen"-Karte: `ziel` (gutachten|nf) scrollt
  // zur Sektion, `abschnitt` (nur GA) springt den Schritt (an GutachtenSection
  // durchgereicht). Query-Param — überlebt Liste-/URL-Navigation.
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const zielParam = searchParams.get('ziel');
  const abschnittParam = searchParams.get('abschnitt') ?? undefined;
  // In-Memory-Slim-Liste des Programms — Quelle für die Vorgänger-Suche.
  const allAntraege = useAntraegeStore(s => s.antraege);

  const isPseudo = isPseudoVerbundId(verbundId);
  // Daten-Schicht: Verbund + TVs + Historie + Schemas (bzw. Pseudo-Verbund).
  const { verbund, antraege, history, schemas, sourceNames, laedt } = useVerbundDetailData(verbundId, isPseudo);

  const [historyField, setHistoryField] = useState<string | null>(null);
  // „Volltext lesen"-Zustand der Kurzbeschreibungs-Karte.
  const [kbOpen, setKbOpen] = useState(false);
  // Phase 6: „Antwort in der Werkbank vorbereiten" reicht die offenen Widerspruchs-
  // Gründe an die Werkbank (nonce triggert die Vorbelegung auch bei erneutem Klick).
  const [werkbankVorbelegung, setWerkbankVorbelegung] = useState<{ keys: string[]; nonce: number }>();
  // Unterprogramm-Labels (Code → Name) fuer die Stammdaten-Anzeige — statt der
  // nackten Nummer den sprechenden Namen. Hook vor dem fruehen Return halten.
  const unterprogrammLabels = useUnterprogrammLabels(antraege[0]?.programm_id ?? null);

  // Default-Expansion: pseudo → automatisch der einzige TV (sonst waere die
  // Detailseite leer, weil die Stammdaten bei pseudo erst im TV-Block stecken —
  // dort per `zeigeEckdaten`). Echter Verbund → beim ERSTAUFRUF alle TVs collapsed (mehr
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

  // Feld-Kennzahlen für die Kontext-Vorschau der kollabierten „Alle Felder"-Sektion.
  const felderStats = useMemo(() => verbundFelderStats(antraege, schemas), [antraege, schemas]);

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

  // TV-Titel als Text (eine Zeile je Teilvorhaben) für die Kopier-Aktion im
  // Sektionskopf — oft in andere Dokumente übernommen. Reihenfolge = TV-Liste
  // (Lead zuerst); leere übersprungen, wortgleiche (normalisiert) Titel nur
  // einmal (bei geteiltem Verbund-Titel sonst N identische Zeilen). Hook läuft
  // unbedingt (vor dem Early-Return) — sonst zählt React beim null→geladen-
  // Übergang unterschiedlich viele Hooks (React #310).
  const tvTitelZeilen = useMemo<string[]>(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const a of antraege) {
      const t = strOrNull(a.titel);
      if (!t) continue;
      const key = t.trim().replace(/\s+/g, ' ').toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
    }
    return out;
  }, [antraege]);

  if (!verbund) {
    // „nicht gefunden" erst behaupten, wenn die Auflösung durch ist — während des
    // Ladens (und während eines Re-Runs bei nachrückendem Datenbestand) ist das
    // schlicht falsch.
    return (
      <PanelShell onClose={onClose} zurueck={zurueck}>
        <div className="py-10 text-[13px] text-[var(--tf-text-tertiary)]">
          {laedt
            ? 'Wird geladen …'
            : isPseudo
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

  // Verbund-Kurzbeschreibung: `vb_inhalt` (CSV-Spalte VB_INHALT, Label "Inhalt /
  // Kurzzusammenfassung"). Über ALLE TVs suchen — der Wert ist zwar auf Verbund-
  // Ebene gedacht, im Export aber oft nur an einem Partner-TV gefüllt; nur den
  // Lead zu lesen verschluckte die Beschreibung still (Karte fehlte).
  const vorhabenInhalt = strOrNull(findFieldValueAcross(antraege, [
    'vb_inhalt', 'vb inhalt', 'vorhaben_inhalt', 'vorhabeninhalt', 'beschreibung', 'kurzbeschreibung',
    'inhalt_kurzzusammenfassung', 'kurzzusammenfassung',
  ]));

  // Kopf-Stepper: Verbund-Ebene (amtliches Aggregat), unabhängig vom expandierten TV.
  const stepperStatus = displayStatus;

  // Kurzbeschreibungs-Karte unter dem Kopf: die VB_INHALT-Kurzzusammenfassung. KEIN
  // Titel-Fallback mehr — fehlt VB_INHALT (wird oft erst nach Abschluss des Gutachtens
  // erstellt), bleibt die Karte leer (dezenter Hinweis in KurzbeschreibungCard); der
  // Titel erscheint dann wieder als Untertitel im Kopf (siehe `untertitel`), statt als
  // vermeintlicher Karteninhalt aufzutreten.
  const kurzbeschreibung = vorhabenInhalt;

  // Untertitel im Kopf nur, wenn er nicht ohnehin (wortgleich) in der Karte steht
  // — sonst stünde der Titel doppelt (dünne Zeile + Karte).
  const untertitel = titel && (!kurzbeschreibung || !sameText(titel, kurzbeschreibung)) ? titel : null;

  // Header-Aktenzeichen: bei pseudo die echte Aktenzeichen-ID, nicht die __pseudo__-Synthetik.
  const headerId = isPseudo ? aktenzeichenFromPseudoVerbundId(verbundId) : verbund.verbund_id;

  // Gutachten/Kurzfassung läuft auf Verbund-Ebene (eine VB pro Verbund). Key +
  // Förderkennzeichen = Verbund-ID (bzw. echtes Az bei Solo/pseudo).
  const kurzfassungCtx: KurzfassungContext = buildKurzfassungContext(
    verbund, antraege, headerId, verbund.verbund_id,
  );

  const gutachtenSichtbar = isGutachtenWorkflowEnabled() || isGutachtenKurzfassungEnabled();

  // Kontext-Vorschau der kollabierten „Antragsdaten"-Sektion: Koordinator + TV-Zahl
  // (die Sektion trägt seit v2.338 auch die Verbundpartner/Teilvorhaben-Liste).
  const antragsdatenPreview = [antragsteller, `${antraege.length} Teilvorhaben`]
    .filter(Boolean).join(' · ');

  // Sprung in die NF-Werkstatt (Artefakt-Leiste-Karte).
  const scrollTo = (id: string): void => { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  // ARTEFAKT-WERKBANK / NACHFORDERUNGEN — als Variable, weil der Block in BEIDEN
  // Zweigen (echter Verbund / pseudo) an unterschiedlicher Stelle steht: beim echten
  // Verbund zwischen „Antragsdaten" und „Alle Felder" (Arbeitsablauf vor den
  // Feld-Sektionen), bei pseudo hinter dem TV-Detail. Reines JSX, kein Hook —
  // keine Rules-of-Hooks-Falle. Die Zweige schliessen sich aus, `#nf`/`#widerspruch`
  // existieren also genau einmal im DOM. Volle Panel-Breite (kein READ_COL).
  const werkbankBlock: React.ReactNode = isArtefaktWerkbankEnabled() ? (
    <>
      <div id="nf" className="mt-6 pt-6 scroll-mt-[80px]" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
        <WerkbankSection ctx={kurzfassungCtx} vorbelegung={werkbankVorbelegung} />
      </div>
      {/* Widerspruch/Stellungnahme — nur sichtbar, wenn ein RNE/ABL-Bescheid existiert.
          Zieht mit der Werkbank mit: „Antwort in der Werkbank vorbereiten" springt von
          hier dorthin, ein Sprung über die Feld-Sektionen hinweg wäre unnötig weit. */}
      <div id="widerspruch" className="mt-6 pt-6 scroll-mt-[80px]" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
        <WiderspruchSection
          ctx={kurzfassungCtx}
          onAntwortVorbereiten={keys => {
            setWerkbankVorbelegung({ keys, nonce: Date.now() });
            document.getElementById('nf')?.scrollIntoView({ behavior: 'smooth' });
          }}
        />
      </div>
    </>
  ) : isNfNachforderungenEnabled() ? (
    <div id="nf" className="mt-6 pt-6 scroll-mt-[80px]" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
      <NachforderungenSection ctx={kurzfassungCtx} />
    </div>
  ) : null;

  return (
    <PanelShell onClose={onClose} zurueck={zurueck}>
      {/* VERBUND-KOPF (Phase 6): Identität + Eckdaten-Meta + Untertitel + amtlicher
          Stepper. Rechts in der Titelzeile die ANTRAG-AUFBEREITUNG als Aktion am Kopf
          (Vollbild-Aufbereitung der VB, flag-gated, nur dev) — erster Schritt im
          Ablauf: erst den Antrag verstehen, dann NF/Gutachten. */}
      <div id="verbund-kopf" className={READ_COL}>
        <VerbundKopf
          akronym={akronym}
          headerId={headerId}
          untertitel={untertitel}
          xsw={leadXsw}
          stepperStatus={stepperStatus}
          tvs={antraege}
          unterprogramm={unterprogramm}
          aktion={isAntragAufbereitungEnabled() ? (
            <Button
              variant="secondary"
              size="sm"
              icon={LayoutTemplate}
              onClick={() => navigate(`/antraege/${encodeURIComponent(kurzfassungCtx.key)}/aufbereitung`)}
            >
              Antrag-Aufbereitung öffnen
            </Button>
          ) : undefined}
        />
      </div>

      {/* KURZBESCHREIBUNG — Kurzzusammenfassung (VB_INHALT) als eigene Karte. Immer sichtbar;
          fehlt VB_INHALT, zeigt die Karte einen dezenten „noch nicht erstellt"-Hinweis. */}
      <div className={READ_COL}>
        <KurzbeschreibungCard
          text={kurzbeschreibung}
          open={kbOpen}
          onToggle={() => setKbOpen(o => !o)}
        />
      </div>

      {/* VORGÄNGER-HINWEIS — frühere abgelehnte/zurückgezogene Einreichungen. */}
      {vorgaenger.length > 0 ? (
        <div className={READ_COL}>
          <AbgelehnteVorgaengerBanner vorgaenger={vorgaenger} onOpenAntrag={onOpenAntrag} />
        </div>
      ) : null}

      {/* ARTEFAKT-LEISTE (Phase 7): Nachforderung als Fortschritts-Karte (nur wenn
          erreicht). Das Gutachten ist in die Gutachten-Werkstatt unten gewandert. */}
      <div className={READ_COL}>
        <ArtefaktLeiste
          ctxKey={kurzfassungCtx.key}
          tvs={antraege}
          status={displayStatus}
          onWeiterNachforderung={() => scrollTo('nf')}
        />
      </div>

      {/* STATUS & VERLAUF (Phase 5) — kuratierter Katalog + Historie + Ableitung
          (Timeline + „Warum?" + nächste Schritte). Nur bei aktivem Status-Cockpit-Flag. */}
      {isStatusCockpitEnabled() && (
        <div id="status" className="mt-6 pt-6 scroll-mt-[80px]" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
          <StatusDetailSection verbundId={verbund.verbund_id} statusRoh={verbundStatus} />
        </div>
      )}

      {/* FRISTEN & MEILENSTEINE — die Soll-Achse zum Status: Zeitstrahl Soll gegen
          Ist, Restzeit zur Gesamtfrist, Risiko-Meldung an die Projektleitung. */}
      {isMeilensteinMonitoringEnabled() && (
        <div id="meilensteine" className="mt-6 pt-6 scroll-mt-[80px]" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
          <MeilensteinSection verbundId={verbund.verbund_id} />
        </div>
      )}

      {/* GUTACHTEN-WERKSTATT — Verbund-Ebene (nur dev). Nach oben gezogen (ersetzt
          die frühere Übersichts-Karte): Fortschritt + „Weiter bei X" leben jetzt im
          Sektionskopf bzw. der Wiederaufnahme-Zeile. Der Workflow A–G löst die
          Kurzfassung-Sektion ab; else-if, damit in dev nur EINE Sektion mountet. */}
      {gutachtenSichtbar ? (
        <div id="gutachten" className="mt-6 pt-6 scroll-mt-[80px]" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
          {isGutachtenWorkflowEnabled() ? (
            <GutachtenSection ctx={kurzfassungCtx} initialAbschnittId={abschnittParam} />
          ) : (
            <KurzfassungSection ctx={kurzfassungCtx} />
          )}
        </div>
      ) : null}

      {/* DATEN-SEKTIONEN — kollabierte Zeilen mit Kontext-Vorschau (Default zu).
          Nur echte Verbuende; bei pseudo (Standalone) stecken die Stammdaten im
          TvDetailBlock (doppelte Anzeige vermeiden). Die Werkbank sitzt ZWISCHEN
          „Antragsdaten" und „Alle Felder" (Arbeitsablauf vor den Feld-Sektionen) —
          daher zwei READ_COL-Gruppen statt einer: der Werkbank-Block laeuft
          bewusst ueber die volle Panel-Breite. */}
      {!isPseudo ? (
        <>
          <div className={READ_COL}>
            <CollapsibleDataSection
              title="Antragsdaten"
              storageKey="verbund_antragsdaten_collapsed"
              preview={antragsdatenPreview}
            >
              <VerbundGlance tvs={antraege} verbundId={verbund.verbund_id} unterprogramm={unterprogramm} />

              {/* Verbundpartner/Teilvorhaben leben in DIESER Sektion (v2.338) — als
                  eigene Klappzeile waren es zwei Sektionen fuer eine Sache. Kopier-
                  Icon steht an der Unter-Ueberschrift, nicht am Sektionskopf: es
                  kopiert TV-Titel, nicht „Antragsdaten". */}
              <div className="mt-5 mb-2 flex items-center gap-1.5">
                <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)]">
                  Verbundpartner und Teilvorhaben
                </span>
                <TvTitelCopyButton titel={tvTitelZeilen} />
              </div>
              <TeilvorhabenListe
                tvs={antraege}
                verbundTitel={titel}
                expandedTvAz={expandedTvAz}
                onToggle={(az) => setExpandedTvAz(prev => (prev === az ? null : az))}
                onOpenAntrag={onOpenAntrag}
              />
            </CollapsibleDataSection>
          </div>

          {werkbankBlock}

          <div className={READ_COL}>
            {antraege.length > 0 ? (
              <CollapsibleDataSection
                title="Alle Felder"
                storageKey="verbund_allefelder_collapsed"
                preview={`${felderStats.gesamt} · ${felderStats.mitWerten} mit Werten`}
              >
                <VerbundAlleFelder
                  tvs={antraege}
                  schemas={schemas}
                  sourceNames={sourceNames}
                  historyCounts={historyCounts}
                  onOpenHistory={setHistoryField}
                />
              </CollapsibleDataSection>
            ) : null}

            <CollapsibleDataSection
              title="Historie"
              storageKey="verbund_historie_collapsed"
              preview={history.length > 0 ? `zuletzt ${formatShortDate(history[0]!.geaendert_am)}` : null}
            >
              <VerbundHistorie history={history} />
            </CollapsibleDataSection>
          </div>
        </>
      ) : (
        // Pseudo-Verbund: TV-Detail direkt (kein Sammel-Block, keine Liste).
        <>
          <div className={READ_COL}>
            {expandedTvAz ? (
              <div className="mb-6">
                <TvDetailBlock aktenzeichen={expandedTvAz} zeigeEckdaten onOpenAntrag={onOpenAntrag} />
              </div>
            ) : null}
          </div>
          {werkbankBlock}
        </>
      )}

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

function PanelShell({ onClose, zurueck, children }: {
  onClose: () => void;
  zurueck?: { label: string; onClick: () => void };
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex-1 min-w-0 h-full overflow-y-auto" style={{ borderLeft: '0.5px solid var(--tf-border)' }}>
      {/* Links der Rückweg (nur wenn es einen gibt), rechts das Schließen. Zwei
          verschiedene Aussagen: „zurück, wo ich herkam" vs. „Detail zu". */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 pt-3 pb-1 bg-[var(--tf-bg)]">
        {zurueck ? (
          <button
            type="button"
            onClick={zurueck.onClick}
            className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer"
          >
            <ArrowLeft size={14} /> {zurueck.label}
          </button>
        ) : <span />}
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

/** Kurzes Datum `DD.MM.YY` für die Historie-Kontext-Vorschau. */
function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch {
    return iso;
  }
}
