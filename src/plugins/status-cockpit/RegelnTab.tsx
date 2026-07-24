/**
 * Regeln-Tab — Nächste-Schritte-Regeln kuratieren.
 *
 * Liste der Regelblätter (nach Priorität) mit Inline-Bearbeitung von aktiv,
 * Priorität und Beschreibung. Die Bedingung wird nur lesend dargestellt (ein
 * kleiner rekursiver Formatierer) — der strukturelle Bedingungs-Editor ist für
 * v1 bewusst NICHT enthalten. Änderungen über `api.setRegel`.
 */
import { Badge } from '@/components/ui/badge';
import type { StatusCockpitApi } from './useStatusCockpit';
import type { Bedingung, NaechsterSchrittRegel } from '@/core/status';
import { WERKZEUG_LABEL, feldKlasse, feldStil } from './labels';

/** Rekursiver Nur-Lese-Formatierer für eine Bedingung (Blatt / UND / ODER). */
function formatBedingung(b: Bedingung): string {
  if ('alle' in b) return `(${b.alle.map(formatBedingung).join(' UND ')})`;
  if ('einige' in b) return `(${b.einige.map(formatBedingung).join(' ODER ')})`;
  switch (b.op) {
    case 'gefuellt': return `${b.feldId} gefüllt`;
    case 'leer': return `${b.feldId} leer`;
    case 'ist': return `${b.feldId} ist „${b.wert ?? ''}"`;
    case 'istNicht': return `${b.feldId} ist nicht „${b.wert ?? ''}"`;
    case 'datumVor': return `${b.feldId} vor heute ${b.tageRelativHeute >= 0 ? '+' : ''}${b.tageRelativHeute} T`;
    case 'datumNach': return `${b.feldId} nach heute ${b.tageRelativHeute >= 0 ? '+' : ''}${b.tageRelativHeute} T`;
    default: return '';
  }
}

function RegelKarte({ r, api }: { r: NaechsterSchrittRegel; api: StatusCockpitApi }): React.ReactElement {
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
        <span className="text-[var(--tf-text-secondary)] font-mono">{formatBedingung(r.bedingung)}</span>
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
    <div className="flex flex-col gap-2.5 pt-3">
      <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
        {regeln.length} Regeln, aufsteigend nach Priorität. Alle zutreffenden aktiven Regeln liefern
        Schritte. Die Bedingungsstruktur wird hier nur angezeigt (Bearbeitung folgt).
      </p>
      {regeln.map(r => <RegelKarte key={r.id} r={r} api={api} />)}
      {regeln.length === 0 && (
        <p className="text-[12.5px] text-[var(--tf-text-tertiary)]">Keine Regeln im Entwurf.</p>
      )}
    </div>
  );
}
