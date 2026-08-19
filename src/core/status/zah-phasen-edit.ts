/**
 * Die Phasen-Tabelle einer Fassung ändern — und die Grenzen, die dabei gelten.
 *
 * Getrennt von `zah-phasen.ts` (dort steht, welcher Schnitt gilt) und von
 * `katalog-edit.ts` (dort stehen die Fassungs-Transformationen der übrigen
 * Achsen). Hier lebt genau eine Frage: **darf dieser Zuschnitt gespeichert
 * werden, und wie sieht er danach aus?**
 *
 * Drei Regeln, drei verschiedene Antworten:
 *
 * 1. **Anzahl und Eindeutigkeit werden GEMELDET, nicht korrigiert.** Ein Editor,
 *    der eine siebte Phase stillschweigend wegwirft, weil er neun für genug
 *    hält, ist schlimmer als einer, der „geht nicht" sagt. `pruefeZahPhasen`
 *    liefert deshalb Sätze, keine bereinigte Liste.
 * 2. **Die Reihenfolge wird normalisiert.** Sie ist keine Entscheidung der PL,
 *    sondern die Folge daraus, wo sie eine Phase hingezogen hat — Zehnerlücken
 *    zu vergeben ist Buchhaltung, kein Eingriff (dieselbe Begründung wie in
 *    `verschiebeTodoRegel`).
 * 3. **Verwaiste Zuordnungen werden GEZÄHLT.** Zeigt ein Statuswert auf eine
 *    Phase, die es nicht mehr gibt, wird er wie „ohne Phase" gelesen — aber
 *    nicht stillschweigend umgeschrieben. Die Zahl steht im Kopf des
 *    Katalog-Tabs, damit niemand sie erst beim nächsten Import bemerkt.
 *
 * Rein und deterministisch: keine IO, keine Uhr.
 */
import { zahPhasenVon } from './zah-phasen';
import type { MappingVersion, ZahPhase, ZahPhaseId } from './typen';

/**
 * Untergrenze der Phasenzahl. Weniger als drei Schritte sind kein Verfahren
 * mehr, sondern eine Ampel — und die Auswertungen (Zieltage, Stillstand,
 * Verfahrensleiste) hätten nichts mehr zu unterscheiden.
 */
export const MIN_PHASEN = 3;

/**
 * Obergrenze. Neun ist eine Setzung, keine technische Schranke: darüber wird die
 * Verfahrensleiste im Verbund-Kopf unlesbar, und ein Zuschnitt, den niemand mehr
 * am Stück liest, wird nicht mehr gepflegt.
 */
export const MAX_PHASEN = 9;

/**
 * Was einem Zuschnitt im Weg steht — leer heißt „speicherbar".
 *
 * Sätze statt Codes: sie stehen unverändert in der Speicherleiste. Ein
 * Fehlercode, den die Oberfläche erst wieder in einen Satz übersetzt, wäre eine
 * zweite Stelle, an der die Begründung gepflegt werden müsste.
 */
export function pruefeZahPhasen(phasen: readonly ZahPhase[]): string[] {
  const fehler: string[] = [];

  if (phasen.length < MIN_PHASEN) {
    fehler.push(
      `Der Verfahrensschnitt braucht mindestens ${MIN_PHASEN} Phasen — es sind ${phasen.length}.`,
    );
  }
  if (phasen.length > MAX_PHASEN) {
    fehler.push(
      `Höchstens ${MAX_PHASEN} Phasen; es sind ${phasen.length}.`
      + ' Darüber wird die Verfahrensleiste unlesbar.',
    );
  }

  const gesehen = new Set<ZahPhaseId>();
  const doppelt = new Set<ZahPhaseId>();
  for (const p of phasen) {
    if (gesehen.has(p.id)) doppelt.add(p.id);
    gesehen.add(p.id);
  }
  if (doppelt.size > 0) {
    fehler.push(
      `Die Kennung muss eindeutig sein — doppelt: ${[...doppelt].sort().join(', ')}.`,
    );
  }

  const ohneId = phasen.filter(p => p.id.trim() === '').length;
  if (ohneId > 0) fehler.push(`${ohneId} Phase(n) ohne Kennung.`);

  const ohneLabel = phasen.filter(p => p.label.trim() === '').length;
  if (ohneLabel > 0) {
    fehler.push(`${ohneLabel} Phase(n) ohne Beschriftung — sie stünde leer in der Leiste.`);
  }

  return fehler;
}

/**
 * Vergibt `reihenfolge` neu: 10, 20, 30 … in der Reihenfolge, in der die Phasen
 * ankommen (nicht in der, die sie behaupten).
 *
 * **Komplett neu statt zwei Werte tauschen**: importierte oder von Hand
 * gepflegte Fassungen können Lücken und Doppelwerte tragen, und ein Tausch
 * zweier gleicher Zahlen wäre eine Aktion, die sichtbar nichts tut.
 */
export function normalisiereReihenfolge(phasen: readonly ZahPhase[]): ZahPhase[] {
  return phasen.map((p, i) => ({ ...p, reihenfolge: (i + 1) * 10 }));
}

/** Wie viele Zuordnungen ins Leere zeigen. */
export interface VerwaisteZuordnungen {
  /** Statuswerte mit einer `zahPhaseId`, die die Fassung nicht (mehr) führt. */
  werte: number;
  /** Dasselbe an Datumsfeldern. */
  felder: number;
}

/** `true`, wenn nichts verwaist ist — für „soll der Hinweis überhaupt erscheinen?". */
export function ohneVerwaiste(v: VerwaisteZuordnungen): boolean {
  return v.werte === 0 && v.felder === 0;
}

/**
 * Zählt Zuordnungen auf nicht (mehr) vorhandene Phasen — über BEIDE Achsen.
 *
 * `null` zählt ausdrücklich nicht mit: das ist die gepflegte Aussage „läuft
 * neben dem Verfahren", kein Verweis ins Leere. Ebenso `undefined` („noch nicht
 * zugeordnet", greift auf die Auslieferung zurück).
 *
 * **Gezählt werden Status, keine Katalogzeilen.** Derselbe Code steht unter
 * `status` und `verbund_status`; ihn zweimal zu zählen ergab systematisch die
 * doppelte Zahl gegenüber dem Baum daneben, der Codes zeigt (dieselbe Einheit
 * wie `zaehleStatus`). Werte ohne Code bleiben für sich — dort ist die Zeile
 * der Status.
 */
export function verwaisteZuordnungen(version: MappingVersion): VerwaisteZuordnungen {
  const bekannt = new Set(zahPhasenVon(version.zahPhasen).map(p => p.id));
  const verwaist = (id: ZahPhaseId | null | undefined): boolean =>
    id !== undefined && id !== null && !bekannt.has(id);
  const codes = new Set<number>();
  let ohneCode = 0;
  for (const w of version.werte) {
    if (!verwaist(w.zahPhaseId)) continue;
    if (w.code === undefined) ohneCode += 1; else codes.add(w.code);
  }
  return {
    werte: codes.size + ohneCode,
    felder: version.felder.filter(f => verwaist(f.zahPhaseId)).length,
  };
}

// --- Die Tabelle ändern -----------------------------------------------------

/** Ändert eine Phase; Id und Reihenfolge bleiben unangetastet. */
export function aendereZahPhase(
  version: MappingVersion, id: ZahPhaseId, patch: Partial<ZahPhase>,
): MappingVersion {
  return {
    ...version,
    zahPhasen: zahPhasenVon(version.zahPhasen).map(p => (
      p.id === id ? { ...p, ...patch, id: p.id, reihenfolge: p.reihenfolge } : p
    )),
  };
}

/**
 * Legt eine Phase ans Ende an. Über der Obergrenze passiert **nichts** — der
 * Knopf ist dort ohnehin deaktiviert, und ein stiller Anhang wäre die zweite
 * Wahrheit über die Grenze.
 *
 * Die Id ist opak und wird aus einem Zähler gebildet, nicht aus der
 * Beschriftung: sonst hinge die Identität am Text, und Umbenennen zerrisse jede
 * Zuordnung (Anti-Pattern „Nummern sind keine Identität", umgekehrt gedacht).
 */
export function fuegeZahPhaseHinzu(
  version: MappingVersion, label: string,
): MappingVersion {
  const bestand = zahPhasenVon(version.zahPhasen);
  if (bestand.length >= MAX_PHASEN) return version;
  const belegt = new Set(bestand.map(p => p.id));
  let n = bestand.length + 1;
  while (belegt.has(`phase-${n}`)) n++;
  return {
    ...version,
    zahPhasen: normalisiereReihenfolge([...bestand, {
      id: `phase-${n}`,
      label: label.trim() === '' ? `Phase ${bestand.length + 1}` : label.trim(),
      reihenfolge: 0,   // gleich überschrieben
      zieltageRelevant: false,
      // Ausdrücklich statt weggelassen, obwohl `normalisiere` denselben Wert
      // ergänzte: eine neue Phase steht im Verfahren, und die Uhr anzuhalten
      // ist die Entscheidung, die jemand treffen muss — nicht der Default.
      fristLaeuft: true,
    }]),
  };
}

/**
 * Entfernt eine Phase und **hängt ihre Statuswerte um** — nach `zielId`, oder
 * mit `null` ausdrücklich in die Marker-Gruppe.
 *
 * Es gibt bewusst keinen Weg, sie ohne Ziel zu entfernen: „wohin mit den n
 * Werten?" ist die Frage, die der Editor stellt, und eine Funktion, die sie
 * überspringen ließe, wäre die Abkürzung, die irgendwann jemand nimmt.
 * Unterschreitet der Schnitt dadurch {@link MIN_PHASEN}, passiert nichts —
 * dasselbe Muster wie bei der Obergrenze.
 *
 * Datumsfelder werden mitgezogen: sie tragen dieselbe `zahPhaseId`, und ein
 * Feld, dessen Phase verschwindet, wäre sonst der nächste Verwaiste.
 */
export function entferneZahPhase(
  version: MappingVersion, id: ZahPhaseId, zielId: ZahPhaseId | null,
): MappingVersion {
  const bestand = zahPhasenVon(version.zahPhasen);
  if (!bestand.some(p => p.id === id)) return version;
  if (bestand.length <= MIN_PHASEN) return version;
  if (zielId !== null && !bestand.some(p => p.id === zielId)) return version;
  // Die zu löschende Phase als Ziel ist kein Umhängen, sondern Verwaisen mit
  // Extraschritt: die Werte behielten eine Id, die es gleich nicht mehr gibt.
  // Der Prüfung oben entgeht das, weil `id` im Bestand ja noch steht.
  if (zielId === id) return version;

  return {
    ...version,
    zahPhasen: normalisiereReihenfolge(bestand.filter(p => p.id !== id)),
    werte: version.werte.map(w => (w.zahPhaseId === id ? { ...w, zahPhaseId: zielId } : w)),
    felder: version.felder.map(f => (f.zahPhaseId === id ? { ...f, zahPhaseId: zielId } : f)),
  };
}

/**
 * Schiebt eine Phase an die Position `index` (0-basiert, in der Anzeige-Reihen-
 * folge). Danach ist die Reihenfolge wieder lückenlos.
 */
export function verschiebeZahPhase(
  version: MappingVersion, id: ZahPhaseId, index: number,
): MappingVersion {
  const bestand = zahPhasenVon(version.zahPhasen);
  const i = bestand.findIndex(p => p.id === id);
  if (i < 0) return version;
  const ziel = Math.max(0, Math.min(bestand.length - 1, index));
  if (ziel === i) return version;
  const kopie = [...bestand];
  const [bewegt] = kopie.splice(i, 1);
  kopie.splice(ziel, 0, bewegt!);
  return { ...version, zahPhasen: normalisiereReihenfolge(kopie) };
}

/**
 * Hängt Status-CODES an eine Phase um (`null` = Marker-Gruppe).
 *
 * **Der Schlüssel ist der Code, nicht die Wert-Id**: derselbe Code steht im
 * Katalog unter `status` UND `verbund_status`. Nur eine der beiden Zeilen
 * umzuhängen hieße, zwei Wege zur Phase zu haben — und `schnittVon` löst das
 * mit „erster Wert gewinnt" auf, also je nach Sortierung mal so, mal so.
 *
 * Sammelform aus demselben Grund wie `setzeZieltage`: ein Zug im Baum-Editor
 * darf nicht 2 `setState`-Runden auslösen, von denen der Save-Lock eine verwirft
 * (Pitfall #16/#20).
 */
export function setzeCodePhasen(
  version: MappingVersion, phasen: ReadonlyMap<number, ZahPhaseId | null>,
): MappingVersion {
  if (phasen.size === 0) return version;
  return {
    ...version,
    werte: version.werte.map(w => {
      if (w.code === undefined || !phasen.has(w.code)) return w;
      const ziel = phasen.get(w.code)!;
      // `marker` und `zahPhaseId` sind zwei Sichten auf dieselbe Aussage —
      // sie hier auseinanderlaufen zu lassen wäre der klassische Halbschritt.
      return { ...w, zahPhaseId: ziel, marker: ziel === null };
    }),
  };
}
