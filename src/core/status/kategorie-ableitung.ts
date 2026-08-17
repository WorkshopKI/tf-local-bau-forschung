/**
 * Status-Code → {@link StatusCategory}: die interne Speisung der Fassade.
 *
 * **Warum es diese Datei gibt.** Bis v2.382 hielt `status-canonical.ts` eine
 * handgeschriebene Tabelle „Rohtext → Kategorie". Sie kannte 21 der 30 amtlichen
 * Status-Codes unter ihrem amtlichen Namen; die übrigen trafen nur, weil der
 * Export zufällig dieselbe Abkürzung schrieb wie die Tabelle. Bei Code 72 ging
 * das schon schief: der Export schreibt „Stellungnahme zur
 * Rücknahmeempfehlung" aus, die Tabelle führte nur „…Rücknahmeempf." — 16
 * Vorgänge lagen deshalb unter `sonstige` und tauchten in keiner Arbeitsliste
 * auf. Eine zweite Wertetabelle neben dem Code-Katalog läuft immer irgendwann
 * auseinander; hier gibt es nur noch eine.
 *
 * **Der Weg:** Rohtext → Code (`status-codes.ts`, exakt oder über eine
 * gepflegte Variante) → Arbeitsliste ({@link CODE_ZU_ARBEITSLISTE}). Die
 * ZAH-Phase steht **nicht** mehr dazwischen: seit v4.87 hängt die Arbeitsliste
 * am Code, nicht am Verfahrensschritt. Warum, steht an der Tabelle selbst.
 *
 * **Flag-unabhängig.** Die Fassade wird von allen Varianten genutzt, auch von
 * prod/as ohne `statusCockpit` — dort wird der Katalog-Snapshot nie gesetzt.
 * Die Ableitung muss deshalb in der EINGEBAUTEN Map sitzen, nicht nur im
 * Snapshot. (Zwei Filter-Module lesen `getStatusValuesByCategory` außerdem auf
 * Modul-Ebene, also lange bevor ein Snapshot existieren könnte.)
 *
 * **Import-Disziplin:** nur Direktimporte auf `./status-codes`, `./zah-phasen`,
 * `./normalisierung` — alle drei sind Blätter. Ein Import über das Barrel
 * `@/core/status` zöge `snapshot.ts` mit und damit `status-canonical.ts`
 * zurück: ein Laufzeit-Zyklus (Zyklen-Wächter). `./typen` und die Kategorie
 * selbst kommen type-only herein.
 *
 * Rein und deterministisch: keine IO, keine Uhr.
 */
import { STATUS_CODE_KATALOG, findeStatusCode, type StatusCodeEintrag } from './status-codes';
import { phaseFuerCode, geltenderSchnitt, zahPhasenVon } from './zah-phasen';
import { normKey } from './normalisierung';
import type { ZahPhaseId } from './typen';
import type { StatusCategory } from '@/core/utils/status-canonical';

/**
 * **Welche Arbeitsliste ein Status-Code speist** — die eine Tabelle, und sie
 * hängt am Code.
 *
 * **Warum sie so aussieht.** Bis v4.86 stand hier nur eine Ausnahmeliste mit
 * sechs Einträgen; die übrigen Codes bekamen ihre Arbeitsliste über die
 * `kategorieVorgabe` ihrer ZAH-Phase. Damit steuerte die **bewegliche** Achse
 * die **feste** — der Verfahrensschnitt wird laufend umkuratiert, die tägliche
 * Arbeitsliste der ABs soll stehen bleiben.
 *
 * Was das kostet, hat die **Katalog-Fassung 19** vom 05.08.2026 gezeigt: sie
 * löste die Phase „Vollständigkeit" auf und hängte deren Codes an „Prüfung" —
 * ein gewollter Schnitt aus der AB/FB-Abstimmung. Nebenwirkung, die niemand
 * beschlossen hatte: **448 Anträge** wechselten die Arbeitsliste, die Lane
 * „Wartet auf Antragsteller" fiel von 52 auf **0**, der Altanträge-Balken der
 * Auslastung blieb bei 22 von 32 MAs leer. In den Reitern fiel es nicht auf,
 * weil das Aggregat „Vor Entscheidung" `offen`, `in_pruefung` und `entscheidung`
 * bündelt — die Verschiebung lief innerhalb eines Aggregats.
 *
 * Die Reparatur damals war die Ausnahmeliste. Sie fing sechs Codes und nannte
 * sich selbst „eine Untergrenze, kein Ersatz" — ein vierter Mechanismus neben
 * der Kopplung statt ihrer Abschaffung. Seit v4.87 ist die Liste vollständig und
 * `kategorieVorgabe` entfällt: **kein Phasenschnitt kann eine Arbeitsliste mehr
 * verschieben.** Das ist Pitfall #50, strukturell statt als Warnung.
 *
 * **Woher die Werte stammen.** Aus der gelebten Katalog-Fassung 23, nicht aus
 * dem älteren Seed-Schnitt — an fünf Codes waren sich beide uneinig, und die
 * Kuration ist der spätere, im Team abgestimmte Stand (Messung am Bestand:
 * 64 385 Zeilen der drei Import-Quellen). Betroffen waren `32`, `72`, `75`
 * (Seed: `entscheidung`) sowie `90`, `91` (Seed: `abgeschlossen`); sie sind unten
 * einzeln begründet. Weil `prod` ohne Fassung läuft, hat es diese fünf bis hier
 * anders eingeordnet als `pl` — die Uneinigkeit ist mit der Tabelle beendet.
 *
 * **Was NICHT mehr hier hängt**: die ZAH-Phase. Sie bleibt kuratierbar und
 * steuert Verfahrensleiste, Filter-Gruppierung, Zieltage und Fristlauf — nur
 * eben nicht mehr die Arbeitsliste. Genau deshalb darf sie sich frei ändern.
 *
 * Ein Code, der hier **fehlt**, ist `sonstige`: die Marker (29 Irrläufer, 88
 * Sonderstatus, 93/94 Partner) laufen als Kennzeichen neben dem Verfahren.
 */
export const CODE_ZU_ARBEITSLISTE: ReadonlyMap<number, StatusCategory> = new Map<number, StatusCategory>([
  [11, 'offen'],          // Skizze eingegangen
  [31, 'offen'],          // beantragt

  // 32 „ablehnungsreif" ist **noch Arbeit**, keine anstehende Entscheidung: die
  // Ablehnung muss erst geschrieben werden. So kuratiert in Fassung 23 (457
  // VB-Werte im Bestand); der Seed führte ihn unter `entscheidung`.
  [32, 'in_pruefung'],

  // 33–37: der Vollständigkeits-Zyklus. Nur bei 35 liegt der Ball beim
  // Antragsteller — 36 „NL eingegangen" sagt, die Nachlieferung ist DA, und 37
  // „keine weiteren NF", der Zyklus ist zu. Bei beiden ist wieder die Behörde am
  // Zug, deshalb `offen` und nicht `nachforderung` (v2.411).
  [33, 'offen'],          // unvollständig
  [34, 'offen'],          // bearbeitungsreif
  [35, 'nachforderung'],  // NF gestellt — wartet auf den Antragsteller
  [36, 'offen'],          // NL eingegangen
  [37, 'offen'],          // keine weiteren NF

  [38, 'in_pruefung'],    // techn geprüft
  [39, 'in_pruefung'],    // kaufm geprüft
  [40, 'in_pruefung'],    // Gutachten fertig

  [50, 'entscheidung'],   // Bewilligungsentwurf VDI/VDE-IT
  [51, 'entscheidung'],   // bewilligungsreif

  // 59 „bewilligt" ist die positive Entscheidung selbst und liegt trotzdem in
  // der Begleitphase — die beginnt fachlich mit ihr. `isBewilligtStatus` hängt
  // an dem Unterschied.
  [59, 'bewilligt'],

  [70, 'entscheidung'],   // Ablehnung versandt
  [71, 'entscheidung'],   // Rücknahmeempfehlung versandt

  // 72/75: eine Stellungnahme bzw. ein Widerspruch ist eingegangen und wird
  // bearbeitet — die Entscheidung steht danach an, nicht jetzt. Fassung 23;
  // Seed: `entscheidung`.
  [72, 'in_pruefung'],    // Stellungnahme zur Rücknahmeempfehlung
  [73, 'abgeschlossen'],  // abgelehnt/zurückgezogen — der negative Endpunkt
  [75, 'in_pruefung'],    // Widerspruch zur Ablehnung

  [89, 'begleitung'],     // Anhörung zum Widerruf

  // 90/91: nach „abgebrochen"/„beendet" steht noch der Schlussvermerk (99) aus.
  // Sie bleiben deshalb im Arbeitsvorrat, statt ins Archiv zu fallen — die
  // größte der fünf Abweichungen (2 187 VB-Werte allein bei 91). Fassung 23;
  // Seed: `abgeschlossen`, was sie aus jeder Arbeitsliste genommen hätte.
  [90, 'begleitung'],     // abgebrochen
  [91, 'begleitung'],     // beendet

  [92, 'begleitung'],     // Widerruf
  [95, 'begleitung'],     // VN technisch geprüft
  [97, 'begleitung'],     // VN geprüft

  [99, 'abgeschlossen'],  // Schlussvermerk — der reguläre Endpunkt
]);

/** Die Codes der Kategorie `nachforderung` — abgeleitete Sicht auf
 *  {@link CODE_ZU_ARBEITSLISTE}, damit es keine zweite Liste gibt. */
export const NACHFORDERUNG_CODES: ReadonlySet<number> = new Set(
  [...CODE_ZU_ARBEITSLISTE].filter(([, kategorie]) => kategorie === 'nachforderung').map(([code]) => code),
);

/** Der Code der positiven Entscheidung. Siehe {@link CODE_ZU_ARBEITSLISTE}. */
export const BEWILLIGT_CODE = 59;

/**
 * **Die Arbeitsliste eines Status-Codes.** Ein Code, den
 * {@link CODE_ZU_ARBEITSLISTE} nicht führt, ist `sonstige` — die Marker
 * 29/88/93/94 und alles Unbekannte laufen neben dem Verfahren, nicht darin.
 *
 * Rein: kein Snapshot, keine Fassung, kein Phasen-Argument. Damit gilt sie in
 * jeder Variante gleich — `prod` ohne Katalog-Fassung liefert dasselbe wie `pl`
 * mit, und ein umkuratierter Verfahrensschnitt ändert daran nichts. Das ist der
 * ganze Zweck der Umstellung von v4.87 (siehe Tabellenkopf).
 *
 * Ein umgehängter Code ändert weiterhin sofort Verfahrensleiste, Gruppierung
 * und Fristlauf — die Zusage „umhängen ist eine Katalog-Zeile, kein Deployment"
 * gilt für alles, was die Phase trägt. Nur die Arbeitsliste ist nicht mehr
 * darunter, und das ist Absicht: sie ist es, worauf die ABs täglich schauen.
 */
export function kategorieFuerCode(code: number): StatusCategory {
  return CODE_ZU_ARBEITSLISTE.get(code) ?? 'sonstige';
}

/**
 * Die Verfahrensschritte, auf deren Codes diese Arbeitsliste fällt — in
 * Anzeige-Reihenfolge des **geltenden** Schnitts.
 *
 * Die Rückrichtung von {@link kategorieFuerCode}, und sie wird gebraucht: der
 * Stepper muss einen Status, den der Katalog nicht führt, trotzdem irgendwo
 * einsortieren, und die Kategorie ist alles, was er von ihm weiß.
 *
 * **Gemessen statt deklariert.** Bis v4.86 stand am Verfahrensschritt eine
 * `kategorieVorgabe`, und diese Funktion las sie ab. Sie ist entfallen; die
 * Antwort entsteht jetzt aus dem, was wirklich zutrifft — welche Codes hängen an
 * dieser Phase, und welche Arbeitsliste tragen sie. Das ist auch dann richtig,
 * wenn eine Phase Codes mehrerer Arbeitslisten bündelt (Fassung 23 tut das:
 * „In Prüfung" trägt `offen`, `nachforderung` und `in_pruefung`) — eine einzelne
 * Vorgabe konnte davon immer nur eine nennen.
 *
 * Leer, wenn keine Phase des Schnitts Codes dieser Arbeitsliste führt.
 */
export function phasenFuerKategorie(kategorie: StatusCategory): readonly ZahPhaseId[] {
  const treffer = new Set<ZahPhaseId>();
  for (const [code, phase] of geltenderSchnitt().codeZuPhase) {
    if (kategorieFuerCode(code) === kategorie) treffer.add(phase);
  }
  return zahPhasenVon().filter(p => treffer.has(p.id)).map(p => p.id);
}

/** Ein Paar (normalisierter Rohtext → Kategorie), wie die Fassade es erwartet. */
export type KategorieEintrag = readonly [string, StatusCategory];

/**
 * **Alle** Schreibweisen der Förder-Domäne → Kategorie, in Code-Reihenfolge:
 * amtlicher Text zuerst, dann die gepflegten Varianten. Speist die
 * Nachschlage-Map der Fassade.
 *
 * Erster gewinnt (wie `baueStatusCodeIndex`) — eine Variante, die schon einem
 * anderen Code gehört, überschreibt ihn nicht still.
 */
export function baueFoerderKategorieEintraege(
  katalog: readonly StatusCodeEintrag[] = STATUS_CODE_KATALOG,
): readonly KategorieEintrag[] {
  const out: KategorieEintrag[] = [];
  const gesehen = new Set<string>();
  for (const e of katalog) {
    const kategorie = kategorieFuerCode(e.code);
    for (const schreibweise of [e.text, ...e.varianten]) {
      const key = normKey(schreibweise);
      if (!key || gesehen.has(key)) continue;
      gesehen.add(key);
      out.push([key, kategorie]);
    }
  }
  return out;
}

/**
 * **Eine Zeile je Code** (nur der amtliche Text) → Kategorie. Speist den
 * Katalog-Seed.
 *
 * Warum nicht dieselbe Liste wie oben: jede Variante als eigener
 * `StatusWertEintrag` wäre eine kuratierbare Doppelzeile — zwei Schreibweisen
 * desselben Codes könnten verschiedene ZAH-Phasen bekommen, und das wäre die
 * zweite Wahrheit, gegen die dieses Modul geschrieben ist. Die Varianten stehen
 * am Eintrag (`varianten`), und `snapshot.ts` zieht sie beim Bau der
 * Nachschlage-Map mit — so decken sich beide Wege trotzdem (`byte-identitaet`).
 */
export function baueFoerderSeedEintraege(
  katalog: readonly StatusCodeEintrag[] = STATUS_CODE_KATALOG,
): readonly KategorieEintrag[] {
  const out: KategorieEintrag[] = [];
  const gesehen = new Set<string>();
  for (const e of katalog) {
    const key = normKey(e.text);
    if (!key || gesehen.has(key)) continue;
    gesehen.add(key);
    out.push([key, kategorieFuerCode(e.code)]);
  }
  return out;
}

/** Amtlicher Code eines Rohtexts; `null`, wenn der Katalog ihn nicht kennt. */
export function codeFuerStatusText(text: unknown): number | null {
  return findeStatusCode(text)?.eintrag.code ?? null;
}

/**
 * ZAH-Phase eines Rohtexts nach dem **geltenden** Schnitt. `null` heißt
 * **beides**: Marker (bewusst ohne Phase) oder nicht im Katalog. Wer die beiden
 * unterscheiden muss, fragt zusätzlich `codeFuerStatusText` — die
 * Status-Erklärung tut genau das.
 *
 * Anders als `kategorieFuerCode` liest das den Snapshot: die Funktion läuft je
 * Interaktion (Verfahrensleiste, Filter), nicht beim Modul-Laden, und ein
 * umgehängter Code muss hier ankommen.
 */
export function zahPhaseFuerStatusText(text: unknown): ZahPhaseId | null {
  const code = codeFuerStatusText(text);
  return code === null ? null : phaseFuerCode(code);
}
