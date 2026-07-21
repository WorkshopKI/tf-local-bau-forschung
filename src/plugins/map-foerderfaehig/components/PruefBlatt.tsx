/**
 * Prüfblatt einer Einreichung: Kopf, Phasen-Navigation, Schritt-Inhalt und
 * Führungsleiste.
 *
 * Verdrahtung, keine Rechnung. Reihenfolge, Phase und Status kommen aus
 * `ansicht/schritte`, die Fachinhalte aus den Schritt-Komponenten.
 *
 * Ein Schritt wird beim ersten Besuch eingehängt und bleibt danach montiert
 * (`hidden`) — so überleben Scrollstand und Eingaben den Wechsel, ohne dass
 * ungeöffnete Schritte Arbeit verursachen. Dieselbe „besucht"-Menge speist das
 * Statusmodell.
 */
import { isDevFixturesEnabled } from '@/config/feature-flags';
import { Check, Info } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import {
  naechsterOffenerSchritt, SCHRITT_LABEL, type AnsichtKey, type StatusSignale,
} from '../ansicht/schritte';
import { baueVergleiche } from '../ansicht/zweitmeinung-vergleich';
import { formatDatum } from '../import/laufzeit';
import { pruefeRichtwerte } from '../infografik/richtwerte';
import { ankerHashFuer } from '../infografik/zweitmeinung';
import type { MapEinreichung, MapImportReport } from '../types';
import { useMapPruefung } from '../useMapPruefung';
import { useMapVb } from '../useMapVb';
import { useSubstanzAnsicht } from '../useSubstanzAnsicht';
import { AbschlussPanel } from './AbschlussPanel';
import { BefundAmpel, BefundListe } from './BefundListe';
import { ChecklistePanel } from './ChecklistePanel';
import { ChecklistenEditor } from './ChecklistenEditor';
import { GuideLeiste } from './GuideLeiste';
import { ImportReportPanel } from './ImportReportPanel';
import { Banner, Karte } from './Karte';
import { PhasenNav } from './PhasenNav';
import { ProjektCanvas } from './ProjektCanvas';
import { ReaderLite } from './ReaderLite';
import { SdtDeltaKarte } from './SdtDeltaKarte';
import { SubstanzSmokePanel } from './SubstanzSmokePanel';
import { VbPanel } from './VbPanel';
import { VorhabenKompakt } from './VorhabenKompakt';
import { WiderspruchListe } from './WiderspruchListe';
import { WirkungsketteAnsicht } from './WirkungsketteAnsicht';

const laedtText = (was: string): React.ReactElement => (
  <p className="text-[13px] text-[var(--tf-text-secondary)]">{was}</p>
);

const analyseHinweis = (was: string): React.ReactElement => (
  <p className="text-[13px] leading-[1.5] text-[var(--tf-text-secondary)]">
    {was} entsteht im internen Analyse-Lauf über die Vorhabensbeschreibung —
    starten Sie ihn im Schritt „Vorhabensbeschreibung".
  </p>
);

export function PruefBlatt({ einreichung, report }: {
  einreichung: MapEinreichung;
  report: MapImportReport | null;
}): React.ReactElement {
  const [ansicht, setAnsicht] = useState<AnsichtKey>('kompakt');
  const [besucht, setBesucht] = useState<ReadonlySet<string>>(() => new Set(['kompakt']));

  const befunde = useMemo(() => report?.befunde ?? [], [report]);
  const pruefung = useMapPruefung(einreichung, befunde);
  const vb = useMapVb(einreichung, pruefung.definition);
  const substanz = useSubstanzAnsicht(vb, pruefung);

  /** Skala-Items = Bewertungsgrundlage der Zweitmeinung (Prompt, Parser, Smoke). */
  const skalaItems = useMemo(
    () => (pruefung.definition?.items ?? []).filter(i => i.art === 'skala' && i.aktiv),
    [pruefung.definition],
  );

  /**
   * Die Zweitmeinungs-Vergleiche entstehen HIER und bewusst nicht in
   * `useSubstanzAnsicht`: dieser Hook speist über Zielkriterien und Präzisions-NF
   * den Abschluss. Bliebe die Zweitmeinung dort, wäre die Regel „sie taucht in
   * keinem Entwurf auf" nicht mehr als Verzeichnis-Guard formulierbar.
   *
   * Der Anker-Stempel entscheidet nur, ob ein Veraltet-Hinweis erscheint — die
   * Zweitmeinung wird nie ausgeblendet, sonst löschte ein Editor-Klick sichtbar
   * Arbeit (dieselbe Haltung wie `versionVeraltet`).
   */
  const vergleiche = useMemo(
    () => baueVergleiche(
      pruefung.ergebnis?.zustaende ?? [], vb.infografik?.innoZweitmeinung ?? [],
    ),
    [pruefung.ergebnis, vb.infografik],
  );

  const ankerVeraltet = vb.infografik !== null
    && vb.infografik.zweitmeinungAnkerHash !== ankerHashFuer(skalaItems);

  const signale: StatusSignale = useMemo(() => ({
    befunde,
    vbZugeordnet: vb.dokument !== null,
    infografikDa: vb.infografik !== null,
    fortschritt: pruefung.ergebnis?.fortschritt ?? null,
    abschlussbereit: pruefung.ergebnis?.abschlussbereit ?? false,
    besucht,
  }), [befunde, vb.dokument, vb.infografik, pruefung.ergebnis, besucht]);

  const naechsterOffen = useMemo(() => naechsterOffenerSchritt(signale), [signale]);

  const wechsle = useCallback((key: AnsichtKey): void => {
    setAnsicht(key);
    setBesucht(vorher => (vorher.has(key) ? vorher : new Set([...vorher, key])));
  }, []);

  const rendereSchritt = (key: AnsichtKey): React.ReactNode => {
    switch (key) {
      case 'kompakt':
        return (
          <VorhabenKompakt
            einreichung={einreichung}
            befunde={befunde}
            gliederung={vb.gliederung}
            substanz={substanz}
          />
        );

      case 'befunde':
        return (
          <div className="flex flex-col gap-4">
            <Banner
              ton={befunde.length === 0 ? 'ok' : 'info'}
              symbol={befunde.length === 0 ? <Check size={17} /> : <Info size={17} />}
              titel={befunde.length === 0
                ? 'Rechenchecks ohne Befund'
                : `${befunde.length} ${befunde.length === 1 ? 'Befund' : 'Befunde'} aus den Rechenchecks`}
            >
              Rechenchecks laufen automatisch beim Import. Warnungen blockieren die
              Prüfung nicht, sollten aber im Gutachten adressiert werden.
            </Banner>
            <Karte titel="Rechenchecks" kopfRechts={<BefundAmpel befunde={befunde} />}>
              <BefundListe befunde={befunde} />
            </Karte>
            <Karte titel="VB ↔ Einreichungsdaten">
              <WiderspruchListe
                zeilen={substanz.widerspruchZeilen}
                gliederung={vb.gliederung}
                lage={vb.infografikLage}
                onUebernehmen={substanz.uebernehmeWiderspruch}
              />
            </Karte>
          </div>
        );

      case 'vb':
        return (
          <Karte titel="Vorhabensbeschreibung">
            <VbPanel vb={vb} einreichungId={einreichung.id} />
          </Karte>
        );

      case 'canvas':
        return (
          <Karte
            titel="Projekt-Canvas"
            kopfRechts={vb.infografik === null ? 'Textfelder noch nicht extrahiert' : 'Textfelder KI-generiert'}
          >
            <ProjektCanvas einreichung={einreichung} texte={vb.infografik?.canvas ?? null} />
          </Karte>
        );

      case 'delta':
        return (
          <Karte titel="Delta zum Stand der Technik">
            {vb.infografik === null
              ? analyseHinweis('Die Gegenüberstellung der Zielparameter')
              : (
                <SdtDeltaKarte
                  zeilen={vb.infografik.sdtDelta}
                  zielkriterienAus={substanz.zielkriterienAus}
                  erledigteAusloeser={substanz.erledigteAusloeser}
                  onZielkriterium={(p, an) => void pruefung.schalteZielkriterium(p, an)}
                  onNachfordern={substanz.nachfordernDelta}
                />
              )}
          </Karte>
        );

      case 'wirkung':
        return (
          <Karte titel="Wirkungskette">
            {vb.infografik === null
              ? analyseHinweis('Die Wirkungskette')
              : (
                <WirkungsketteAnsicht
                  kette={vb.infografik.wirkungskette}
                  richtwerte={pruefeRichtwerte(vb.infografik.wirkungskette, einreichung)}
                />
              )}
          </Karte>
        );

      case 'reader':
        return (
          <Karte titel="Lesen nach Prüfaspekt">
            {vb.dokument === null
              ? laedtText('Ordnen Sie zuerst im Schritt „Vorhabensbeschreibung" ein Dokument zu.')
              : (
                <ReaderLite
                  gliederung={vb.gliederung}
                  markdown={vb.korpus?.markdown ?? vb.dokument.markdown}
                  mapping={vb.aspektMapping}
                />
              )}
          </Karte>
        );

      case 'pruefung':
        return (
          <Karte titel="Förderfähigkeit">
            {pruefung.definition === null || pruefung.ergebnis === null
              ? laedtText('Checkliste wird geladen …')
              : (
                <ChecklistePanel
                  definition={pruefung.definition}
                  ergebnis={pruefung.ergebnis}
                  versionVeraltet={pruefung.versionVeraltet}
                  aspektMapping={vb.aspektMapping}
                  gliederung={vb.gliederung}
                  vbMarkdown={vb.korpus?.markdown ?? ''}
                  vergleiche={vergleiche}
                  ankerVeraltet={ankerVeraltet}
                  onBewerte={(itemId, status, bemerkung) =>
                    void pruefung.bewerteItem({ itemId, status, bemerkung })}
                  onStufe={(itemId, stufe, bemerkung) =>
                    void pruefung.bewerteItem({ itemId, status: 'erfuellt', stufe, bemerkung })}
                  onBedingung={(itemId, wert) => void pruefung.beantworteBedingung(itemId, wert)}
                  onNachziehen={() => void pruefung.ziehePruefungNach()}
                />
              )}
          </Karte>
        );

      case 'abschluss':
        return (
          <Karte titel="Abschluss">
            {pruefung.definition === null || pruefung.ergebnis === null
              ? laedtText('Wird geladen …')
              : (
                <AbschlussPanel
                  einreichung={einreichung}
                  definition={pruefung.definition}
                  ergebnis={pruefung.ergebnis}
                  zielkriterien={substanz.zielkriterien}
                  praezisionsNf={substanz.praezisionsNf}
                />
              )}
          </Karte>
        );

      case 'checkliste':
        return (
          <Karte titel="Checkliste bearbeiten">
            {pruefung.definition === null
              ? laedtText('Wird geladen …')
              : (
                <ChecklistenEditor
                  definition={pruefung.definition}
                  onBearbeite={pruefung.bearbeiteItem}
                  onErgaenze={pruefung.ergaenzeKriterium}
                  onAktiviere={pruefung.aktiviereItem}
                  onZuruecksetzen={pruefung.setzeChecklisteZurueck}
                />
              )}
          </Karte>
        );

      case 'report':
        return (
          <Karte titel="Import-Report">
            {report === null ? laedtText('Report wird geladen …') : <ImportReportPanel report={report} />}
          </Karte>
        );

      case 'smoke':
        return (
          <Karte titel="Substanz-Smoke (dev)">
            <SubstanzSmokePanel skalaItems={skalaItems} />
          </Karte>
        );
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 px-7 pt-5">
        <h1 className="text-[18px] font-medium text-[var(--tf-text)] leading-snug">
          {einreichung.stamm.titel ?? 'Ohne Titel'}
        </h1>
        <p className="text-[12px] text-[var(--tf-text-tertiary)] mt-1">
          <b className="font-medium text-[var(--tf-text-secondary)]">
            {einreichung.stamm.akronym ?? '—'}
          </b>
          {' · importiert am '}
          {formatDatum(einreichung.importiertAm.slice(0, 10))}
          {einreichung.importiertVon != null && ` von ${einreichung.importiertVon}`}
        </p>
      </div>

      <div className="shrink-0 px-7 pt-3.5">
        <PhasenNav
          aktiv={ansicht}
          signale={signale}
          konfigExtra={isDevFixturesEnabled() ? ['smoke'] : undefined}
          onWechsle={wechsle}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-7 py-5">
        {[...besucht].map(key => (
          <div key={key} hidden={key !== ansicht}>
            {rendereSchritt(key as AnsichtKey)}
          </div>
        ))}
      </div>

      <GuideLeiste aktiv={ansicht} naechsterOffen={naechsterOffen} onWechsle={wechsle} />

      <span className="sr-only" role="status">
        {SCHRITT_LABEL[ansicht]}
      </span>
    </div>
  );
}
