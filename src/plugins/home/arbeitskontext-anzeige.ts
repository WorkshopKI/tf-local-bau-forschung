/**
 * Reine Anzeige-Formatierung für die „Weitermachen"-Karte (Home). Übersetzt einen
 * Arbeitskontext-Log-Eintrag + aufgelöste Verbund-/Antrags-Kopfdaten in die
 * Karten-Zeile. IDB-frei und render-frei → vollständig testbar.
 */
import type {
  ArbeitskontextEintrag, ArbeitskontextTyp,
} from '@/core/services/personal-storage/arbeitskontext-log';

export interface ArbeitskontextAnzeige {
  akronym: string;
  titel: string | null;
  /** Verbund-Key / FKZ-Kennung (zugleich Deep-Link-Ziel + Anzeige). */
  fkz: string;
  /** Kontextzeile, z.B. „Gutachten · Abschnitt B im Entwurf". */
  kontext: string;
  ts: string;
}

const TYP_LABEL: Record<ArbeitskontextTyp, string> = {
  gutachten: 'Gutachten',
  nachforderung: 'Nachforderungen',
  kurzfassung: 'Kurzfassung',
};

function abschnittStatusText(status: string | undefined): string {
  switch (status) {
    case 'entwurf': return 'im Entwurf';
    case 'freigegeben': return 'freigegeben';
    default: return 'offen';
  }
}

/**
 * Formt einen Log-Eintrag in die Anzeige-Zeile. `info` = aufgelöste Verbund-/
 * Antrags-Kopfdaten; `null` ⇒ Antrag/Verbund nicht mehr gefunden ⇒ Eintrag
 * überspringen (Rückgabe `null`). `abschnittStatus` = LIVE-Status des Gutachten-
 * Abschnitts aus dem Workflow-Store — NIE der geloggte Status (der wird gar nicht
 * geloggt).
 */
export function beschreibeArbeitskontext(
  eintrag: ArbeitskontextEintrag,
  info: { akronym: string | null; titel: string | null } | null,
  abschnittStatus?: string,
): ArbeitskontextAnzeige | null {
  if (!info) return null;
  const typLabel = TYP_LABEL[eintrag.typ];
  const kontext = eintrag.typ === 'gutachten' && eintrag.abschnittId
    ? `${typLabel} · Abschnitt ${eintrag.abschnittId} ${abschnittStatusText(abschnittStatus)}`
    : typLabel;
  return {
    akronym: info.akronym?.trim() || eintrag.verbundKey,
    titel: info.titel?.trim() || null,
    fkz: eintrag.verbundKey,
    kontext,
    ts: eintrag.ts,
  };
}
