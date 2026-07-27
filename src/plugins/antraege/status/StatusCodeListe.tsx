/**
 * Die gesetzten Statuseinträge eines Verbunds, gruppiert nach den Ordnern des
 * Fachsystems (Kommunikation, Antragsbearbeitung → pre-check, …).
 *
 * Die Timeline darüber beantwortet „wann ist was passiert", diese Liste
 * „was steht in welchem Ordner" — dieselbe Ordnung, in der das Team seine
 * Vorgänge kennt. Read-only; kuratiert wird im Status-Cockpit.
 *
 * Die eigene Rolle (Profil: AB/FB) ist eine **Vorauswahl, keine Sperre**: die
 * Liste startet gefiltert, „Alle" ist ein Klick entfernt.
 */
import { useMemo, useState } from 'react';
import { ToggleChip } from '@/components/ui/ToggleChip';
import { useProfile } from '@/core/hooks/useProfile';
import { parseGermanDate } from '@/core/services/csv/dateParse';
import {
  flacheBaumListe, NICHT_ZUGEORDNET_ID,
  type FeldVorkommen, type MappingVersion, type Zustaendigkeit,
} from '@/core/status';

const EBENE_LABEL: Record<'verbund' | 'tv', string> = { verbund: 'Verbund', tv: 'Teilvorhaben' };
const ZUST_LABEL: Record<Zustaendigkeit, string> = { ab: 'AB', fb: 'FB', beide: 'AB + FB' };

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

/** Passt der Eintrag zur gewählten Rolle? `beide` ist immer relevant. */
function passtZuRolle(v: FeldVorkommen, rolle: Zustaendigkeit): boolean {
  if (rolle === 'beide') return true;
  const z = v.feld.zustaendigkeit ?? 'beide';
  return z === 'beide' || z === rolle;
}

export function StatusCodeListe({ version, vorkommen }: {
  version: MappingVersion;
  vorkommen: readonly FeldVorkommen[];
}): React.ReactElement | null {
  const { profile } = useProfile();
  const [rolle, setRolle] = useState<Zustaendigkeit>(() => profile?.status_rolle ?? 'beide');

  const kategorien = version.kategorien ?? [];

  /** Nur Einträge, die überhaupt angezeigt werden sollen — „Ignoriert" heißt hier: nirgends. */
  const sichtbar = useMemo(
    () => vorkommen.filter(v =>
      v.feld.aktiv && v.feld.prominenzDefault !== 'ignoriert' && passtZuRolle(v, rolle)),
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
        <h4 className="text-[13px] font-medium text-[var(--tf-text)]">Statuseinträge</h4>
        <span className="text-[12px] text-[var(--tf-text-tertiary)]">{sichtbar.length}</span>
        <span className="flex-1" />
        {(['beide', 'ab', 'fb'] as const).map(r => (
          <ToggleChip
            key={r}
            label={r === 'beide' ? 'Alle' : ZUST_LABEL[r]}
            selected={rolle === r}
            onToggle={() => setRolle(r)}
          />
        ))}
      </div>

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
                    {(v.feld.zustaendigkeit ?? 'beide') !== 'beide' && (
                      <span className="text-[11px] text-[var(--tf-text-tertiary)] shrink-0">
                        {ZUST_LABEL[v.feld.zustaendigkeit!]}
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
    </section>
  );
}
