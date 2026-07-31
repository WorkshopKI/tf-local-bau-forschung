/**
 * „Über die App" — geöffnet per Klick auf die Versionsnummer in der Sidebar
 * (BuildInfo) ODER über den Link in der Fußzeile jedes Seiten-Hilfe-Dialogs.
 * Beide Wege teilen sich `useUeberAppDialog`; gemountet wird genau einmal
 * (ShellLayout), siehe Store-Docblock.
 *
 * Seit v2.366 ZWEI Spalten statt drei Abschnitte untereinander — der Überblick ist
 * gut eine Bildschirmhöhe lang und schob „Änderungen & Updates" sonst unter den Falz.
 * Jede Spalte scrollt für sich, beide sind ohne Scrollen sichtbar:
 *  - **links: Überblick** — der App-Überblick aus `docs/feedback-kontext/_app.md`, ohne
 *    Technik-Teil (`getAppUeberblick`). Bis v2.360 sah den nur die Feedback-KI.
 *    Darunter fest die **Version** — laufende Version, Build-Datum, Variante.
 *  - **rechts: Änderungen & Updates** — gruppiert nach Hauptnummer (Major) als
 *    ausklappbare Über-Überschrift (aktuelle Major auf, frühere zu), darunter die
 *    Minor-Versionen `x.yy`. Jede Änderung trägt eine Kategorie (Neu & geändert /
 *    Bugfix); ein Filter blendet nur die jeweils gewünschte ein.
 *
 * Inhalt der Änderungsliste: bevorzugt die geglättete `changelog-user.md`, sonst
 * aus der entwickler-orientierten CHANGELOG.md (+ Archiv) abgeleitet (siehe
 * deriveChangelog). Alle Markdown-Quellen werden zur BUILD-Zeit via `?raw` inlined
 * (file://-tauglich, Pitfall #1/#2 — kein Runtime-fetch).
 */

import { useMemo, useState } from 'react';
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
import { appVersion, buildTime, runtimeConfig } from '@/config/runtime-config';
import { getAppUeberblick } from '@/core/services/feedback/screenContext';
import {
  getChangelogMarkdown,
  getDisplayChangelog,
  hasUserChangelogContent,
  parseUserChangelog,
  bucketizeMinors,
  type ChangeCategory,
  type ChangelogMinor,
} from './deriveChangelog';

type FilterKey = 'all' | ChangeCategory;

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

export function UeberDieAppDialog({ open, onClose }: { open: boolean; onClose: () => void }): React.ReactElement | null {
  const [filter, setFilter] = useState<FilterKey>('all');
  // Konstant über die Laufzeit (gebündeltes Doc + Build-Konstanten) → einmal ableiten.
  const ueberblick = useMemo(() => getAppUeberblick(), []);
  const buildDatum = useMemo(() => {
    try {
      return new Date(buildTime).toLocaleDateString('de-DE');
    } catch {
      return buildTime;
    }
  }, []);
  // „Alle aufklappen": überschreibt die Default-Offen-Logik (erste 3 + Pakete zu) und öffnet
  // alles. Steckt in den Collapsible-Keys → Toggle mountet neu (Radix `defaultOpen` ist mount-only).
  const [expandAll, setExpandAll] = useState(false);

  const currentMajor = useMemo(() => {
    const n = Number.parseInt(appVersion.split('.')[0] ?? '', 10);
    return Number.isFinite(n) ? n : 0;
  }, []);

  // Aus CHANGELOG.md abgeleitete „Build-Wahrheit" ALLER Versionen — Lückenfüller der Anzeige
  // (garantiert, dass die neueste Version immer erscheint, auch wenn noch nicht geglättet).
  const derivedMarkdown = useMemo(
    () => getChangelogMarkdown(DEV_COMBINED, '', currentMajor),
    [currentMajor],
  );
  // Kuratierter Override: die hand-gepflegte, geglättete committed `changelog-user.md` (nur wenn
  // sie echte `## vX.Y`-Abschnitte trägt). Sie ist die Quelle der geglätteten Fassung; wird
  // zusammen mit CHANGELOG.md gepflegt und zur Build-Zeit eingebettet (kein Runtime-Share-Weg).
  const override = useMemo(
    () => (hasUserChangelogContent(userChangelogRaw) ? userChangelogRaw.trim() : ''),
    [],
  );
  // Anzeige: Override gewinnt je Version (schöne Prosa), fehlende (ältere) Versionen kommen
  // aus der Build-Ableitung — so hinkt nichts hinter dem Build her.
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
          min.changes.some((c) => matches(c.category)) ||
          (filter === 'all' && min.changes.length === 0 && min.bodyMarkdown.length > 0),
      ),
    }))
    .filter((maj) => maj.minors.length > 0);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Über die App"
      description="Was die App ist, welche Fassung läuft und was sich zuletzt geändert hat."
      size="2xl"
      align="center"
      resizable
      // Neuer Key bei jeder Default-Änderung: eine unter dem alten Namen gemerkte Größe
      // würde den neuen Default dauerhaft überstimmen (v2.360 zwei Abschnitte mehr,
      // v2.366 zweispaltig + breiter — sonst sähe niemand mit Alt-Eintrag die Änderung).
      resizeStorageKey="teamflow_ueber_app_dialog_size_v2"
    >
      {/* Zwei Spalten, damit „Änderungen & Updates" nicht unter dem langen Überblick
          verschwindet. `flex-wrap` statt Media-Query: maßgeblich ist die (frei ziehbare)
          Dialog-Breite, nicht die des Fensters — bei schmalem Dialog stapeln die Spalten. */}
      <div className="flex h-full min-h-0 flex-wrap gap-5">
        {/* Linke Spalte: Überblick (scrollt) + Version (steht fest darunter). */}
        {ueberblick !== null && (
          <div className="flex min-h-0 min-w-[300px] shrink grow basis-[360px] flex-col">
            <p className="mb-2 text-[13px] font-medium text-[var(--tf-text)]">Überblick</p>
            {/* Bis v2.360 sah dieses Doc nur die Feedback-KI. */}
            <div className="min-h-0 flex-1 overflow-y-auto rounded-[var(--tf-radius)] border border-[var(--tf-border)] px-3 py-2.5">
              <MarkdownRenderer content={ueberblick.markdown} />
            </div>
            {/* Version — was im Support-Fall gefragt wird, ohne Tooltip-Suche. */}
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-[var(--tf-radius)] bg-[var(--tf-bg-secondary)] px-3 py-2 text-[12px] text-[var(--tf-text-secondary)]">
              <span>Fassung <span className="font-mono text-[var(--tf-text)]">v{appVersion}</span></span>
              <span>Stand {buildDatum}</span>
              <span>Ausgabe {runtimeConfig.build.label}</span>
            </div>
          </div>
        )}

        {/* Rechte Spalte: Kopf (Titel + Filter) steht, nur die Liste scrollt. */}
        <div className="flex min-h-0 min-w-[380px] shrink grow basis-[560px] flex-col">
          <p className="mb-2 text-[13px] font-medium text-[var(--tf-text)]">
            Änderungen &amp; Updates <span className="font-normal text-[var(--tf-text-tertiary)]">— neueste zuerst</span>
          </p>

          {/* Kategorie-Filter */}
          <div className="mb-3 flex flex-wrap items-center gap-1 border-b border-[var(--tf-border)] pb-2">
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
            {/* Rechte Gruppe: Aufklapp-Steuerung (orthogonal zur Kategorie). */}
            <button
              type="button"
              onClick={() => setExpandAll((v) => !v)}
              aria-pressed={expandAll}
              className={`ml-auto rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                expandAll
                  ? 'bg-[var(--tf-primary-light)] text-[var(--tf-primary)]'
                  : 'text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]'
              }`}
            >
              {expandAll ? 'Alle zuklappen' : 'Alle aufklappen'}
            </button>
          </div>

          {visibleMajors.length === 0 ? (
            <p className="py-6 text-sm text-[var(--tf-text-secondary)]">
              Keine Einträge in dieser Kategorie.
            </p>
          ) : (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-2">
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
                      // Tab-Wechsel neu mounten (Radix `defaultOpen` greift nur beim Mount).
                      const { loose, buckets } = bucketizeMinors(
                        maj.minors,
                        maj.major === currentMajor ? 3 : 0,
                        maj.major,
                      );
                      return (
                        <>
                          {loose.map((min, idx) => (
                            <MinorCard
                              key={`${filter}-${min.minor}`}
                              min={min}
                              defaultOpen={expandAll || (maj.major === currentMajor && idx < 3)}
                              matches={matches}
                            />
                          ))}
                          {buckets.map((bucket) => (
                            <Collapsible
                              key={`${filter}-${bucket.key}`}
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
        </div>
      </div>
    </Dialog>
  );
}
