/**
 * Zwei-Spalten-Layout der Startseite mit ZIEHBAREM Trenn-Griff zwischen Haupt-
 * und Seitenspalte — dünner Wrapper über die geteilte <ZweiSpaltenResizable>
 * mit den Home-spezifischen Parametern (Storage-Key + Breiten-Grenzen).
 * Verhalten, Persistenz und CSS-Details leben in der geteilten Komponente
 * (src/components/zwei-spalten). Nur ab `lg` aktiv; darunter einspaltig gestapelt.
 */
import { ZweiSpaltenResizable, clampBreite } from '@/components/zwei-spalten';

const LS_KEY = 'teamflow_home_seite_breite';
/** 260 → 300 (v2.372.2): bei 260 schnitt die Spalte den EIGENEN Widget-Titel ab
 *  („Antragseing…", gemessen 103 px Bedarf gegen 86 px Platz) und dazu das
 *  Bearbeiter-Label. Eine gezogene Breite bleibt erhalten — der Default greift
 *  nur, wo nie gezogen wurde. */
const DEFAULT_BREITE = 300;
const MIN_BREITE = 200;
const MAX_BREITE = 480;

/** Klemmt die Seitenspalten-Breite auf den Home-Bereich (rein, testbar; Back-compat). */
export function clampSeiteBreite(px: number): number {
  return clampBreite(px, MIN_BREITE, MAX_BREITE, DEFAULT_BREITE);
}

export interface HomeZweiSpaltenProps {
  main: React.ReactNode;
  seite: React.ReactNode;
}

export function HomeZweiSpalten({ main, seite }: HomeZweiSpaltenProps): React.ReactElement {
  return (
    <ZweiSpaltenResizable
      haupt={main}
      seite={seite}
      storageKey={LS_KEY}
      defaultBreite={DEFAULT_BREITE}
      minBreite={MIN_BREITE}
      maxBreite={MAX_BREITE}
      gapClassName="gap-8"
      ariaLabel="Breite der Seitenspalte anpassen"
    />
  );
}
