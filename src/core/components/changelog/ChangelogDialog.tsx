/**
 * Nutzer-Changelog-Modal — geöffnet per Klick auf die Versionsnummer in der
 * Sidebar (BuildInfo). Zeigt „Was ist neu?" gruppiert nach Hauptnummer (Major)
 * als ausklappbare Über-Überschrift (aktuelle Major auf, frühere zu) und darunter
 * die Minor-Versionen `x.yy` als ausklappbare Abschnitte. Jede Änderung trägt eine
 * Kategorie (Neu & geändert / Bugfix); ein Filter oben blendet nur die jeweils
 * gewünschte Kategorie ein.
 *
 * Inhalt: bevorzugt die geglättete `changelog-user.md`, sonst aus der
 * entwickler-orientierten CHANGELOG.md (+ Archiv) abgeleitet (siehe deriveChangelog).
 * Alle Markdown-Quellen werden zur BUILD-Zeit via `?raw` inlined (file://-tauglich,
 * Pitfall #1/#2 — kein Runtime-fetch).
 */

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { marked } from 'marked';
// Markdown-Quellen werden zur Build-Zeit als String eingebettet (?raw).
import devChangelogRaw from '../../../../CHANGELOG.md?raw';
import archivChangelogRaw from '../../../../docs/CHANGELOG-ARCHIV.md?raw';
import userChangelogRaw from './changelog-user.md?raw';
import { Dialog } from '@/components/ui/dialog';
import { MarkdownRenderer, sanitizeHtml } from '@/components/ui/MarkdownRenderer';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { appVersion } from '@/config/runtime-config';
import { canPolishChangelog } from '@/config/feature-flags';
import { useStorage } from '@/core/hooks/useStorage';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import {
  getChangelogMarkdown,
  getDisplayChangelog,
  hasUserChangelogContent,
  parseUserChangelog,
  bucketizeMinors,
  type ChangeCategory,
  type ChangelogMinor,
} from './deriveChangelog';
import { readUserChangelogFromShare } from './changelogShare';
import { ChangelogPolishPanel } from './ChangelogPolishPanel';

type FilterKey = 'all' | ChangeCategory;
type TimeFilterKey = 'all' | 'month';

const CATEGORY_ORDER: ChangeCategory[] = ['feature', 'fix'];

const CATEGORY_META: Record<ChangeCategory, { label: string; badge: 'success' | 'warning' }> = {
  feature: { label: 'Neu & Verbesserungen', badge: 'success' },
  fix: { label: 'Fehlerbehebungen', badge: 'warning' },
};

const TRIGGER_BASE =
  'flex w-full items-center justify-between gap-2 rounded-[var(--tf-radius)] px-3 text-left ' +
  'transition-colors hover:bg-[var(--tf-hover)] [&[data-state=open]>svg]:rotate-180';

/** Entwickler-CHANGELOG + Archiv, zur Build-Zeit eingebettet (stabil → memo-tauglich). */
const DEV_COMBINED = `${devChangelogRaw}\n${archivChangelogRaw}`;

/** Einzeiliger Änderungstext mit leichtem Inline-Markdown (z.B. **fett**). */
function ChangeText({ text }: { text: string }): React.ReactElement {
  const html = useMemo(() => sanitizeHtml(marked.parseInline(text, { async: false }) as string), [text]);
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Eine einzelne (auf-/zuklappbare) Minor-Versions-Karte — einzeln oder innerhalb eines 10er-Pakets. */
function MinorCard({
  min,
  defaultOpen,
  matches,
}: {
  min: ChangelogMinor;
  defaultOpen: boolean;
  matches: (cat: ChangeCategory) => boolean;
}): React.ReactElement {
  return (
    <Collapsible defaultOpen={defaultOpen} className="rounded-[var(--tf-radius)] bg-[var(--tf-bg-secondary)]">
      <CollapsibleTrigger className={`${TRIGGER_BASE} py-2`}>
        <span className="text-[13px] font-medium text-[var(--tf-text)]">{min.label}</span>
        <ChevronDown size={15} className="shrink-0 text-[var(--tf-text-tertiary)] transition-transform" />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3 pt-1">
        {min.changes.length === 0 ? (
          <MarkdownRenderer content={min.bodyMarkdown} />
        ) : (
          CATEGORY_ORDER.filter(matches).map((cat) => {
            const items = min.changes.filter((c) => c.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat} className="mb-2.5 last:mb-0">
                <Badge variant={CATEGORY_META[cat].badge} className="mb-1.5 text-[10px]">
                  {CATEGORY_META[cat].label}
                </Badge>
                <ul className="list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-[var(--tf-text)]">
                  {items.map((c, i) => (
                    <li key={i}>
                      <ChangeText text={c.text} />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ChangelogDialog({ open, onClose }: { open: boolean; onClose: () => void }): React.ReactElement | null {
  const storage = useStorage();
  // Kurator-Session-Status: gibt im Kurator-Build den Glätten-Editor frei (siehe canPolishChangelog).
  const kuratorActive = useKuratorSession((s) => s.isActive);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilterKey>('all');
  // „Alle aufklappen": überschreibt die Default-Offen-Logik (erste 3 + Pakete zu) und öffnet
  // alles. Steckt in den Collapsible-Keys → Toggle mountet neu (Radix `defaultOpen` ist mount-only).
  const [expandAll, setExpandAll] = useState(false);
  // Beim Öffnen den geglätteten Changelog vom Daten-Share laden (Vorrang vor der
  // eingebetteten/abgeleiteten Fassung); null = keiner/offline → Fallback greift.
  const [shareMd, setShareMd] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void readUserChangelogFromShare(storage.idb).then((md) => {
      if (!cancelled) setShareMd(md);
    });
    return () => {
      cancelled = true;
    };
  }, [open, storage]);

  const currentMajor = useMemo(() => {
    const n = Number.parseInt(appVersion.split('.')[0] ?? '', 10);
    return Number.isFinite(n) ? n : 0;
  }, []);

  // Aktueller Monats-Index (Nutzer-Uhr) für den „Letzter Monat"-Filter — monatsgenau (year*12 + month0).
  const nowMonthIndex = useMemo(() => {
    const now = new Date();
    return now.getFullYear() * 12 + now.getMonth();
  }, []);

  // Aus CHANGELOG.md abgeleitete „Build-Wahrheit" ALLER Versionen — Quelle fürs Glätten
  // UND Lückenfüller der Anzeige (garantiert, dass die neueste Version immer erscheint).
  const derivedMarkdown = useMemo(
    () => getChangelogMarkdown(DEV_COMBINED, '', currentMajor),
    [currentMajor],
  );
  // Kuratierter Override: geglätteter Share-Stand (Laufzeit) hat Vorrang, sonst die
  // committed changelog-user.md (nur wenn sie echte `## vX.Y`-Abschnitte trägt).
  const committedOverride = useMemo(
    () => (hasUserChangelogContent(userChangelogRaw) ? userChangelogRaw.trim() : ''),
    [],
  );
  const override = shareMd ?? committedOverride;
  // Anzeige: Override gewinnt je Version (schöne Prosa), fehlende (neuere) Versionen kommen
  // aus der Build-Ableitung — ein veralteter Override verdeckt so nichts Neueres mehr.
  const markdown = useMemo(() => getDisplayChangelog(derivedMarkdown, override), [derivedMarkdown, override]);

  const majors = useMemo(() => parseUserChangelog(markdown), [markdown]);

  const counts = useMemo(() => {
    let feature = 0;
    let fix = 0;
    for (const maj of majors) {
      for (const min of maj.minors) {
        for (const c of min.changes) {
          if (c.category === 'fix') fix += 1;
          else feature += 1;
        }
      }
    }
    return { all: feature + fix, feature, fix };
  }, [majors]);

  if (!open) return null;

  const matches = (cat: ChangeCategory): boolean => filter === 'all' || filter === cat;

  // „Letzter Monat" = aktueller + voriger Kalendermonat (monatsgenaue Näherung; Einträge ohne
  // geparstes Datum fallen bewusst heraus, da nur ältere/Archiv-Versionen kein Monatslabel tragen).
  const withinTime = (min: { monthIndex?: number }): boolean =>
    timeFilter === 'all' || (min.monthIndex !== undefined && min.monthIndex >= nowMonthIndex - 1);

  const filters: { key: FilterKey; label: string; count: number; activeClass: string }[] = [
    { key: 'all', label: 'Alle', count: counts.all, activeClass: 'bg-[var(--tf-primary-light)] text-[var(--tf-primary)]' },
    {
      key: 'feature',
      label: CATEGORY_META.feature.label,
      count: counts.feature,
      activeClass: 'bg-[var(--tf-success-bg)] text-[var(--tf-success-text)]',
    },
    {
      key: 'fix',
      label: 'Bugfixes',
      count: counts.fix,
      activeClass: 'bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)]',
    },
  ];

  // Sichtbare Majors/Minors für den aktiven Filter vorab bestimmen (leere ausblenden).
  const visibleMajors = majors
    .map((maj) => ({
      ...maj,
      minors: maj.minors.filter(
        (min) =>
          withinTime(min) &&
          (min.changes.some((c) => matches(c.category)) ||
            (filter === 'all' && min.changes.length === 0 && min.bodyMarkdown.length > 0)),
      ),
    }))
    .filter((maj) => maj.minors.length > 0);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Änderungen & Updates"
      description="Was sich in den letzten Versionen getan hat — neueste zuerst."
      size="lg"
      align="center"
      resizable
      resizeStorageKey="teamflow_changelog_dialog_size"
    >
      {/* Kategorie-Filter (klebt am oberen Rand des scrollbaren Inhalts) */}
      <div className="sticky top-0 z-10 -mx-6 mb-3 flex flex-wrap items-center gap-1 border-b border-[var(--tf-border)] bg-[var(--tf-bg)] px-6 pb-2 pt-1">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
              filter === f.key ? f.activeClass : 'text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]'
            }`}
          >
            {f.label} <span className="opacity-60">{f.count}</span>
          </button>
        ))}
        {/* Rechte Gruppe: Aufklapp-Steuerung + Zeit-Filter (orthogonal zur Kategorie). */}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setExpandAll((v) => !v)}
            aria-pressed={expandAll}
            className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
              expandAll
                ? 'bg-[var(--tf-primary-light)] text-[var(--tf-primary)]'
                : 'text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]'
            }`}
          >
            {expandAll ? 'Alle zuklappen' : 'Alle aufklappen'}
          </button>
          <button
            type="button"
            onClick={() => setTimeFilter((t) => (t === 'month' ? 'all' : 'month'))}
            aria-pressed={timeFilter === 'month'}
            className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
              timeFilter === 'month'
                ? 'bg-[var(--tf-primary-light)] text-[var(--tf-primary)]'
                : 'text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]'
            }`}
          >
            Letzter Monat
          </button>
        </div>
      </div>

      {visibleMajors.length === 0 ? (
        <p className="py-6 text-sm text-[var(--tf-text-secondary)]">
          Keine Einträge in dieser Kategorie.
        </p>
      ) : (
        <div className="space-y-3 pb-2">
          {visibleMajors.map((maj) => (
            <Collapsible
              // expandAll im Key → Toggle mountet die ganze Hauptnummer neu, alle Kinder
              // übernehmen ihr neues defaultOpen.
              key={`${expandAll}-${maj.major}`}
              defaultOpen={expandAll || maj.major === currentMajor}
              className="rounded-[var(--tf-radius)] border border-[var(--tf-border)]"
            >
              <CollapsibleTrigger className={`${TRIGGER_BASE} py-3`}>
                <span className="text-[15px] font-semibold text-[var(--tf-text)]">{maj.label}</span>
                <ChevronDown size={18} className="shrink-0 text-[var(--tf-text-tertiary)] transition-transform" />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1.5 px-2 pb-2">
                {(() => {
                  // Aktuelle Hauptnummer: erste 3 sichtbare Versionen einzeln (offen), Rest in
                  // 10er-Pakete; ältere Hauptnummern komplett in Pakete. Filter im Key → bei
                  // Tab-/Zeit-Wechsel neu mounten (Radix `defaultOpen` greift nur beim Mount).
                  const { loose, buckets } = bucketizeMinors(
                    maj.minors,
                    maj.major === currentMajor ? 3 : 0,
                    maj.major,
                  );
                  return (
                    <>
                      {loose.map((min, idx) => (
                        <MinorCard
                          key={`${filter}-${timeFilter}-${min.minor}`}
                          min={min}
                          defaultOpen={expandAll || (maj.major === currentMajor && idx < 3)}
                          matches={matches}
                        />
                      ))}
                      {buckets.map((bucket) => (
                        <Collapsible
                          key={`${filter}-${timeFilter}-${bucket.key}`}
                          defaultOpen={expandAll}
                          className="rounded-[var(--tf-radius)] border border-[var(--tf-border)]"
                        >
                          <CollapsibleTrigger className={`${TRIGGER_BASE} py-2`}>
                            <span className="text-[13px] font-medium text-[var(--tf-text-secondary)]">
                              {bucket.label}
                              <span className="ml-1.5 text-[var(--tf-text-tertiary)]">· {bucket.minors.length}</span>
                            </span>
                            <ChevronDown size={15} className="shrink-0 text-[var(--tf-text-tertiary)] transition-transform" />
                          </CollapsibleTrigger>
                          <CollapsibleContent className="space-y-1.5 px-2 pb-2 pt-1">
                            {bucket.minors.map((min) => (
                              <MinorCard key={min.minor} min={min} defaultOpen={expandAll} matches={matches} />
                            ))}
                          </CollapsibleContent>
                        </Collapsible>
                      ))}
                    </>
                  );
                })()}
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      )}

      {canPolishChangelog(kuratorActive) && (
        <ChangelogPolishPanel
          sourceMarkdown={derivedMarkdown}
          shareMarkdown={override}
          onSaved={(merged) => setShareMd(merged)}
        />
      )}
    </Dialog>
  );
}
