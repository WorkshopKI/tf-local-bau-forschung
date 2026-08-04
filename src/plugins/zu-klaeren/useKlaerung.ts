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
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { canWriteDatenShare } from '@/config/feature-flags';
import { ladeAktiveVersion, getAktiveVersion, SEED_CODE_ZU_ZAH_PHASE } from '@/core/status';
import { falte, baueEintrag, type EintragEingabe } from './fold';
import { autorenVon, istAntwortfaehig } from './konsens';
import { baueZeilen, baueGruppen, beantwortetVon, type GruppeAnsicht, type ZeilenFilter } from './gruppen';
import { leseKlaerung, haengeEintragAn } from './klaerung-share';
import { ladeVorkommen } from './vorkommen';
import { PHASENSCHNITT, bauePunkte } from './seed-phasenschnitt';
import { OHNE_PHASE, type Klaerung, type KlaerungPunkt, type KlaerungStand } from './typen';

/** Warum das Antworten gesperrt ist — oder `null`, wenn es nicht gesperrt ist. */
export type Sperre = 'kein-kuerzel' | 'kein-schreibrecht' | null;

export interface KlaerungApi {
  klaerung: Klaerung;
  punkte: KlaerungPunkt[];
  fragen: KlaerungPunkt[];
  gruppen: GruppeAnsicht[];
  stand: KlaerungStand;
  autoren: string[];
  meinKuerzel: string | undefined;
  sperre: Sperre;
  /** Anzahl eigener Antworten und Gesamtzahl der Punkte. */
  beantwortet: number;
  gesamt: number;
  filter: ZeilenFilter;
  setFilter: (f: ZeilenFilter) => void;
  /** Wie viele Zeilen die beiden engeren Filter zeigen würden. */
  anzahlStrittig: number;
  anzahlUnklar: number;
  laden: boolean;
  /** ISO-Zeit des letzten erfolgreichen Ladens. */
  standIso: string | null;
  fehler: string | null;
  /** Codes, bei denen die geladene Katalog-Fassung vom Auslieferungsschnitt abweicht. */
  fassungWeichtAb: number[];
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
  const meinKuerzel = useMeinKuerzel();
  const istKurator = useKuratorSession(s => s.isActive);
  const darfSchreiben = canWriteDatenShare(istKurator);

  const punkte = useMemo(() => bauePunkte(), []);
  const fragen = useMemo(() => punkte.filter(p => p.art === 'freitext'), [punkte]);

  const [stand, setStand] = useState<KlaerungStand>(() => falte([]));
  const [laden, setLaden] = useState(true);
  const [standIso, setStandIso] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [filter, setFilter] = useState<ZeilenFilter>('alle');
  const [fassungWeichtAb, setFassungWeichtAb] = useState<number[]>([]);
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
      const version = getAktiveVersion() ?? await ladeAktiveVersion(idb);
      const abweichend = (version.werte ?? [])
        .filter(w => w.code !== undefined
          && w.zahPhaseId !== undefined
          && (w.zahPhaseId ?? OHNE_PHASE) !== (SEED_CODE_ZU_ZAH_PHASE.get(w.code) ?? OHNE_PHASE))
        .map(w => w.code as number);
      setFassungWeichtAb([...new Set(abweichend)].sort((a, b) => a - b));

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

  const sperre: Sperre = !istAntwortfaehig(meinKuerzel)
    ? 'kein-kuerzel'
    : (darfSchreiben ? null : 'kein-schreibrecht');

  const aeussern = useCallback(async (eingabe: Omit<EintragEingabe, 'autor'>): Promise<void> => {
    if (meinKuerzel === undefined || !istAntwortfaehig(meinKuerzel)) {
      throw new Error('Ohne eigenes Kürzel im Profil lässt sich nichts eintragen.');
    }
    const eintrag = baueEintrag({ ...eingabe, autor: meinKuerzel }, new Date().toISOString());
    const ok = await haengeEintragAn(idb, PHASENSCHNITT.klaerungId, eintrag);
    if (!ok) {
      // Der Share-Schreiber wirft nie; `false` ist das einzige Signal. Würde es
      // hier verschluckt, sähe der Nutzer seine Antwort auf dem Bildschirm,
      // während es sie auf dem Share nicht gibt.
      throw new Error('Nicht gespeichert — der Daten-Share war nicht beschreibbar.');
    }
    await neuLaden();
  }, [idb, meinKuerzel, neuLaden]);

  const autoren = useMemo(() => autorenVon(stand), [stand]);
  const zeilen = useMemo(
    () => baueZeilen(punkte, stand, autoren, meinKuerzel, vorkommen),
    [punkte, stand, autoren, meinKuerzel, vorkommen],
  );
  const gruppen = useMemo(() => baueGruppen(zeilen, filter), [zeilen, filter]);

  return {
    klaerung: PHASENSCHNITT,
    punkte, fragen, gruppen, stand, autoren, meinKuerzel, sperre,
    beantwortet: beantwortetVon(punkte, stand, meinKuerzel),
    gesamt: punkte.length,
    filter, setFilter,
    anzahlStrittig: zeilen.filter(z => z.befund.zustand === 'strittig').length,
    anzahlUnklar: zeilen.filter(z => z.befund.unklarVon.length > 0).length,
    laden, standIso, fehler, fassungWeichtAb, vorkommen, bestandVom,
    neuLaden, aeussern,
  };
}
