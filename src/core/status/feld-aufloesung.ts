/**
 * Auflösung der Katalog-Felder gegen die Programm-Schemas — und die eine Regel,
 * aus welchem Record ein Feld gelesen wird.
 *
 * **Warum überhaupt aufgelöst wird**: die Code-Felder des Fachsystems tragen als
 * `feldId` den rohen CSV-Spalten-Code (`D_XTEC`). Unter welchem Key die Spalte
 * im Antrag-Record landet, entscheidet aber das Mapping — kanonisch, custom oder
 * schlicht kleingeschrieben (`resolveFieldKey`). Der Code ist der einzige über
 * Programme hinweg stabile Bezeichner; alles andere wird hier aufgelöst.
 *
 * **Warum Ebene und Herkunft getrennt sind**: die Verbund-Codes (`X`-Präfix)
 * beschreiben den Verbund, stehen aber nicht im Verbund-Record — der führt nur
 * Titel und Status. Sie stehen identisch auf jeder TV-Zeile der CSV. `ebene`
 * sagt also, WORÜBER ein Eintrag spricht, `herkunft`, WO er steht.
 *
 * Rein: keine IDB-, keine SMB-Zugriffe. Die Schemas reicht der Aufrufer herein.
 */
import type { CsvSchema } from '@/core/services/csv/types';
import { resolveFieldKey } from '@/core/services/csv/merger/helpers';
import type { MappingVersion, StatusFeldEintrag } from './typen';

/**
 * Der Schlüssel, unter dem eine CSV-Spalte nachgeschlagen wird.
 *
 * Normalisiert **nur** Unicode-Form, Rand-Leerraum und Groß-/Kleinschreibung —
 * ausdrücklich **keine** Satzzeichen. Im Vokabular des Fachsystems tragen `-`
 * und `_` Bedeutung: `QS` heißt „kaufm. QS erfolgt", `QS-` heißt „kaufm. QS
 * zurück an AB". Das sind zwei Kürzel mit zwei Spalten.
 *
 * Bis v4.82.0 lief die Auflösung über `normCode`, das genau diese Zeichen
 * wegwirft. `D_QS` und `D_QS-` fielen damit auf denselben Schlüssel; der
 * Kollisionsschutz unten warf einen von beiden hinaus, und der Verlierer trug in
 * der ganzen App nie einen Wert — `D_QS` in 7 135 Export-Zeilen, `D_AQ4` in
 * 6 758, `D_VQK` in 3 208, `D_ARQ` in 1 260, `D_ABLQ` in 821. Schlimmer noch:
 * `D_ARQ-` und `D_VQK-` haben gar keine eigene Spalte und griffen über den
 * unscharfen Schlüssel die des Geschwisters ab — fremde Daten unter eigenem
 * Namen.
 *
 * Gebraucht wurde die Unschärfe nur für Groß-/Kleinschreibung (`vb_phase` gegen
 * die Spalte `VB_PHASE`); genau die bleibt. `normCode` selbst ist unverändert —
 * dort, wo Kürzel-SCHREIBWEISEN verglichen werden, ist es richtig.
 */
export function spaltenSchluessel(s: string): string {
  return s.normalize('NFC').trim().toLowerCase();
}

/** Wo ein Feld im Record steht (aufgelöst gegen die Schemas). */
export interface AufgeloestesFeld {
  /** Key im Antrag-/Verbund-Record. */
  recordKey: string;
  /** Key der begleitenden Textspalte, falls gemappt. */
  textKey?: string;
}

export type FeldAufloesung = ReadonlyMap<string, AufgeloestesFeld>;

/** Aus welchem Record gelesen wird — explizit gesetzt oder aus der Ebene abgeleitet. */
export function herkunftVon(feld: StatusFeldEintrag): 'verbund-record' | 'tv-record' {
  return feld.herkunft ?? (feld.ebene === 'verbund' ? 'verbund-record' : 'tv-record');
}

/**
 * Index CSV-Spalte (normalisiert) → Record-Key, Master-Schema zuerst.
 *
 * Exportiert, weil die selbst angelegten Spalten (`core/spalten/aufloesung.ts`)
 * dieselbe Frage stellen — „unter welchem Key steht diese CSV-Spalte im
 * Record?" — nur ohne Katalog-Feldeintrag drumherum. Zwei Indizes liefen bei der
 * ersten Mapping-Feinheit auseinander, und ein Feld, das die eine Seite findet
 * und die andere nicht, ist eine dauerhaft leere Spalte ohne Fehlermeldung.
 */
export function baueSpaltenIndex(schemas: readonly CsvSchema[]): Map<string, string> {
  const geordnet = [...schemas].sort((a, b) => (b.is_master ? 1 : 0) - (a.is_master ? 1 : 0));
  const idx = new Map<string, string>();
  for (const schema of geordnet) {
    for (const [spalte, entry] of Object.entries(schema.column_mapping ?? {})) {
      if (!entry || entry.ignore) continue;
      const key = resolveFieldKey(spalte, entry);
      if (!key) continue;
      const norm = spaltenSchluessel(spalte);
      if (!idx.has(norm)) idx.set(norm, key);
    }
  }
  return idx;
}

/**
 * Löst alle Felder einer Fassung gegen die Schemas auf.
 *
 * Regeln, in dieser Reihenfolge:
 * 1. `quelleKey` gesetzt ⇒ der gewinnt (kanonische Umleitung wie
 *    `verbund_status` → `status` im Verbund-Record).
 * 2. Die `feldId` ist als CSV-Spalte gemappt ⇒ deren Record-Key.
 * 3. Die Spalte `D_<code>` ist gemappt ⇒ deren Record-Key.
 * 4. Sonst ⇒ die `feldId` selbst (kanonische Felder heißen im Record wie sie).
 *
 * **Warum Regel 3** (v4.126): die vier kanonisch angebundenen Kürzel tragen als
 * `feldId` den Record-Key (`VBE` → `vn_eingang_datum`), nicht den Spaltennamen —
 * Regel 2 greift bei ihnen also nie, und Regel 4 unterstellt, das Mapping habe
 * die Spalte kanonisch gelegt. Für `D_AAE`, `D_ABB` und `D_AZ1_1` stimmt das
 * (gemessen in allen drei Programm-Schemas). `D_VBE` liegt in `7737-bgl.json`
 * aber unter `custom: 'eingang_vn_sach'` — der VN-Eingang war dadurch in der
 * ganzen Verlaufs-Schicht dauerhaft leer, bei 5 793 gefüllten Zeilen. Regel 3
 * fragt deshalb zusätzlich nach der Spalte, die zum Kürzel gehört; wo das
 * Mapping kanonisch ist, liefert sie dasselbe wie Regel 4 und ändert nichts.
 *
 * **Kollisionsschutz**: landen zwei Felder **derselben Herkunft** auf demselben
 * Record-Key, gewinnt das kanonische (das ohne `code`) und das andere fällt aus
 * der Auflösung. Sonst zählte dieselbe Spalte zweimal — als Ereignis und als
 * Ableitungs-Beitrag. Das kann passieren, wenn ein Programm eine Code-Spalte
 * kanonisch mappt.
 *
 * **Die Herkunft gehört in den Schlüssel** (v4.82.0): `verbund_status` liest
 * `status` aus dem VERBUND-Record, das kanonische `status` aus dem TV-Record.
 * Derselbe Key, zwei Records, kein Konflikt — trotzdem fiel `verbund_status`
 * heraus. Der Verlaufs-Bestandslauf sucht es namentlich (`feldId ===
 * 'verbund_status'`) und bekam dadurch immer den leeren String.
 *
 * Was **nicht** hierher gehört: zwei verschiedene CSV-Spalten, die das Mapping
 * auf denselben kanonischen Key legt (`D_LZX` und `D_ÄZX` beide auf
 * `bewilligung_ohne_bescheid`, gemessen vier Paare). Dort sind die Werte schon
 * beim Import verschmolzen; die Auflösung kann das nicht rückgängig machen und
 * meldet weiterhin nur eines der beiden Felder.
 */
export function baueFeldAufloesung(
  schemas: readonly CsvSchema[], felder: readonly StatusFeldEintrag[],
): FeldAufloesung {
  const spalten = baueSpaltenIndex(schemas);
  const aufgeloest = new Map<string, AufgeloestesFeld>();
  const besetzt = new Map<string, StatusFeldEintrag>();   // herkunft::recordKey → Gewinner

  const recordKeyVon = (feld: StatusFeldEintrag): string =>
    feld.quelleKey
    ?? spalten.get(spaltenSchluessel(feld.feldId))
    ?? (feld.code !== undefined ? spalten.get(spaltenSchluessel(`D_${feld.code}`)) : undefined)
    ?? feld.feldId;

  for (const feld of felder) {
    const recordKey = recordKeyVon(feld);
    const belegung = `${herkunftVon(feld)}::${recordKey}`;
    const bisher = besetzt.get(belegung);
    if (bisher) {
      // Kanonisch (ohne Code) schlägt Code-Feld; sonst bleibt der erste stehen.
      const neuerGewinnt = bisher.code !== undefined && feld.code === undefined;
      if (!neuerGewinnt) continue;
      aufgeloest.delete(bisher.feldId);
    }
    besetzt.set(belegung, feld);
    const textKey = feld.textSpalte
      ? spalten.get(spaltenSchluessel(feld.textSpalte)) : undefined;
    aufgeloest.set(feld.feldId, { recordKey, ...(textKey ? { textKey } : {}) });
  }
  return aufgeloest;
}

/** Ein gefundener Feldwert samt Herkunft. `tvId` nur bei TV-Ebene. */
export interface FeldVorkommen {
  feld: StatusFeldEintrag;
  wert: string;
  /** Begleitender Texteintrag, falls das Feld einen führt und er gefüllt ist. */
  text?: string;
  tvId?: string;
}

function roh(rec: Record<string, unknown>, key: string): string {
  const v = rec[key];
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  return '';
}

/**
 * Sammelt alle gesetzten Feldwerte eines Verbunds — die **eine** Stelle, an der
 * die Ebene/Herkunft-Regel ausgewertet wird. Ableitung, Cockpit und
 * Historie-Reconcile bauen darauf auf, damit sie nie auseinanderlaufen können.
 *
 * Verbund-Felder, die im TV-Record stehen (die `X`-Codes), liefern **einen**
 * Eintrag ohne `tvId`: der erste Teilvorhaben-Record, der einen Wert trägt. Die
 * Spalte steht auf jeder TV-Zeile mit demselben Inhalt; sie je Teilvorhaben zu
 * melden würde denselben Vorgang vervielfachen.
 */
export function sammleVorkommen(
  felder: readonly StatusFeldEintrag[],
  verbundRecord: Record<string, unknown>,
  antraege: readonly { aktenzeichen: string; record: Record<string, unknown> }[],
  aufloesung?: FeldAufloesung,
): FeldVorkommen[] {
  return sammleVorkommenGeplant(planFuer(felder, aufloesung), verbundRecord, antraege);
}

/** Steht für „ohne Auflösung" — eine WeakMap braucht ein Objekt als Schlüssel. */
const OHNE_AUFLOESUNG: FeldAufloesung = new Map();

/**
 * Der kompilierte Plan, memoisiert über **beide** Eingaben.
 *
 * Wozu: Der Board-Pfad hebt den Plan von Hand aus der Schleife
 * ([vorgangs-quelle.ts](./vorgangs-quelle.ts)); das Cockpit geht über
 * `baueVerbundFelder` je Verbund hinein und kompilierte ihn dadurch rund 7 500
 * mal je Kaltbesuch — dieselben ~550 Felder, jedes Mal neu.
 *
 * WeakMap statt Map, aus demselben Grund wie in
 * [version-index.ts](./version-index.ts): das Cockpit erzeugt bei jedem
 * Tastendruck eine neue Fassung, eine starke Map hielte jeden Zwischenstand für
 * die Sitzung fest.
 *
 * **Über beide Eingaben geschlüsselt, und das ist keine Kosmetik**: dieselbe
 * Spalte liegt je Programm unter einem anderen Record-Key. Ein Plan, der nur an
 * `felder` hinge, wäre im zweiten Programm still falsch (Bug-Klasse 5). Weil
 * jedes Programm seine eigene `aufloesung` mitbringt, kann der Plan hier gar
 * nicht über die Programmgrenze rutschen.
 */
let planCache = new WeakMap<object, WeakMap<object, VorkommenPlan>>();

function planFuer(
  felder: readonly StatusFeldEintrag[], aufloesung?: FeldAufloesung,
): VorkommenPlan {
  const zweiter = aufloesung ?? OHNE_AUFLOESUNG;
  let innen = planCache.get(felder);
  if (!innen) { innen = new WeakMap<object, VorkommenPlan>(); planCache.set(felder, innen); }
  const treffer = innen.get(zweiter);
  if (treffer) return treffer;
  const plan = baueVorkommenPlan(felder, aufloesung);
  innen.set(zweiter, plan);
  return plan;
}

/** Nur für Tests: die Memoisierung leeren (Vorbild `leereVersionIndexCache`). */
export function leereVorkommenPlanCache(): void {
  planCache = new WeakMap<object, WeakMap<object, VorkommenPlan>>();
}

/**
 * Ein Feld, fertig entschieden — die Vorarbeit von {@link sammleVorkommen},
 * herausgezogen aus der Schleife über die Anträge.
 *
 * `art` ist die Verzweigung `ebene` × `herkunftVon`, EINMAL beantwortet statt je
 * Antrag: sie hängt allein am Feldeintrag und gab über 14 000 Sätze hinweg
 * 14 000-mal dieselbe Antwort.
 */
export interface VorkommenSchritt {
  feld: StatusFeldEintrag;
  recordKey: string;
  textKey: string | undefined;
  art: 'verbund-aus-verbund' | 'verbund-aus-tv' | 'tv';
}

/** Die kompilierte Feldliste für {@link sammleVorkommenGeplant}. */
export type VorkommenPlan = readonly VorkommenSchritt[];

/**
 * Kompiliert die Feldliste **einmal** — Reihenfolge exakt wie `felder`, weil sie
 * die Reihenfolge der Vorkommen bestimmt und mehrere Konsumenten `[0]` nehmen.
 */
export function baueVorkommenPlan(
  felder: readonly StatusFeldEintrag[], aufloesung?: FeldAufloesung,
): VorkommenPlan {
  const plan: VorkommenSchritt[] = [];
  for (const feld of felder) {
    const auf = aufloesung?.get(feld.feldId) ?? { recordKey: feld.quelleKey ?? feld.feldId };
    plan.push({
      feld,
      recordKey: auf.recordKey,
      textKey: auf.textKey,
      art: feld.ebene !== 'verbund'
        ? 'tv'
        : (herkunftVon(feld) === 'verbund-record' ? 'verbund-aus-verbund' : 'verbund-aus-tv'),
    });
  }
  return plan;
}

/** Ein Vorkommen bauen — modul-lokal statt Closure je Feld (14 000 × ~550 Stück). */
function vorkommenAusRecord(
  s: VorkommenSchritt, rec: Record<string, unknown>, tvId?: string,
): FeldVorkommen | null {
  const wert = roh(rec, s.recordKey);
  if (!wert) return null;
  const text = s.textKey ? roh(rec, s.textKey) : '';
  // Explizite Zweige statt bedingter Spreads: gleiches Ergebnis, EIN Objekt
  // statt bis zu drei je Treffer.
  if (text) return tvId ? { feld: s.feld, wert, text, tvId } : { feld: s.feld, wert, text };
  return tvId ? { feld: s.feld, wert, tvId } : { feld: s.feld, wert };
}

/**
 * Wie {@link sammleVorkommen}, nur mit vorab kompiliertem Plan — für Aufrufer,
 * die über den ganzen Bestand laufen und den Plan je Programm wiederverwenden.
 */
export function sammleVorkommenGeplant(
  plan: VorkommenPlan,
  verbundRecord: Record<string, unknown>,
  antraege: readonly { aktenzeichen: string; record: Record<string, unknown> }[],
): FeldVorkommen[] {
  const out: FeldVorkommen[] = [];
  for (const s of plan) {
    if (s.art === 'verbund-aus-verbund') {
      const treffer = vorkommenAusRecord(s, verbundRecord);
      if (treffer) out.push(treffer);
      continue;
    }
    if (s.art === 'verbund-aus-tv') {
      for (const a of antraege) {
        const treffer = vorkommenAusRecord(s, a.record);
        if (treffer) { out.push(treffer); break; }   // erster Treffer genügt
      }
      continue;
    }
    // TV-Ebene: je Teilvorhaben ein eigener Eintrag.
    for (const a of antraege) {
      const treffer = vorkommenAusRecord(s, a.record, a.aktenzeichen);
      if (treffer) out.push(treffer);
    }
  }
  return out;
}

/** Bequemlichkeit: Auflösung direkt aus einer Fassung + Schemas. */
export function aufloesungFuer(
  version: MappingVersion, schemas: readonly CsvSchema[],
): FeldAufloesung {
  return baueFeldAufloesung(schemas, version.felder);
}
