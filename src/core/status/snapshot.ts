/**
 * In-Memory-Snapshot der aktiven Katalog-Version.
 *
 * `getStatusCategory` (in `status-canonical.ts`) bleibt synchron — sie liest den
 * flachen Wert→Kategorie-Snapshot, den diese Datei setzt. Ohne gesetzten
 * Snapshot (Tests, früher Boot, Flag aus) greift dort der eingebaute
 * `CATEGORY_MAP`-Fallback; das Ergebnis ist bei identischem Mapping bitweise
 * gleich.
 *
 * Der Snapshot kollabiert die feld-skopierten Wert-Einträge auf eine flache
 * `normalisiert(wert) → Kategorie`-Map — `getStatusCategory` kennt kein Feld.
 * Der Seed führt jeden Wert unter allen Feldern mit derselben Kategorie, daher
 * ist die Kollabierung eindeutig. `unkuratiert`-Einträge speisen die Laufzeit-
 * Kategorie **nicht** (sie sind ein Kurations-Todo, kein Kategorien-Fakt).
 *
 * **Die Varianten kommen mit** (`indexNachSchreibweise`). Ließe der Snapshot sie
 * weg, löste „techn. geprüft" über die eingebaute Map auf, über den Snapshot
 * aber nicht — die App verhielte sich mit Flag anders als ohne, in derselben
 * Version. Genau das misst `byte-identitaet`.
 *
 * Zusätzlich kommen die **amtlichen** Schreibweisen aus dem Code-Katalog dazu
 * (`mitAmtlichenSchreibweisen`) — eine Fassung, die eine davon nicht führt,
 * darf sie nicht aus der Auflösung nehmen.
 *
 * **Die Kategorie wird abgeleitet, nicht aus der Fassung übernommen** — siehe
 * `kategorieAusFassung`. Sonst trüge eine ältere Fassung die Kategorien ihres
 * Seed-Standes weiter, obwohl der Code-Katalog längst etwas anderes sagt.
 *
 * **Hier hängen alle vier Register.** Neben der Wert→Kategorie-Map setzt diese
 * Datei seit v2.409 auch die geltende Phasen-Tabelle und den geltende
 * Code→Phase-Schnitt (`zah-phasen.ts`), seit v3.15 zusätzlich die
 * Beschriftungen (`status-wert-labels.ts`). Sie ist deren EINZIGER Schreibweg —
 * vier Register an einer Stelle können nicht auseinanderlaufen, vier
 * Schreibwege schon (Konventionstest `zah-phasen-snapshot-single-writer`).
 *
 * **Das Beschriftungs-Register trägt nur die KURATION.** Es füllt `lang`/`kurz`
 * ausschließlich aus `label`/`kurzLabel` der Fassung und lässt sie sonst leer;
 * die Auslieferung steht in `status-wert-labels.ts` selbst und wird pro
 * Schlüssel dahintergeschaltet. Würde diese Datei die Auslieferung mit
 * einbacken, nähme eine Fassung, die eine Schreibweise nicht führt, ihr die
 * Kurzform weg — derselbe Fehler, den `mitAmtlichenSchreibweisen` unten für die
 * Kategorie beheben musste.
 */
import { setStatusKatalogSnapshotMap } from '@/core/utils/status-canonical';
import {
  setStatusLabelSnapshot, type StatusBeschriftung,
} from '@/core/utils/status-wert-labels';
import {
  normalisiereWert,
  type MappingVersion, type StatusCategory, type StatusWertEintrag,
} from './typen';
import { indexNachSchreibweise } from './wert-index';
import { kategorieFuerCode } from './kategorie-ableitung';
import { setCodePhasenSnapshot, setZahPhasenSnapshot } from './zah-phasen';
import { schnittVon } from './phasen-schnitt';
import { statusCodeEintrag } from './status-codes';
import { ebenenKonflikte } from './seed-codes';

let aktiveVersion: MappingVersion | null = null;

/** Setzt (oder löscht mit `null`) den aktiven Katalog-Snapshot. Nach jedem
 *  Aktivieren im Cockpit und einmalig beim App-Start aufgerufen. */
export function setStatusKatalogSnapshot(version: MappingVersion | null): void {
  aktiveVersion = version;
  if (!version) {
    setStatusKatalogSnapshotMap(null);
    setStatusLabelSnapshot(null);
    setZahPhasenSnapshot(null);
    setCodePhasenSnapshot(null);
    return;
  }
  const kuratiert = version.werte.filter(w => !w.unkuratiert);
  const idx = indexNachSchreibweise(kuratiert.map(mitAmtlichenSchreibweisen));
  const m = new Map<string, StatusCategory>();
  const beschriftung = new Map<string, StatusBeschriftung>();
  for (const [key, w] of idx) {
    m.set(key, kategorieAusFassung(w));
    beschriftung.set(key, { lang: w.label ?? '', kurz: w.kurzLabel ?? '' });
  }
  setStatusKatalogSnapshotMap(m);
  setStatusLabelSnapshot(beschriftung);
  // Erst die Phasen, dann der Schnitt: die Kategorie-Map oben ist schon
  // gerechnet, aber Sidebar, Verfahrensleiste und Filter fragen die Register
  // erst beim nächsten Rendern — die Reihenfolge hier ist reine Lesbarkeit.
  setZahPhasenSnapshot(version.zahPhasen);
  setCodePhasenSnapshot(schnittVon(version));
  meldeEbenenKonflikte(version);
}

/**
 * Invariant-Guard: die **Setzebene** eines Katalog-Feldes muss zu seinem Code
 * passen (`X`-Präfix = Verbund). Der Seed und die Spalten-Entdeckung leiten sie
 * daraus ab; brechen kann sie nur eine kuratierte Fassung.
 *
 * **Gemeldet, nicht geworfen** — und nicht geheilt: eine kuratierte Fassung ist
 * Team-Arbeit, kein Autorenfehler. Ein Wurf beim Aktivieren nähme dem Nutzer die
 * ganze App, statt ihm einen Datenfehler zu zeigen; dieselbe Abwägung wie in
 * `programmNummer.ts`. Was WIR schreiben (der Seed), bricht dagegen den Build:
 * dafür gibt es den Convention-Test `status-ebene-folgt-x-praefix`.
 *
 * Gemessen am Bestand (Fassung 19, 505 Code-Felder): null Konflikte. Der Guard
 * ist ein Regressionsgatter, kein Fundbüro.
 */
function meldeEbenenKonflikte(version: MappingVersion): void {
  const konflikte = ebenenKonflikte(version.felder);
  if (konflikte.length === 0) return;
  console.error(
    `[status-ebene] Invariante verletzt — Fassung ${version.version}: ${konflikte.length} `
    + `Statusfelder tragen eine Ebene, die ihrem Code widerspricht (X = Verbund). `
    + `Betroffen sind Verlaufsableitung und Timeline-Zuordnung. Beispiele: `
    + konflikte.slice(0, 10).map(k => `${k.feldId} (${k.code}: ist ${k.ist}, soll ${k.soll})`).join(', '),
  );
}

/**
 * Ergänzt die Schreibweisen eines Eintrags um die amtlichen aus dem
 * Code-Katalog. **Nur Schreibweisen** — Kategorie, Phase, Rang und Zieltage
 * bleiben, wie die PL sie kuratiert hat (Pitfall #43: Bezeichnungen sind
 * Fremddaten, unsere Kuration lebt daneben).
 *
 * Ohne diesen Schritt friert eine Fassung, die eine Schreibweise nicht führt,
 * sie dauerhaft aus: Fassung 12 kannte Code 72 nur als „stellungnahme zur
 * rücknahmeempf.", im Bestand stand 15× die Langform — die fielen auf
 * `sonstige` und standen damit in keiner Sicht. `reichereWerteAn` half nicht:
 * sie steigt bei gesetztem Code sofort aus und läuft nur beim Seed-Bau.
 *
 * Rein: das Ergebnis wird NICHT zurückgeschrieben (Pitfall #45).
 */
/**
 * Ein Fassungseintrag samt **allen** Schreibweisen, unter denen er gilt:
 * seinen eigenen Varianten plus dem amtlichen Text und dessen Varianten.
 *
 * Exportiert, weil die Klärfragen-Ableitung dieselbe Auflösung braucht: sie
 * fragt „führt die Fassung diesen Wert?", und die Antwort muss dieselbe sein,
 * die die Anzeige gibt. Ohne das fragte sie nach Werten, die die App längst
 * auflöst — Code 72 steht in der Fassung unter der Abkürzung und im Bestand
 * ausgeschrieben.
 */
export function mitAmtlichenSchreibweisen(w: StatusWertEintrag): StatusWertEintrag {
  if (w.code === undefined) return w;
  const amtlich = statusCodeEintrag(w.code);
  if (!amtlich) return w;
  const gesehen = new Set<string>([normalisiereWert(w.wert)]);
  const varianten: string[] = [];
  for (const s of [...(w.varianten ?? []), amtlich.text, ...amtlich.varianten]) {
    const k = normalisiereWert(s);
    if (!k || gesehen.has(k)) continue;
    gesehen.add(k);
    varianten.push(s);
  }
  return { ...w, varianten };
}

/**
 * Die Kategorie eines Eintrags **aus der Fassung**: für Werte mit amtlichem Code
 * die Arbeitsliste des Codes, sonst das gepflegte Feld.
 *
 * Warum nicht einfach `w.kategorie`: das Feld stammt aus dem Seed-Stand, unter
 * dem die Fassung angelegt wurde. Eine Fassung von gestern trüge damit die
 * Kategorien von gestern und überschriebe die Ableitung — beobachtet an Fassung
 * v7, die für `NL eingegangen` eine andere Kategorie führte als die eingebaute
 * Map. Ergebnis: Zähler, die auf derselben Seite verschiedene Zahlen zeigten, je
 * nachdem ob sie beim Modul-Laden oder beim Rendern fragten. (Derselbe Wert ist
 * mit v2.411 erneut gewandert — genau deshalb rechnet diese Funktion und liest
 * nicht ab.)
 *
 * **Die kuratierte `zahPhaseId` geht seit v4.87 NICHT mehr ein.** Sie tat es bis
 * dahin, und damit verschob ein Phasenschnitt die Arbeitslisten (v3.25: 448
 * Anträge). Die Phase steuert weiter Verfahrensleiste, Gruppierung, Zieltage und
 * Fristlauf — nur nicht mehr, wer auf welcher Arbeitsliste steht.
 */
function kategorieAusFassung(w: StatusWertEintrag): StatusCategory {
  if (w.code === undefined) return w.kategorie;   // unkuratierter Wert, kein Code
  return kategorieFuerCode(w.code);
}

/** Die aktuell aktive Version (oder `null`, wenn kein Snapshot gesetzt ist).
 *  Synchroner Zugriff für Engine/Timeline/Cockpit, die die volle Version brauchen. */
export function getAktiveVersion(): MappingVersion | null {
  return aktiveVersion;
}
