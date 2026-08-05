/**
 * Die Bilanz einer gepflegten Katalog-Fassung **gegenüber der Auslieferung**.
 *
 * **Warum es diese Datei gibt.** Für die To-do-Kaskade gibt es die Bilanz seit
 * v2.412 (`todoRegelDrift` in `katalog-edit.ts`) — für Phasen, Zuordnungen und
 * Zieltage gab es sie nicht. Der Schnitt wird seit v2.409 in der App kuratiert
 * und wandert dort weiter, während `prod` weiter auf dem Seed läuft; wie weit
 * beide auseinander sind, wusste niemand. Beim späteren Abgleich mit dem Code
 * ist der Unterschied zwischen einer Bilanz und keiner Bilanz der zwischen
 * einer Entscheidung und Archäologie.
 *
 * **Sie stellt fest, sie ändert nichts.** Anders als das Paar
 * `todoRegelDrift`/`zieheTodoRegelnNach` hat diese Bilanz **kein** Nachzieh-
 * Gegenstück: die Kuration ist hier der spätere Stand, nicht die Auslieferung.
 * Ein „Drift zurücksetzen" wäre das Verwerfen genau der Arbeit, die die Bilanz
 * sichtbar macht. Drift ist der erwartete Zustand, kein Fehler.
 *
 * **Keine zweite Vergleichslogik.** Der Code→Phase-Schnitt kommt für BEIDE
 * Seiten aus `schnittVon` (dort steckt die dreiwertige `zahPhaseId`-Lesung und
 * „erster Wert mit dem Code gewinnt"), die Phasenliste aus `zahPhasenVon`
 * (Normalisierung + Sortierung). Rechnete diese Datei selbst, liefe sie
 * irgendwann anders als die App, die sie beschreibt.
 *
 * **Nicht in der Bilanz: `StatusWertEintrag.kategorie`.** Das Feld ist
 * abgeleitet und wird vom Snapshot neu gerechnet (Pitfall #45) — ein Vergleich
 * darauf meldete Rauschen. Die Arbeitsliste erscheint dort, wo sie wirklich
 * kuratiert wird: an der `kategorieVorgabe` der Phase.
 *
 * Import-Disziplin wie bei den Nachbarn: nur Blätter (`./zah-phasen`,
 * `./phasen-schnitt`, `./status-codes`) und `./typen` type-only — nie über das
 * Barrel `@/core/status`, das zöge `snapshot.ts` mit und damit einen
 * Laufzeit-Zyklus.
 *
 * Rein und deterministisch: keine IO, keine Uhr.
 */
import { zahPhasenVon } from './zah-phasen';
import { schnittVon } from './phasen-schnitt';
import { statusCodeEintrag } from './status-codes';
import type {
  MappingVersion, Prominenz, StatusCategory, StatusWertEintrag, ZahPhaseId,
} from './typen';

/** Eine Phase, auf ihre Kennung und ihre Beschriftung eingedampft. */
export interface PhaseKurz {
  id: ZahPhaseId;
  label: string;
}

/** Dieselbe Phase, andere Beschriftung. */
export interface PhaseUmbenannt {
  id: ZahPhaseId;
  alt: string;
  neu: string;
}

/** Dieselbe Phase, andere Stelle in der Reihenfolge. */
export interface PhaseVerschoben {
  id: ZahPhaseId;
  label: string;
  /** Positionen zählen NUR die gemeinsamen Phasen — siehe {@link phasenDrift}. */
  vorher: number;
  nachher: number;
}

/**
 * Eine beibehaltene Phase, deren **Vorgabe** sich geändert hat.
 *
 * Die stille Sorte: kein Code wurde umgehängt, trotzdem wechseln alle Codes
 * dieser Phase die Arbeitsliste. Ohne diese Gruppe fiele das nirgends auf.
 */
export interface PhaseVorgabe {
  id: ZahPhaseId;
  label: string;
  arbeitsliste?: { alt: StatusCategory; neu: StatusCategory };
  zieltageRelevant?: { alt: boolean; neu: boolean };
  /** Wie viele Status-Codes an dieser Phase hängen — das Gewicht der Änderung. */
  codeAnzahl: number;
}

/** Was die Fassung an den Verfahrensschritten anders sagt. */
export interface PhasenDrift {
  entfernt: PhaseKurz[];
  hinzugefuegt: PhaseKurz[];
  umbenannt: PhaseUmbenannt[];
  umsortiert: PhaseVerschoben[];
  vorgabeGeaendert: PhaseVorgabe[];
}

/** Ein Status-Code, der in der Fassung in einem anderen Schritt steht. */
export interface ZuordnungDrift {
  code: number;
  /** Amtliche Bezeichnung aus dem Code-Katalog; leer, wenn er den Code nicht führt. */
  bezeichnung: string;
  /** `null` heißt „ohne Phase" — auf beiden Seiten möglich. */
  vorher: ZahPhaseId | null;
  nachher: ZahPhaseId | null;
}

/** Ein gepflegter Zieltag. Die Auslieferung kennt heute keine (siehe `seedKenntZieltage`). */
export interface ZieltagDrift {
  id: string;
  code: number | null;
  wert: string;
  alt: number | null;
  neu: number;
}

/** Ein Statuswert, auf Kennung und Anzeigetext eingedampft. */
export interface WertKurz {
  id: string;
  code: number | null;
  wert: string;
}

/** Ein Statuswert mit geänderter Prominenz. */
export interface ProminenzDrift {
  id: string;
  code: number | null;
  wert: string;
  alt: Prominenz;
  neu: Prominenz;
}

/**
 * Die vollständige Bilanz, nach Art gegliedert.
 *
 * Jede Änderung erscheint in **genau einer** Gruppe. Eine Umhängung steht unter
 * `zuordnungen`, nicht zusätzlich unter der Arbeitsliste — sonst läse sich eine
 * Änderung als zwei.
 */
export interface KatalogDrift {
  phasen: PhasenDrift;
  zuordnungen: ZuordnungDrift[];
  zieltage: ZieltagDrift[];
  /**
   * Führt die AUSLIEFERUNG überhaupt Zieltage? Heute nein — jeder gepflegte
   * Wert ist damit per Definition Drift. Das wird abgeleitet und nicht
   * behauptet, damit die Aussage stimmt, sobald der Seed welche mitbringt.
   */
  seedKenntZieltage: boolean;
  statuswerte: {
    stillgelegt: WertKurz[];
    wiederAktiviert: WertKurz[];
  };
  prominenz: ProminenzDrift[];
}

/** Die leere Bilanz — Fallback, solange keine Fassung geladen ist. */
export function leereKatalogDrift(): KatalogDrift {
  return {
    phasen: { entfernt: [], hinzugefuegt: [], umbenannt: [], umsortiert: [], vorgabeGeaendert: [] },
    zuordnungen: [],
    zieltage: [],
    seedKenntZieltage: false,
    statuswerte: { stillgelegt: [], wiederAktiviert: [] },
    prominenz: [],
  };
}

/** Trägt die Bilanz überhaupt etwas? Sonst erscheint sie gar nicht erst. */
export function hatDrift(d: KatalogDrift): boolean {
  const p = d.phasen;
  return p.entfernt.length > 0 || p.hinzugefuegt.length > 0 || p.umbenannt.length > 0
    || p.umsortiert.length > 0 || p.vorgabeGeaendert.length > 0
    || d.zuordnungen.length > 0 || d.zieltage.length > 0
    || d.statuswerte.stillgelegt.length > 0 || d.statuswerte.wiederAktiviert.length > 0
    || d.prominenz.length > 0;
}

/**
 * Was die gepflegte Fassung gegenüber dem Auslieferungsstand anders sagt.
 *
 * Der Seed wird **hereingereicht statt importiert** (Hausmuster von
 * `todoRegelDrift`, `vorgangssystemLuecke`, `seedTextAbweichungen`): so bleibt
 * die Funktion rein und der Test kann beide Seiten stellen.
 */
export function katalogDrift(fassung: MappingVersion, seed: MappingVersion): KatalogDrift {
  return {
    phasen: phasenDrift(fassung, seed),
    zuordnungen: zuordnungsDrift(fassung, seed),
    zieltage: zieltageDrift(fassung, seed),
    seedKenntZieltage: seed.werte.some(w => typeof w.zieltage === 'number'),
    statuswerte: statuswertDrift(fassung, seed),
    prominenz: prominenzDrift(fassung, seed),
  };
}

/**
 * Phasen: entfernt, hinzugefügt, umbenannt, umsortiert, Vorgabe geändert.
 *
 * **`umsortiert` zählt nur die gemeinsamen Phasen.** Eine entfernte Phase
 * verschiebt alle nachfolgenden um eine Stelle; würde die absolute Position
 * verglichen, meldete das Entfernen von „Vollständigkeit" nebenbei vier
 * Umsortierungen, die niemand vorgenommen hat.
 */
function phasenDrift(fassung: MappingVersion, seed: MappingVersion): PhasenDrift {
  const alt = zahPhasenVon(seed.zahPhasen);
  const neu = zahPhasenVon(fassung.zahPhasen);
  const altNach = new Map(alt.map(p => [p.id, p]));
  const neuNach = new Map(neu.map(p => [p.id, p]));

  const gemeinsamAlt = alt.filter(p => neuNach.has(p.id)).map(p => p.id);
  const gemeinsamNeu = neu.filter(p => altNach.has(p.id)).map(p => p.id);
  const codesJePhase = zaehleCodesJePhase(fassung);

  const umbenannt: PhaseUmbenannt[] = [];
  const vorgabeGeaendert: PhaseVorgabe[] = [];
  for (const p of neu) {
    const a = altNach.get(p.id);
    if (!a) continue;
    if (a.label !== p.label) umbenannt.push({ id: p.id, alt: a.label, neu: p.label });
    const arbeitsliste = a.kategorieVorgabe !== p.kategorieVorgabe
      ? { alt: a.kategorieVorgabe, neu: p.kategorieVorgabe }
      : undefined;
    const zieltage = a.zieltageRelevant !== p.zieltageRelevant
      ? { alt: a.zieltageRelevant, neu: p.zieltageRelevant }
      : undefined;
    if (arbeitsliste || zieltage) {
      vorgabeGeaendert.push({
        id: p.id,
        label: p.label,
        ...(arbeitsliste ? { arbeitsliste } : {}),
        ...(zieltage ? { zieltageRelevant: zieltage } : {}),
        codeAnzahl: codesJePhase.get(p.id) ?? 0,
      });
    }
  }

  return {
    entfernt: alt.filter(p => !neuNach.has(p.id)).map(p => ({ id: p.id, label: p.label })),
    hinzugefuegt: neu.filter(p => !altNach.has(p.id)).map(p => ({ id: p.id, label: p.label })),
    umbenannt,
    umsortiert: gemeinsamNeu.flatMap((id, i) => {
      const vorher = gemeinsamAlt.indexOf(id);
      return vorher === i
        ? []
        : [{ id, label: neuNach.get(id)?.label ?? id, vorher, nachher: i }];
    }),
    vorgabeGeaendert,
  };
}

/** Status-Codes je Verfahrensschritt der FASSUNG — das Gewicht einer Vorgabe-Änderung. */
function zaehleCodesJePhase(fassung: MappingVersion): Map<ZahPhaseId, number> {
  const proPhase = new Map<ZahPhaseId, number>();
  for (const phase of schnittVon(fassung).codeZuPhase.values()) {
    proPhase.set(phase, (proPhase.get(phase) ?? 0) + 1);
  }
  return proPhase;
}

/**
 * Zuordnungen: je Code der ausgelieferte Schritt und der gepflegte.
 *
 * Die Menge ist die **Vereinigung** beider Schnitte — sonst fehlte der Code,
 * der in der Auslieferung Marker ist und in der Fassung eine Phase bekommen hat
 * (und umgekehrt). Ein Code, der auf beiden Seiten ohne Phase steht, taucht
 * nicht auf: das ist keine Änderung.
 */
function zuordnungsDrift(fassung: MappingVersion, seed: MappingVersion): ZuordnungDrift[] {
  const auslieferung = schnittVon(seed);
  const gepflegt = schnittVon(fassung);
  const codes = [...new Set([
    ...auslieferung.codeZuPhase.keys(),
    ...gepflegt.codeZuPhase.keys(),
  ])].sort((a, b) => a - b);

  return codes.flatMap(code => {
    const vorher = auslieferung.codeZuPhase.get(code) ?? null;
    const nachher = gepflegt.codeZuPhase.get(code) ?? null;
    if (vorher === nachher) return [];
    return [{ code, bezeichnung: statusCodeEintrag(code)?.text ?? '', vorher, nachher }];
  });
}

/**
 * Ein Status steht ZWEIMAL im Katalog — einmal am TV-Feld, einmal am
 * Verbund-Feld — und der Baum-Editor pflegt beide gemeinsam („beide
 * Katalog-Zeilen des Codes ziehen mit"). Ungefiltert meldete die Bilanz darum
 * jeden gepflegten Zieltag doppelt und behauptete den doppelten Abstand.
 *
 * Entdoppelt wird nach Code UND Aussage: sagen beide Zeilen dasselbe, bleibt
 * eine; sagen sie Verschiedenes, bleiben beide — sonst verschwiege die Bilanz
 * genau den Fall, in dem TV und Verbund auseinanderlaufen. Werte ohne Code
 * haben kein Gegenstück und laufen unverändert durch.
 */
function entdopple<T extends { code: number | null }>(
  eintraege: readonly T[], aussage: (t: T) => string,
): T[] {
  const gesehen = new Set<string>();
  return eintraege.filter(t => {
    if (t.code === null) return true;
    const schluessel = `${t.code}|${aussage(t)}`;
    if (gesehen.has(schluessel)) return false;
    gesehen.add(schluessel);
    return true;
  });
}

/**
 * Zieltage: aufgezählt, nicht verglichen.
 *
 * Solange `seedKenntZieltage` falsch ist, ist jeder gepflegte Wert Drift — die
 * Kuration lebt ausschließlich in der Fassung. Ein ENTFERNTER Zieltag kann
 * folglich nicht vorkommen; sobald der Seed welche mitbringt, meldet der
 * Vergleich unten die geänderten und der Fall ist von selbst richtig.
 */
function zieltageDrift(fassung: MappingVersion, seed: MappingVersion): ZieltagDrift[] {
  const auslieferung = new Map(seed.werte.map(w => [w.id, w]));
  const alle = fassung.werte.flatMap(w => {
    if (typeof w.zieltage !== 'number') return [];
    const vorher = auslieferung.get(w.id)?.zieltage;
    if (vorher === w.zieltage) return [];
    return [{
      id: w.id,
      code: w.code ?? null,
      wert: anzeigeWert(w),
      alt: typeof vorher === 'number' ? vorher : null,
      neu: w.zieltage,
    }];
  });
  return entdopple(alle, z => `${z.alt}->${z.neu}`);
}

/**
 * Stillgelegte und wieder aktivierte Statuswerte.
 *
 * Verglichen wird nur, was **beide** Seiten führen. Ein Wert, den erst der
 * Bestand hervorgebracht hat (unkuratierter Fund), hat keinen
 * Auslieferungs-Gegenpart — er ist neue Beobachtung, keine Drift.
 */
function statuswertDrift(
  fassung: MappingVersion, seed: MappingVersion,
): { stillgelegt: WertKurz[]; wiederAktiviert: WertKurz[] } {
  const auslieferung = new Map(seed.werte.map(w => [w.id, w]));
  const stillgelegt: WertKurz[] = [];
  const wiederAktiviert: WertKurz[] = [];
  for (const w of fassung.werte) {
    const a = auslieferung.get(w.id);
    if (!a || a.aktiv === w.aktiv) continue;
    (w.aktiv ? wiederAktiviert : stillgelegt)
      .push({ id: w.id, code: w.code ?? null, wert: anzeigeWert(w) });
  }
  return {
    stillgelegt: entdopple(stillgelegt, w => w.wert),
    wiederAktiviert: entdopple(wiederAktiviert, w => w.wert),
  };
}

/** Statuswerte, deren Prominenz von der Auslieferung abweicht. */
function prominenzDrift(fassung: MappingVersion, seed: MappingVersion): ProminenzDrift[] {
  const auslieferung = new Map(seed.werte.map(w => [w.id, w]));
  const alle = fassung.werte.flatMap(w => {
    const a = auslieferung.get(w.id);
    if (!a || a.prominenz === w.prominenz) return [];
    return [{
      id: w.id, code: w.code ?? null, wert: anzeigeWert(w), alt: a.prominenz, neu: w.prominenz,
    }];
  });
  return entdopple(alle, p => `${p.alt}->${p.neu}`);
}

/**
 * Der Name eines Statuswerts in der Bilanz: kuratiertes Label, sonst die
 * amtliche Bezeichnung, sonst der Rohwert.
 *
 * Die amtliche Bezeichnung steht in der Mitte, damit die Aufstellung EINE
 * Schreibweise führt: die Zuordnungen nennen ohnehin den Code-Katalog, und ohne
 * diesen Schritt stand derselbe Status oben als „35 NF gestellt" und unten als
 * „35 nf gestellt" (der Rohwert ist normalisiert).
 */
function anzeigeWert(w: StatusWertEintrag): string {
  if (w.label !== undefined) return w.label;
  return (w.code !== undefined ? statusCodeEintrag(w.code)?.text : undefined) ?? w.wert;
}
