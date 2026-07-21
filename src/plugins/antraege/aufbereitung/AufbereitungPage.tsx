/**
 * Vollbild-Seite der Antrag-Aufbereitung (Route `/antraege/:aktenzeichen/aufbereitung`,
 * flag-gated `antragAufbereitung`). Rahmen aus dem Mockup: Zurück-Link + Kopf
 * (Titel/Meta + Quellen-Status + „Neu aufbereiten") + Hinweiszeile + Tab-Leiste.
 * In Paket 1 ist nur der Zeitplan-Tab funktional.
 *
 * Der Kontext wird aus dem Route-Key über dieselben Helfer wie VerbundDetail
 * aufgelöst (`useVerbundDetailData` + `buildKurzfassungContext`) — deep-link-/
 * refresh-fest. `key` ist ein echtes Verbund-Az oder ein Aktenzeichen (nie ein
 * Pseudo-Id), daher direkt als Route-Segment nutzbar.
 */
import { useCallback, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { isAntragAufbereitungEnabled } from '@/config/feature-flags';
import { resetHatVerlaufsrisiko } from '@/core/services/ai/chat-reset';
import { useAntraegeStore } from '../store';
import { useVerbundDetailData } from '../useVerbundDetailData';
import { buildKurzfassungContext } from '../kurzfassung/context-builder';
import { isPseudoVerbundId, pseudoVerbundIdFor } from '../pseudoVerbund';
import { useAufbereitung } from './useAufbereitung';
import { QuellenPanel } from './QuellenPanel';
import { AufbereitungTabs, type AufbereitungTabId } from './AufbereitungTabs';
import { deriveTabZustaende } from './tab-gating';
import { aggregiereFundstellen } from './lesemodus-fundstellen';
import { UebersichtTab } from './UebersichtTab';
import { ZeitplanTab } from './ZeitplanTab';
import { AbdeckungTab, type AbdeckungAnsicht } from './AbdeckungTab';
import { SteckbriefTab, type SteckbriefStammdaten } from './SteckbriefTab';
import { ZahlenTab } from './ZahlenTab';
import { VerwertungTab } from './VerwertungTab';
import { GlossarTab } from './GlossarTab';
import { RechercheTab } from './RechercheTab';
import { FragenTab } from './FragenTab';
import { LesemodusTab } from './LesemodusTab';
import { LesemodusSprungProvider } from './lesemodusSprung';

function kurzDatum(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : d.toLocaleDateString('de-DE');
}

export function AufbereitungPage({ antragKey }: { antragKey: string }): React.ReactElement {
  const antraege = useAntraegeStore(s => s.antraege);
  const istVerbund = useMemo(() => antraege.some(a => a.verbund_id === antragKey), [antraege, antragKey]);
  const verbundId = istVerbund ? antragKey : pseudoVerbundIdFor(antragKey);
  const { verbund, antraege: tvs } = useVerbundDetailData(verbundId, isPseudoVerbundId(verbundId));
  const ctx = useMemo(
    () => (verbund ? buildKurzfassungContext(verbund, tvs, antragKey, verbund.verbund_id) : null),
    [verbund, tvs, antragKey],
  );
  const aufb = useAufbereitung(
    ctx ? {
      key: ctx.key,
      knownIds: ctx.knownIds,
      teilvorhaben: tvs.map((tv, i) => ({
        nr: i + 1,
        tvAz: tv.aktenzeichen,
        akronym: typeof tv.akronym === 'string' && tv.akronym.trim() ? tv.akronym.trim() : null,
        titel: typeof tv.titel === 'string' && tv.titel.trim() ? tv.titel.trim() : null,
      })),
      // Identifizierende Stammwerte für den DR-Prompt-Leak-Check (Paket 5). Personennamen
      // aus dem Steckbrief liegen zur recherche-prompt-Laufzeit noch nicht vor (der Baustein
      // läuft zuerst) — die TV-Antragsteller/-Titel decken den Kern deterministisch ab.
      bekannteWerte: {
        antragsteller: ctx.antragsteller,
        foerderkennzeichen: ctx.foerderkennzeichen,
        akronym: ctx.akronym,
        titel: ctx.titel,
        aktenzeichen: ctx.knownIds,
        personennamen: tvs.map(tv => (typeof tv.antragsteller === 'string' ? tv.antragsteller.trim() : '')).filter(Boolean),
        weitereTitel: tvs.map(tv => (typeof tv.titel === 'string' ? tv.titel.trim() : '')).filter(Boolean),
      },
    } : null,
  );
  const [tab, setTab] = useState<AufbereitungTabId>('uebersicht');
  const [ansicht, setAnsicht] = useState<AbdeckungAnsicht>('liste');
  // „Im Antrag öffnen": Fundstelle → Lesemodus-Tab + Sprung zur Sektion (Context, kein Drilling).
  const [sprungZiel, setSprungZiel] = useState<string | null>(null);
  const springeZuFundstelle = useCallback((sektionId: string) => {
    setSprungZiel(sektionId);
    setTab('lesemodus');
  }, []);
  const verbraucheSprung = useCallback(() => setSprungZiel(null), []);
  const sprung = useMemo(
    () => (aufb.vbMarkdown ? springeZuFundstelle : null),
    [aufb.vbMarkdown, springeZuFundstelle],
  );
  // Fundstellen-Overlay des Lesemodus: welche Baustein-Ergebnisse referenzieren je Sektion
  // (nur vorhandene Daten; deterministische Aggregation). Vor dem Early-Return (Hook-Order).
  const fundstellen = useMemo(
    () => aggregiereFundstellen({
      gliederung: aufb.run?.gliederung ?? [],
      aspekte: aufb.aspekte.daten ?? null,
      steckbrief: aufb.steckbrief.daten ?? null,
      zahlen: aufb.zahlen.daten ?? null,
      verwertung: aufb.verwertung.daten ?? null,
      glossar: aufb.glossar.daten ?? null,
    }),
    [aufb.run, aufb.aspekte.daten, aufb.steckbrief.daten, aufb.zahlen.daten, aufb.verwertung.daten, aufb.glossar.daten],
  );
  const bausteineGelaufen = aufb.aspekte.status === 'ok' || aufb.aspekte.status === 'degradiert';
  // Fortschritt für „Mit KI aufbereiten": wie viele der KI-Bausteine sind fertig
  // (ok/degradiert/fehler) — speist das Live-Label des Buttons während des Laufs.
  const kiBausteine = [aufb.recherchePrompt, aufb.aspekte, aufb.steckbrief, aufb.zahlen, aufb.glossar, aufb.verwertung];
  const kiFertig = kiBausteine.filter(b => b.status === 'ok' || b.status === 'degradiert' || b.status === 'fehler').length;
  const resetRisiko = [aufb.aspekte.chatResetStatus, aufb.steckbrief.chatResetStatus, aufb.verwertung.chatResetStatus]
    .some(s => s != null && resetHatVerlaufsrisiko(s));

  // Defense-in-depth: die Route ist bereits flag-gated registriert.
  if (!isAntragAufbereitungEnabled()) return <Navigate to="/antraege" replace />;

  const backHref = istVerbund
    ? `/antraege/verbund/${encodeURIComponent(antragKey)}`
    : `/antraege/${encodeURIComponent(antragKey)}`;

  const titel = ctx?.akronym ?? antragKey;
  const metaTeile = [ctx?.foerderkennzeichen ? `FKZ ${ctx.foerderkennzeichen}` : null, ctx?.antragsteller ?? null]
    .filter((s): s is string => !!s);
  const stammdaten: SteckbriefStammdaten = {
    antragsteller: ctx?.antragsteller ?? null,
    foerderkennzeichen: ctx?.foerderkennzeichen ?? null,
    projektform: ctx ? (istVerbund ? `ZIM-Kooperationsprojekt · ${tvs.length} Teilvorhaben` : 'ZIM-Einzelprojekt · 1 Teilvorhaben') : null,
  };
  return (
    <div className="px-8 py-6">
      <Link to={backHref}
        className="inline-flex items-center gap-1 text-[13px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]">
        <ArrowLeft size={14} /> Zurück zum Antrag
      </Link>

      <PageHeader
        className="mt-2"
        title={titel}
        meta={metaTeile.length ? <span className="text-[12px] text-[var(--tf-text-tertiary)]">{metaTeile.join(' · ')}</span> : undefined}
        actions={
          <div className="flex items-center gap-2.5 flex-wrap justify-end">
            {aufb.run ? (
              <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
                aufbereitet {kurzDatum(aufb.run.erzeugtAm)}
              </span>
            ) : null}
            {bausteineGelaufen ? (
              <Button variant="ghost" size="sm" loading={aufb.bausteineNeu.busy} onClick={() => aufb.bausteineNeu.run()}
                title="Verwirft die KI-Baustein-Caches und rechnet Aspekte/Steckbrief neu">
                KI-Bausteine neu berechnen
              </Button>
            ) : null}
            <Button variant="secondary" size="sm" loading={aufb.neu.busy} onClick={() => aufb.neu.run()}>
              {aufb.neu.busy ? 'Aufbereiten …' : 'Neu aufbereiten'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={aufb.bausteine.busy}
              onClick={() => aufb.bausteine.run()}
              title="Erzeugt alle KI-Abschnitte der Aufbereitung (Steckbrief, Abdeckung, Zahlen, Glossar, Verwertung) auf einmal — kein Abschnitt muss einzeln gestartet werden"
            >
              {aufb.bausteine.busy ? `KI-Aufbereitung läuft … (${kiFertig}/${kiBausteine.length})` : 'Mit KI aufbereiten'}
            </Button>
          </div>
        }
      />

      {aufb.veraltet ? (
        <div className="mt-2 text-[12px] text-[var(--tf-text-tertiary)]">
          ● Quellen haben sich seit der Aufbereitung geändert — „Neu aufbereiten" für den aktuellen Stand.
        </div>
      ) : null}

      {resetRisiko ? (
        <div className="mt-2 text-[12px] text-[var(--tf-warning-text)] bg-[var(--tf-warning-bg)] rounded-[8px] px-3 py-2">
          ⚠ Chat-Reset fehlgeschlagen — ein KI-Baustein lief evtl. auf altem Chat-Verlauf der internen KI.
          In AitisiGPT einen neuen Chat starten und „KI-Bausteine neu berechnen".
        </div>
      ) : null}

      <p className="mt-2 text-[12px] text-[var(--tf-text-tertiary)]">
        KI-gestützte Aufbereitung — jede Angabe ist per Fundstelle im Original prüfbar. Kein Ersatz für die Prüfung des Antrags.
      </p>

      {ctx ? (
        <QuellenPanel
          ctx={{ key: ctx.key, knownIds: ctx.knownIds }}
          run={aufb.run}
          korpusMass={aufb.korpusMass}
          onIngested={aufb.requestRecompute}
        />
      ) : null}

      <div className="mt-4">
        <AufbereitungTabs
          active={tab}
          onChange={setTab}
          zustaende={deriveTabZustaende({
            gebundeneTabs: {
              steckbrief: aufb.steckbrief.status,
              abdeckung: aufb.aspekte.status,
              zahlen: aufb.zahlen.status,
              glossar: aufb.glossar.status,
              verwertung: aufb.verwertung.status,
            },
            weitereStatus: [aufb.recherchePrompt.status],
            activeTab: tab,
          })}
        />
      </div>

      <div className="mt-6">
        <LesemodusSprungProvider value={sprung}>
        {tab === 'uebersicht' ? (
          <UebersichtTab
            run={aufb.run}
            loading={aufb.loading}
            veraltet={aufb.veraltet}
            stepper={{
              recherchePrompt: aufb.recherchePrompt,
              aspekte: aufb.aspekte,
              steckbrief: aufb.steckbrief,
              zahlen: aufb.zahlen,
              glossar: aufb.glossar,
              verwertung: aufb.verwertung,
            }}
            onTab={setTab}
            bausteine={aufb.bausteine}
            neu={aufb.neu}
          />
        ) : tab === 'zeitplan' ? (
          <ZeitplanTab
            run={aufb.run}
            loading={aufb.loading}
            neu={aufb.neu}
            toggle={aufb.toggle}
            ctx={ctx ? { key: ctx.key, knownIds: ctx.knownIds } : { key: '', knownIds: [] }}
            onIngested={aufb.requestRecompute}
          />
        ) : tab === 'steckbrief' ? (
          <SteckbriefTab
            run={aufb.run}
            steckbrief={aufb.steckbrief}
            vbMarkdown={aufb.vbMarkdown}
            stammdaten={stammdaten}
            bausteine={aufb.bausteine}
            bausteineNeu={aufb.bausteineNeu}
          />
        ) : tab === 'abdeckung' ? (
          <AbdeckungTab
            run={aufb.run}
            aspekte={aufb.aspekte}
            vbMarkdown={aufb.vbMarkdown}
            wurzel={titel}
            ansicht={ansicht}
            onAnsicht={setAnsicht}
            bausteine={aufb.bausteine}
            bausteineNeu={aufb.bausteineNeu}
            toggle={aufb.toggle}
          />
        ) : tab === 'zahlen' ? (
          <ZahlenTab
            run={aufb.run}
            zahlen={aufb.zahlen}
            vbMarkdown={aufb.vbMarkdown}
            bausteine={aufb.bausteine}
            bausteineNeu={aufb.bausteineNeu}
            toggle={aufb.toggle}
          />
        ) : tab === 'verwertung' ? (
          <VerwertungTab
            run={aufb.run}
            verwertung={aufb.verwertung}
            vbMarkdown={aufb.vbMarkdown}
            bausteine={aufb.bausteine}
            bausteineNeu={aufb.bausteineNeu}
            onGotoRecherche={() => setTab('recherche')}
          />
        ) : tab === 'glossar' ? (
          <GlossarTab
            run={aufb.run}
            glossar={aufb.glossar}
            vbMarkdown={aufb.vbMarkdown}
            bausteine={aufb.bausteine}
            bausteineNeu={aufb.bausteineNeu}
          />
        ) : tab === 'recherche' ? (
          <RechercheTab
            recherchePrompt={aufb.recherchePrompt}
            run={aufb.run}
            steckbrief={aufb.steckbrief}
            stammdaten={stammdaten}
            bausteine={aufb.bausteine}
            onMarktzugangKopiert={() => aufb.markiereMarktzugangKopiert.run()}
            importText={aufb.importTextRecherche}
            importDatei={aufb.importDateiRecherche}
            loescheImport={aufb.loescheExternRecherche}
          />
        ) : tab === 'fragen' ? (
          <FragenTab
            run={aufb.run}
            aspekte={aufb.aspekte}
            zahlen={aufb.zahlen}
            vbMarkdown={aufb.vbMarkdown}
            toggleErledigt={aufb.toggleErledigt}
            bausteine={aufb.bausteine}
          />
        ) : tab === 'lesemodus' ? (
          <LesemodusTab
            run={aufb.run}
            vbMarkdown={aufb.vbMarkdown}
            sprungZiel={sprungZiel}
            onVerbraucht={verbraucheSprung}
            fundstellen={fundstellen}
          />
        ) : (
          <div className="py-16 text-center text-[13px] text-[var(--tf-text-tertiary)]">In Vorbereitung (Paket 2)</div>
        )}
        </LesemodusSprungProvider>
      </div>
    </div>
  );
}
