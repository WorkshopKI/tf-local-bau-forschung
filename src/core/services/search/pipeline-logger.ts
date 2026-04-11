const PREFIX = '%c[TeamFlow]';
const STYLE = 'color: #1D9E75; font-weight: bold;';
const MOD = 'color: #534AB7; font-weight: 500;';
const RESET = 'color: inherit;';
const WARN_STYLE = 'color: #BA7517; font-weight: bold;';

let enabled = import.meta.env.DEV;

export const pipelineLog = {
  enable: (): void => { enabled = true; },
  disable: (): void => { enabled = false; },
  isEnabled: (): boolean => enabled,

  info: (module: string, message: string, data?: unknown): void => {
    if (!enabled) return;
    if (data !== undefined) {
      console.log(`${PREFIX} %c${module}%c ${message}`, STYLE, MOD, RESET, data);
    } else {
      console.log(`${PREFIX} %c${module}%c ${message}`, STYLE, MOD, RESET);
    }
  },

  warn: (module: string, message: string, data?: unknown): void => {
    if (!enabled) return;
    if (data !== undefined) {
      console.warn(`${PREFIX} %c${module}%c ${message}`, WARN_STYLE, MOD, RESET, data);
    } else {
      console.warn(`${PREFIX} %c${module}%c ${message}`, WARN_STYLE, MOD, RESET);
    }
  },

  searchSummary: (config: {
    query: string;
    embeddingModel: string;
    vectorReady: boolean;
    reRankerActive: boolean; // PHASE 2: Re-Ranker
    stage1Results: number;
    stage2Results?: number;
    totalTimeMs: number;
  }): void => {
    if (!enabled) return;
    console.groupCollapsed(
      `${PREFIX} %cSuche%c "${config.query}" — ${config.totalTimeMs}ms`,
      STYLE, MOD, RESET,
    );
    console.log('Embedding-Modell:', config.embeddingModel);
    console.log('Vektor-Suche:', config.vectorReady ? '\u2705 aktiv' : '\u274c nur BM25');
    console.log('Re-Ranker:', config.reRankerActive ? '\u2705 aktiv' : '\u274c nicht geladen');
    console.log(`Stage 1 (Orama Hybrid): ${config.stage1Results} Ergebnisse`);
    if (config.stage2Results !== undefined) {
      console.log(`Stage 2 (Re-Ranker): ${config.stage1Results} \u2192 ${config.stage2Results} Ergebnisse`);
    }
    console.groupEnd();
  },

  indexSummary: (config: {
    embeddingModel: string;
    metadataLLM: string | null;
    contextualPrefixes: boolean;
    totalDocs: number;
    backend: string;
  }): void => {
    if (!enabled) return;
    console.groupCollapsed(
      `${PREFIX} %cIndexierung%c ${config.totalDocs} Dokumente`,
      STYLE, MOD, RESET,
    );
    console.log('Embedding-Modell:', config.embeddingModel);
    console.log('Metadata-LLM:', config.metadataLLM ?? 'keins (regelbasiert)');
    console.log('Kontextuelle Prefixes:', config.contextualPrefixes ? '\u2705' : '\u274c');
    console.log('Backend:', config.backend);
    console.groupEnd();
  },
};
