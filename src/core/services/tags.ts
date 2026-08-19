import type { StorageService } from '@/core/services/storage';
import { istDokumentTypTag, relationTagAusTags } from '@/core/components/dokumentAufnahmeFkz';

export interface TagEntry {
  name: string;
  color?: string;
  count: number;
}

export class TagService {
  private tags: TagEntry[] = [];

  async loadTags(storage: StorageService): Promise<void> {
    const saved = await storage.idb.get<TagEntry[]>('tag-registry');
    if (saved) this.tags = saved;
  }

  async saveTags(storage: StorageService): Promise<void> {
    await storage.idb.set('tag-registry', this.tags);
    if (storage.fs) {
      try {
        await storage.fs.writeJSON('.teamflow/tags.json', this.tags);
      } catch { /* FS write optional */ }
    }
  }

  addTag(name: string): void {
    const normalized = name.trim().toLowerCase();
    if (!normalized) return;
    if (!this.tags.find(t => t.name === normalized)) {
      this.tags.push({ name: normalized, count: 0 });
    }
  }

  removeTag(name: string): void {
    this.tags = this.tags.filter(t => t.name !== name);
  }

  /**
   * Benennt den Registry-Eintrag um. Der Schwester-Schritt — dieselbe
   * Umbenennung in den Dokumenten — steht in {@link benenneTagInDokumentenUm}
   * und läuft im Provider davor; die Registry allein zu ändern hätte das
   * nächste „Neu zählen" wortlos zurückgedreht.
   *
   * Trägt die Registry den neuen Namen schon, werden die beiden Einträge
   * zusammengeführt (der alte fällt weg) — sonst stünde derselbe Name zweimal
   * in der Liste und die Zählerstände widersprächen sich.
   */
  renameTag(oldName: string, newName: string): void {
    const normalized = newName.trim().toLowerCase();
    if (!normalized || normalized === oldName) return;
    const tag = this.tags.find(t => t.name === oldName);
    if (!tag) return;
    const vorhanden = this.tags.find(t => t.name === normalized);
    if (vorhanden) {
      vorhanden.count += tag.count;
      this.tags = this.tags.filter(t => t !== tag);
      return;
    }
    tag.name = normalized;
  }

  getPopularTags(limit = 10): TagEntry[] {
    return [...this.tags].sort((a, b) => b.count - a.count).slice(0, limit);
  }

  getAllTags(): TagEntry[] {
    return [...this.tags].sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Zählt die Registry gegen die tatsächlich vergebenen Tags neu und nimmt
   * dabei neu entdeckte Schlagwörter auf.
   *
   * `technische` sind die maschinell gesetzten Tags — die Verbund-/Antrags-
   * Kennung, über die `listDocsByFkz` die Dokumente eines Antrags findet, und
   * die Dokumenttypen der Aufnahme. Sie werden weder aufgenommen NOCH behalten:
   * bis v4.116 schwemmte „Neu zählen" sie gleichberechtigt neben echte
   * Schlagwörter, wo sie zum Umbenennen und Löschen angeboten wurden — beides
   * hätte die Zuordnung zwischen Antrag und Dokument zerrissen.
   */
  recountTags(allTags: string[], technische: ReadonlySet<string> = new Set()): void {
    const counts = new Map<string, number>();
    for (const t of allTags) {
      const n = t.trim().toLowerCase();
      counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    this.tags = this.tags.filter(t => !technische.has(t.name));
    for (const tag of this.tags) {
      tag.count = counts.get(tag.name) ?? 0;
    }
    // Add new tags discovered
    for (const [name, count] of counts) {
      if (technische.has(name)) continue;
      if (!this.tags.find(t => t.name === name)) {
        this.tags.push({ name, count });
      }
    }
  }

  suggest(prefix: string, limit = 5): string[] {
    const p = prefix.trim().toLowerCase();
    if (!p) return [];
    return this.tags
      .filter(t => t.name.startsWith(p))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map(t => t.name);
  }
}

/* --------------------------------------------------------------------------
 * Die Tags AN DEN DATENSÄTZEN
 *
 * Die Registry oben ist ein Verzeichnis — die Wahrheit stehen die `doc:`- und
 * (historisch) `vorgang:`-Datensätze selbst. Wer nur das Verzeichnis anfasst,
 * hat nichts geändert: bis v4.116 benannte „Umbenennen" allein den
 * Registry-Eintrag um, das nächste „Neu zählen" holte den alten Namen aus den
 * Dokumenten zurück und stellte den neuen mit 0 Verwendungen daneben.
 * -------------------------------------------------------------------------- */

/** Datensatz, der Tags trägt (Dokument oder Alt-Vorgang). */
interface TagTraeger {
  tags?: unknown;
}

export interface TagBestand {
  /** Alle vergebenen Tag-Namen MIT Wiederholungen — Eingabe für `recountTags`. */
  namen: string[];
  /** Maschinell gesetzte Tags (Verbund-Kennungen + Dokumenttypen), klein geschrieben. */
  technische: Set<string>;
}

function tagsVon(rec: TagTraeger | null | undefined): string[] {
  return Array.isArray(rec?.tags) ? (rec.tags as unknown[]).filter((t): t is string => typeof t === 'string') : [];
}

async function tagSchluessel(storage: StorageService): Promise<string[]> {
  const [vorgaenge, dokumente] = await Promise.all([
    storage.idb.keys('vorgang:'),
    storage.idb.keys('doc:'),
  ]);
  return [...vorgaenge, ...dokumente];
}

/**
 * Liest alle vergebenen Tags aus den Datensätzen — und trennt dabei die
 * maschinell gesetzten heraus (siehe `relationTagAusTags`).
 */
export async function leseTagBestand(storage: StorageService): Promise<TagBestand> {
  const namen: string[] = [];
  const technische = new Set<string>();
  for (const key of await tagSchluessel(storage)) {
    const tags = tagsVon(await storage.idb.get<TagTraeger>(key));
    if (tags.length === 0) continue;
    namen.push(...tags);
    const relation = relationTagAusTags(tags);
    if (relation) technische.add(relation.trim().toLowerCase());
    for (const t of tags) if (istDokumentTypTag(t)) technische.add(t.trim().toLowerCase());
  }
  return { namen, technische };
}

/**
 * Benennt einen Tag in ALLEN Datensätzen um. Gibt zurück, wie viele
 * Datensätze angefasst wurden.
 *
 * Vergleich klein geschrieben, weil die Registry normalisiert und die
 * Datensätze die Schreibweise der Eingabe tragen („ZKN103113" gegen
 * „zkn103113"). Trägt ein Datensatz den neuen Namen bereits, bleibt er einmal
 * stehen statt doppelt.
 */
export async function benenneTagInDokumentenUm(
  storage: StorageService,
  altRoh: string,
  neuRoh: string,
): Promise<number> {
  const alt = altRoh.trim().toLowerCase();
  const neu = neuRoh.trim().toLowerCase();
  if (!alt || !neu || alt === neu) return 0;

  let geaendert = 0;
  for (const key of await tagSchluessel(storage)) {
    const rec = await storage.idb.get<TagTraeger & Record<string, unknown>>(key);
    const tags = tagsVon(rec);
    if (!tags.some(t => t.trim().toLowerCase() === alt)) continue;
    const naechste: string[] = [];
    for (const t of tags) {
      const wert = t.trim().toLowerCase() === alt ? neu : t;
      if (!naechste.some(v => v.trim().toLowerCase() === wert.trim().toLowerCase())) naechste.push(wert);
    }
    await storage.idb.set(key, { ...rec, tags: naechste });
    geaendert += 1;
  }
  return geaendert;
}
