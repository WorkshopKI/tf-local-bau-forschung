/**
 * Nutzer-Changelog-Modal — geöffnet per Klick auf die Versionsnummer in der
 * Sidebar (BuildInfo). Zeigt „Was ist neu?" gruppiert nach Hauptnummer (Major)
 * als ausklappbare Über-Überschrift (aktuelle Major auf, frühere zu) und darunter
 * die Minor-Versionen `x.yy` als ausklappbare Abschnitte mit Markdown-Details.
 *
 * Inhalt: bevorzugt die geglättete `changelog-user.md`, sonst aus der
 * entwickler-orientierten CHANGELOG.md (+ Archiv) abgeleitet (siehe deriveChangelog).
 * Alle Markdown-Quellen werden zur BUILD-Zeit via `?raw` inlined (file://-tauglich,
 * Pitfall #1/#2 — kein Runtime-fetch).
 */

import { useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
// Markdown-Quellen werden zur Build-Zeit als String eingebettet (?raw).
import devChangelogRaw from '../../../../CHANGELOG.md?raw';
import archivChangelogRaw from '../../../../docs/CHANGELOG-ARCHIV.md?raw';
import userChangelogRaw from './changelog-user.md?raw';
import { Dialog } from '@/components/ui/dialog';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { appVersion } from '@/config/runtime-config';
import { isDevContext } from '@/config/feature-flags';
import { getChangelogMarkdown, parseUserChangelog } from './deriveChangelog';
import { ChangelogPolishPanel } from './ChangelogPolishPanel';

const TRIGGER_BASE =
  'flex w-full items-center justify-between gap-2 rounded-[var(--tf-radius)] px-3 text-left ' +
  'transition-colors hover:bg-[var(--tf-hover)] [&[data-state=open]>svg]:rotate-180';

export function ChangelogDialog({ open, onClose }: { open: boolean; onClose: () => void }): React.ReactElement | null {
  const currentMajor = useMemo(() => {
    const n = Number.parseInt(appVersion.split('.')[0] ?? '', 10);
    return Number.isFinite(n) ? n : 0;
  }, []);

  const markdown = useMemo(
    () => getChangelogMarkdown(`${devChangelogRaw}\n${archivChangelogRaw}`, userChangelogRaw, currentMajor),
    [currentMajor],
  );

  const majors = useMemo(() => parseUserChangelog(markdown), [markdown]);

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Änderungen & Updates"
      description="Was sich in den letzten Versionen getan hat — neueste zuerst."
      size="lg"
      align="center"
    >
      {majors.length === 0 ? (
        <p className="py-6 text-sm text-[var(--tf-text-secondary)]">
          Für diese Version liegen noch keine aufbereiteten Änderungshinweise vor.
        </p>
      ) : (
        <div className="space-y-3 pb-2">
          {majors.map((maj) => (
            <Collapsible
              key={maj.major}
              defaultOpen={maj.major === currentMajor}
              className="rounded-[var(--tf-radius)] border border-[var(--tf-border)]"
            >
              <CollapsibleTrigger className={`${TRIGGER_BASE} py-3`}>
                <span className="text-[15px] font-semibold text-[var(--tf-text)]">{maj.label}</span>
                <ChevronDown size={18} className="shrink-0 text-[var(--tf-text-tertiary)] transition-transform" />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1.5 px-2 pb-2">
                {maj.minors.map((min, idx) => (
                  <Collapsible
                    key={min.minor}
                    defaultOpen={maj.major === currentMajor && idx === 0}
                    className="rounded-[var(--tf-radius)] bg-[var(--tf-bg-secondary)]"
                  >
                    <CollapsibleTrigger className={`${TRIGGER_BASE} py-2`}>
                      <span className="text-[13px] font-medium text-[var(--tf-text)]">{min.label}</span>
                      <ChevronDown size={15} className="shrink-0 text-[var(--tf-text-tertiary)] transition-transform" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-3 pb-3 pt-1">
                      <MarkdownRenderer content={min.bodyMarkdown} />
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      )}

      {isDevContext() && <ChangelogPolishPanel currentMarkdown={markdown} />}
    </Dialog>
  );
}
