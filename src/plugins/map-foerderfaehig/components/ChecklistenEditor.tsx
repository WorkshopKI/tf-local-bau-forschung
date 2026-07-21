/**
 * Checklisten-Editor — Kriterien im laufenden Betrieb ändern, ergänzen,
 * stilllegen. Jede Speicherung zählt die Fassung hoch und stempelt Autor und
 * Zeitpunkt.
 *
 * Rein darstellend: die Versionslogik liegt in `checkliste/editor.ts`.
 */
import { Button } from '@/components/ui/button';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { Plus, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import type { ItemAenderung, NeuesItem } from '../checkliste/editor';
import type { MapChecklistenDefinition, MapPruefklasse } from '../checkliste/typen';

const KLASSEN: ReadonlyArray<{ wert: MapPruefklasse; label: string }> = [
  { wert: 'R', label: 'R — rechnerisch' },
  { wert: 'K', label: 'K — Grenzwert' },
  { wert: 'S', label: 'S — im Text zu prüfen' },
  { wert: 'E', label: 'E — externe Recherche' },
];

const feldKlasse = 'w-full text-[12.5px] rounded px-2 py-1.5 bg-[var(--tf-bg)] text-[var(--tf-text)]';
const feldStil = { border: '0.5px solid var(--tf-border)' };

function ItemZeile({
  id, kriterium, hinweis, fundstelle, klasse, aktiv, herkunft, onSpeichern, onAktiv,
}: {
  id: string;
  kriterium: string;
  hinweis: string;
  fundstelle: string;
  klasse: MapPruefklasse;
  aktiv: boolean;
  herkunft: string;
  onSpeichern: (a: ItemAenderung) => Promise<void>;
  onAktiv: (aktiv: boolean) => Promise<void>;
}): React.ReactElement {
  const [offen, setOffen] = useState(false);
  const [entwurf, setEntwurf] = useState({ kriterium, hinweis, fundstelle, klasse });

  const speichern = useAsyncAction(async () => {
    await onSpeichern(entwurf);
    setOffen(false);
  });
  const umschalten = useAsyncAction(async () => { await onAktiv(!aktiv); });

  return (
    <div
      className="rounded px-2.5 py-2"
      style={{ border: '0.5px solid var(--tf-border)', opacity: aktiv ? 1 : 0.55 }}
    >
      {!offen ? (
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[12.5px] text-[var(--tf-text)] leading-snug">{kriterium}</p>
            <p className="text-[11px] text-[var(--tf-text-tertiary)] mt-0.5">
              {klasse} · {herkunft === 'app' ? 'Ergänzung' : 'Vorlage'}
              {!aktiv && ' · stillgelegt'}
            </p>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="sm" onClick={() => setOffen(true)}>Bearbeiten</Button>
            <Button variant="ghost" size="sm" disabled={umschalten.busy} onClick={() => umschalten.run()}>
              {aktiv ? 'Stilllegen' : 'Aktivieren'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <textarea
            value={entwurf.kriterium} rows={2} className={feldKlasse} style={feldStil}
            onChange={e => setEntwurf(v => ({ ...v, kriterium: e.target.value }))}
          />
          <input
            value={entwurf.hinweis} placeholder="Hinweis (optional)"
            className={feldKlasse} style={feldStil}
            onChange={e => setEntwurf(v => ({ ...v, hinweis: e.target.value }))}
          />
          <input
            value={entwurf.fundstelle} placeholder="Fundstelle (optional)"
            className={feldKlasse} style={feldStil}
            onChange={e => setEntwurf(v => ({ ...v, fundstelle: e.target.value }))}
          />
          <select
            value={entwurf.klasse} className={feldKlasse} style={feldStil}
            onChange={e => setEntwurf(v => ({ ...v, klasse: e.target.value as MapPruefklasse }))}
          >
            {KLASSEN.map(k => <option key={k.wert} value={k.wert}>{k.label}</option>)}
          </select>
          <div className="flex gap-1.5">
            <Button
              variant="primary" size="sm"
              disabled={speichern.busy || entwurf.kriterium.trim().length === 0}
              onClick={() => speichern.run()}
            >
              {speichern.busy ? 'Speichert …' : 'Speichern (Fassung +1)'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setOffen(false); setEntwurf({ kriterium, hinweis, fundstelle, klasse }); }}>
              Abbrechen
            </Button>
          </div>
          {speichern.error != null && (
            <p className="text-[11.5px]" style={{ color: 'var(--tf-danger-text)' }}>
              {speichern.error}
            </p>
          )}
        </div>
      )}
      <span className="sr-only">{id}</span>
    </div>
  );
}

export function ChecklistenEditor({
  definition, onBearbeite, onErgaenze, onAktiviere, onZuruecksetzen,
}: {
  definition: MapChecklistenDefinition;
  onBearbeite: (itemId: string, a: ItemAenderung) => Promise<void>;
  onErgaenze: (neu: NeuesItem) => Promise<void>;
  onAktiviere: (itemId: string, aktiv: boolean) => Promise<void>;
  onZuruecksetzen: () => Promise<void>;
}): React.ReactElement {
  const gruppen = [...new Set(definition.items.map(i => i.gruppe))];
  const [neu, setNeu] = useState<NeuesItem>({
    gruppe: gruppen[0] ?? 'Sonstiges', kriterium: '', klasse: 'S',
  });

  const ergaenzen = useAsyncAction(async () => {
    await onErgaenze(neu);
    setNeu(v => ({ ...v, kriterium: '' }));
  });
  const zuruecksetzen = useAsyncAction(async () => { await onZuruecksetzen(); });

  return (
    <div className="flex flex-col gap-4">
      <div
        className="rounded px-3 py-2.5 text-[12.5px]"
        style={{ background: 'color-mix(in srgb, var(--tf-primary) 7%, var(--tf-bg))' }}
      >
        <p className="text-[var(--tf-text)]">
          Fassung {definition.version}
          {definition.geaendertVon != null && ` · zuletzt geändert von ${definition.geaendertVon}`}
          {` · ${definition.geaendertAm.slice(0, 10)}`}
        </p>
        <p className="text-[var(--tf-text-secondary)] mt-1">
          Änderungen wirken auf neu gestartete Prüfungen. Laufende Prüfungen behalten ihre
          Fassung, bis sie ausdrücklich nachgezogen werden.
        </p>
      </div>

      <div className="rounded px-3 py-3" style={{ border: '0.5px solid var(--tf-border)' }}>
        <p className="text-[12.5px] font-medium text-[var(--tf-text)] mb-2">Kriterium ergänzen</p>
        <div className="flex flex-col gap-1.5">
          <select
            value={neu.gruppe} className={feldKlasse} style={feldStil}
            onChange={e => setNeu(v => ({ ...v, gruppe: e.target.value }))}
          >
            {gruppen.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <textarea
            value={neu.kriterium} rows={2} placeholder="Wortlaut des Kriteriums"
            className={feldKlasse} style={feldStil}
            onChange={e => setNeu(v => ({ ...v, kriterium: e.target.value }))}
          />
          <select
            value={neu.klasse} className={feldKlasse} style={feldStil}
            onChange={e => setNeu(v => ({ ...v, klasse: e.target.value as MapPruefklasse }))}
          >
            {KLASSEN.map(k => <option key={k.wert} value={k.wert}>{k.label}</option>)}
          </select>
          <Button
            variant="primary" size="sm"
            disabled={ergaenzen.busy || neu.kriterium.trim().length === 0}
            onClick={() => ergaenzen.run()}
          >
            <Plus size={14} /> {ergaenzen.busy ? 'Ergänzt …' : 'Ergänzen (Fassung +1)'}
          </Button>
          {ergaenzen.error != null && (
            <p className="text-[11.5px]" style={{ color: 'var(--tf-danger-text)' }}>
              {ergaenzen.error}
            </p>
          )}
        </div>
      </div>

      {gruppen.map(gruppe => (
        <section key={gruppe} className="flex flex-col gap-1.5">
          <h3 className="text-[12px] font-medium text-[var(--tf-text-secondary)] uppercase tracking-wide">
            {gruppe}
          </h3>
          {definition.items.filter(i => i.gruppe === gruppe).map(item => (
            <ItemZeile
              key={item.id}
              id={item.id}
              kriterium={item.kriterium}
              hinweis={item.hinweis ?? ''}
              fundstelle={item.fundstelle ?? ''}
              klasse={item.klasse}
              aktiv={item.aktiv}
              herkunft={item.herkunft}
              onSpeichern={a => onBearbeite(item.id, a)}
              onAktiv={aktiv => onAktiviere(item.id, aktiv)}
            />
          ))}
        </section>
      ))}

      <div className="pt-2" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
        <Button variant="ghost" size="sm" disabled={zuruecksetzen.busy} onClick={() => zuruecksetzen.run()}>
          <RotateCcw size={14} /> Auf Auslieferungsfassung zurücksetzen
        </Button>
        {zuruecksetzen.error != null && (
          <p className="text-[11.5px] mt-1" style={{ color: 'var(--tf-danger-text)' }}>
            {zuruecksetzen.error}
          </p>
        )}
      </div>
    </div>
  );
}
