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
 * (die kleine Tabelle unten). Drei Ausnahmen hängen am **Code**, nicht an der
 * Phase, weil die Kategorie feiner schneidet als die Phase:
 * 35–37 sind Nachforderung innerhalb der Vollständigkeit, und 59 ist die
 * Bewilligung selbst, nicht schon Begleitung.
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
 * Die beiden Phasen, an denen die Code-Ausnahmen unten hängen.
 *
 * Sie stehen hier als Konstanten, weil sie **Anker** sind und keine Vorgabe:
 * hängt die PL Code 35 in eine andere Phase, ist er dort keine Nachforderung
 * mehr, sondern das, was die neue Phase vorgibt. Löscht sie die Phase ganz, hat
 * sie den Schnitt bewusst umdefiniert — dann greift die Ausnahme nicht mehr und
 * die Kategorie kommt aus `kategorieVorgabe`. Beides ist getestet
 * (`kategorie-ableitung.test.ts`), damit es keine stille Änderung wird.
 */
const ANKER_NACHFORDERUNG: ZahPhaseId = 'vollstaendigkeit';
const ANKER_BEWILLIGUNG: ZahPhaseId = 'begleitung';

/**
 * Codes der Phase „Vollständigkeit", die fachlich **Nachforderung** sind:
 * 35 NF gestellt, 36 NL eingegangen, 37 keine weiteren NF. Die Kategorie
 * schneidet hier feiner als die Phase — alle drei gehören zum
 * Nachforderungs-Zyklus, 33 (unvollständig) und 34 (bearbeitungsreif) nicht.
 */
export const NACHFORDERUNG_CODES: ReadonlySet<number> = new Set([35, 36, 37]);

/**
 * Code 59 „bewilligt" ist die positive Entscheidung selbst und liegt trotzdem in
 * der Phase „Begleitung" — die beginnt fachlich mit ihr. Die Kategorie muss den
 * Unterschied halten, weil `isBewilligtStatus` daran hängt.
 */
export const BEWILLIGT_CODE = 59;

/**
 * Kategorie aus **Phase und Code**. `null` als Phase heißt Marker — bewusst ohne
 * Phase, also `sonstige`.
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
  if (!phase) return 'sonstige';
  if (phase === ANKER_NACHFORDERUNG && NACHFORDERUNG_CODES.has(code)) return 'nachforderung';
  if (phase === ANKER_BEWILLIGUNG && code === BEWILLIGT_CODE) return 'bewilligt';
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
