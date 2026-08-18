/**
 * Die Nachschlagewerke einer Katalog-Fassung — **einmal je Fassung** gebaut
 * statt einmal je Antrag.
 *
 * Warum es dieses Modul gibt: Wächter, Board und Cockpit bauten dieselben vier
 * Indizes aus `version.felder` / `version.werte` **innerhalb** ihrer Schleife
 * über den Bestand neu auf. Bei ~550 Feldern und ~12 000 Vorgängen sind das
 * Millionen `normalize('NFC')`-Aufrufe je Seitenaufruf; gemessen ~2,5 s allein
 * im Wächter. Die Indizes hängen aber ausschließlich an der Fassung — sie gaben
 * 12 000-mal dieselbe Antwort.
 *
 * **Rein im Sinn dieses Ordners.** Kein IO, keine Uhr, kein beobachtbarer
 * Seiteneffekt: gleiche Eingabe ⇒ gleiche Ausgabe. Der Cache ist eine
 * Memoisierung auf dem Eingabeobjekt, wie {@link ../journal/lesen.ts} sie für
 * die Monatsdateien führt. `baueVersionIndex` bleibt ungecacht exportiert, damit
 * Tests „memoisiert gegen frisch" vergleichen können.
 *
 * **Grenze, ehrlich benannt:** der Wächter unten erkennt einen Austausch der
 * Arrays (`v.felder = [...]`). Wer einen Feld-Eintrag **an Ort und Stelle**
 * verändert, bekommt einen veralteten Index — das entzöge sich allerdings jeder
 * Memoisierung. Fassungen werden nirgends in-place mutiert (`katalog-edit.ts`
 * liefert durchweg neue Objekte); bleibt das so, greift die Grenze nie.
 */
import { normKey } from './normalisierung';
import type { MappingVersion, StatusFeldEintrag, StatusWertEintrag } from './typen';

export interface VersionIndex {
  /**
   * `normKey(code)` → Feld. **Letzter gewinnt** — exakt wie die ersetzte
   * Schleife in `findeOffenePaare`, wo `Map.set` in Feldreihenfolge überschrieb.
   */
  felderNachCode: ReadonlyMap<string, StatusFeldEintrag>;
  /** `feldId` → Feld. Für `vorkommenAus` im Cockpit. */
  felderNachId: ReadonlyMap<string, StatusFeldEintrag>;
  /**
   * Die als `relevant` markierten Feld-Ids.
   *
   * `size === 0` heißt „die Fassung markiert gar nichts", **nicht** „nichts ist
   * relevant" — die Aufrufer verzweigen darauf und betrachten dann alles.
   */
  relevanteFeldIds: ReadonlySet<string>;
  /**
   * `code` → **erster** Werteintrag mit diesem Code, auch wenn er weder
   * `zieltage` noch `zahPhaseId` führt.
   *
   * Bildet `version.werte.find(w => w.code === code)` ab. Das ist wichtig: das
   * Board hängt `?? SEED_CODE_ZU_ZAH_PHASE.get(code) ?? null` an. Läge hier der
   * erste Eintrag MIT `zahPhaseId`, übersprünge man einen früheren ohne — und
   * der Rückfall auf die Auslieferung feuerte nicht mehr.
   */
  ersterWertNachCode: ReadonlyMap<number, StatusWertEintrag>;
  /**
   * `code` → `zieltage`. Nur Einträge mit **numerischem** `zieltage`, erster
   * gewinnt — eine ANDERE Auswahl als {@link ersterWertNachCode}, weil
   * `zieltageFuer` genau so filtert. Beide in eine Map zu legen wäre still falsch.
   */
  zieltageNachCode: ReadonlyMap<number, number>;
}

/** Baut die Indizes. Rein, ungecacht — das Orakel der Äquivalenztests. */
export function baueVersionIndex(version: MappingVersion): VersionIndex {
  const felderNachCode = new Map<string, StatusFeldEintrag>();
  const felderNachId = new Map<string, StatusFeldEintrag>();
  const relevanteFeldIds = new Set<string>();
  for (const f of version.felder) {
    if (f.code) felderNachCode.set(normKey(f.code), f);
    felderNachId.set(f.feldId, f);
    if (f.relevant === true) relevanteFeldIds.add(f.feldId);
  }

  const ersterWertNachCode = new Map<number, StatusWertEintrag>();
  const zieltageNachCode = new Map<number, number>();
  for (const w of version.werte) {
    if (typeof w.code !== 'number') continue;
    if (!ersterWertNachCode.has(w.code)) ersterWertNachCode.set(w.code, w);
    if (typeof w.zieltage === 'number' && !zieltageNachCode.has(w.code)) {
      zieltageNachCode.set(w.code, w.zieltage);
    }
  }

  return { felderNachCode, felderNachId, relevanteFeldIds, ersterWertNachCode, zieltageNachCode };
}

interface CacheEintrag {
  felder: readonly StatusFeldEintrag[];
  werte: readonly StatusWertEintrag[];
  index: VersionIndex;
}

/**
 * WeakMap, nicht Map: das Cockpit erzeugt bei **jedem Tastendruck** eine neue
 * Fassung (`setEntwurf` kopiert, mutiert nie). Eine starke Map hielte einen
 * Index je Tastendruck für die ganze Sitzung fest.
 *
 * Und bewusst nicht auf `version.version` geschlüsselt: der Entwurf trägt
 * während des Bearbeitens dieselbe Nummer wie die aktive Fassung — der Index
 * würde genau dort schal, wo editiert wird.
 */
let cache = new WeakMap<MappingVersion, CacheEintrag>();

/** Die Indizes der Fassung, memoisiert. Gleiches Objekt rein ⇒ gleiches raus. */
export function versionIndex(version: MappingVersion): VersionIndex {
  const treffer = cache.get(version);
  if (treffer && treffer.felder === version.felder && treffer.werte === version.werte) {
    return treffer.index;
  }
  const index = baueVersionIndex(version);
  cache.set(version, { felder: version.felder, werte: version.werte, index });
  return index;
}

/** Nur für Tests: die Memoisierung leeren (Vorbild `leereJournalCache`). */
export function leereVersionIndexCache(): void {
  // Eine WeakMap kennt kein `clear()` — ein frisches Exemplar tut dasselbe.
  cache = new WeakMap<MappingVersion, CacheEintrag>();
}
