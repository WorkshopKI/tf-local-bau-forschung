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

/** Ein Wert dieses Feldes und die Teilvorhaben, die genau ihn tragen. */
export interface OhneDatumWert {
  /** Der Wert, wie er im Export steht. */
  wert: string;
  /** „Verbund", ein Aktenzeichen oder „N Teilvorhaben". */
  traeger: string;
}

export interface OhneDatumEintrag {
  /** Stabiler Key der Zeile — die `feldId`, also die Spalte. */
  feldId: string;
  /** Code des Fachsystems (`ABK`) — der Griff für die Rückfrage ans Team. */
  code: string;
  label: string;
  /**
   * Die **verschiedenen** Werte des Feldes, in der Reihenfolge der Teilvorhaben.
   *
   * Nie leer. Ein Eintrag = alle Träger sagen dasselbe (der Normalfall bei
   * `XAT`, `XPC+`, `XINNO`); mehrere = die Teilvorhaben weichen voneinander ab.
   */
  werte: OhneDatumWert[];
}

/**
 * Sammelt die terminlosen Einträge aus den Vorkommen einer Zeile.
 *
 * **Ein Eintrag je Feld, eine Zeile je verschiedenem Wert.** Dieselbe Spalte
 * steht auf jeder TV-Zeile; vier Teilvorhaben mit demselben Wert sind ein Wert
 * mit vier Trägern, nicht vier Einträge. Weichen sie ab, bekommt jeder Wert
 * seine eigene Zeile mit seinen eigenen Trägern.
 *
 * Bis v6.65 gewann hier der erste gefundene Wert und die übrigen Träger standen
 * trotzdem daneben — der Kommentar nannte das „ausnahmsweise". Am Bestand vom
 * 11.09.2026 ist es der Normalfall: von 2.289 Verbünden mit `T_ABK` tragen
 * **2.214** je Teilvorhaben verschiedene Beträge (96,7 %), bei `T_AAI` 1.105 von
 * 1.133. Bei KITED (ZKN125314) las die Zeile „280000 · 3 Teilvorhaben", während
 * die drei Anträge 280.000, 492.225 und 331.006 beantragt hatten. Eine falsche
 * Zahl ist teurer als eine Zeile mehr.
 *
 * Sortiert nach Bezeichnung: die Liste ist zum Nachschlagen da, und eine
 * Reihenfolge nach Fundort wäre keine. **Innerhalb** eines Feldes bleibt die
 * Fundreihenfolge stehen — sie ist die Reihenfolge der Teilvorhaben.
 */
export function baueOhneDatum(vorkommen: readonly FeldVorkommen[]): OhneDatumEintrag[] {
  const proFeld = new Map<string, {
    feldId: string;
    code: string;
    label: string;
    /** Je Wert die Träger, in Fundreihenfolge (Map hält sie). */
    werte: Map<string, string[]>;
  }>();

  for (const v of vorkommen) {
    if (v.feld.typ !== 'text') continue;
    if (!v.feld.aktiv) continue;
    if (v.feld.prominenzDefault === 'ignoriert') continue;

    let eintrag = proFeld.get(v.feld.feldId);
    if (!eintrag) {
      eintrag = {
        feldId: v.feld.feldId,
        // Ohne Code fällt die Spalte ein — sie ist der einzige andere
        // Bezeichner, den das Fachsystem kennt (unkuratierte Funde).
        code: v.feld.code ?? v.feld.feldId,
        label: v.feld.label,
        werte: new Map(),
      };
      proFeld.set(v.feld.feldId, eintrag);
    }

    const traeger = eintrag.werte.get(v.wert);
    if (traeger) {
      if (v.tvId && !traeger.includes(v.tvId)) traeger.push(v.tvId);
    } else {
      eintrag.werte.set(v.wert, v.tvId ? [v.tvId] : []);
    }
  }

  return [...proFeld.values()]
    .map(e => ({
      feldId: e.feldId,
      code: e.code,
      label: e.label,
      werte: [...e.werte].map(([wert, tvIds]) => ({ wert, traeger: traegerLabel(tvIds) })),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'de') || a.code.localeCompare(b.code, 'de'));
}
