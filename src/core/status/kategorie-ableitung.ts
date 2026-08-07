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
 * gepflegte Variante) → ZAH-Phase (`zah-phasen.ts`, PL-editierbar) → Kategorie
 * (die kleine Tabelle unten). Sechs Codes hängen am **Code** statt an der Phase
 * ({@link KATEGORIE_ANKER}), weil ihre Arbeitsliste fachlich feststeht, während
 * der Verfahrensschnitt beweglich ist.
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
import { SEED_CODE_ZU_ZAH_PHASE, SEED_ZAH_PHASEN, phaseFuerCode } from './zah-phasen';
import { normKey } from './normalisierung';
import type { ZahPhase, ZahPhaseId } from './typen';
import type { StatusCategory } from '@/core/utils/status-canonical';

/**
 * Codes, deren **Arbeitsliste am Code hängt** statt am Verfahrensschritt.
 *
 * **Warum es diese Tabelle gibt.** Bis v3.24 hingen die beiden Ausnahmen (35,
 * 59) an einer Phasen-Id: „35 ist eine Nachforderung, *wenn* er in der
 * Vollständigkeit liegt". Das las sich wie eine Feinheit und war eine
 * Sollbruchstelle. Die **Katalog-Fassung 19** vom 05.08.2026 löste die Phase
 * „Vollständigkeit" auf und hängte ihre Codes 33–37 an „Prüfung" — ein gewollter
 * Schnitt (fünf statt sechs Phasen), beschlossen in der AB/FB-Abstimmung. Der
 * Anker griff damit ins Leere, und weil `pruefung` die Arbeitsliste
 * `in_pruefung` vorgibt, wanderten vier der fünf Status, an denen die tägliche
 * Arbeit hängt, aus „Zu bearbeiten" und „Wartet auf Antragsteller" heraus.
 *
 * Am Bestand gemessen (14 222 Anträge): **448 Anträge** wechselten die
 * Arbeitsliste, die Lane „Wartet auf Antragsteller" fiel von 52 auf **0**, und
 * der Altanträge-Balken der Auslastung blieb bei 22 von 32 MAs leer (395 → 22
 * gezählte Teilvorhaben). In den Reitern fiel es nicht auf, weil das Aggregat
 * „Vor Entscheidung" `offen`, `in_pruefung` und `entscheidung` bündelt — die
 * Verschiebung lief innerhalb eines Aggregats.
 *
 * Genau davor warnt Pitfall #50: der Verfahrensschritt ist beweglich, die
 * **Arbeitsliste steht still**. `kategorieVorgabe` war das Schlupfloch, durch das
 * eine Phasen-Iteration die Arbeitsliste doch verschieben konnte. Für die sechs
 * Codes, deren Zuständigkeit fachlich feststeht, ist es hiermit zu.
 *
 * **Der Anker greift VOR der Phase** — auch, wenn eine Fassung den Code zum
 * Marker macht. Sonst nähme ein gelöschter Phasenbezug demselben Code seine
 * Arbeitsliste wieder weg, nur auf einem anderen Weg.
 *
 * **Die Werte sind der Ist-Stand, keine Neubewertung**: sie sind identisch mit
 * dem, was die Auslieferung heute liefert (`vollstaendigkeit`→`offen` plus die
 * beiden alten Anker). `CATEGORY_MAP` und damit die Variante ohne Fassung
 * (`prod`) ändern sich dadurch nicht — festgehalten in `byte-identitaet`.
 *
 * Was NICHT hier steht, kuratiert die PL weiter über `kategorieVorgabe` (38/39/40
 * „Prüfung", die Entscheidungs- und Abschluss-Codes). Die Tabelle ist eine
 * Untergrenze für das fachlich Feste, kein Ersatz für den Schnitt.
 */
export const KATEGORIE_ANKER: ReadonlyMap<number, StatusCategory> = new Map<number, StatusCategory>([
  // 33–37: der Vollständigkeits-Zyklus. Nur bei 35 liegt der Ball beim
  // Antragsteller — 36 „NL eingegangen" sagt, die Nachlieferung ist DA, und 37
  // „keine weiteren NF", der Zyklus ist zu. Bei beiden ist wieder die Behörde am
  // Zug, deshalb `offen` und nicht `nachforderung` (v2.411).
  [33, 'offen'],          // unvollständig
  [34, 'offen'],          // bearbeitungsreif
  [35, 'nachforderung'],  // NF gestellt — wartet auf den Antragsteller
  [36, 'offen'],          // NL eingegangen
  [37, 'offen'],          // keine weiteren NF
  // 59 „bewilligt" ist die positive Entscheidung selbst und liegt trotzdem in
  // der Begleitphase — die beginnt fachlich mit ihr. `isBewilligtStatus` hängt
  // an dem Unterschied.
  [59, 'bewilligt'],
]);

/** Die verankerten Codes der Kategorie `nachforderung` — abgeleitete Sicht auf
 *  {@link KATEGORIE_ANKER}, damit es keine zweite Liste gibt. */
export const NACHFORDERUNG_CODES: ReadonlySet<number> = new Set(
  [...KATEGORIE_ANKER].filter(([, kategorie]) => kategorie === 'nachforderung').map(([code]) => code),
);

/** Der Code der positiven Entscheidung. Siehe {@link KATEGORIE_ANKER}. */
export const BEWILLIGT_CODE = 59;

/**
 * Kategorie aus **Phase und Code**. Ein Code aus {@link KATEGORIE_ANKER} bekommt
 * seine Arbeitsliste unabhängig von der Phase; für alle übrigen heißt `null` als
 * Phase Marker — bewusst ohne Phase, also `sonstige`.
 *
 * Die Vorgabe kommt seit v2.409 aus der Phasen-Tabelle (`kategorieVorgabe`)
 * statt aus einer festen Map hier. Hängt die PL einen Code um, folgt die
 * Kategorie von selbst; legt sie eine Phase an, bestimmt sie deren Arbeitsliste
 * mit. Genau das ist die Zusage „umhängen ist eine Katalog-Zeile, kein
 * Deployment".
 *
 * **Die Phasen werden hereingereicht, nicht aus dem Register gelesen.** Ohne
 * Angabe gilt die Auslieferung — das ist der Pfad, über den `CATEGORY_MAP` in
 * `status-canonical.ts` beim Import entsteht, lange vor jedem Snapshot. Nur
 * `snapshot.ts` übergibt die Phasen der Fassung.
 *
 * Fehlt einer Phase die Vorgabe (Fassung vor v2.409), greift der Seed-Eintrag
 * gleicher Id — dieselbe Regel wie in `zahPhasenVon`, nur ohne Allokation.
 *
 * **Verwaiste Zuordnungen behalten ihre Arbeitsliste, obwohl sie „ohne Phase"
 * angezeigt werden.** Das sieht widersprüchlich aus und ist Absicht: Beschriftung
 * und Gruppierung dürfen ehrlich sagen „steht neben dem Verfahren", die
 * Arbeitsliste der ABs darf davon nicht leerlaufen. Fiele ein gelöschter Schritt
 * auf `sonstige` durch, verschwänden mit ihm reihenweise Anträge aus Reitern,
 * Zählern und Kanban — ein stiller Totalausfall statt eines Hinweises. Der
 * Hinweis steht stattdessen im Kopf des Katalog-Tabs (`verwaisteZuordnungen`).
 * Nur eine Id, die auch die Auslieferung nicht kennt, wird `sonstige`.
 */
export function kategorieFuerPhase(
  phase: ZahPhaseId | null,
  code: number,
  phasen: readonly ZahPhase[] = SEED_ZAH_PHASEN,
): StatusCategory {
  const anker = KATEGORIE_ANKER.get(code);
  if (anker) return anker;
  if (!phase) return 'sonstige';
  return phasen.find(p => p.id === phase)?.kategorieVorgabe
    ?? SEED_ZAH_PHASEN.find(p => p.id === phase)?.kategorieVorgabe
    ?? 'sonstige';
}

/**
 * Kategorie eines Status-Codes nach dem **ausgelieferten** Phasen-Schnitt. Codes
 * ohne Phase — die Marker 29/88/93/94 und alles, was die Schnitt-Tabelle nicht
 * führt — sind `sonstige`: sie laufen neben dem Verfahren, nicht darin.
 *
 * Bewusst am Seed und nicht am Register: diese Funktion speist `CATEGORY_MAP`
 * beim Modul-Laden, also den Ohne-Fassung-Pfad, der sich exakt wie zuvor
 * verhalten muss (`byte-identitaet`).
 */
export function kategorieFuerCode(code: number): StatusCategory {
  return kategorieFuerPhase(SEED_CODE_ZU_ZAH_PHASE.get(code) ?? null, code);
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
