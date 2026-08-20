/**
 * Widget „Zuletzt geändert" (Home, Seitenspalte — Phase 4 v1.1, Kurator-only).
 *
 * Read-only + Navigation: zeigt die jüngsten Skill-/Regel-Änderungen der
 * geladenen Registry (Selektor registryAenderungen.ts — kein neues Journal).
 * Permanente Warn-Fußzeile: Aktivierungen sind sofort für ALLE Varianten live —
 * der wichtigste Betriebs-Invariant, dem Kurator täglich vor Augen.
 *
 * Hieß bis v4.133 „Registry-Änderungen" — ein Wort aus `registry.json`, das in
 * der Oberfläche sonst nirgends vorkommt. Die Typ-Id `registry-aenderungen`
 * bleibt: sie steht in persistierten Nutzer-Configs, ein Umbenennen verlöre
 * jede bestehende Startseiten-Einstellung.
 *
 * Ein Klick öffnet GENAU den angeklickten Eintrag (`selectedId`) — Skill wie
 * Regel, beide über dieselbe Route `/kuration/skill-verwaltung/<eintragId>`.
 * Bis v4.133 landete er auf der Skills-Liste ohne Auswahl: die Deep-Link-Route
 * war längst gebaut, nur rief sie niemand auf.
 */
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Pencil, Plus, Power, PowerOff, type LucideIcon } from 'lucide-react';
import { useNavigation } from '@/core/hooks/useNavigation';
import { useStorage } from '@/core/hooks/useStorage';
import { alterInTagen } from '@/core/utils/relativeZeit';
import { readCachedSkillRegistry } from '@/core/services/skills';
import type { SkillRegistryFile } from '@/core/services/skills';
import {
  baueRegistryAenderungen, zaehleRegistryAenderungen,
  type AenderungsArt, type RegistryAenderung,
} from './registryAenderungen';
import { WidgetShell } from './WidgetShell';
import type { WidgetProps } from './widgetProps';

const DEFAULT_MAX = 3;

const ART_ICON: Record<AenderungsArt, LucideIcon> = {
  neu: Plus,
  geaendert: Pencil,
  aktiviert: Power,
  deaktiviert: PowerOff,
};
const ART_LABEL: Record<AenderungsArt, string> = {
  neu: 'neu',
  geaendert: 'geändert',
  aktiviert: 'aktiviert',
  deaktiviert: 'deaktiviert',
};
const REIFEGRAD_LABEL: Record<string, string> = {
  entwurf: 'Entwurf',
  erprobt: 'Erprobt',
  empfohlen: 'Empfohlen',
};

function tageSeit(iso: string, nowMs: number): number | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((nowMs - t) / 86_400_000));
}

export function RegistryAenderungenWidget({ instanz, onToggleEingeklappt }: WidgetProps): React.ReactElement {
  const storage = useStorage();
  const { navigate } = useNavigation();
  const maxEintraege = instanz.config.art === 'registry-aenderungen' ? instanz.config.maxEintraege : DEFAULT_MAX;

  // Cache-Read ist ein einzelner IDB-Key (günstig) → immer laden, auch eingeklappt
  // (der Zähler zeigt dann etwas). Kein 13k-Aggregat wie bei Kanban/Auslastung.
  const [file, setFile] = useState<SkillRegistryFile | null>(null);
  useEffect(() => {
    let cancelled = false;
    readCachedSkillRegistry(storage.idb)
      .then(f => { if (!cancelled) setFile(f); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [storage.idb]);

  const zeilen = useMemo(
    () => (file ? baueRegistryAenderungen(file.skills, file.regeln, maxEintraege) : []),
    [file, maxEintraege],
  );
  // Der Zähler nennt den BESTAND, nicht die Kappungs-Grenze (v4.131).
  const gesamt = useMemo(
    () => (file ? zaehleRegistryAenderungen(file.skills, file.regeln) : 0),
    [file],
  );

  return (
    <WidgetShell
      titel="Zuletzt geändert"
      meta="Nur Kurator"
      variante="seite"
      eingeklappt={instanz.eingeklappt}
      onToggleEingeklappt={onToggleEingeklappt}
      instanz={instanz}
      zaehler={
        gesamt > 0 ? (
          <span
            className="text-[12px] tabular-nums text-[var(--tf-text-tertiary)]"
            title={gesamt > zeilen.length
              ? `${gesamt} Einträge in der Registry, die ${zeilen.length} jüngsten stehen hier. Alle in der Skill-Verwaltung.`
              : undefined}
          >
            {gesamt > zeilen.length ? `${zeilen.length} / ${gesamt}` : gesamt}
          </span>
        ) : undefined
      }
    >
      {zeilen.length === 0 ? (
        <p className="text-[12px] text-[var(--tf-text-tertiary)] py-1">Keine jüngsten Änderungen.</p>
      ) : (
        <div className="flex flex-col">
          {zeilen.map((z, i) => (
            <AenderungZeile
              key={z.key}
              aenderung={z}
              onOpen={() => navigate('skill-verwaltung-kuration', { selectedId: z.id })}
              last={i === zeilen.length - 1}
            />
          ))}
        </div>
      )}
      {/* Permanenter Betriebs-Invariant — Warn-Ton, immer sichtbar. */}
      <p className="mt-2 pt-2 flex items-start gap-1.5 text-[11px] leading-snug text-[var(--tf-warning-text)]" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
        <AlertTriangle size={12} className="shrink-0 mt-px" aria-hidden />
        Aktivierungen wirken sofort für alle Varianten.
      </p>
    </WidgetShell>
  );
}

function AenderungZeile({ aenderung, onOpen, last }: { aenderung: RegistryAenderung; onOpen: () => void; last: boolean }): React.ReactElement {
  const Icon = ART_ICON[aenderung.art];
  const tage = tageSeit(aenderung.geaendertAm, Date.now());
  const suffix = aenderung.art === 'aktiviert'
    ? ' · live in allen Varianten'
    : (!aenderung.aktiv ? ' · aktiv: false' : '');
  const reifegradSuffix = aenderung.art === 'neu' && aenderung.reifegrad
    ? ` als ${REIFEGRAD_LABEL[aenderung.reifegrad] ?? aenderung.reifegrad}`
    : '';
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left py-2 cursor-pointer group"
      style={last ? undefined : { borderBottom: '0.5px solid var(--tf-border)' }}
    >
      <div className="flex items-start gap-2">
        <Icon size={13} className="shrink-0 mt-0.5 text-[var(--tf-text-tertiary)]" aria-hidden />
        <span className="min-w-0 flex-1 text-[12.5px] leading-snug text-[var(--tf-text)] group-hover:text-[var(--tf-primary)]">
          {aenderung.objektArt === 'skill' ? 'Skill ' : 'Regel '}
          {aenderung.objektArt === 'skill'
            ? <code className="font-mono text-[12px] text-[var(--tf-text)]">{aenderung.id}</code>
            : <span className="font-medium">„{aenderung.name}"</span>}
          {' '}{ART_LABEL[aenderung.art]}{reifegradSuffix}
        </span>
      </div>
      <p className="mt-0.5 ml-[21px] text-[11px] tabular-nums text-[var(--tf-text-tertiary)]">
        {alterInTagen(tage) ?? ''}{suffix}
      </p>
    </button>
  );
}
