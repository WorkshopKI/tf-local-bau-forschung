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
import { useSichtbar } from '@/core/hooks/useSichtbar';
import { reiterId } from '@/core/sichtbarkeit';
import { useVerbundDetailData } from '../useVerbundDetailData';
import { buildKurzfassungContext } from '../kurzfassung/context-builder';
import { isPseudoVerbundId, pseudoVerbundIdFor } from '../pseudoVerbund';
import { antragDetailPfad } from '../detailPfad';
import { useAufbereitung } from './useAufbereitung';
import { kontextZustand } from './kontext-zustand';
import { QuellenPanel } from './QuellenPanel';
import { AufbereitungTabs, type AufbereitungTabId } from './AufbereitungTabs';
import { deriveTabZustaende } from './tab-gating';
import { aggregiereFundstellen } from './lesemodus-fundstellen';
import { UebersichtTab } from './UebersichtTab';
import { baueKiCta, NEU_AUFBEREITEN_TITEL } from './uebersicht';
import { ZeitplanTab } from './ZeitplanTab';
import { AbdeckungTab, type AbdeckungAnsicht } from './AbdeckungTab';
import { SteckbriefTab, type SteckbriefStammdaten } from './SteckbriefTab';
import { ZahlenTab } from './ZahlenTab';
import { VerwertungTab } from './VerwertungTab';
import { GlossarTab } from './GlossarTab';
import { RechercheTab } from './RechercheTab';
import type { BekannteStammwerte } from './recherche-leak';
import { FragenTab } from './FragenTab';
import { LesemodusTab } from './LesemodusTab';
import { LesemodusSprungProvider } from './lesemodusSprung';

function kurzDatum(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : d.toLocaleDateString('de-DE');
}

export function AufbereitungPage({ antragKey }: { antragKey: string }): React.ReactElement {
  const antraege = useAntraegeStore(s => s.antraege);
  const sichtbar = useSichtbar();
  const istVerbund = useMemo(() => antraege.some(a => a.verbund_id === antragKey), [antraege, antragKey]);
  const verbundId = istVerbund ? antragKey : pseudoVerbundIdFor(antragKey);
  const { verbund, antraege: tvs, laedt: kontextLaedt, erneutVersuchen } = useVerbundDetailData(verbundId, isPseudoVerbundId(verbundId));
  const ctx = useMemo(
    () => (verbund ? buildKurzfassungContext(verbund, tvs, antragKey, verbund.verbund_id) : null),
    [verbund, tvs, antragKey],
  );
  // Identifizierende Stammwerte für den DR-Leak-Check (Paket 5). Personennamen aus dem
  // Steckbrief liegen zur recherche-prompt-Laufzeit noch nicht vor (der Baustein läuft
  // zuerst) — die TV-Antragsteller/-Titel decken den Kern deterministisch ab. Auch der
  // Stichwort-Editor prüft Eingaben dagegen, deshalb eigener Memo statt Inline-Objekt.
  const bekannteWerte = useMemo<BekannteStammwerte>(
    () => (ctx ? {
      antragsteller: ctx.antragsteller,
      foerderkennzeichen: ctx.foerderkennzeichen,
      akronym: ctx.akronym,
      titel: ctx.titel,
      aktenzeichen: ctx.knownIds,
      personennamen: tvs.map(tv => (typeof tv.antragsteller === 'string' ? tv.antragsteller.trim() : '')).filter(Boolean),
      weitereTitel: tvs.map(tv => (typeof tv.titel === 'string' ? tv.titel.trim() : '')).filter(Boolean),
    } : {}),
    [ctx, tvs],
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
      bekannteWerte,
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
  // Beschriftung/Tooltip aus demselben reinen Helfer wie das Cockpit — sonst driften
  // die beiden Kopfleisten auseinander (und eine von beiden lügt).
  const kiCta = baueKiCta(kiBausteine.map(b => b.status), { stark: aufb.laufZiel.ziel === 'stark' });
  // ALLE sechs Bausteine, nicht drei: der Lauf übernimmt `chatResetStatus` für
  // jeden von ihnen, und dies ist die einzige Stelle, die ihn im echten Lauf
  // auswertet. Zahlen, Glossar und Recherche-Prompt fielen still heraus — ein
  // Ergebnis aus fremdem Chat-Verlauf stand dann als normales da, ohne dass die
  // Gegenmaßnahme angeboten wurde (Pitfall #36, v4.124).
  const resetRisiko = kiBausteine.some(b => b.chatResetStatus != null && resetHatVerlaufsrisiko(b.chatResetStatus));

  // Defense-in-depth: die Route ist bereits flag-gated registriert.
  if (!isAntragAufbereitungEnabled()) return <Navigate to="/antraege" replace />;

  const backHref = antragDetailPfad(istVerbund
    ? { verbundId: antragKey }
    : { aktenzeichen: antragKey });

  const titel = ctx?.akronym ?? antragKey;

  // Ohne aufgelösten Antrag hat die Seite keine Grundlage: „Neu aufbereiten" und
  // „Mit KI aufbereiten" brechen dann wortlos ab. Also gar nicht erst anbieten,
  // sondern den Zustand benennen (siehe `kontext-zustand.ts`).
  const zustand = kontextZustand({ ctxVorhanden: ctx !== null, laedt: kontextLaedt });
  if (zustand !== 'bereit') {
    return (
      <KontextHinweis
        zustand={zustand}
        antragKey={antragKey}
        backHref={backHref}
        onErneutVersuchen={erneutVersuchen}
      />
    );
  }

  const metaTeile = [ctx?.foerderkennzeichen ? `FKZ ${ctx.foerderkennzeichen}` : null, ctx?.antragsteller ?? null]
    .filter((s): s is string => !!s);
  const stammdaten: SteckbriefStammdaten = {
    antragsteller: ctx?.antragsteller ?? null,
    foerderkennzeichen: ctx?.foerderkennzeichen ?? null,
    // Die Projektform haengt an der ZAHL der Teilvorhaben, nicht daran, ob der
    // Route-Schluessel eine VB-Nummer ist. `verbund_id` ist in 14 225 von 14 225
    // Records gesetzt, `istVerbund` war also praktisch immer wahr — jeder
    // Ein-TV-Verbund (EP/DL sind laut Doku genau das) las sich als
    // „ZIM-Kooperationsprojekt · 1 Teilvorhaben“, waehrend die Filterleiste
    // dieselben Vorhaben unter „Einzelprojekt“ zaehlte. Dieselbe Regel wie in
    // `matchesProjektart` (v4.124).
    projektform: ctx
      ? `${tvs.length >= 2 ? 'ZIM-Kooperationsprojekt' : 'ZIM-Einzelprojekt'} · ${tvs.length} ${tvs.length === 1 ? 'Teilvorhaben' : 'Teilvorhaben'}`
      : null,
  };
  return (
    <div className="px-8 py-6">
      <ZurueckLink href={backHref} />

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
            <Button variant="secondary" size="sm" loading={aufb.neu.busy} onClick={() => aufb.neu.run()}
              title={NEU_AUFBEREITEN_TITEL}>
              {aufb.neu.busy ? 'Aufbereiten …' : 'Neu aufbereiten (ohne KI)'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={aufb.bausteine.busy}
              onClick={() => aufb.bausteine.run()}
              title={kiCta.titel}
            >
              {aufb.bausteine.busy ? `KI-Aufbereitung läuft … (${kiFertig}/${kiBausteine.length})` : kiCta.label}
            </Button>
          </div>
        }
      />

      {/* Fehler der beiden Kopf-Aktionen: `bausteine.error` zeigen die Tabs selbst,
          `neu`/`bausteineNeu` hatten bis dahin NUR im pausierten Zeitplan-Tab einen
          Anzeigeort — ein gescheiterter Klick sah aus wie ein toter Knopf. */}
      {aufb.neu.error || aufb.bausteineNeu.error ? (
        <div className="mt-2 rounded-lg px-3 py-2 text-[12.5px] text-[var(--tf-danger-text)]"
          style={{ border: '0.5px solid var(--tf-border)' }}>
          {aufb.neu.error ?? aufb.bausteineNeu.error}
        </div>
      ) : null}

      {aufb.veraltet ? (
        <div className="mt-2 text-[12px] text-[var(--tf-text-tertiary)]">
          ● Quellen haben sich seit der Aufbereitung geändert — „Neu aufbereiten" für den aktuellen Stand.
        </div>
      ) : null}

      {resetRisiko ? (
        <div className="mt-2 text-[12px] text-[var(--tf-warning-text)] bg-[var(--tf-warning-bg)] rounded-[8px] px-3 py-2">
          ⚠ Chat-Reset fehlgeschlagen — mindestens ein KI-Baustein lief evtl. auf altem Chat-Verlauf der internen KI.
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
          laufZiel={aufb.laufZiel}
          onStarkErzwungen={aufb.setzeStarkErzwungen}
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
            laufZiel={aufb.laufZiel}
            hatEinreichungsJson={aufb.einreichungsBezug?.zeitplan != null}
          />
        ) : tab === 'zeitplan' ? (
          <ZeitplanTab
            run={aufb.run}
            loading={aufb.loading}
            neu={aufb.neu}
            toggle={aufb.toggle}
            ctx={ctx ? { key: ctx.key, knownIds: ctx.knownIds } : { key: '', knownIds: [] }}
            onIngested={aufb.requestRecompute}
            einreichung={aufb.einreichungsBezug}
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
            {...(sichtbar(reiterId('aufbereitung', 'recherche'))
              ? { onGotoRecherche: () => setTab('recherche') }
              : {})}
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
            speichereDrPrompt={aufb.speichereRecherchePrompt}
            speichereDrStichworte={aufb.speichereRechercheStichworte}
            verwerfeDrPromptEdit={aufb.verwerfeRecherchePromptEdit}
            bekannteWerte={bekannteWerte}
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

function ZurueckLink({ href }: { href: string }): React.ReactElement {
  return (
    <Link to={href}
      className="inline-flex items-center gap-1 text-[13px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]">
      <ArrowLeft size={14} /> Zurück zum Antrag
    </Link>
  );
}

/**
 * Seite ohne auflösbaren Antrag. Zeigt bewusst KEINE Aktionen — ohne Kontext bricht
 * jede von ihnen wortlos ab, und genau dieser stille Knopf war der gemeldete Fehler.
 * Der häufigste Grund ist ein Datenbestand, der noch nachrückt (Start-Sync / laufende
 * Aktualisierung); `useVerbundDetailData` löst dann von selbst neu auf, „Erneut
 * versuchen" ist der Weg für alles andere.
 */
function KontextHinweis({ zustand, antragKey, backHref, onErneutVersuchen }: {
  zustand: 'laedt' | 'nicht-aufloesbar';
  antragKey: string;
  backHref: string;
  onErneutVersuchen: () => void;
}): React.ReactElement {
  return (
    <div className="px-8 py-6">
      <ZurueckLink href={backHref} />
      <PageHeader className="mt-2" title={antragKey} />
      {zustand === 'laedt' ? (
        <p className="mt-4 text-[13px] text-[var(--tf-text-tertiary)]">Antrag wird geladen …</p>
      ) : (
        <div className="mt-4 max-w-[560px] rounded-xl p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
          <p className="text-[13px] text-[var(--tf-text)]">
            Antrag {antragKey} ist im aktuellen Datenbestand nicht auffindbar.
          </p>
          <p className="mt-1 text-[12.5px] text-[var(--tf-text-tertiary)] leading-snug">
            Möglicherweise werden die Daten gerade aktualisiert — dann erscheint der Antrag von
            selbst, sobald die Aktualisierung durch ist. Die Aufbereitung ist bis dahin nicht
            möglich, deshalb sind die Aktionen ausgeblendet.
          </p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={onErneutVersuchen}>
            Erneut versuchen
          </Button>
        </div>
      )}
    </div>
  );
}
