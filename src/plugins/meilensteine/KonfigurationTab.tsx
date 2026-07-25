/**
 * Konfigurations-Tab: der Meilenstein-Baum der PL. Struktur (wie viele
 * Meilensteine, welche Soll-Woche) und Zuordnung (welche CSV-Spalte erfüllt ihn)
 * an einer Stelle, ohne Code-Änderung.
 *
 * Jeder Knoten ist eine aufklappbare Zeile: Kopf mit Nummer, Label, Soll-Woche
 * und Zustandsschaltern, Körper mit dem Bedingungs-Editor. Unbestätigte
 * Zuordnungen aus dem Auslieferungs-Plan tragen einen sichtbaren Hinweis — wer
 * eine geratene Zahl für bare Münze nimmt, plant falsch.
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ToggleChip } from '@/components/ui/ToggleChip';
import {
  aendereKnoten, entferneKnoten, fuegeKnotenHinzu, sortiereKnoten, tiefeVon, verschiebeKnoten,
  type MeilensteinKnoten, type SpaltenEintrag,
} from '@/core/meilensteine';
import { ANTRAGSTYP_BUCKETS } from '@/core/utils/vb-phase-mappings';
import { BedingungEditor } from './BedingungEditor';
import { TYP_LABEL, feldStil } from './labels';

interface Props {
  knoten: MeilensteinKnoten[];
  gesamtfristTage: number;
  spalten: SpaltenEintrag[];
  schreibgeschuetzt: boolean;
  onKnoten: (k: MeilensteinKnoten[]) => void;
  onGesamtfrist: (tage: number) => void;
}

function KnotenZeile({
  knoten, alle, spalten, schreibgeschuetzt, offen, onToggleOffen, onKnoten,
}: {
  knoten: MeilensteinKnoten;
  alle: MeilensteinKnoten[];
  spalten: SpaltenEintrag[];
  schreibgeschuetzt: boolean;
  offen: boolean;
  onToggleOffen: () => void;
  onKnoten: (k: MeilensteinKnoten[]) => void;
}): React.ReactElement {
  const tiefe = tiefeVon(alle, knoten.id);
  const patch = (p: Partial<MeilensteinKnoten>): void => onKnoten(aendereKnoten(alle, knoten.id, p));

  return (
    <div className="rounded" style={{ ...feldStil, marginLeft: tiefe * 20 }}>
      <div className="flex items-center gap-2 px-2 py-1.5 flex-wrap">
        <button
          type="button"
          onClick={onToggleOffen}
          aria-expanded={offen}
          aria-label={offen ? 'Bedingung einklappen' : 'Bedingung ausklappen'}
          className="p-0.5 rounded text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
        >
          {offen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        <span className="text-[12px] font-mono text-[var(--tf-text-tertiary)] w-[46px] shrink-0">
          {knoten.nummer || '—'}
        </span>

        <input
          value={knoten.label}
          onChange={e => patch({ label: e.target.value })}
          disabled={schreibgeschuetzt}
          aria-label="Bezeichnung"
          className="flex-1 min-w-[180px] text-[13px] rounded px-2 py-1 bg-[var(--tf-bg)] text-[var(--tf-text)] disabled:opacity-60"
          style={feldStil}
        />

        <label className="flex items-center gap-1 text-[11.5px] text-[var(--tf-text-tertiary)]">
          Woche
          <input
            type="number" min={0}
            value={knoten.sollWoche}
            onChange={e => patch({ sollWoche: Math.max(0, Number(e.target.value) || 0) })}
            disabled={schreibgeschuetzt}
            className="w-[56px] text-[12px] rounded px-1.5 py-1 bg-[var(--tf-bg)] text-[var(--tf-text)] text-right disabled:opacity-60"
            style={feldStil}
          />
        </label>

        <ToggleChip
          label="aktiv"
          selected={knoten.aktiv}
          onToggle={() => patch({ aktiv: !knoten.aktiv })}
          disabled={schreibgeschuetzt}
          title="Inaktive Meilensteine werden nie als gerissen gezählt"
        />
        <ToggleChip
          label="Frist"
          selected={knoten.relevantFuerFrist}
          onToggle={() => patch({ relevantFuerFrist: !knoten.relevantFuerFrist })}
          disabled={schreibgeschuetzt}
          title="Zählt in die Prognose zur Gesamtfrist"
        />

        {knoten.unbestaetigt && (
          <span title="Vorbelegung aus dem Auslieferungs-Plan — bitte prüfen">
            <Badge variant="warning">unbestätigt</Badge>
          </span>
        )}

        {!schreibgeschuetzt && (
          <span className="ml-auto flex items-center gap-0.5">
            <button
              type="button" aria-label="Nach oben" title="Nach oben"
              onClick={() => onKnoten(verschiebeKnoten(alle, knoten.id, 'hoch'))}
              className="p-1 rounded text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
            >
              <ChevronUp size={13} />
            </button>
            <button
              type="button" aria-label="Nach unten" title="Nach unten"
              onClick={() => onKnoten(verschiebeKnoten(alle, knoten.id, 'runter'))}
              className="p-1 rounded text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
            >
              <ChevronDown size={13} />
            </button>
            <button
              type="button" aria-label="Unter-Meilenstein anlegen" title="Unter-Meilenstein anlegen"
              onClick={() => onKnoten(fuegeKnotenHinzu(alle, knoten.id))}
              className="p-1 rounded text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
            >
              <Plus size={13} />
            </button>
            <button
              type="button" aria-label="Meilenstein löschen" title="Meilenstein und Unter-Meilensteine löschen"
              onClick={() => onKnoten(entferneKnoten(alle, knoten.id))}
              className="p-1 rounded text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)] cursor-pointer"
            >
              <Trash2 size={13} />
            </button>
          </span>
        )}
      </div>

      {offen && (
        <div className="border-t border-[var(--tf-border)] px-3 py-2 flex flex-col gap-2">
          <input
            value={knoten.beschreibung ?? ''}
            onChange={e => patch({ beschreibung: e.target.value })}
            disabled={schreibgeschuetzt}
            placeholder="Beschreibung (optional)"
            aria-label="Beschreibung"
            className="text-[12px] rounded px-2 py-1 bg-[var(--tf-bg)] text-[var(--tf-text-secondary)] disabled:opacity-60"
            style={feldStil}
          />

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">Gilt für:</span>
            {ANTRAGSTYP_BUCKETS.map(t => (
              <ToggleChip
                key={t}
                label={TYP_LABEL[t]}
                selected={knoten.nurTypen.length === 0 || knoten.nurTypen.includes(t)}
                disabled={schreibgeschuetzt}
                onToggle={() => {
                  const aktuell = knoten.nurTypen.length === 0 ? [...ANTRAGSTYP_BUCKETS] : knoten.nurTypen;
                  const naechste = aktuell.includes(t) ? aktuell.filter(x => x !== t) : [...aktuell, t];
                  // Alle ausgewählt ⇒ wieder „gilt für alle" (leere Liste).
                  patch({ nurTypen: naechste.length === ANTRAGSTYP_BUCKETS.length ? [] : naechste });
                }}
              />
            ))}
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">Erfüllt, wenn:</span>
            {schreibgeschuetzt ? (
              <p className="text-[12px] text-[var(--tf-text-tertiary)]">
                Nur Lesezugriff — die Bedingung kann hier nicht geändert werden.
              </p>
            ) : (
              <BedingungEditor
                bedingung={knoten.bedingung}
                spalten={spalten}
                onChange={b => patch({ bedingung: b })}
              />
            )}
          </div>

          <label className="flex items-center gap-2 text-[11.5px] text-[var(--tf-text-tertiary)]">
            Ist-Termin aus Feld
            <select
              value={knoten.istDatumFeld ?? ''}
              onChange={e => patch({ istDatumFeld: e.target.value || undefined })}
              disabled={schreibgeschuetzt}
              className="text-[12px] rounded px-1.5 py-1 bg-[var(--tf-bg)] text-[var(--tf-text)] max-w-[260px] cursor-pointer disabled:opacity-60"
              style={feldStil}
            >
              <option value="">— frühestes Datum der Bedingungs-Felder —</option>
              {spalten.filter(s => s.typ === 'datum').map(s => (
                <option key={s.feldId} value={s.feldId}>
                  {s.label === s.feldId ? s.feldId : `${s.label} · ${s.feldId}`}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}

export function KonfigurationTab({
  knoten, gesamtfristTage, spalten, schreibgeschuetzt, onKnoten, onGesamtfrist,
}: Props): React.ReactElement {
  const [offene, setOffene] = useState<Set<string>>(new Set());
  const sortiert = sortiereKnoten(knoten);
  const unbestaetigt = knoten.filter(k => k.unbestaetigt).length;

  return (
    <div className="flex flex-col gap-3 pt-4">
      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-1.5 text-[12.5px] text-[var(--tf-text-secondary)]">
          Gesamtfrist ab Antragseingang
          <input
            type="number" min={1}
            value={gesamtfristTage}
            onChange={e => onGesamtfrist(Math.max(1, Number(e.target.value) || 1))}
            disabled={schreibgeschuetzt}
            className="w-[72px] text-[12.5px] rounded px-2 py-1 bg-[var(--tf-bg)] text-[var(--tf-text)] text-right disabled:opacity-60"
            style={feldStil}
          />
          Tage
        </label>
        {!schreibgeschuetzt && (
          <Button variant="ghost" size="sm" icon={Plus} onClick={() => onKnoten(fuegeKnotenHinzu(knoten, null))}>
            Meilenstein
          </Button>
        )}
        {unbestaetigt > 0 && (
          <span className="text-[12px] text-[var(--tf-warning-text)]">
            {unbestaetigt} {unbestaetigt === 1 ? 'Zuordnung wartet' : 'Zuordnungen warten'} auf Bestätigung
          </span>
        )}
      </div>

      {sortiert.length === 0 ? (
        <p className="text-[12.5px] text-[var(--tf-text-tertiary)]">
          Noch kein Meilenstein angelegt.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {sortiert.map(k => (
            <KnotenZeile
              key={k.id}
              knoten={k}
              alle={knoten}
              spalten={spalten}
              schreibgeschuetzt={schreibgeschuetzt}
              offen={offene.has(k.id)}
              onToggleOffen={() => setOffene(s => {
                const n = new Set(s);
                if (n.has(k.id)) n.delete(k.id); else n.add(k.id);
                return n;
              })}
              onKnoten={onKnoten}
            />
          ))}
        </div>
      )}
    </div>
  );
}
