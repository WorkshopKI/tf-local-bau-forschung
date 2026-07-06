import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { getStatusLabel } from '@/core/utils/status-mappings';
import { dominantStatus } from './groupAggregates';
import { FieldHistoryModal } from './FieldHistoryModal';
import { VerbundAlleFelder } from './VerbundAlleFelder';
import { VerbundGlance, VerbundPartnerTabelle } from './alleFelder';
import { verbundFelderStats } from './alleFelder/verbundMerge';
import { VerbundKopf } from './VerbundKopf';
import { CollapsibleDataSection } from './CollapsibleDataSection';
import { TeilvorhabenListe } from './TeilvorhabenListe';
import { VerbundHistorie } from './VerbundHistorie';
import { ArtefaktLeiste } from './artefakte/ArtefaktLeiste';
import { ArtefaktBreadcrumb } from './ArtefaktBreadcrumb';
import { statusZuStepperPosition, STEPPER_STATIONS } from './statusZuStepperPosition';
import { TvDetailBlock } from './TvDetailBlock';
import { findFieldValue } from './fieldLookup';
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

export function VerbundDetail({
  verbundId,
  initialExpandedTvAz,
  onClose,
  onOpenAntrag,
}: Props): React.ReactElement {
  // Deep-Link aus der Home-„Weitermachen"-Karte: `ziel` (gutachten|nf) scrollt
  // zur Sektion, `abschnitt` (nur GA) springt den Schritt (an GutachtenSection
  // durchgereicht). Query-Param — überlebt Liste-/URL-Navigation. `setSearchParams`
  // treibt den „Weiter bei X"-Sprung der Artefakt-Leiste (setzt `abschnitt`).
  const [searchParams, setSearchParams] = useSearchParams();
  const zielParam = searchParams.get('ziel');
  const abschnittParam = searchParams.get('abschnitt') ?? undefined;
  // In-Memory-Slim-Liste des Programms — Quelle für die Vorgänger-Suche.
  const allAntraege = useAntraegeStore(s => s.antraege);

  const isPseudo = isPseudoVerbundId(verbundId);
  // Daten-Schicht: Verbund + TVs + Historie + Schemas (bzw. Pseudo-Verbund).
  const { verbund, antraege, history, schemas, sourceNames } = useVerbundDetailData(verbundId, isPseudo);

  const [historyField, setHistoryField] = useState<string | null>(null);
  // Kompakt-Layout: Kurzbeschreibung-Expand im Kopf.
  const [kbOpen, setKbOpen] = useState(false);
  // Unterprogramm-Labels (Code → Name) fuer die Stammdaten-Anzeige — statt der
  // nackten Nummer den sprechenden Namen. Hook vor dem fruehen Return halten.
  const unterprogrammLabels = useUnterprogrammLabels(antraege[0]?.programm_id ?? null);

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

  // Verbund-Kurzbeschreibung aus dem Lead-TV. `vb_inhalt` (CSV-Spalte VB_INHALT,
  // Label "Inhalt / Kurzzusammenfassung") ist auf Verbund-Ebene i.d.R. identisch
  // über alle TVs — Lead-Wert reicht.
  const vorhabenInhalt = lead ? strOrNull(findFieldValue(lead, [
    'vb_inhalt', 'vb inhalt', 'vorhaben_inhalt', 'vorhabeninhalt', 'beschreibung', 'kurzbeschreibung',
    'inhalt_kurzzusammenfassung', 'kurzzusammenfassung',
  ])) : null;

  // Kopf-Stepper: Verbund-Ebene (amtliches Aggregat), unabhängig vom expandierten TV.
  const stepperStatus = displayStatus;
  // Amtliche Phase für die Werkstatt-Breadcrumb (Stepper-Station bzw. Terminal-Label).
  const stepperPos = statusZuStepperPosition(displayStatus);
  const phaseLabel: string | null = stepperPos.terminal
    ? getStatusLabel(displayStatus ?? '')
    : (STEPPER_STATIONS[stepperPos.station - 1] ?? null);

  // Kopf-Beschreibung: Titel + Kurzzusammenfassung (VB_INHALT) in EINEM Block
  // (exakte Duplikate zusammengefasst); 3-Zeilen-Clamp via `kbOpen` im VerbundKopf.
  const beschreibung = (() => {
    const parts = [titel, vorhabenInhalt].filter((v): v is string => !!v);
    const uniq = parts.filter((v, i) => parts.indexOf(v) === i);
    return uniq.length > 0 ? uniq.join(' ') : null;
  })();

  // Header-Aktenzeichen: bei pseudo die echte Aktenzeichen-ID, nicht die __pseudo__-Synthetik.
  const headerId = isPseudo ? aktenzeichenFromPseudoVerbundId(verbundId) : verbund.verbund_id;

  // Gutachten/Kurzfassung läuft auf Verbund-Ebene (eine VB pro Verbund). Key +
  // Förderkennzeichen = Verbund-ID (bzw. echtes Az bei Solo/pseudo).
  const kurzfassungCtx: KurzfassungContext = buildKurzfassungContext(
    verbund, antraege, headerId, verbund.verbund_id,
  );

  const gutachtenSichtbar = isGutachtenWorkflowEnabled() || isGutachtenKurzfassungEnabled();

  // Kontext-Vorschau der kollabierten „Antragsdaten"-Sektion: Koordinator + weitere.
  const antragsdatenPreview = [antragsteller, antraege.length > 1 ? `${antraege.length - 1} weitere` : null]
    .filter(Boolean).join(' · ');

  // Zurück-zum-Kopf (Werkstatt-Breadcrumb) + Sprung in GA/NF-Werkstatt (Artefakt-Leiste).
  const scrollTo = (id: string): void => { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const onWeiterGutachten = (stepId?: string): void => {
    if (stepId) {
      const next = new URLSearchParams(searchParams);
      next.set('abschnitt', stepId);
      setSearchParams(next, { replace: true });
    }
    // Nach dem etwaigen Param-Update rendern lassen, dann scrollen.
    setTimeout(() => scrollTo('gutachten'), 0);
  };

  return (
    <PanelShell onClose={onClose}>
      {/* VERBUND-KOPF (Phase 6): Identität + Beschreibung + Eckdaten + amtlicher Stepper. */}
      <div id="verbund-kopf" className={READ_COL}>
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

      {/* VORGÄNGER-HINWEIS — frühere abgelehnte/zurückgezogene Einreichungen. */}
      {vorgaenger.length > 0 ? (
        <div className={READ_COL}>
          <AbgelehnteVorgaengerBanner vorgaenger={vorgaenger} onOpenAntrag={onOpenAntrag} />
        </div>
      ) : null}

      {/* ARTEFAKT-LEISTE (Phase 7): Gutachten + Nachforderung als Fortschritts-Karten —
          nur erreichte Artefakte. Sprünge in die jeweilige Werkstatt weiter unten. */}
      <div className={READ_COL}>
        <ArtefaktLeiste
          ctxKey={kurzfassungCtx.key}
          tvs={antraege}
          status={displayStatus}
          onWeiterGutachten={onWeiterGutachten}
          onWeiterNachforderung={() => scrollTo('nf')}
        />
      </div>

      {/* DATEN-SEKTIONEN — kollabierte Zeilen mit Kontext-Vorschau (Default zu).
          Nur echte Verbuende; bei pseudo (Standalone) stecken die Stammdaten im
          TvDetailBlock (doppelte Anzeige vermeiden). */}
      {!isPseudo ? (
        <div className={READ_COL}>
          <CollapsibleDataSection
            title="Antragsdaten und Verbundpartner"
            storageKey="verbund_antragsdaten_collapsed"
            preview={antragsdatenPreview}
          >
            <div className="mb-4">
              <VerbundGlance tvs={antraege} verbundId={verbund.verbund_id} unterprogramm={unterprogramm} />
            </div>
            <VerbundPartnerTabelle tvs={antraege} />
          </CollapsibleDataSection>

          <CollapsibleDataSection
            title="Teilvorhaben"
            storageKey="verbund_teilvorhaben_collapsed"
            preview={antraege.length}
          >
            <TeilvorhabenListe
              tvs={antraege}
              expandedTvAz={expandedTvAz}
              onToggle={(az) => setExpandedTvAz(prev => (prev === az ? null : az))}
              onOpenAntrag={onOpenAntrag}
            />
          </CollapsibleDataSection>

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
      ) : (
        // Pseudo-Verbund: TV-Detail direkt (kein Sammel-Block, keine Liste).
        <div className={READ_COL}>
          {expandedTvAz ? (
            <div className="mb-6">
              <TvDetailBlock aktenzeichen={expandedTvAz} onOpenAntrag={onOpenAntrag} />
            </div>
          ) : null}
        </div>
      )}

      {/* GUTACHTEN-WERKSTATT — Verbund-Ebene (nur dev). Der Workflow A–G löst die
          Kurzfassung-Sektion ab; else-if, damit in dev nur EINE Sektion mountet. */}
      {gutachtenSichtbar ? (
        <div id="gutachten" className="mt-6 pt-6 scroll-mt-[80px]" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
          <ArtefaktBreadcrumb akronym={akronym} phase={phaseLabel} onBack={() => scrollTo('verbund-kopf')} />
          {isGutachtenWorkflowEnabled() ? (
            <GutachtenSection ctx={kurzfassungCtx} initialAbschnittId={abschnittParam} />
          ) : (
            <KurzfassungSection ctx={kurzfassungCtx} />
          )}
        </div>
      ) : null}

      {/* NACHFORDERUNGEN-WERKSTATT — eigener Artefakt-Typ (nur dev). */}
      {isNfNachforderungenEnabled() ? (
        <div id="nf" className="mt-6 pt-6 scroll-mt-[80px]" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
          <ArtefaktBreadcrumb akronym={akronym} phase={phaseLabel} onBack={() => scrollTo('verbund-kopf')} />
          <NachforderungenSection ctx={kurzfassungCtx} />
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

/** Kurzes Datum `DD.MM.YY` für die Historie-Kontext-Vorschau. */
function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch {
    return iso;
  }
}
