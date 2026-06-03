/**
 * ManuellerMaPicker (v2.19) — Button + ausklappbare Liste ALLER aktiven MAs,
 * damit die PL einen Antrag auch an einen MA zuweisen kann, den der Matcher
 * nicht vorgeschlagen hat. Auswahl erzeugt eine manuelle Vorschlags-Card
 * (siehe `buildManualMatch`).
 *
 * Rein praesentational: keine Async-Aktion, kein Store-Zugriff — die Auswahl
 * wird per `onAdd(anonId)` an den Cockpit-Container gereicht.
 */
import { useMemo, useState } from 'react';
import { UserPlus, Search } from 'lucide-react';
import type { AnonymerMitarbeiter } from '../types';
import { AnonymIdBadge } from './AnonymIdBadge';

interface Props {
  mitarbeiter: Record<string, AnonymerMitarbeiter>;
  /** anonIds, die bereits als Card sichtbar sind (Matcher-Vorschlag oder schon manuell). */
  excludeAnonIds: Set<string>;
  /** anonId → echtes Kuerzel (De-Anon-Resolver des Cockpits; null = nicht aufgelöst). */
  resolveName: (anonId: string) => string | null | undefined;
  /** Optionaler Kapazitaets-Hinweis pro MA (freie TVs) — hilft beim Auswaehlen. */
  restTVsByAnon?: Map<string, number>;
  onAdd: (anonId: string) => void;
}

export function ManuellerMaPicker({
  mitarbeiter, excludeAnonIds, resolveName, restTVsByAnon, onAdd,
}: Props): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const aktiveMas = useMemo(() => {
    const list = Object.values(mitarbeiter)
      .filter(m => m.aktiv && !excludeAnonIds.has(m.anonId))
      .map(m => ({ ma: m, name: resolveName(m.anonId) ?? '' }));
    list.sort((a, b) => (a.name || a.ma.anonId).localeCompare(b.name || b.ma.anonId, 'de'));
    return list;
  }, [mitarbeiter, excludeAnonIds, resolveName]);

  const gefiltert = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return aktiveMas;
    return aktiveMas.filter(({ ma, name }) =>
      name.toLowerCase().includes(q)
      || ma.anonId.toLowerCase().includes(q)
      || (ma.hauptKategorie ?? '').toLowerCase().includes(q),
    );
  }, [aktiveMas, query]);

  function add(anonId: string): void {
    onAdd(anonId);
    setOpen(false);
    setQuery('');
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1.5 text-[11.5px] px-2 py-1 rounded-md cursor-pointer"
        style={{ border: '0.5px solid var(--tf-border)', color: 'var(--tf-text-secondary)' }}
        title="Einen aktiven MA manuell als Vorschlag hinzufügen (auch ohne Matching-Treffer)"
        aria-expanded={open}
      >
        <UserPlus size={13} aria-hidden />
        MA manuell hinzufügen
      </button>

      {open && (
        <div
          className="absolute right-0 z-20 mt-1 w-[280px] rounded-[10px] overflow-hidden flex flex-col"
          style={{ background: 'var(--tf-bg)', border: '0.5px solid var(--tf-border)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
        >
          <div className="flex items-center gap-1.5 px-2 py-1.5" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
            <Search size={12} className="text-[var(--tf-text-tertiary)] shrink-0" aria-hidden />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="MA suchen…"
              className="w-full bg-transparent text-[12px] outline-none text-[var(--tf-text)] placeholder:text-[var(--tf-text-tertiary)]"
            />
          </div>
          <ul className="max-h-[240px] overflow-y-auto py-1">
            {gefiltert.map(({ ma }) => {
              const restTVs = restTVsByAnon?.get(ma.anonId);
              return (
                <li key={ma.anonId}>
                  <button
                    type="button"
                    onClick={() => add(ma.anonId)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-left cursor-pointer hover:bg-[var(--tf-bg-secondary)]"
                  >
                    <AnonymIdBadge anonId={ma.anonId} size="sm" realName={resolveName(ma.anonId)} />
                    {ma.hauptKategorie && (
                      <span className="text-[10.5px] text-[var(--tf-text-tertiary)]">{ma.hauptKategorie}</span>
                    )}
                    {typeof restTVs === 'number' && (
                      <span className="ml-auto text-[10.5px] text-[var(--tf-text-tertiary)] shrink-0">
                        {restTVs} TVs frei
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
            {gefiltert.length === 0 && (
              <li className="px-2 py-3 text-center text-[11.5px] text-[var(--tf-text-tertiary)]">
                Keine aktiven MAs gefunden.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
