/**
 * Der **rohe** Status-Wert, wie er aus dem CSV-Export kommt — keine Aufzählung.
 *
 * Bis v2.395 stand hier eine Snake-Case-Union (`neu` | `in_pruefung` |
 * `genehmigt` | …). Sie stammte aus der mit v2.88 entfernten Bauantrag-Demo und
 * war für Förderdaten schon damals unwahr: `dashboardAggregate` castete den
 * amtlichen CSV-Wert hinein, und alle Konsumenten (`tallyStatus`,
 * `kanbanLanes`, `naechsterSchritt`, `getStatusLabel`) fragen ihn ohnehin über
 * `getStatusCategory` ab. Die Union hat nichts verhindert, nur behauptet.
 *
 * **Nicht gegen ein Literal vergleichen** — Kategorie-Helper aus
 * `core/utils/status-canonical.ts` nutzen (Pitfall #12).
 */
export type VorgangStatus = string;

/**
 * Generische „Vorgang"-Shape für die Home-Dashboard-Aggregation — das
 * Projektions-Shape, auf das Förderanträge im Home-Dashboard abgebildet werden
 * (siehe `AntragVorgang` in `plugins/home/dashboardAggregate.ts`). Kein
 * eigenständiger IDB-Store.
 */
export interface Vorgang {
  id: string;
  title: string;
  status: VorgangStatus;
  priority: 'niedrig' | 'normal' | 'hoch' | 'dringend';
  assignee: string;
  created: string;
  modified: string;
  deadline?: string;
  tags: string[];
  notes: string;
}
