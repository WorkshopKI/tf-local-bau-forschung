/**
 * Die Einträge, die **keinen Termin tragen** — rein, ohne React.
 *
 * `D_` ist das Datum, `T_` der Text. Für manche Codes führt das Fachsystem im
 * Export nur die Textspalte: `T_ABK` = 302400, `T_AMA` = 3, `T_AVU` = 200000.
 * Im Legacy-Fenster stehen sie datiert in der Ereignisliste, in der Breittabelle
 * bleibt vom Ereignis nur der Wert übrig. Auf einen Zeitstrahl können sie
 * deshalb nicht — und schweigend wegzulassen hieße, die Chronik für
 * vollständiger auszugeben, als sie ist.
 *
 * **Nur `typ: 'text'`, und das ist die ganze Regel.** Der Seed setzt den Typ aus
 * der Primärspalte des Codes (`seed-codes.ts`: `spalte.startsWith('T_')`), und
 * damit unterscheidet er zwei Dinge, die man leicht verwechselt:
 *
 * - `spalte: 'T_ABK'` — die **eigene** Spalte des Codes ist eine Textspalte. Der
 *   Code hat im Export nie einen Termin ⇒ er gehört hierher.
 * - `text: 'T_AAI'` — eine **Begleitnotiz** zum Datumsfeld `D_AAI`. Sie ist gar
 *   kein eigenes Vorkommen, sondern steht als `FeldVorkommen.text` am datierten
 *   Eintrag der Chronik. Hier taucht sie nie auf.
 *
 * `typ: 'wert'` bleibt ebenfalls draußen: das sind die App-eigenen Projektionen
 * (`status`, `verbund_status`, `vb_phase`), keine Vorgangs-Einträge. Der Status
 * steht in der Zeile darüber; ihn hier zu wiederholen wäre keine Auskunft.
 *
 * Die ausführliche Schwester ist die nach Ordnern gruppierte Liste
 * `StatusCodeListe` auf der Verbund-Detailseite — hier steht die kompakte
 * Fassung ohne Rollenfilter, keine dritte Oberfläche.
 */
import { traegerLabel, type FeldVorkommen } from '@/core/status';

export interface OhneDatumEintrag {
  /** Stabiler Key der Zeile — die `feldId`, also die Spalte. */
  feldId: string;
  /** Code des Fachsystems (`ABK`) — der Griff für die Rückfrage ans Team. */
  code: string;
  label: string;
  wert: string;
  /** „Verbund", ein Aktenzeichen oder „N Teilvorhaben". */
  traeger: string;
}

/**
 * Sammelt die terminlosen Einträge aus den Vorkommen einer Zeile.
 *
 * **Ein Eintrag je Feld** — dieselbe Entdopplung wie in `baueChronik`: dieselbe
 * Spalte steht auf jeder TV-Zeile, und vier Teilvorhaben mit demselben Wert sind
 * ein Eintrag mit vier Trägern, nicht vier Einträge. Weichen die Werte
 * ausnahmsweise ab, gewinnt der erste gefundene und die weiteren Träger stehen
 * trotzdem daneben — eine Zeile je Wert wäre hier Rauschen, die Ordner-Ansicht
 * der Detailseite zeigt sie einzeln.
 *
 * Sortiert nach Bezeichnung: die Liste ist zum Nachschlagen da, und eine
 * Reihenfolge nach Fundort wäre keine.
 */
export function baueOhneDatum(vorkommen: readonly FeldVorkommen[]): OhneDatumEintrag[] {
  const proFeld = new Map<string, { eintrag: OhneDatumEintrag; tvIds: string[] }>();

  for (const v of vorkommen) {
    if (v.feld.typ !== 'text') continue;
    if (!v.feld.aktiv) continue;
    if (v.feld.prominenzDefault === 'ignoriert') continue;

    const vorhanden = proFeld.get(v.feld.feldId);
    if (vorhanden) {
      if (v.tvId && !vorhanden.tvIds.includes(v.tvId)) vorhanden.tvIds.push(v.tvId);
      continue;
    }
    proFeld.set(v.feld.feldId, {
      eintrag: {
        feldId: v.feld.feldId,
        // Ohne Code fällt die Spalte ein — sie ist der einzige andere
        // Bezeichner, den das Fachsystem kennt (unkuratierte Funde).
        code: v.feld.code ?? v.feld.feldId,
        label: v.feld.label,
        wert: v.wert,
        traeger: '',
      },
      tvIds: v.tvId ? [v.tvId] : [],
    });
  }

  return [...proFeld.values()]
    .map(({ eintrag, tvIds }) => ({ ...eintrag, traeger: traegerLabel(tvIds) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'de') || a.code.localeCompare(b.code, 'de'));
}
