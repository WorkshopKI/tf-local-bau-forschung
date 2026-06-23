/**
 * markdownLivePreview — Obsidian-style "Live Preview" decoration layer for CodeMirror 6.
 *
 * Sits on top of the existing `@codemirror/lang-markdown` language. The editor buffer stays
 * RAW Markdown (ground-truth, no serialize-roundtrip); this only adds a styling + conceal
 * decoration layer:
 *   - StrongEmphasis / Emphasis / ATXHeading{1..6} get a styling `mark` (see theme below).
 *   - The marker tokens (`**`, `*`, `#`) are HIDDEN via `Decoration.replace({})` on inactive
 *     lines, and REVEALED on the line(s) the cursor/selection touches so they stay editable.
 *
 * The conceal logic lives in the pure, exported {@link computeLivePreviewRanges} so it can be
 * unit-tested in a `node` environment (no DOM / no `EditorView`).
 */
import { syntaxTree } from '@codemirror/language';
import type { EditorState, Extension, Range } from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view';

// Decoration constants — created once, reused via `.range(from, to)`.
const STRONG_MARK = Decoration.mark({ class: 'cm-md-strong' });
const EM_MARK = Decoration.mark({ class: 'cm-md-em' });
const HEADING_MARK = [1, 2, 3, 4, 5, 6].map(n => Decoration.mark({ class: `cm-md-h${n}` }));
const HIDE = Decoration.replace({}); // empty spec => conceal the range (atomic-compatible)

const ATX_PREFIX = 'ATXHeading';

export interface LivePreviewRanges {
  /** Styling marks (cm-md-strong / cm-md-em / cm-md-h{n}) over container nodes. */
  marks: Range<Decoration>[];
  /** Concealed marker spans (the `**`/`*`/`#` tokens hidden on inactive lines). */
  replaces: Range<Decoration>[];
}

/**
 * Walk the markdown syntax tree over the given scan ranges and produce the styling + conceal
 * decoration ranges. Pure: depends only on `state` (doc + selection + syntax tree).
 *
 * Markers inside the "active band" — the line(s) touched by the primary selection — are NOT
 * concealed (so they remain visible and editable); their container's styling mark stays active.
 */
export function computeLivePreviewRanges(
  state: EditorState,
  scan: readonly { from: number; to: number }[],
): LivePreviewRanges {
  const marks: Range<Decoration>[] = [];
  const replaces: Range<Decoration>[] = [];
  const tree = syntaxTree(state);
  const doc = state.doc;

  const sel = state.selection.main;
  const bandFrom = doc.lineAt(sel.from).from;
  const bandTo = doc.lineAt(sel.to).to;
  const inBand = (from: number, to: number): boolean => to > bandFrom && from < bandTo;

  for (const { from, to } of scan) {
    tree.iterate({
      from,
      to,
      enter: (node) => {
        const name = node.name;
        if (name === 'StrongEmphasis') {
          marks.push(STRONG_MARK.range(node.from, node.to));
          return; // descend to reach the EmphasisMark children
        }
        if (name === 'Emphasis') {
          marks.push(EM_MARK.range(node.from, node.to));
          return;
        }
        if (name.startsWith(ATX_PREFIX)) {
          const level = Number(name.slice(ATX_PREFIX.length)); // 1..6
          const deco = HEADING_MARK[level - 1];
          if (deco) marks.push(deco.range(node.from, node.to));
          return; // descend to reach the HeaderMark child
        }
        if (name === 'EmphasisMark' || name === 'HeaderMark') {
          if (inBand(node.from, node.to)) return; // visible/editable on the active line(s)
          let end = node.to;
          // The opening `HeaderMark` covers only the `#`s; the single space after it is a parser
          // gap (belongs to no node). Swallow it so `## ` conceals cleanly without a leading space.
          if (name === 'HeaderMark' && doc.sliceString(node.to, node.to + 1) === ' ') end = node.to + 1;
          replaces.push(HIDE.range(node.from, end));
        }
      },
    });
  }

  return { marks, replaces };
}

class LivePreviewPlugin {
  decorations: DecorationSet; // marks + replaces (combined) — rendered
  hidden: DecorationSet; // replaces only — fed to atomicRanges

  constructor(view: EditorView) {
    const built = this.build(view);
    this.decorations = built.decorations;
    this.hidden = built.hidden;
  }

  update(u: ViewUpdate): void {
    // `selectionSet` is mandatory — without it the conceal would not re-toggle with the cursor.
    if (u.docChanged || u.selectionSet || u.viewportChanged) {
      const built = this.build(u.view);
      this.decorations = built.decorations;
      this.hidden = built.hidden;
    }
  }

  private build(view: EditorView): { decorations: DecorationSet; hidden: DecorationSet } {
    const { marks, replaces } = computeLivePreviewRanges(view.state, view.visibleRanges);
    return {
      // `true` => sort: mark (container) and replace (marker) ranges overlap and arrive unsorted,
      // so RangeSetBuilder would throw "Ranges must be added sorted".
      decorations: Decoration.set([...marks, ...replaces], true),
      hidden: Decoration.set(replaces, true),
    };
  }
}

const livePreviewPlugin = ViewPlugin.fromClass(LivePreviewPlugin, {
  decorations: (v) => v.decorations,
});

/** Theme mirroring the `MarkdownRenderer` display subset. Em-relative so conceal toggling causes
 *  no layout jump (sizes scale to the editor's base font-size). */
const livePreviewTheme = EditorView.theme({
  '.cm-md-strong': { fontWeight: '700' },
  '.cm-md-em': { fontStyle: 'italic' },
  '.cm-md-h1': { fontSize: '1.7em', fontWeight: '700', lineHeight: '1.3', color: 'var(--tf-text)' },
  '.cm-md-h2': { fontSize: '1.4em', fontWeight: '600', lineHeight: '1.3', color: 'var(--tf-text)' },
  '.cm-md-h3': { fontSize: '1.2em', fontWeight: '500', lineHeight: '1.3', color: 'var(--tf-text)' },
  '.cm-md-h4': { fontSize: '1.05em', fontWeight: '600', color: 'var(--tf-text)' },
  '.cm-md-h5': { fontSize: '1.05em', fontWeight: '600', color: 'var(--tf-text-secondary)' },
  '.cm-md-h6': { fontSize: '1.05em', fontWeight: '600', color: 'var(--tf-text-secondary)' },
});

/**
 * Inline Markdown live-preview extension. Pass via the `extensions` prop of `MarkdownEditor`.
 * `atomicRanges` exposes the concealed marker spans so arrow keys skip over hidden markers
 * (the cursor would otherwise get stuck in an invisible zone).
 */
export function markdownLivePreview(): Extension {
  return [
    livePreviewPlugin,
    livePreviewTheme,
    EditorView.atomicRanges.of((view) => view.plugin(livePreviewPlugin)?.hidden ?? Decoration.none),
  ];
}
