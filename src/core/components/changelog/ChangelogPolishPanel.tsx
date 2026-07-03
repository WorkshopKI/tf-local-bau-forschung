/**
 * Entwickler-Werkzeug im Changelog-Modal: „Mit KI glätten".
 *
 * Schickt die noch NICHT geglätteten Versionen (aus CHANGELOG.md abgeleitet) an die
 * interne KI und lässt sie in nutzerfreundliche Sprache umschreiben. Standard ist
 * INKREMENTELL: es werden nur die Versionen geglättet, die noch nicht im geglätteten
 * Share-Changelog (`_intern/changelog-user.md`) stehen; das Ergebnis wird über den
 * bestehenden Stand gemerged. Der Entwickler kann den gemergten Stand nachbearbeiten
 * und ihn dann auf den Daten-Share schreiben — danach sehen ihn ALLE Build-Varianten
 * zur Laufzeit, ohne Rebuild.
 *
 * Gerendert im Entwickler-Build sowie im Kurator-Build mit aktiver Kurator-Session
 * (siehe ChangelogDialog, `canPolishChangelog()`). `useAIBridge()` ist hier immer
 * sicher — der Provider hängt app-global über dem Router (App.tsx).
 */

import { useState } from 'react';
import { Sparkles, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useStorage } from '@/core/hooks/useStorage';
import { selectNewMinorSections, mergeChangelog, splitMinorSections } from './deriveChangelog';
import { writeUserChangelogToShare } from './changelogShare';

const SYSTEM_PROMPT =
  'Du bist technischer Redakteur. Du schreibst Changelog-Einträge für Endnutzer ' +
  'einer internen Web-App zur Verwaltung von Förderanträgen um: klar, knapp, auf ' +
  'Deutsch, ohne Datei- oder Funktionsnamen und ohne internen Jargon. Beschreibe ' +
  'den Nutzen, nicht die technische Umsetzung.';

const USER_INSTRUCTIONS =
  'Formuliere den folgenden Changelog nutzerfreundlich um. Regeln:\n' +
  '- Behalte die `## vX.Y`-Überschriften exakt bei — gleiche Nummern, gleiche ' +
  'Reihenfolge UND den optionalen Datums-Suffix ` — JJJJ-MM` unverändert (er steuert ' +
  'einen Zeit-Filter).\n' +
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

export function ChangelogPolishPanel({
  sourceMarkdown,
  shareMarkdown,
  onSaved,
}: {
  /** Volle Build-Wahrheit (aus CHANGELOG.md abgeleitet) — Quelle aller Versionen. */
  sourceMarkdown: string;
  /** Aktuell auf dem Share liegender, bereits geglätteter Changelog ('' wenn keiner). */
  shareMarkdown: string;
  /** Nach erfolgreichem Speichern aufgerufen — aktualisiert die Modal-Anzeige sofort. */
  onSaved: (merged: string) => void;
}): React.ReactElement {
  const bridge = useAIBridge();
  const storage = useStorage();
  const [draft, setDraft] = useState<string | null>(null);
  const [polishAll, setPolishAll] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const polish = useAsyncAction(async () => {
    setNote(null);
    // Inkrementell gegen den Share-Stand; „Alle neu glätten" ignoriert ihn (existing = '').
    const existing = polishAll ? '' : shareMarkdown;
    const newSections = selectNewMinorSections(sourceMarkdown, existing);
    if (newSections.length === 0) {
      setDraft(null);
      setNote('Alles aktuell — keine neuen Versionen zu glätten.');
      return;
    }
    const userMessage = USER_INSTRUCTIONS + newSections.map((s) => s.text).join('\n\n');
    const transport = bridge.getActiveTransport();
    let out: string;
    if (typeof transport.submitConversation === 'function') {
      out = await transport.submitConversation(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        // Output-Headroom: nur die neuen Versionen, Thinking aus (kein Token-Budget-Klau).
        { maxTokens: 16000, thinkingBudget: 'none' },
      );
    } else {
      out = await transport.submitMessage(userMessage, SYSTEM_PROMPT, { thinkingBudget: 'none' });
    }
    const merged = mergeChangelog(stripCodeFence(out), existing);
    setDraft(merged);
    // Verifizieren, dass JEDE frisch selektierte Version den Merge überlebt hat. Fehlt eine,
    // kam sie nicht als parsebarer `## v…`-Kopf zurück (Bridge/Modell) — sonst würde sie hier
    // still verschwinden und ein unvollständiger Stand ließe sich speichern.
    const survived = new Set(splitMinorSections(merged).map((s) => s.key));
    const dropped = newSections.filter((s) => !survived.has(s.key));
    if (dropped.length > 0) {
      setNote(
        `⚠️ ${dropped.length} Version${dropped.length === 1 ? '' : 'en'} kam${dropped.length === 1 ? '' : 'en'} ` +
          `nicht sauber von der KI zurück (kein „## v…"-Kopf) und fehlt im Entwurf: ` +
          `${dropped.map((s) => `v${s.key}`).join(', ')}. Bitte im Entwurf ergänzen oder erneut glätten.`,
      );
    } else {
      setNote(`${newSections.length} neue Version${newSections.length === 1 ? '' : 'en'} geglättet — prüfen und speichern.`);
    }
  });

  const save = useAsyncAction(async () => {
    if (draft == null) return;
    const merged = draft.trim();
    await writeUserChangelogToShare(storage.idb, merged);
    onSaved(merged);
    setDraft(null);
    setNote('Auf den Daten-Share gespeichert — für alle Varianten sichtbar.');
  });

  return (
    <div className="mt-6 rounded-[var(--tf-radius)] border border-dashed border-[var(--tf-border)] bg-[var(--tf-bg-secondary)] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--tf-text-tertiary)]">
          Entwickler · Nutzer-Changelog pflegen
        </span>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-[var(--tf-text-secondary)]">
            <input
              type="checkbox"
              checked={polishAll}
              onChange={(e) => setPolishAll(e.target.checked)}
              className="accent-[var(--tf-primary)]"
            />
            Alle neu glätten
          </label>
          <Button size="sm" variant="outline" onClick={() => polish.run()} disabled={polish.busy}>
            <Sparkles size={13} className="mr-1.5" />
            {polish.busy ? 'Glätte…' : 'Mit KI glätten'}
          </Button>
        </div>
      </div>

      {note && <div className="mt-2 text-[12px] text-[var(--tf-text-secondary)]">{note}</div>}
      {polish.error && (
        <div className="mt-2 text-[12px] text-[var(--tf-danger-text)]">Fehler: {polish.error}</div>
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
              Speichern schreibt <code>_intern/changelog-user.md</code> auf den Daten-Share — alle
              Varianten lesen das zur Laufzeit (kein Rebuild).
            </span>
            <Button size="sm" variant="default" onClick={() => save.run()} disabled={save.busy}>
              <UploadCloud size={13} className="mr-1.5" />
              {save.busy ? 'Speichere…' : 'Auf Share speichern'}
            </Button>
          </div>
          {save.error && (
            <div className="text-[12px] text-[var(--tf-danger-text)]">Fehler: {save.error}</div>
          )}
        </div>
      )}
    </div>
  );
}
