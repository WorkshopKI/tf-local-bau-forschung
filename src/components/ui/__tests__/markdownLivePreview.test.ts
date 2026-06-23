import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { ensureSyntaxTree } from '@codemirror/language';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { computeLivePreviewRanges } from '../markdownLivePreview';

// Runs in the `node` Vitest environment: no DOM, no EditorView — we exercise the pure
// `computeLivePreviewRanges` over a plain EditorState.
function makeState(doc: string, cursor: number): EditorState {
  const state = EditorState.create({
    doc,
    selection: { anchor: cursor },
    extensions: [markdown({ base: markdownLanguage })],
  });
  // Markdown parses async/incrementally; force a synchronous full parse so syntaxTree(state)
  // inside the pure fn sees the complete tree (otherwise the 2nd line could be missing -> flaky).
  ensureSyntaxTree(state, state.doc.length);
  return state;
}

const DOC = '**bold** text\n## Heading';
//            0123456789...        ^14  ^17
const BOLD_LINE_END = 13; // end of "**bold** text"
const HEADING_START = 14; // start of "## Heading"
const wholeDoc = (s: EditorState) => [{ from: 0, to: s.doc.length }];

describe('computeLivePreviewRanges', () => {
  it('(a) conceals the ** markers when the cursor is outside the bold line', () => {
    const state = makeState(DOC, HEADING_START + 4); // cursor in the heading line
    const { replaces } = computeLivePreviewRanges(state, wholeDoc(state));
    const spans = replaces.map(r => [r.from, r.to]);
    expect(spans).toContainEqual([0, 2]); // opening **
    expect(spans).toContainEqual([6, 8]); // closing **
  });

  it('(b) reveals the ** markers (no replace) when the cursor is inside the bold line, mark stays', () => {
    const state = makeState(DOC, 4); // cursor inside "**bold**"
    const { replaces, marks } = computeLivePreviewRanges(state, wholeDoc(state));
    const boldReplaces = replaces.filter(r => r.from < BOLD_LINE_END);
    expect(boldReplaces).toHaveLength(0); // markers visible / editable
    expect(
      marks.some(m => m.value.spec.class === 'cm-md-strong' && m.from === 0 && m.to === 8),
    ).toBe(true);
  });

  it('(c) marks the heading with cm-md-h2 and conceals "## " incl. the trailing gap space', () => {
    const state = makeState(DOC, 4); // cursor on the bold line, NOT on the heading
    const { marks, replaces } = computeLivePreviewRanges(state, wholeDoc(state));
    expect(
      marks.some(
        m => m.value.spec.class === 'cm-md-h2' && m.from === HEADING_START && m.to === state.doc.length,
      ),
    ).toBe(true);
    // HeaderMark [14,16) extended +1 to swallow the gap space => [14,17)
    expect(replaces.map(r => [r.from, r.to])).toContainEqual([HEADING_START, HEADING_START + 3]);
  });

  it('(d) conceals ALL markers when the editor is NOT focused (clean preview), even on the cursor line', () => {
    const state = makeState(DOC, 4); // cursor inside "**bold**" — but unfocused
    const { replaces } = computeLivePreviewRanges(state, wholeDoc(state), false);
    const spans = replaces.map(r => [r.from, r.to]);
    expect(spans).toContainEqual([0, 2]); // ** hidden despite cursor on this line (not focused)
    expect(spans).toContainEqual([6, 8]);
  });
});
