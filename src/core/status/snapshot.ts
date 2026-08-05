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
 * **Hier hängen alle drei Register.** Neben der Wert→Kategorie-Map setzt diese
 * Datei seit v2.409 auch die geltende Phasen-Tabelle und den geltende
 * Code→Phase-Schnitt (`zah-phasen.ts`). Sie ist deren EINZIGER Schreibweg —
 * drei Register an einer Stelle können nicht auseinanderlaufen, drei
 * Schreibwege schon (Konventionstest `zah-phasen-snapshot-single-writer`).
 */
import { setStatusKatalogSnapshotMap } from '@/core/utils/status-canonical';
import {
  normalisiereWert,
  type MappingVersion, type StatusCategory, type StatusWertEintrag, type ZahPhase,
} from './typen';
import { indexNachSchreibweise } from './wert-index';
import { kategorieFuerCode, kategorieFuerPhase } from './kategorie-ableitung';
import { setCodePhasenSnapshot, setZahPhasenSnapshot } from './zah-phasen';
import { schnittVon } from './phasen-schnitt';
import { statusCodeEintrag } from './status-codes';

let aktiveVersion: MappingVersion | null = null;

/** Setzt (oder löscht mit `null`) den aktiven Katalog-Snapshot. Nach jedem
 *  Aktivieren im Cockpit und einmalig beim App-Start aufgerufen. */
export function setStatusKatalogSnapshot(version: MappingVersion | null): void {
  aktiveVersion = version;
  if (!version) {
    setStatusKatalogSnapshotMap(null);
    setZahPhasenSnapshot(null);
    setCodePhasenSnapshot(null);
    return;
  }
  const kuratiert = version.werte.filter(w => !w.unkuratiert);
  const idx = indexNachSchreibweise(kuratiert.map(mitAmtlichenSchreibweisen));
  const m = new Map<string, StatusCategory>();
  for (const [key, w] of idx) m.set(key, kategorieAusFassung(w, version.zahPhasen));
  setStatusKatalogSnapshotMap(m);
  // Erst die Phasen, dann der Schnitt: die Kategorie-Map oben ist schon
  // gerechnet, aber Sidebar, Verfahrensleiste und Filter fragen die Register
  // erst beim nächsten Rendern — die Reihenfolge hier ist reine Lesbarkeit.
  setZahPhasenSnapshot(version.zahPhasen);
  setCodePhasenSnapshot(schnittVon(version));
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
function mitAmtlichenSchreibweisen(w: StatusWertEintrag): StatusWertEintrag {
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
 * abgeleitet aus (kuratierter) ZAH-Phase + Code, sonst das gepflegte Feld.
 *
 * Warum nicht einfach `w.kategorie`: das Feld stammt aus dem Seed-Stand, unter
 * dem die Fassung angelegt wurde. Eine Fassung von gestern trüge damit die
 * Kategorien von gestern und überschriebe die Ableitung — beobachtet an Fassung
 * v7, die `NL eingegangen` noch als `offen` führte, während die eingebaute Map
 * schon `nachforderung` sagte. Ergebnis: Zähler, die auf derselben Seite
 * verschiedene Zahlen zeigten, je nachdem ob sie beim Modul-Laden oder beim
 * Rendern fragten.
 *
 * `zahPhaseId` ist dreiwertig und wird auch so gelesen: gesetzt = kuratiert,
 * `null` = bewusst Marker, `undefined` = noch nicht zugeordnet ⇒ Auslieferungs-
 * Schnitt (dieselbe Regel wie in `baueHerleitung`).
 */
function kategorieAusFassung(
  w: StatusWertEintrag, phasen: readonly ZahPhase[] | undefined,
): StatusCategory {
  if (w.code === undefined) return w.kategorie;   // unkuratierter Wert, kein Code
  if (w.zahPhaseId !== undefined) return kategorieFuerPhase(w.zahPhaseId, w.code, phasen);
  return kategorieFuerCode(w.code);
}

/** Die aktuell aktive Version (oder `null`, wenn kein Snapshot gesetzt ist).
 *  Synchroner Zugriff für Engine/Timeline/Cockpit, die die volle Version brauchen. */
export function getAktiveVersion(): MappingVersion | null {
  return aktiveVersion;
}
