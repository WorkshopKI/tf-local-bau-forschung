/**
 * Die Termine, die der **aktuelle** Export nicht mehr zeigt — belegt aus dem
 * Import-Diff-Journal.
 *
 * Die Chronik ({@link baueChronik}) liest die Datumsspalten, wie sie heute
 * stehen. Nimmt jemand in C16 eine Setzung zurück oder korrigiert er ihr Datum,
 * überschreibt der Nacht-Export die Spalte — und die alte Zeile ist spurlos weg.
 * Gemessen am echten Bestand ist das kein Randfall: allein am Verbund ZKN125417
 * wurde `D_ART` (Rücknahmeempfehlung) geleert und durch `D_ABLT` (Ablehnung)
 * ersetzt, und `D_AL` wanderte vom 03.08. auf den 11.08. Nach dem Import war von
 * beidem nichts mehr zu sehen.
 *
 * Das Journal hält es fest (`geleert` / `geaendert`, vorgangssystem.md §12.3).
 * Dieses Modul übersetzt seine Einträge zurück in **Positionen auf der Achse**:
 * jeder verschwundene Wert wird an dem Tag gezeigt, an dem er einmal stand.
 *
 * **Nur rückwärts, nie vorwärts.** Der Status selbst bleibt der importierte
 * (Pitfall #44) — hier steht ausschließlich, was ein früherer Export trug.
 *
 * Rein: kein IDB, kein Datei-Zugriff, keine Uhr. Die Chroniken reicht der
 * Aufrufer herein.
 */
import { normCode } from '@/core/services/csv/status-datum-gruppen';
import type { ChronikEintrag } from './chronik';
import type { AntragsChronikMitId, JournalEintrag } from './journal';
import type { StatusFeldEintrag } from './typen';

/**
 * Ein Termin, den der Export nicht mehr führt.
 *
 * `tag` ist das **alte** Datum — die Stelle, an der die Zeile in der Chronik
 * steht. Nicht das Datum des Nachtlaufs, der die Rücknahme entdeckt hat: der
 * beantwortet „wann haben wir es gemerkt", nicht „wann stand es da".
 */
export interface ZurueckgenommenerTermin {
  /** ISO-Tag des alten Wertes — die Position auf der Achse. */
  tag: string;
  feld: StatusFeldEintrag;
  /** Teilvorhaben, die den verschwundenen Termin trugen. Leer = Verbund-Ebene. */
  tvIds: string[];
  /** `zurueckgenommen`: der Wert ist weg. `verschoben`: er steht jetzt anderswo. */
  art: 'zurueckgenommen' | 'verschoben';
  /** Nur bei `verschoben`: der ISO-Tag, an dem der Wert jetzt steht. */
  nachTag?: string;
  /**
   * Der Journal-Eintrag, aus dem das kommt — die Anzeige formuliert daraus ihr
   * „am …" bzw. „zwischen … und …" (`journalTexte.wannText`). Als Ganzes
   * durchgereicht statt als fertiger Satz: der Wortlaut gehört in die Anzeige,
   * und ein zweiter Formulierungsort wäre genau das, was `journalTexte`
   * verhindert.
   */
  belegt: JournalEintrag;
}

/** `20260811` → `2026-08-11`. `null`, wenn das keine acht Stellen sind. */
function alsIsoTag(wert: JournalEintrag['von']): string | null {
  if (wert === undefined) return null;
  const s = String(wert);
  if (!/^\d{8}$/.test(s)) return null;
  const iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  // Ein Datum wie `20260231` ist ein Datenfehler, kein Termin.
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : iso;
}

/** Schlüssel, unter dem ein Termin (Feld × Tag) eindeutig ist. */
function terminKey(feldId: string, tag: string): string {
  return `${feldId}|${tag}`;
}

/**
 * Die verschwundenen Termine mehrerer Anträge, gefaltet und sortiert.
 *
 * Regeln, jede mit ihrem Grund:
 *
 * - **Nur `geleert` und `geaendert`.** `gesetzt` steht bereits als normaler
 *   Termin in der Chronik; `antrag-neu`/`antrag-fehlt` haben kein Feld und damit
 *   keinen Platz auf der Achse. Gelesen wird jeweils `von` — der Wert, der weg
 *   ist.
 * - **Join über `feldId`.** `JournalEintrag.feld` ist die ROHE CSV-Spalte
 *   (`D_ART`), und `StatusFeldEintrag.feldId` ist bei den Code-Feldern derselbe
 *   rohe Code. Kein Katalog-Treffer ⇒ verworfen: ein Kürzel ohne Eintrag hat
 *   keine Bezeichnung, und `D_ART` allein ist keine Auskunft.
 * - **Nur `typ: 'datum'`.** Damit fallen `STATUS_TV`/`STATUS_VB` von selbst
 *   heraus. Sie stehen im Journal, sind aber kein Termin, sondern der Status —
 *   und den leitet die App nicht ab und stellt ihn nicht auf die Achse
 *   (Pitfall #44).
 * - **Prominenz wie beim Bauen der Chronik**: `ignoriert` immer raus,
 *   `nebensaechlich` nur auf Wunsch. Sonst zeigte die Ansicht die Rücknahme
 *   eines Kürzels, das sie als gesetztes gerade ausblendet.
 * - **Über Träger falten** (Schlüssel Feld × Tag × Art). Die Verbund-Codes
 *   (`X`-Präfix) stehen identisch auf jeder TV-Zeile der CSV; ungefaltet stünde
 *   ein Verbund-Storno bei einem Vierer-Verbund viermal untereinander. Dieselbe
 *   Regel, aus der `baueChronik` einen Eintrag je (Feld, Tag) macht.
 * - **Was wieder da ist, ist kein Storno.** Trägt die aktuelle Chronik denselben
 *   Termin (Feld × Tag) erneut, fällt er weg — eine durchgestrichene Zeile neben
 *   ihrer lebenden Zwillingszeile wäre schlicht falsch. Das passiert bei einer
 *   Korrektur, die auf ihren Ausgangswert zurückgeht.
 *
 * @param chroniken Journal-Chroniken der Anträge, über die die Ansicht spricht.
 * @param felder Die Felder der geladenen Fassung (`MappingVersion.felder`).
 * @param aktuell Die bereits gebaute Chronik derselben Ansicht.
 */
export function baueZurueckgenommene(
  chroniken: readonly AntragsChronikMitId[],
  felder: readonly StatusFeldEintrag[],
  aktuell: readonly ChronikEintrag[],
  opts: { zeigeNebensaechlich: boolean } = { zeigeNebensaechlich: false },
): ZurueckgenommenerTermin[] {
  const nachCode = new Map<string, StatusFeldEintrag>();
  for (const f of felder) {
    const key = normCode(f.feldId);
    if (!nachCode.has(key)) nachCode.set(key, f);
  }

  // Was heute (wieder) dasteht — Feld × Tag, unabhängig vom Träger. Ein Termin,
  // den irgendein Teilvorhaben noch trägt, ist keine Rücknahme dieser Ansicht.
  const lebendig = new Set(aktuell.map(e => terminKey(e.feld.feldId, e.tag)));

  const proSchluessel = new Map<string, ZurueckgenommenerTermin>();

  for (const c of chroniken) {
    for (const fc of c.felder) {
      const feld = nachCode.get(normCode(fc.feld));
      if (!feld || feld.typ !== 'datum') continue;
      const prominenz = feld.prominenzDefault;
      if (prominenz === 'ignoriert') continue;
      if (prominenz === 'nebensaechlich' && !opts.zeigeNebensaechlich) continue;

      for (const e of fc.eintraege) {
        if (e.art !== 'geleert' && e.art !== 'geaendert') continue;
        const tag = alsIsoTag(e.von);
        if (tag === null) continue;
        if (lebendig.has(terminKey(feld.feldId, tag))) continue;

        const nachTag = e.art === 'geaendert' ? alsIsoTag(e.nach) : null;
        // Ein `geaendert` ohne lesbaren Zielwert ist faktisch eine Leerung —
        // „verschoben auf —" wäre eine Auskunft, die nichts sagt.
        const art = nachTag === null ? 'zurueckgenommen' : 'verschoben';

        const schluessel = `${terminKey(feld.feldId, tag)}|${art}`;
        const vorhanden = proSchluessel.get(schluessel);
        if (vorhanden) {
          if (!vorhanden.tvIds.includes(c.antragId)) vorhanden.tvIds.push(c.antragId);
          continue;
        }
        proSchluessel.set(schluessel, {
          tag,
          feld,
          tvIds: [c.antragId],
          art,
          ...(nachTag !== null ? { nachTag } : {}),
          belegt: e,
        });
      }
    }
  }

  return [...proSchluessel.values()].sort((a, b) =>
    a.tag.localeCompare(b.tag) || a.feld.label.localeCompare(b.feld.label, 'de'));
}

/**
 * Eine Zeile der Chronik: ein Termin oder ein verschwundener Termin.
 *
 * Als Union statt als zwei Listen, weil beide **dieselbe Achse** teilen. Zwei
 * getrennte Listen müsste die Ansicht bei jedem Monatsblock ineinanderfädeln,
 * und die Sortierregel läge dann in der Anzeige statt hier.
 */
export type VerlaufZeile =
  | { art: 'termin'; tag: string; e: ChronikEintrag }
  | { art: 'storno'; tag: string; s: ZurueckgenommenerTermin };

/**
 * Termine und verschwundene Termine zu **einer** datumssortierten Liste.
 *
 * Bei gleichem Tag steht der Storno **hinter** dem Termin: erst „so ist es
 * jetzt", dann „so war es". Die Reihenfolge der Termine untereinander bleibt
 * unangetastet — sie kommt bereits sortiert (Prominenz, dann Bezeichnung) und
 * hier neu zu sortieren hieße, diese Regel ein zweites Mal zu schreiben.
 */
export function mischeVerlaufZeilen(
  termine: readonly ChronikEintrag[],
  stornos: readonly ZurueckgenommenerTermin[],
): VerlaufZeile[] {
  if (stornos.length === 0) {
    return termine.map(e => ({ art: 'termin', tag: e.tag, e }));
  }
  const zeilen: VerlaufZeile[] = [
    ...termine.map((e): VerlaufZeile => ({ art: 'termin', tag: e.tag, e })),
    ...stornos.map((s): VerlaufZeile => ({ art: 'storno', tag: s.tag, s })),
  ];
  // Stabil: `Array.prototype.sort` ist es seit ES2019, also bleibt bei gleichem
  // Tag und gleicher Art die eingehende Ordnung erhalten.
  return zeilen.sort((a, b) =>
    a.tag.localeCompare(b.tag)
    || (a.art === b.art ? 0 : a.art === 'termin' ? -1 : 1));
}

/**
 * Das **jüngste Ende** einer Chronik — der Ausschnitt, den der Tabellen-Ausklapp
 * zeigt, statt Median 22 und p90 32 Zeilen in eine aufgeklappte Tabellenzeile zu
 * legen.
 *
 * Geschnitten wird am **Anfang**, nicht am Ende: die Liste läuft aufsteigend
 * (ältestes oben), das Jüngste steht also hinten. Deshalb gehört auch der
 * Aufklapp-Schalter in der Anzeige ÜBER die erste sichtbare Zeile.
 *
 * `weggelassen` ist die Zahl, die der Schalter ansagt — ohne sie läse sich ein
 * Ausschnitt als der ganze Verlauf, und genau das war der Grund, aus dem die
 * Chronik bisher nirgends gekürzt wurde.
 *
 * Generisch, weil hier nur gezählt wird: die Zeilen selbst bleiben unangetastet.
 */
export function juengsteZeilen<Z>(zeilen: readonly Z[], anzahl: number): {
  sichtbar: readonly Z[];
  weggelassen: number;
} {
  // `anzahl <= 0` heißt „kein Fenster", nicht „nichts zeigen" — eine leere
  // Chronik mit einem Schalter darüber wäre keine Auskunft.
  if (anzahl <= 0 || zeilen.length <= anzahl) return { sichtbar: zeilen, weggelassen: 0 };
  return { sichtbar: zeilen.slice(zeilen.length - anzahl), weggelassen: zeilen.length - anzahl };
}
