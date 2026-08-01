/**
 * Regeln-Tab — zwei Regelwerke nebeneinander.
 *
 * Oben die **To-do-Kaskade** des Vorgangssystems (geordnet, erste zutreffende
 * Regel gewinnt), darunter die alten **Nächste-Schritte-Regeln** (priorisiert,
 * alle zutreffenden liefern Schritte). Die beiden folgen verschiedenen
 * Auswertungsmodellen; sie zusammenzulegen wäre erst nach dem Rückbau (P6)
 * ehrlich, wenn geklärt ist, welches bleibt.
 *
 * Die Bedingung wird über den geteilten `bedingungAlsText` gerendert — nicht
 * über einen tab-eigenen Formatierer, der die Operatoren des Vorgangssystems
 * nicht kennte.
 */
import { Badge } from '@/components/ui/badge';
import { isVorgangssystemEnabled } from '@/config/feature-flags';
import type { StatusCockpitApi } from './useStatusCockpit';
import { bedingungAlsText } from '@/core/status';
import type { MappingVersion, NaechsterSchrittRegel } from '@/core/status';
import { WERKZEUG_LABEL, feldKlasse, feldStil } from './labels';
import { TodoRegelnBereich } from './TodoRegelnBereich';

function RegelKarte({ r, version, api }: {
  r: NaechsterSchrittRegel; version: MappingVersion; api: StatusCockpitApi;
}): React.ReactElement {
  return (
    <div
      className="rounded px-3 py-2.5 flex flex-col gap-2"
      style={{ ...feldStil, opacity: r.aktiv ? 1 : 0.6 }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <label className="inline-flex items-center gap-1.5 text-[12px] text-[var(--tf-text-secondary)] cursor-pointer">
          <input
            type="checkbox" className="accent-[var(--tf-primary)] cursor-pointer" checked={r.aktiv}
            onChange={e => api.setRegel(r.id, { aktiv: e.target.checked })}
          />
          aktiv
        </label>
        <label className="inline-flex items-center gap-1.5 text-[12px] text-[var(--tf-text-secondary)]">
          Priorität
          <input
            type="number" value={r.prioritaet} className="w-[64px] text-[12.5px] rounded px-2 py-1 bg-[var(--tf-bg)] text-[var(--tf-text)]"
            style={feldStil}
            onChange={e => api.setRegel(r.id, { prioritaet: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : 0 })}
          />
        </label>
        {!r.aktiv && <Badge variant="default">stillgelegt</Badge>}
        <span className="ml-auto text-[11px] font-mono text-[var(--tf-text-tertiary)]">{r.id}</span>
      </div>

      <input
        value={r.beschreibung} placeholder="Beschreibung der Regel" className={feldKlasse} style={feldStil}
        onChange={e => api.setRegel(r.id, { beschreibung: e.target.value })}
      />

      <div className="text-[11px] text-[var(--tf-text-tertiary)]">
        <span className="uppercase tracking-wide">Wenn</span>{' '}
        <span className="text-[var(--tf-text-secondary)]">{bedingungAlsText(r.bedingung, version)}</span>
      </div>

      {r.schritte.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-[var(--tf-text-tertiary)] uppercase tracking-wide">Dann</span>
          {r.schritte.map((s, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 text-[11.5px] rounded-full px-2.5 py-[3px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]"
            >
              {s.label}
              {s.werkzeug && (
                <span className="text-[10px] text-[var(--tf-text-tertiary)]">· {WERKZEUG_LABEL[s.werkzeug]}</span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function RegelnTab({ api }: { api: StatusCockpitApi }): React.ReactElement | null {
  const entwurf = api.entwurf;
  if (!entwurf) return null;

  const regeln = [...entwurf.regeln].sort((a, b) => a.prioritaet - b.prioritaet);

  return (
    <div className="flex flex-col gap-4 pt-3">
      {isVorgangssystemEnabled() && <TodoRegelnBereich version={entwurf} api={api} />}

      <section className="flex flex-col gap-2.5">
        <h3 className="text-[13px] font-medium text-[var(--tf-text)]">
          Nächste-Schritte-Regeln (alte Ableitung)
        </h3>
        <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
          {regeln.length} Regeln, aufsteigend nach Priorität. Anders als die Kaskade oben liefern
          hier <strong>alle</strong> zutreffenden aktiven Regeln Schritte. Die Bedingungsstruktur
          wird nur angezeigt.
        </p>
        {regeln.map(r => <RegelKarte key={r.id} r={r} version={entwurf} api={api} />)}
        {regeln.length === 0 && (
          <p className="text-[12.5px] text-[var(--tf-text-tertiary)]">Keine Regeln im Entwurf.</p>
        )}
      </section>
    </div>
  );
}
