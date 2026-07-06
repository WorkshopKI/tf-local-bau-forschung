/**
 * Home-Kopfzeile aus den Eingangs-Ampel-Aggregaten.
 *
 * Eine einheitliche Dringlichkeits-Sprache: dieselben Zahlen wie die
 * Sidebar-Karte `EingangAmpelCard` (beide über `useEingangAmpelCounts`).
 * `offen` = frisch + warnung + kritisch (Ampel-Gesamtzahl), damit die
 * Kopfzeilen-Zahlen den Karten-Zahlen exakt entsprechen.
 */
export interface HomeSubtitleParts {
  /** „47 offene Vorgänge" / „1 offener Vorgang" — immer gesetzt. */
  offen: string;
  /** „38 über der 90-Tage-Frist" — null wenn kritisch === 0.
   *  Wird im Render in `--tf-danger-text` gerendert. */
  kritisch: string | null;
  /** „9 nähern sich" — null wenn warnung === 0. */
  warnung: string | null;
}

const fmt = (n: number): string => n.toLocaleString('de-DE');

/**
 * Baut die drei Teile der Home-Kopfzeile. Der Kritisch-Teil wird getrennt
 * zurückgegeben, weil er im Render farblich hervorgehoben wird. Null-Teile
 * (Zähler 0) lässt der Renderer weg — bei kritisch === 0 ∧ warnung === 0
 * bleibt nur „{n} offene Vorgänge".
 */
export function formatHomeSubtitle(counts: {
  offen: number;
  kritisch: number;
  warnung: number;
}): HomeSubtitleParts {
  const offenWort = counts.offen === 1 ? 'offener Vorgang' : 'offene Vorgänge';
  return {
    offen: `${fmt(counts.offen)} ${offenWort}`,
    kritisch: counts.kritisch > 0 ? `${fmt(counts.kritisch)} über der 90-Tage-Frist` : null,
    warnung: counts.warnung > 0 ? `${fmt(counts.warnung)} nähern sich` : null,
  };
}
