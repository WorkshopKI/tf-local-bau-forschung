/**
 * Ein Rohstatus als {@link StatusRef} — Code plus Beschriftung, an einer Stelle.
 *
 * Die Beschriftung kommt über `statusKurzLabelMit`/`statusLabel`
 * ([status-wert-labels.ts](../../utils/status-wert-labels.ts)): Fassung →
 * Code-Katalog → gekürzt. Die Stufe wird mitgeführt, weil das Popover sie
 * benennen können soll („eure Fassung" / „Auslieferung" / „nichts gepflegt").
 * Eine vierte Kopie der Kurzform darf hier nicht entstehen (Pitfall #50,
 * Guard `status-kurzlabel-single-source`).
 *
 * Import-Disziplin wie in `phasen-schnitt.ts`: die Nachbarn direkt, nie über das
 * Barrel `@/core/status` — das zöge `snapshot.ts` und damit einen
 * Laufzeit-Zyklus (`npm run cycles` hat eine leere Allowlist).
 *
 * Rein: keine IO, keine Uhr.
 */
import { statusKurzLabelMit, statusLabel } from '@/core/utils/status-wert-labels';
import { findeStatusCode, statusCodeEintrag } from '../status-codes';
import type { StatusRef } from './typen';

/**
 * Aus einem Rohtext, wie er im Export steht.
 *
 * `code: null` heißt „der Katalog kennt diesen Text nicht" — die Beschriftung
 * fällt dann auf den gekürzten Rohwert zurück und ist als solche erkennbar.
 */
export function statusRefVonText(roh: string): StatusRef {
  const kurz = statusKurzLabelMit(roh);
  return {
    roh,
    code: findeStatusCode(roh)?.eintrag.code ?? null,
    kurz: kurz.text,
    lang: statusLabel(roh),
    labelHerkunft: kurz.herkunft,
  };
}

/**
 * Aus dem Zielstatus einer Trigger-Regel: die Zuarbeit führt einen **Wortlaut**
 * und — sofern auflösbar — den amtlichen Code.
 *
 * Ist der Code bekannt, wird über den **amtlichen Text** beschriftet, nicht über
 * den Wortlaut der Zuarbeit: der trägt Tippfehler („bewilligungseif") und
 * Kurzformen („GA fertig"), die keiner Kuration entsprechen. Der Wortlaut bleibt
 * als `roh` erhalten — bei Zweifeln gilt er.
 */
export function statusRefVonRegel(roh: string, code: number | null): StatusRef {
  if (code === null) {
    const kurz = statusKurzLabelMit(roh);
    return { roh, code: null, kurz: kurz.text, lang: statusLabel(roh), labelHerkunft: kurz.herkunft };
  }
  const amtlich = statusCodeEintrag(code)?.text ?? roh;
  const kurz = statusKurzLabelMit(amtlich);
  return { roh, code, kurz: kurz.text, lang: statusLabel(amtlich), labelHerkunft: kurz.herkunft };
}

/**
 * Aus dem Zielstatus einer **C16**-Zeile: dort steht nur die Zahl.
 *
 * Anders als bei der Zuarbeit gibt es keinen Wortlaut, den man danebenstellen
 * könnte — der Code IST die Angabe. Kennt der Katalog ihn nicht, bleibt die Zahl
 * als `roh` stehen; sie zu verschweigen machte aus einer Lücke im Katalog eine
 * Lücke in der Bahn.
 */
export function statusRefVonCode(code: number): StatusRef {
  const amtlich = statusCodeEintrag(code)?.text ?? String(code);
  const kurz = statusKurzLabelMit(amtlich);
  return { roh: amtlich, code, kurz: kurz.text, lang: statusLabel(amtlich), labelHerkunft: kurz.herkunft };
}

/** Zwei Statuswerte meinen dasselbe? Über den Code, sonst über den Rohtext. */
export function gleicherStatus(a: StatusRef | null, b: StatusRef | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.code !== null && b.code !== null) return a.code === b.code;
  return a.roh.trim().toLowerCase() === b.roh.trim().toLowerCase();
}
