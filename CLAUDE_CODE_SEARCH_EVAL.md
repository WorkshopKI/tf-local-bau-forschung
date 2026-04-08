# Prompt: Automatisierter Search-Eval mit Dashboard

```
Lies CLAUDE.md und DESIGN_GUIDE.md.

Baue ein automatisiertes Evaluierungs-System für die Hybrid-Suche.
Der Admin klickt einen Button, alle Testfälle laufen durch, Ergebnisse
werden in einem Mini-Dashboard angezeigt und als Datei exportiert.

Das Eval läuft IM BROWSER — es nutzt die gleichen Services (HybridSearch,
EmbeddingService) wie die echte Suche. Kein separates Script nötig.

═══════════════════════════════════════════════════
TEIL 1: Testfälle definieren
═══════════════════════════════════════════════════

Erstelle src/core/services/search/eval/test-cases.ts:

export interface SearchTestCase {
  id: string;
  query: string;
  category: 'keyword' | 'semantic' | 'hybrid';
  difficulty: 'easy' | 'medium' | 'hard';
  description: string;        // Was der Test prüft (deutsch)
  expectedDocs: string[];     // Dateinamen die in Top-5 sein sollten
  expectedTop1?: string;      // Optionaler exakter Top-1 Match
}

export const searchTestCases: SearchTestCase[] = [
  // === KEYWORD TESTS (sollten immer funktionieren) ===
  {
    id: 'K1', query: 'Brandschutz', category: 'keyword', difficulty: 'easy',
    description: 'Exakter Keyword-Match auf Brandschutz-Dokumente',
    expectedDocs: ['Brandschutz_BA013.md', 'Brandschutz_BA006.md', 'Brandschutz_BA018.md', 'Brandschutz_BA002.md', 'Brandschutz_BA012.md'],
  },
  {
    id: 'K2', query: 'Tiefgarage', category: 'keyword', difficulty: 'easy',
    description: 'Keyword findet Tiefgarage-Dokumente und Vorgang',
    expectedDocs: ['Statik_Tragwerk_BA010.md', 'Hydrogeologie_BA010.md'],
  },
  {
    id: 'K3', query: 'Perowskit', category: 'keyword', difficulty: 'easy',
    description: 'Spezieller Fachbegriff findet Forschungsprojekt',
    expectedDocs: ['Projekt_FA002.md'],
    expectedTop1: 'Projekt_FA002.md',
  },
  {
    id: 'K4', query: 'Holzrahmenbau', category: 'keyword', difficulty: 'easy',
    description: 'Baufachbegriff findet relevante Statik/Formular-Dokumente',
    expectedDocs: ['Statik_Tragwerk_BA011.md', 'Bauantragsformular_BA012.md'],
  },
  {
    id: 'K5', query: 'Nachforderung', category: 'keyword', difficulty: 'easy',
    description: 'Verwaltungsbegriff findet Nachforderungsschreiben',
    expectedDocs: ['Nachforderung_BA004.md', 'Nachforderung_BA017.md'],
  },

  // === SEMANTISCHE TESTS (Umgangssprache → Fachtext) ===
  {
    id: 'S1', query: 'Wie evakuiert man Kleinkinder?', category: 'semantic', difficulty: 'hard',
    description: 'Umgangssprache soll Kita-Brandschutzkonzept finden',
    expectedDocs: ['Brandschutz_BA012.md', 'Brandschutz_BA018.md'],
    expectedTop1: 'Brandschutz_BA012.md',
  },
  {
    id: 'S2', query: 'Gebäude Energie sparen', category: 'semantic', difficulty: 'medium',
    description: 'Paraphrase soll Energienachweise finden',
    expectedDocs: ['Energienachweis_BA001.md', 'Energienachweis_BA002.md', 'Energienachweis_BA009.md'],
  },
  {
    id: 'S3', query: 'Nachbar klagt wegen Schatten', category: 'semantic', difficulty: 'hard',
    description: 'Umgangssprache soll Nachbar-Stellungnahme finden',
    expectedDocs: ['Stellungnahme_Nachbar_BA002.md'],
    expectedTop1: 'Stellungnahme_Nachbar_BA002.md',
  },
  {
    id: 'S4', query: 'Gift im Boden', category: 'semantic', difficulty: 'medium',
    description: 'Umgangssprache "Gift" soll Altlastengutachten (PAK) finden',
    expectedDocs: ['Altlastengutachten_BA006.md'],
    expectedTop1: 'Altlastengutachten_BA006.md',
  },
  {
    id: 'S5', query: 'altes Haus renovieren', category: 'semantic', difficulty: 'hard',
    description: 'Umgangssprache soll Denkmalschutz/Fachwerk-Dokumente finden',
    expectedDocs: ['Stellungnahme_Denkmalschutz_BA005.md', 'Stellungnahme_Denkmalschutz_BA021.md'],
  },
  {
    id: 'S6', query: 'Grundwasser Baugrube', category: 'semantic', difficulty: 'easy',
    description: 'Fachbegriff-Kombination soll Hydrogeologie-Gutachten finden',
    expectedDocs: ['Hydrogeologie_BA010.md', 'Statik_Tragwerk_BA010.md'],
    expectedTop1: 'Hydrogeologie_BA010.md',
  },
  {
    id: 'S7', query: 'Künstliche Intelligenz Infrastruktur', category: 'semantic', difficulty: 'medium',
    description: 'Übergreifende Begriffe sollen KI-Forschungsprojekte finden',
    expectedDocs: ['Projekt_FA001.md', 'Projekt_FA011.md', 'Projekt_FA014.md'],
  },
  {
    id: 'S8', query: 'Tierversuche Ethik', category: 'semantic', difficulty: 'medium',
    description: 'Ethik-Begriffe sollen Tierversuch-Ethikantrag finden',
    expectedDocs: ['Ethik_FA003.md', 'Review_FA003.md'],
    expectedTop1: 'Ethik_FA003.md',
  },
  {
    id: 'S9', query: 'Datenschutz bei KI', category: 'semantic', difficulty: 'medium',
    description: 'Soll Datenschutzkonzept für Verwaltungsautomation finden',
    expectedDocs: ['Datenschutz_FA014.md', 'Projekt_FA014.md'],
    expectedTop1: 'Datenschutz_FA014.md',
  },
  {
    id: 'S10', query: 'Batterie Recycling', category: 'semantic', difficulty: 'medium',
    description: 'Synonym soll Bioleaching-Projekt (Altbatterien) finden',
    expectedDocs: ['Projekt_FA009.md', 'Compliance_FA009.md'],
    expectedTop1: 'Projekt_FA009.md',
  },
  {
    id: 'S11', query: 'Brücke für Fahrräder', category: 'semantic', difficulty: 'medium',
    description: 'Umgangssprache soll Radschnellweg-Brücke finden',
    expectedDocs: ['Statik_Tragwerk_BA024.md', 'Bauantragsformular_BA024.md'],
  },
  {
    id: 'S12', query: 'Senioren Wohnung barrierefrei', category: 'semantic', difficulty: 'medium',
    description: 'Soll Seniorenwohnanlage-Dokumente finden',
    expectedDocs: ['Bauantragsformular_BA018.md', 'Brandschutz_BA018.md'],
  },
  {
    id: 'S13', query: 'Feuerwiderstand Rettungswege', category: 'semantic', difficulty: 'easy',
    description: 'Brandschutz-Fachbegriffe sollen Brandschutz-Dokumente finden',
    expectedDocs: ['Brandschutz_BA002.md', 'Brandschutz_BA012.md', 'Brandschutz_BA018.md'],
  },
  {
    id: 'S14', query: 'Wärmedämmung Außenwand', category: 'semantic', difficulty: 'easy',
    description: 'Energiefachbegriffe sollen Energienachweise finden',
    expectedDocs: ['Energienachweis_BA001.md', 'Energienachweis_BA002.md'],
  },
  {
    id: 'S15', query: 'Fördergelder Nachhaltigkeit', category: 'semantic', difficulty: 'hard',
    description: 'Überbegriff soll Forschungsprojekte zu Klima/Energie finden',
    expectedDocs: ['Projekt_FA009.md', 'Projekt_FA013.md', 'Projekt_FA016.md'],
  },
];

═══════════════════════════════════════════════════
TEIL 2: Eval Runner
═══════════════════════════════════════════════════

Erstelle src/core/services/search/eval/eval-runner.ts:

import type { HybridSearch, HybridResult } from '../hybrid-search';
import type { SearchTestCase } from './test-cases';
import { searchTestCases } from './test-cases';

export interface TestCaseResult {
  testCase: SearchTestCase;
  results: HybridResult[];          // Top-10 Ergebnisse
  top1Match: boolean;               // expectedTop1 === results[0]?
  expectedInTop3: string[];         // Welche expected docs in Top 3?
  expectedInTop5: string[];         // Welche expected docs in Top 5?
  expectedInTop10: string[];        // Welche expected docs in Top 10?
  precision3: number;               // expectedInTop3.length / expectedDocs.length
  precision5: number;               // expectedInTop5.length / expectedDocs.length
  pass: boolean;                    // Mindestens 1 expected doc in Top 5
}

export interface EvalReport {
  timestamp: string;
  model: string;                    // z.B. 'Xenova/all-MiniLM-L6-v2'
  totalChunks: number;
  totalDocs: number;
  duration: number;                 // ms
  results: TestCaseResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    avgPrecision3: number;
    avgPrecision5: number;
    top1Accuracy: number;           // Anteil korrekter Top-1 (nur wo expectedTop1 definiert)
    byCategory: Record<string, { total: number; passed: number }>;
    byDifficulty: Record<string, { total: number; passed: number }>;
  };
}

export class EvalRunner {
  constructor(private search: HybridSearch) {}

  async run(
    onProgress?: (current: number, total: number, query: string) => void,
  ): Promise<EvalReport> {
    const startTime = Date.now();
    const results: TestCaseResult[] = [];

    for (let i = 0; i < searchTestCases.length; i++) {
      const tc = searchTestCases[i]!;
      onProgress?.(i + 1, searchTestCases.length, tc.query);

      const searchResults = await this.search.search(tc.query);
      const top10 = searchResults.slice(0, 10);

      // Matching: Prüfe ob Dateiname im source/title des Results vorkommt
      const matchesInTopN = (n: number): string[] => {
        const topN = top10.slice(0, n);
        return tc.expectedDocs.filter(expected =>
          topN.some(r =>
            r.title.includes(expected) ||
            r.source.includes(expected) ||
            r.id.includes(expected)
          )
        );
      };

      const top1Source = top10[0]?.source ?? top10[0]?.title ?? '';
      const top1Match = tc.expectedTop1
        ? top1Source.includes(tc.expectedTop1)
        : false;

      const expectedInTop3 = matchesInTopN(3);
      const expectedInTop5 = matchesInTopN(5);
      const expectedInTop10 = matchesInTopN(10);

      results.push({
        testCase: tc,
        results: top10,
        top1Match,
        expectedInTop3,
        expectedInTop5,
        expectedInTop10,
        precision3: tc.expectedDocs.length > 0 ? expectedInTop3.length / tc.expectedDocs.length : 0,
        precision5: tc.expectedDocs.length > 0 ? expectedInTop5.length / tc.expectedDocs.length : 0,
        pass: expectedInTop5.length > 0,
      });

      // Micro-yield für UI
      await new Promise(r => setTimeout(r, 0));
    }

    const duration = Date.now() - startTime;
    const passed = results.filter(r => r.pass).length;
    const top1Cases = results.filter(r => r.testCase.expectedTop1);

    // By category
    const byCategory: Record<string, { total: number; passed: number }> = {};
    const byDifficulty: Record<string, { total: number; passed: number }> = {};
    for (const r of results) {
      const cat = r.testCase.category;
      if (!byCategory[cat]) byCategory[cat] = { total: 0, passed: 0 };
      byCategory[cat]!.total++;
      if (r.pass) byCategory[cat]!.passed++;

      const diff = r.testCase.difficulty;
      if (!byDifficulty[diff]) byDifficulty[diff] = { total: 0, passed: 0 };
      byDifficulty[diff]!.total++;
      if (r.pass) byDifficulty[diff]!.passed++;
    }

    return {
      timestamp: new Date().toISOString(),
      model: 'Xenova/all-MiniLM-L6-v2',  // TODO: aus Config lesen
      totalChunks: 0,  // wird von der UI gesetzt
      totalDocs: 0,
      duration,
      results,
      summary: {
        total: results.length,
        passed,
        failed: results.length - passed,
        avgPrecision3: results.reduce((s, r) => s + r.precision3, 0) / results.length,
        avgPrecision5: results.reduce((s, r) => s + r.precision5, 0) / results.length,
        top1Accuracy: top1Cases.length > 0
          ? top1Cases.filter(r => r.top1Match).length / top1Cases.length
          : 0,
        byCategory,
        byDifficulty,
      },
    };
  }
}

═══════════════════════════════════════════════════
TEIL 3: Export als Markdown + JSON
═══════════════════════════════════════════════════

Erstelle src/core/services/search/eval/eval-export.ts:

export function evalToMarkdown(report: EvalReport): string {
  Generiere einen Markdown-Report im Format:

  # Search Eval Report
  
  **Datum**: ...
  **Modell**: ...
  **Chunks**: ... | **Dokumente**: ...
  **Dauer**: ... ms

  ## Zusammenfassung

  | Metrik | Wert |
  |---|---|
  | Bestanden | X/20 (Y%) |
  | Avg Precision@3 | Z% |
  | Avg Precision@5 | Z% |
  | Top-1 Accuracy | Z% |

  ## Nach Kategorie
  | Kategorie | Bestanden |
  |---|---|
  | keyword | X/5 |
  | semantic | X/15 |

  ## Nach Schwierigkeit
  | Schwierigkeit | Bestanden |
  |---|---|
  | easy | X/Y |
  | medium | X/Y |
  | hard | X/Y |

  ## Einzelergebnisse
  | # | Query | Erwartet | Top-1 | Top-1✓ | In Top3 | In Top5 | Pass |
  |---|---|---|---|---|---|---|---|
  | K1 | Brandschutz | 5 docs | Brandschutz_BA013 | ✅ | 3/5 | 5/5 | ✅ |
  | S1 | Wie evakuiert man... | 2 docs | Compliance_FA011 | ❌ | 0/2 | 1/2 | ⚠️ |
  ...

  ## Fehlgeschlagene Tests (Details)
  Für jeden fehlgeschlagenen Test: Query, erwartete Docs, tatsächliche Top-5
}

export function evalToJSON(report: EvalReport): string {
  return JSON.stringify(report, null, 2);
}

═══════════════════════════════════════════════════
TEIL 4: Eval Dashboard in Admin-UI
═══════════════════════════════════════════════════

Erstelle src/plugins/admin/EvalDashboard.tsx:

Neuer Abschnitt in IndexManager.tsx ODER als eigene Komponente die in
IndexManager eingebettet wird.

4a. Trigger:
  SectionHeader "Suche Evaluierung"
  Info-Text: "Testet 20 Queries gegen den aktuellen Index (5 Keyword + 15 Semantisch)"
  [Eval starten] Button (Secondary)
  Disabled wenn Chunks === 0 (kein Index vorhanden)

4b. Während Eval läuft:
  Fortschrittsbalken: "Query 7/20 — Tierversuche Ethik"
  Dauer-Zähler live

4c. Ergebnis-Dashboard (nach Abschluss):

  Obere Zeile — 4 Metric Cards:
  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
  │ 17/20    │ │ 62%      │ │ 78%      │ │ 71%      │
  │ Bestanden│ │ P@3      │ │ P@5      │ │ Top-1    │
  └──────────┘ └──────────┘ └──────────┘ └──────────┘

  Mittlere Zeile — Kategorie + Schwierigkeit:
  ┌─ Nach Kategorie ──────┐  ┌─ Nach Schwierigkeit ──┐
  │ keyword:  5/5 ███████ │  │ easy:   7/7 ████████  │
  │ semantic: 12/15 █████ │  │ medium: 8/9 ███████   │
  └───────────────────────┘  │ hard:   2/4 ████      │
                             └─────────────────────────┘

  Fortschrittsbalken: Dünn, monochrom (var(--tf-text) fill, var(--tf-bg-secondary) track)
  Prozent-Zahl rechts neben dem Balken

  Untere Zeile — Einzelergebnisse-Tabelle:
  Jede Zeile: ID | Query (truncated) | Top-1 Ergebnis | ✅/❌ | Score

  Farb-Kodierung der Zeilen:
  - ✅ Pass: Normal
  - ❌ Fail: Dezenter roter Hintergrund (var(--tf-danger-bg))

  Klick auf eine Zeile: Expandiert und zeigt Top-5 Ergebnisse + erwartete Docs

4d. Export-Buttons (unter der Tabelle):
  [↓ Markdown] → Generiert MD via evalToMarkdown, downloadet als EVAL_REPORT.md
  [↓ JSON] → Generiert JSON via evalToJSON, downloadet als eval_report.json
  [Auf GitHub pushen] → Speichert in IDB unter 'eval-reports' Array
    (eigentliches Git-Push macht Claude Code separat)

4e. Historie (optional aber nützlich):
  Dropdown "Vorherige Evaluierungen" — lädt gespeicherte Reports aus IDB
  Vergleich: Wenn ein vorheriger Report existiert, zeige Delta:
    "Bestanden: 17/20 (+2 seit letztem Eval)"
    Grüner/Roter Pfeil bei verbessertem/verschlechtertem Score

═══════════════════════════════════════════════════
TEIL 5: Eval-Report Datei automatisch speichern
═══════════════════════════════════════════════════

Nach jedem Eval-Lauf:
- Speichere Report in IDB: await storage.idb.set('eval-latest', report)
- Speichere in Historie: eval-history Array (max 20 Einträge, älteste raus)
- Generiere EVAL_REPORT.md im Root des Projekts (wenn File Server connected):
  await storage.fs.writeFile('EVAL_REPORT.md', evalToMarkdown(report))

═══════════════════════════════════════════════════
TEIL 6: Modell-Name aus Config lesen
═══════════════════════════════════════════════════

Der Report soll das verwendete Embedding-Modell dokumentieren.
In embedding-service.ts: Exportiere den Modellnamen als Konstante:
  export const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';

Im EvalRunner: Importiere und nutze diesen Namen.
So wird beim Modellwechsel automatisch der richtige Name im Report stehen.

═══════════════════════════════════════════════════
TEST
═══════════════════════════════════════════════════

1. npm run dev → Chrome → localhost:5173
2. Admin → Testdaten müssen vorhanden sein (60 Docs)
3. Admin → Index muss existieren (460 Chunks)
4. Admin → Suche Evaluierung → [Eval starten]
5. Fortschritt: "Query 1/20 — Brandschutz" ... "Query 20/20 — Fördergelder..."
6. Dashboard erscheint:
   - 4 Metric Cards mit Zahlen
   - Kategorie-Balken (keyword vs semantic)
   - Schwierigkeit-Balken (easy/medium/hard)
   - Einzelergebnis-Tabelle mit ✅/❌
7. Klick auf fehlgeschlagenen Test → Details aufklappen
8. [↓ Markdown] → EVAL_REPORT.md wird heruntergeladen
9. [↓ JSON] → eval_report.json wird heruntergeladen
10. Report-Inhalt prüfen: Alle 20 Tests mit Ergebnissen dokumentiert
11. Console: Keine Errors

Committe und pushe: "feat: automated search eval system with dashboard, 20 test cases, MD/JSON export"
```
