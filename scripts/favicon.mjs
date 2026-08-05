/**
 * Favicon-Erzeugung für den Single-File-Build.
 *
 * Warum ein `data:`-URI und keine Icon-Datei: Vite weigert sich, Icon-Links zu
 * inlinen (`noInlineLinkRels` enthält `icon` — die Entscheidung fällt VOR
 * `assetsInlineLimit`), und `vite-plugin-singlefile` inlined nur JS- und
 * CSS-Bundles. Ein emittiertes Icon bliebe als separate Datei neben dem HTML
 * liegen und wäre unter `file://` tot. Ein `data:`-URI umgeht beides: Vite
 * fasst data-URLs im HTML nicht an (`isExcludedUrl`), und der Post-Build-Strip
 * (`strip-inline-wasm.mjs`) greift ausschließlich große WASM-Blobs.
 *
 * Motiv: Monogramm „Z" (weiß) auf abgerundetem Quadrat in der Variant-Farbe.
 * Der Buchstabe ist als `<path>` gezeichnet, NICHT als `<text>` — ein
 * SVG-Favicon rendert in einem eigenen Kontext ohne Zugriff auf die Fonts des
 * Dokuments, ein `<text>` fiele je nach System auf etwas anderes zurück.
 *
 * Die Geometrie ist auf 16 px hin gemessen (Rasterung im Canvas, nicht
 * geschätzt): Glyphe 18/32 breit, Balken 4,4 stark — damit die Balken auf zwei
 * volle Pixelzeilen fallen und die Diagonale 3 px durchgehend bleibt. Ein
 * schmalerer Schnitt (14/32, Stärke 3,2) las sich bei 16 px sichtbar dünner.
 *
 * Verdrahtet in `vite.config.ts` (Hook `teamflow-index-html-branding`), Farbe
 * pro Variante aus `build.faviconColor`. Siehe docs/agents/change-app-branding.md.
 */

/** Fallback-Farbe (prod-Schiefer-Blau), wenn keine oder eine ungültige gesetzt ist. */
export const FAVICON_DEFAULT_COLOR = '#506786';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Baut das Favicon-SVG als `data:`-URI.
 *
 * Die Farbe wird in Markup interpoliert und deshalb hart geprüft — alles, was
 * nicht exakt `#rrggbb` ist, fällt auf {@link FAVICON_DEFAULT_COLOR} zurück,
 * statt ungeprüft durchzugehen.
 *
 * @param {string} [color] Grundfarbe des Quadrats, Format `#rrggbb`.
 * @returns {string} `data:image/svg+xml,…` (vollständig URL-kodiert)
 */
export function faviconDataUri(color) {
  const fill = typeof color === 'string' && HEX_RE.test(color) ? color : FAVICON_DEFAULT_COLOR;
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
    `<rect width="32" height="32" rx="7" fill="${fill}"/>` +
    '<path fill="#ffffff" d="M7 7h18v4.4l-11 9.2H25v4.4H7v-4.4l11-9.2H7z"/>' +
    '</svg>';
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Fertiger `<link>`-Tag für index.html — eine Quelle für Default und Build-Injektion. */
export function faviconLinkTag(color) {
  return `<link rel="icon" href="${faviconDataUri(color)}" />`;
}
