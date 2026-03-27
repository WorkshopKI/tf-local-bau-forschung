import MiniSearch from 'minisearch';

export interface SearchDoc {
  id: string;
  text: string;
  title: string;
  source: string;
  tags: string[];
  type: string;
}

export interface SearchResult {
  id: string;
  text: string;
  title: string;
  source: string;
  tags: string[];
  type: string;
  score: number;
}

export class FulltextSearch {
  private index: MiniSearch<SearchDoc>;

  constructor() {
    this.index = new MiniSearch<SearchDoc>({
      fields: ['text', 'title'],
      storeFields: ['text', 'source', 'tags', 'type', 'title'],
      searchOptions: {
        fuzzy: 0.2,
        prefix: true,
      },
    });
  }

  addDocument(doc: SearchDoc): void {
    if (this.index.has(doc.id)) {
      this.index.replace(doc);
    } else {
      this.index.add(doc);
    }
  }

  removeDocument(id: string): void {
    if (this.index.has(id)) {
      this.index.discard(id);
    }
  }

  search(query: string, filters?: { type?: string }): SearchResult[] {
    if (!query.trim()) return [];
    const results = this.index.search(query);
    return results
      .filter(r => !filters?.type || r.type === filters.type)
      .map(r => ({
        id: r.id,
        text: (r.text as string) ?? '',
        title: (r.title as string) ?? '',
        source: (r.source as string) ?? '',
        tags: (r.tags as string[]) ?? [],
        type: (r.type as string) ?? '',
        score: r.score,
      }));
  }

  exportIndex(): string {
    return JSON.stringify(this.index.toJSON());
  }

  importIndex(json: string): void {
    this.index = MiniSearch.loadJSON<SearchDoc>(json, {
      fields: ['text', 'title'],
      storeFields: ['text', 'source', 'tags', 'type', 'title'],
      searchOptions: {
        fuzzy: 0.2,
        prefix: true,
      },
    });
  }

  getDocumentCount(): number {
    return this.index.documentCount;
  }
}
