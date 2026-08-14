/**
 * Die gesetzten Statuseinträge eines Verbunds, gruppiert nach den Ordnern des
 * Fachsystems (Kommunikation, Antragsbearbeitung → pre-check, …).
 *
 * Die Timeline darüber beantwortet „wann ist was passiert", diese Liste
 * „was steht in welchem Ordner" — dieselbe Ordnung, in der das Team seine
 * Vorgänge kennt. Read-only; kuratiert wird im Status-Cockpit.
 *
 * Die eigene Rolle (Profil) ist eine **Vorauswahl, keine Sperre**: die Liste
 * startet gefiltert, „Alle" ist ein Klick entfernt. Neutrale Einträge — die das
 * Fachsystem von jedem setzen lässt — bleiben unter jeder Wahl sichtbar.
 *
 * Einklappbar mit Default ZU (Vorgabe zentral in `detailSektionen.ts`): die
 * Ordner-Liste ist der längste Block der Statussektion — an einem Verbund mit
 * drei Teilvorhaben über 1.100 px. Wer sie ungefragt ausrollte, schob Chronik
 * und Navigator aus dem Blick. Die Anzahl steht auch zugeklappt im Kopf.
 */
import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { ToggleChip } from '@/components/ui/ToggleChip';
import { useCollapsedSection } from '@/core/hooks/useCollapsedSection';
import { useProfile } from '@/core/hooks/useProfile';
import { parseGermanDate } from '@/core/services/csv/dateParse';
import { sektionOffenDefault, sektionsKey } from '../detailSektionen';
import {
  flacheBaumListe, NICHT_ZUGEORDNET_ID, ROLLEN, ROLLE_LABEL, ROLLE_LANG,
  betrifftRolle, istNeutral, leseStatusRolle, rollenLabel,
  type FeldVorkommen, type MappingVersion, type Rolle,
} from '@/core/status';

const EBENE_LABEL: Record<'verbund' | 'tv', string> = { verbund: 'Verbund', tv: 'Teilvorhaben' };

/** Datum lesbar, sonst der Rohwert (Textfelder tragen keinen Termin). */
function anzeige(v: FeldVorkommen): string {
  if (v.feld.typ !== 'datum') return v.wert;
  const iso = parseGermanDate(v.wert);
  if (!iso) return v.wert;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? v.wert
    : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function StatusCodeListe({ version, vorkommen }: {
  version: MappingVersion;
  vorkommen: readonly FeldVorkommen[];
}): React.ReactElement | null {
  const { profile } = useProfile();
  const [rolle, setRolle] = useState<Rolle | 'alle'>(() => leseStatusRolle(profile?.status_rolle));
  // Hook VOR dem Early Return (Hook-Reihenfolge, React #310) — die Vorgabe steht
  // zentral in `detailSektionen.ts`, nicht hier.
  const [offen, toggleOpen] = useCollapsedSection(
    sektionsKey('statuseintraege'), { defaultOpen: sektionOffenDefault('statuseintraege') },
  );

  const kategorien = version.kategorien ?? [];

  /** Nur Einträge, die überhaupt angezeigt werden sollen — „Ignoriert" heißt hier: nirgends. */
  const sichtbar = useMemo(
    () => vorkommen.filter(v =>
      v.feld.aktiv && v.feld.prominenzDefault !== 'ignoriert' && betrifftRolle(v.feld, rolle)),
    [vorkommen, rolle],
  );

  const proOrdner = useMemo(() => {
    const m = new Map<string, FeldVorkommen[]>();
    for (const v of sichtbar) {
      const id = v.feld.kategorieId ?? NICHT_ZUGEORDNET_ID[v.feld.ebene];
      const liste = m.get(id);
      if (liste) liste.push(v); else m.set(id, [v]);
    }
    return m;
  }, [sichtbar]);

  if (kategorien.length === 0 || vorkommen.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={toggleOpen}
          aria-expanded={offen}
          className="flex items-center gap-1.5 cursor-pointer"
        >
          <ChevronRight
            size={14}
            className="text-[var(--tf-text-tertiary)] transition-transform duration-200 shrink-0"
            style={{ transform: offen ? 'rotate(90deg)' : 'rotate(0deg)' }}
          />
          <h4 className="text-[13px] font-medium text-[var(--tf-text)]">Statuseinträge</h4>
        </button>
        {/* Die Anzahl bleibt AUCH zugeklappt stehen — eine eingeklappte Zeile,
            die nichts aussagt, zwingt zum Aufklappen, nur um zu erfahren, ob es
            sich lohnt (dieselbe Regel wie an „Nächste Schritte"). */}
        <span className="text-[12px] text-[var(--tf-text-tertiary)]">{sichtbar.length}</span>
        <span className="flex-1" />
        {/* Die Rollen-Chips filtern den Rumpf; zugeklappt steuerten sie nichts
            Sichtbares und gäben vor, die Kopfzahl daneben zu meinen. */}
        {offen && (['alle', ...ROLLEN] as const).map(r => (
          <ToggleChip
            key={r}
            label={r === 'alle' ? 'Alle' : ROLLE_LABEL[r]}
            title={r === 'alle' ? undefined : ROLLE_LANG[r]}
            selected={rolle === r}
            onToggle={() => setRolle(r)}
          />
        ))}
      </div>

      {/* CSS-`hidden` statt Unmount: die Rollen-Wahl oben ist lokaler Zustand und
          soll das Zuklappen überleben. */}
      <div className={offen ? 'flex flex-col gap-2' : 'hidden'}>
      {(['verbund', 'tv'] as const).map(ebene => {
        const ordner = flacheBaumListe(kategorien, ebene)
          .filter(({ kategorie }) => (proOrdner.get(kategorie.id) ?? []).length > 0);
        if (ordner.length === 0) return null;
        return (
          <div key={ebene} className="flex flex-col gap-1">
            <h5 className="text-[11px] font-medium text-[var(--tf-text-tertiary)] uppercase tracking-wide">
              {EBENE_LABEL[ebene]}
            </h5>
            {ordner.map(({ kategorie, tiefe }) => (
              <div key={kategorie.id} style={{ marginLeft: tiefe * 12 }}>
                <div className="text-[12px] font-medium text-[var(--tf-text-secondary)] mt-1">
                  {kategorie.label}
                </div>
                {(proOrdner.get(kategorie.id) ?? []).map(v => (
                  <div
                    key={`${v.feld.feldId}|${v.tvId ?? ''}`}
                    className="flex items-baseline gap-2 py-0.5 border-b border-[var(--tf-border)]"
                  >
                    <span className="text-[12.5px] text-[var(--tf-text)] flex-1 min-w-0 truncate" title={v.feld.label}>
                      {v.feld.label}
                    </span>
                    {v.tvId && (
                      <span className="text-[11px] font-mono text-[var(--tf-text-tertiary)] shrink-0">{v.tvId}</span>
                    )}
                    {/* Neutrale Einträge tragen kein Kürzel: „alle" an jeder
                        zweiten Zeile wäre Rauschen ohne Information. */}
                    {!istNeutral(v.feld) && (
                      <span className="text-[11px] text-[var(--tf-text-tertiary)] shrink-0">
                        {rollenLabel(v.feld)}
                      </span>
                    )}
                    <span className="text-[12px] text-[var(--tf-text-secondary)] shrink-0 tabular-nums" title={v.text}>
                      {anzeige(v)}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        );
      })}

      {sichtbar.length === 0 && (
        <p className="text-[12.5px] text-[var(--tf-text-tertiary)] py-2">
          Für diese Rolle sind keine Statuseinträge gesetzt.
        </p>
      )}
      </div>
    </section>
  );
}
