// Typ-Deklaration für die pure Prüffunktion aus bash-guard.mjs
// (das Skript ist reines JS/Node-Stdlib; hier nur die Test-Oberfläche typisiert).

/** Grund der Blockade oder null, wenn das Kommando durchgelassen wird. */
export function pruefeBefehl(befehl: string | undefined): string | null;
