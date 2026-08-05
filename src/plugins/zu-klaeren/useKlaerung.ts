/**
 * Zustand und Aktionen der Klärungs-Seite.
 *
 * **Bewusst logikfrei**: Faltung, Auswertung und Gruppierung liegen in
 * `fold`/`konsens`/`gruppen` — reine Module, die der Node-Testlauf greifen kann.
 * Hier steht nur, was ohne Browser nicht geht: IDB, Share, Identität, Uhr. Ginge
 * die Logik hierher, wäre sie ungetestet (Vitest sammelt nur `.test.ts`, und ein
 * Hook braucht ein DOM).
 *
 * Der Zeitstempel wird beim Anlegen einer Äußerung EINMAL genommen und in die
 * reine `baueEintrag` gereicht — nie eine Uhr in der Berechnung.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { canWriteDatenShare } from '@/config/feature-flags';
import { ladeAktiveVersion, getAktiveVersion, baueSeedVersion, katalogDrift } from '@/core/status';
import type { KatalogDrift, ZahPhase } from '@/core/status';
import { falte, baueEintrag, type EintragEingabe } from './fold';
import { autorenVon, istAntwortfaehig } from './konsens';
import {
  baueZeilen, baueGruppen, beantwortetVon, nichtUmgesetzt,
  type GruppeAnsicht, type IstStandKontext, type ZeilenFilter,
} from './gruppen';
import { leseKlaerung, haengeEintragAn } from './klaerung-share';
import { ladeVorkommen } from './vorkommen';
import { PHASENSCHNITT, bauePunkte } from './seed-phasenschnitt';
import { OHNE_PHASE, type Klaerung, type KlaerungPunkt, type KlaerungStand } from './typen';

/** Der Auslieferungsstand als Vergleichsmaß — einmal gebaut, nicht je Laden. */
const AUSLIEFERUNG = baueSeedVersion();

/** Warum das Antworten gesperrt ist — oder `null`, wenn es nicht gesperrt ist. */
export type Sperre = 'kein-name' | 'kein-schreibrecht' | null;

export interface KlaerungApi {
  klaerung: Klaerung;
  punkte: KlaerungPunkt[];
  fragen: KlaerungPunkt[];
  gruppen: GruppeAnsicht[];
  stand: KlaerungStand;
  autoren: string[];
  /** Der eigene Anzeigename aus dem Profil — die Autorschaft dieser Seite. */
  meinName: string | undefined;
  sperre: Sperre;
  /** Anzahl eigener Antworten und Gesamtzahl der Punkte. */
  beantwortet: number;
  gesamt: number;
  filter: ZeilenFilter;
  setFilter: (f: ZeilenFilter) => void;
  /** Alle Zuordnungszeilen — die Zahl an der Pille „Alle Zuordnungen". */
  anzahlZuordnungen: number;
  /** Wie viele Zeilen die engeren Filter zeigen würden. */
  anzahlStrittig: number;
  anzahlUnklar: number;
  anzahlNichtUmgesetzt: number;
  laden: boolean;
  /** ISO-Zeit des letzten erfolgreichen Ladens. */
  standIso: string | null;
  fehler: string | null;
  /** Codes, bei denen die geladene Katalog-Fassung vom Auslieferungsschnitt abweicht. */
  fassungWeichtAb: number[];
  /**
   * Die volle Bilanz der Fassung gegenüber der Auslieferung — `null`, solange sie
   * nicht geladen ist. Speist den Ist-Stand je Zeile UND den Seed-Export.
   */
  drift: KatalogDrift | null;
  /** Die Verfahrensschritte der Fassung — Beschriftung des Ist-Stands und Seed-Export. */
  fassungPhasen: readonly ZahPhase[] | undefined;
  /** Vorkommen je Statuscode; `null`, solange der Zähl-Lauf nicht durch ist. */
  vorkommen: Map<number, number> | null;
  /** ISO-Zeitpunkt des Bestands, auf den sich die Vorkommen-Zahlen berufen. */
  bestandVom: string | null;
  neuLaden: () => Promise<void>;
  aeussern: (eingabe: Omit<EintragEingabe, 'autor'>) => Promise<void>;
}

export function useKlaerung(): KlaerungApi {
  const storage = useStorage();
  const idb = storage.idb;
  // Autorschaft ist eine PERSON, nicht die Rolle im Fachsystem: der Profilname,
  // nicht `bearbeiter_kuerzel` (das haben PL und Kurator gar nicht). Siehe
  // `istAntwortfaehig`.
  const { profile } = useProfile();
  const meinName = profile?.name;
  const istKurator = useKuratorSession(s => s.isActive);
  const darfSchreiben = canWriteDatenShare(istKurator);

  const punkte = useMemo(() => bauePunkte(), []);
  const fragen = useMemo(() => punkte.filter(p => p.art === 'freitext'), [punkte]);

  const [stand, setStand] = useState<KlaerungStand>(() => falte([]));
  const [laden, setLaden] = useState(true);
  const [standIso, setStandIso] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [filter, setFilter] = useState<ZeilenFilter>('alle');
  const [drift, setDrift] = useState<KatalogDrift | null>(null);
  const [fassungPhasen, setFassungPhasen] = useState<readonly ZahPhase[] | undefined>(undefined);
  const [vorkommen, setVorkommen] = useState<Map<number, number> | null>(null);
  const [bestandVom, setBestandVom] = useState<string | null>(null);
  const laufend = useRef(false);

  const neuLaden = useCallback(async (): Promise<void> => {
    if (laufend.current) return;
    laufend.current = true;
    setLaden(true);
    try {
      const { stand: frisch } = await leseKlaerung(idb, PHASENSCHNITT.klaerungId);
      setStand(frisch);
      setStandIso(new Date().toISOString());
      setFehler(null);

      // Ehrlichkeits-Prüfung: die Seite diskutiert den AUSGELIEFERTEN Schnitt.
      // Trüge eine Katalog-Fassung für einen Code etwas anderes, redeten Seite und
      // App aneinander vorbei — dann sagt das die Seite, statt es zu verschweigen.
      //
      // Gerechnet wird das NICHT hier: `katalogDrift` ist die eine Stelle, an der
      // Fassung und Auslieferung verglichen werden (bis v2.417 stand daneben eine
      // eigene Filterschleife über `zahPhaseId`, also eine zweite Wahrheit über
      // dieselbe Frage). Aus derselben Bilanz kommt auch der Ist-Stand je Zeile.
      const version = getAktiveVersion() ?? await ladeAktiveVersion(idb);
      setDrift(katalogDrift(version, AUSLIEFERUNG));
      setFassungPhasen(version.zahPhasen);

      // Nach dem Stand, nicht davor: die Tabelle soll stehen, bevor der Zähl-Lauf
      // über den ganzen Bestand beginnt. Ein Fragebogen darf nicht auf 14 000
      // Anträge warten. Scheitert der Lauf, bleiben die Zahlen leer („—") —
      // die Klärung funktioniert auch ohne sie.
      void ladeVorkommen(idb, version)
        .then(v => { setVorkommen(v.proCode); setBestandVom(v.importiertAm); })
        .catch((err: unknown) => { console.warn('[zu-klaeren] Vorkommen nicht gezählt:', err); });
    } catch (err) {
      setFehler((err as Error).message ?? 'Die Klärung konnte nicht geladen werden.');
    } finally {
      setLaden(false);
      laufend.current = false;
    }
  }, [idb]);

  useEffect(() => { void neuLaden(); }, [neuLaden]);

  // Neu gelesen wird beim Zurückkommen ins Fenster — und sonst nur per Knopf.
  // Kein Intervall: mehrere Clients, die ein SMB-Verzeichnis pollen, sind ein
  // schlechter Nachbar, und eine Abstimmung hat jemanden, der klicken kann.
  useEffect(() => {
    const beiRueckkehr = (): void => {
      if (document.visibilityState === 'visible') void neuLaden();
    };
    document.addEventListener('visibilitychange', beiRueckkehr);
    window.addEventListener('focus', beiRueckkehr);
    return () => {
      document.removeEventListener('visibilitychange', beiRueckkehr);
      window.removeEventListener('focus', beiRueckkehr);
    };
  }, [neuLaden]);

  const sperre: Sperre = !istAntwortfaehig(meinName)
    ? 'kein-name'
    : (darfSchreiben ? null : 'kein-schreibrecht');

  const aeussern = useCallback(async (eingabe: Omit<EintragEingabe, 'autor'>): Promise<void> => {
    if (meinName === undefined || !istAntwortfaehig(meinName)) {
      throw new Error('Ohne Namen im Profil lässt sich nichts eintragen.');
    }
    const eintrag = baueEintrag({ ...eingabe, autor: meinName }, new Date().toISOString());
    const ok = await haengeEintragAn(idb, PHASENSCHNITT.klaerungId, eintrag);
    if (!ok) {
      // Der Share-Schreiber wirft nie; `false` ist das einzige Signal. Würde es
      // hier verschluckt, sähe der Nutzer seine Antwort auf dem Bildschirm,
      // während es sie auf dem Share nicht gibt.
      throw new Error('Nicht gespeichert — der Daten-Share war nicht beschreibbar.');
    }
    await neuLaden();
  }, [idb, meinName, neuLaden]);

  const autoren = useMemo(() => autorenVon(stand), [stand]);

  /** Die abweichenden Codes samt gepflegter Phase — direkt aus der Bilanz. */
  const istStand = useMemo<IstStandKontext | null>(() => (drift === null ? null : {
    abweichend: new Map(drift.zuordnungen.map(z => [z.code, z.nachher ?? OHNE_PHASE])),
    fassungPhasen,
  }), [drift, fassungPhasen]);

  const zeilen = useMemo(
    () => baueZeilen(punkte, stand, autoren, meinName, vorkommen, istStand),
    [punkte, stand, autoren, meinName, vorkommen, istStand],
  );
  const gruppen = useMemo(() => baueGruppen(zeilen, filter), [zeilen, filter]);

  return {
    klaerung: PHASENSCHNITT,
    punkte, fragen, gruppen, stand, autoren, meinName, sperre,
    beantwortet: beantwortetVon(punkte, stand, meinName),
    gesamt: punkte.length,
    filter, setFilter,
    anzahlZuordnungen: zeilen.length,
    anzahlStrittig: zeilen.filter(z => z.befund.zustand === 'strittig').length,
    anzahlUnklar: zeilen.filter(z => z.befund.unklarVon.length > 0).length,
    anzahlNichtUmgesetzt: zeilen.filter(nichtUmgesetzt).length,
    laden, standIso, fehler, vorkommen, bestandVom,
    drift, fassungPhasen,
    fassungWeichtAb: (drift?.zuordnungen ?? []).map(z => z.code),
    neuLaden, aeussern,
  };
}
