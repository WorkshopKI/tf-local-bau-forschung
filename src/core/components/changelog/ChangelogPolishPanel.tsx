/**
 * Entwickler-Werkzeug im Changelog-Modal: „Mit KI glätten".
 *
 * Schickt den aktuell angezeigten (aus CHANGELOG.md abgeleiteten oder bereits
 * geglätteten) Changelog an die interne KI und lässt ihn in nutzerfreundliche
 * Sprache umschreiben. Das Ergebnis kann der Entwickler im Textfeld nachbearbeiten
 * und via File System Access API in `src/core/components/changelog/changelog-user.md`
 * zurückschreiben — danach committen, dann sehen alle Build-Varianten den Text.
 *
 * Wird ausschließlich im Entwickler-Build gerendert (siehe ChangelogDialog,
 * `isDevContext()`), daher ist `useAIBridge()` hier sicher (Provider ist Vorfahr).
 */

import { useState } from 'react';
import { Sparkles, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';

const SYSTEM_PROMPT =
  'Du bist technischer Redakteur. Du schreibst Changelog-Einträge für Endnutzer ' +
  'einer internen Web-App zur Verwaltung von Förderanträgen um: klar, knapp, auf ' +
  'Deutsch, ohne Datei- oder Funktionsnamen und ohne internen Jargon. Beschreibe ' +
  'den Nutzen, nicht die technische Umsetzung.';

const USER_INSTRUCTIONS =
  'Formuliere den folgenden Changelog nutzerfreundlich um. Regeln:\n' +
  '- Behalte die `## vX.Y`-Überschriften exakt bei (gleiche Nummern, gleiche Reihenfolge).\n' +
  '- Fasse je Version die Punkte zu kurzen, verständlichen Sätzen zusammen; ' +
  'gruppiere bei Bedarf in `### Neu`, `### Verbesserungen`, `### Bugfixes`.\n' +
  '- Keine Datei-/Funktionsnamen, keine internen Begriffe (Snapshot, IndexedDB, Merge, ' +
  'Flag, Delta …), wo vermeidbar.\n' +
  '- Gib NUR Markdown aus, kein Vorwort, keine Code-Fences.\n\n' +
  'Quelle:\n\n';

/** ```markdown … ``` / ``` … ```-Umhüllung entfernen, falls das Modell sie ausgibt. */
function stripCodeFence(s: string): string {
  const t = s.trim();
  const m = /^```[a-zA-Z]*\n([\s\S]*?)\n```$/.exec(t);
  return m ? (m[1] ?? '').trim() : t;
}

export function ChangelogPolishPanel({ currentMarkdown }: { currentMarkdown: string }): React.ReactElement {
  const bridge = useAIBridge();
  const [draft, setDraft] = useState<string | null>(null);

  const polish = useAsyncAction(async () => {
    const transport = bridge.getActiveTransport();
    const userMessage = USER_INSTRUCTIONS + currentMarkdown;
    let out: string;
    if (typeof transport.submitConversation === 'function') {
      out = await transport.submitConversation(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        // Output-Headroom: der ganze v2.x-Changelog kann lang werden; Thinking aus,
        // damit der Denkprozess nicht das Token-Budget der Antwort frisst.
        { maxTokens: 16000, thinkingBudget: 'none' },
      );
    } else {
      out = await transport.submitMessage(userMessage, SYSTEM_PROMPT, { thinkingBudget: 'none' });
    }
    setDraft(stripCodeFence(out));
  });

  const save = useAsyncAction(async () => {
    if (draft == null) return;
    const win = window as unknown as {
      showSaveFilePicker?: (options?: {
        suggestedName?: string;
        types?: { description?: string; accept: Record<string, string[]> }[];
      }) => Promise<FileSystemFileHandle>;
    };
    if (!win.showSaveFilePicker) {
      throw new Error('File System Access API nicht verfügbar in diesem Browser.');
    }
    let handle: FileSystemFileHandle;
    try {
      handle = await win.showSaveFilePicker({
        suggestedName: 'changelog-user.md',
        types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md'] } }],
      });
    } catch (err) {
      // Abbruch im Datei-Dialog ist kein Fehler.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      throw err;
    }
    const writable = await handle.createWritable();
    await writable.write(draft.endsWith('\n') ? draft : draft + '\n');
    await writable.close();
  });

  return (
    <div className="mt-6 rounded-[var(--tf-radius)] border border-dashed border-[var(--tf-border)] bg-[var(--tf-bg-secondary)] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--tf-text-tertiary)]">
          Entwickler · Nutzer-Changelog pflegen
        </span>
        <Button size="sm" variant="outline" onClick={() => polish.run()} disabled={polish.busy}>
          <Sparkles size={13} className="mr-1.5" />
          {polish.busy ? 'Glätte…' : 'Mit KI glätten'}
        </Button>
      </div>

      {polish.error && (
        <div className="mt-2 text-[12px] text-[var(--tf-danger,#dc2626)]">Fehler: {polish.error}</div>
      )}

      {draft != null && (
        <div className="mt-3 space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            className="h-56 w-full resize-y rounded-[var(--tf-radius-sm,6px)] border border-[var(--tf-border)] bg-[var(--tf-bg)] p-2 font-mono text-[12px] leading-relaxed text-[var(--tf-text)]"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-[var(--tf-text-tertiary)]">
              Speichern → <code>src/core/components/changelog/changelog-user.md</code> wählen, dann committen.
            </span>
            <Button size="sm" variant="default" onClick={() => save.run()} disabled={save.busy}>
              <Save size={13} className="mr-1.5" />
              {save.busy ? 'Speichere…' : 'In Datei speichern'}
            </Button>
          </div>
          {save.error && (
            <div className="text-[12px] text-[var(--tf-danger,#dc2626)]">Fehler: {save.error}</div>
          )}
        </div>
      )}
    </div>
  );
}
