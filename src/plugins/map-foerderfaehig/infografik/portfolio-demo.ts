/**
 * Fest verdrahtete Demo-Daten der Portfolio-Prinzipansicht.
 *
 * Diese Daten sind **erfunden** und tragen in der Ansicht dauerhaft das Label
 * „Demo-Daten · Prinzipansicht". Sie zeigen, wie eine Portfolio-Sicht aussähe,
 * nicht wie das Portfolio aussieht. Es fliesst keine einzige echte Antragszahl
 * ein — die Ansicht liest bewusst nichts aus dem Store.
 *
 * Einordnung, damit später niemand die Themen für gesetzt hält: ZIM ist
 * technologie- und branchenoffen, es gibt also keine programmgegebene
 * Themen-Taxonomie. Jede solche Liste — auch diese — ist gesetzt, nicht
 * abgeleitet. Sobald echte Steuerungsfragen anstehen, tragen deterministische
 * Dimensionen (Projektform × Grössenklasse, Befundverteilung über die Prüfungen)
 * mehr als ein Themenrad.
 */

export interface PortfolioSegment {
  /** Themenfeld (erfunden). */
  name: string;
  /** Fiktive Anzahl Anträge. */
  anzahl: number;
  /** Untergliederung — die zweite Ringebene. */
  unter: ReadonlyArray<{ name: string; anzahl: number }>;
}

/** 6 Themenfelder, 42 fiktive Anträge. */
export const PORTFOLIO_DEMO: readonly PortfolioSegment[] = [
  {
    name: 'Produktionstechnik',
    anzahl: 11,
    unter: [
      { name: 'Additive Fertigung', anzahl: 5 },
      { name: 'Automatisierung', anzahl: 4 },
      { name: 'Messtechnik', anzahl: 2 },
    ],
  },
  {
    name: 'Digitale Systeme',
    anzahl: 9,
    unter: [
      { name: 'Eingebettete Software', anzahl: 4 },
      { name: 'Datenplattformen', anzahl: 3 },
      { name: 'Assistenzsysteme', anzahl: 2 },
    ],
  },
  {
    name: 'Werkstoffe',
    anzahl: 7,
    unter: [
      { name: 'Verbundwerkstoffe', anzahl: 4 },
      { name: 'Beschichtungen', anzahl: 3 },
    ],
  },
  {
    name: 'Energie & Umwelt',
    anzahl: 6,
    unter: [
      { name: 'Speichertechnik', anzahl: 3 },
      { name: 'Kreislaufwirtschaft', anzahl: 3 },
    ],
  },
  {
    name: 'Medizintechnik',
    anzahl: 5,
    unter: [
      { name: 'Diagnostik', anzahl: 3 },
      { name: 'Therapiegeräte', anzahl: 2 },
    ],
  },
  {
    name: 'Mobilität',
    anzahl: 4,
    unter: [
      { name: 'Antriebe', anzahl: 2 },
      { name: 'Fahrzeugsensorik', anzahl: 2 },
    ],
  },
];

/** Gesamtzahl der fiktiven Anträge. */
export const PORTFOLIO_DEMO_GESAMT = PORTFOLIO_DEMO.reduce((a, s) => a + s.anzahl, 0);

export interface RingSegment {
  name: string;
  /** Startwinkel im Bogenmass. */
  von: number;
  /** Endwinkel im Bogenmass. */
  bis: number;
  anzahl: number;
  ebene: 1 | 2;
  /** Farbindex des zugehörigen Themenfelds. */
  farbIndex: number;
}

/**
 * Rechnet die Demo-Daten in Ringsegmente um. Winkel im Bogenmass, Start oben
 * (−90°), im Uhrzeigersinn. Rein — die Ansicht zeichnet nur noch.
 */
export function baueRingSegmente(
  daten: readonly PortfolioSegment[] = PORTFOLIO_DEMO,
): RingSegment[] {
  const gesamt = daten.reduce((a, s) => a + s.anzahl, 0);
  if (gesamt === 0) return [];

  const segmente: RingSegment[] = [];
  let winkel = -Math.PI / 2;

  daten.forEach((thema, farbIndex) => {
    const breite = (thema.anzahl / gesamt) * Math.PI * 2;
    segmente.push({
      name: thema.name, von: winkel, bis: winkel + breite,
      anzahl: thema.anzahl, ebene: 1, farbIndex,
    });

    let innen = winkel;
    for (const unter of thema.unter) {
      const unterBreite = (unter.anzahl / thema.anzahl) * breite;
      segmente.push({
        name: unter.name, von: innen, bis: innen + unterBreite,
        anzahl: unter.anzahl, ebene: 2, farbIndex,
      });
      innen += unterBreite;
    }

    winkel += breite;
  });

  return segmente;
}

/** SVG-Pfad eines Ringsegments. Rein. */
export function ringPfad(
  segment: RingSegment, mitte: number, innen: number, aussen: number,
): string {
  const p = (radius: number, winkel: number): string =>
    `${(mitte + radius * Math.cos(winkel)).toFixed(2)} ${(mitte + radius * Math.sin(winkel)).toFixed(2)}`;

  const gross = segment.bis - segment.von > Math.PI ? 1 : 0;

  return [
    `M ${p(innen, segment.von)}`,
    `L ${p(aussen, segment.von)}`,
    `A ${aussen} ${aussen} 0 ${gross} 1 ${p(aussen, segment.bis)}`,
    `L ${p(innen, segment.bis)}`,
    `A ${innen} ${innen} 0 ${gross} 0 ${p(innen, segment.von)}`,
    'Z',
  ].join(' ');
}
