/**
 * Editor eines Textbausteins: Thema/Kategorie/Aspekte/Stichworte/Text bearbeiten,
 * Freigeben/Stilllegen, Versions-Historie mit Diff + Rollback.
 *
 * Der **Text ist hier editierbar** — der Kurator pflegt den kuratierten Wortlaut.
 * Die Verbatim-Regel (Pitfall #34) bindet den LLM-Pfad und den Import, nicht die
 * Kuration. Die Platzhalter-Vorschau leitet live aus dem Text ab (`extractPlatzhalter`)
 * — nie von Hand gepflegt, damit Text und Platzhalter nicht driften.
 *
 * Rein präsentierend: jede Mutation läuft über `onSpeichern`/`onStatus`/`onRollback`
 * des Aufrufers (der besitzt Katalog + Persistenz).
 */
import { useEffect, useMemo, useState } from 'react';
import { RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  diffLines, extractPlatzhalter,
  type BausteinStatus, type TextbausteinRecord, type TextbausteinSnapshot,
} from '@/core/services/skills';
import { AspektChips } from './AspektChips';
import { STATUS_LABEL, STATUS_VARIANT, TYP_LABEL } from './textbausteinLabels';

export interface BausteinEntwurf {
  thema: string;
  kategorie: string;
  aspekte: string[];
  stichworte: string[];
  text: string;
}

function entwurfAus(rec: TextbausteinRecord): BausteinEntwurf {
  return {
    thema: rec.thema,
    kategorie: rec.kategorie,
    aspekte: [...rec.aspekte],
    stichworte: [...rec.stichworte],
    text: rec.text,
  };
}

function istGeaendert(rec: TextbausteinRecord, e: BausteinEntwurf): boolean {
  return e.thema !== rec.thema
    || e.kategorie !== rec.kategorie
    || e.text !== rec.text
    || e.aspekte.join(' ') !== rec.aspekte.join(' ')
    || e.stichworte.join(' ') !== rec.stichworte.join(' ');
}

interface Props {
  baustein: TextbausteinRecord;
  canEdit: boolean;
  busy: boolean;
  onSpeichern: (e: BausteinEntwurf) => void;
  onStatus: (status: BausteinStatus, begruendung: string) => void;
  onRollback: (snap: TextbausteinSnapshot) => void;
}

export function TextbausteinEditor({ baustein, canEdit, busy, onSpeichern, onStatus, onRollback }: Props): React.ReactElement {
  const [entwurf, setEntwurf] = useState<BausteinEntwurf>(() => entwurfAus(baustein));
  const [ansicht, setAnsicht] = useState<'bearbeiten' | 'versionen'>('bearbeiten');
  const [stichwortText, setStichwortText] = useState(baustein.stichworte.join(', '));

  // Bei Wechsel des Bausteins den Entwurf neu setzen.
  useEffect(() => {
    setEntwurf(entwurfAus(baustein));
    setStichwortText(baustein.stichworte.join(', '));
    setAnsicht('bearbeiten');
  }, [baustein]);

  const platzhalter = useMemo(() => extractPlatzhalter(entwurf.text), [entwurf.text]);
  const geaendert = istGeaendert(baustein, entwurf);

  const toggleAspekt = (id: string): void =>
    setEntwurf(e => ({ ...e, aspekte: e.aspekte.includes(id) ? e.aspekte.filter(x => x !== id) : [...e.aspekte, id] }));

  const commitStichworte = (): void =>
    setEntwurf(e => ({ ...e, stichworte: stichwortText.split(',').map(s => s.trim()).filter(Boolean) }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="font-mono text-[13px] text-[var(--tf-text)]">{baustein.id}</span>
        <Badge variant="info">{TYP_LABEL[baustein.artefaktTyp]}</Badge>
        <Badge variant={STATUS_VARIANT[baustein.status]}>{STATUS_LABEL[baustein.status]}</Badge>
        <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">v{baustein.version}</span>
        <span className="flex-1" />
        <div className="inline-flex rounded-[7px] border-[0.5px] border-[var(--tf-border)] overflow-hidden">
          {(['bearbeiten', 'versionen'] as const).map(a => (
            <button
              key={a}
              type="button"
              aria-pressed={ansicht === a}
              onClick={() => setAnsicht(a)}
              className={`text-[11.5px] px-2.5 py-1 transition-colors cursor-pointer ${
                ansicht === a ? 'bg-[var(--tf-primary)] text-white' : 'text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]'
              }`}
            >
              {a === 'bearbeiten' ? 'Bearbeiten' : `Versionen (${baustein.historie.length})`}
            </button>
          ))}
        </div>
      </div>

      {ansicht === 'versionen' ? (
        <VersionenPanel baustein={baustein} canEdit={canEdit} onRollback={onRollback} />
      ) : (
        <>
          <Feld label="Thema">
            <Input value={entwurf.thema} disabled={!canEdit} onChange={e => setEntwurf(v => ({ ...v, thema: e.target.value }))} />
          </Feld>
          <Feld label="Überkategorie">
            <Input value={entwurf.kategorie} disabled={!canEdit} onChange={e => setEntwurf(v => ({ ...v, kategorie: e.target.value }))} />
          </Feld>
          <Feld label="Prüfaspekte" hinweis="Treiben den Vorschlag in der Werkbank — der Aspekt-Treffer wiegt schwerer als ein Wortstamm.">
            <AspektChips gewaehlt={entwurf.aspekte} onToggle={toggleAspekt} disabled={!canEdit} />
          </Feld>
          <Feld label="Stichworte" hinweis="Komma-getrennt.">
            <Input
              value={stichwortText}
              disabled={!canEdit}
              onChange={e => setStichwortText(e.target.value)}
              onBlur={commitStichworte}
              placeholder="z. B. schutzrechte, patent"
            />
          </Feld>
          <Feld label="Text (Rechtstext, mit Platzhaltern)">
            <Textarea
              value={entwurf.text}
              disabled={!canEdit}
              onChange={e => setEntwurf(v => ({ ...v, text: e.target.value }))}
              rows={8}
              className="font-mono text-[12.5px] leading-[1.6]"
            />
          </Feld>
          <PlatzhalterVorschau platzhalter={platzhalter} />

          {canEdit && (
            <div className="flex items-center gap-2 flex-wrap pt-1 border-t-[0.5px] border-[var(--tf-border)]">
              <Button
                variant="primary"
                size="sm"
                loading={busy}
                disabled={!geaendert}
                onClick={() => { commitStichworte(); onSpeichern({ ...entwurf, stichworte: stichwortText.split(',').map(s => s.trim()).filter(Boolean) }); }}
              >
                Speichern
              </Button>
              <span className="flex-1" />
              <StatusAktionen status={baustein.status} busy={busy} onStatus={onStatus} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Feld({ label, hinweis, children }: { label: string; hinweis?: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--tf-text-tertiary)] mb-1.5">{label}</div>
      {children}
      {hinweis && <div className="mt-1 text-[11px] text-[var(--tf-text-tertiary)]">{hinweis}</div>}
    </div>
  );
}

function PlatzhalterVorschau({ platzhalter }: { platzhalter: ReturnType<typeof extractPlatzhalter> }): React.ReactElement {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--tf-text-tertiary)] mb-1.5">
        Abgeleitete Platzhalter ({platzhalter.length})
      </div>
      {platzhalter.length === 0 ? (
        <div className="text-[12px] text-[var(--tf-text-tertiary)]">Keine — der Text ist vollständig.</div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {platzhalter.map((p, i) => (
            <span key={i} className="font-mono text-[11.5px] px-2 py-0.5 rounded-[6px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]" title={p.typ}>
              {p.roh}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Status-Aktionen: der jeweils sinnvolle Nächst-Schritt, mit Pflicht-Begründung. */
function StatusAktionen({ status, busy, onStatus }: {
  status: BausteinStatus; busy: boolean; onStatus: (s: BausteinStatus, grund: string) => void;
}): React.ReactElement {
  const [wechsel, setWechsel] = useState<BausteinStatus | null>(null);
  const [grund, setGrund] = useState('');

  const optionen: BausteinStatus[] = status === 'freigegeben'
    ? ['stillgelegt', 'entwurf']
    : status === 'entwurf'
      ? ['freigegeben']
      : ['freigegeben', 'entwurf']; // stillgelegt → reaktivieren

  if (wechsel) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[12px] text-[var(--tf-text-secondary)]">→ {STATUS_LABEL[wechsel]}:</span>
        <Input value={grund} onChange={e => setGrund(e.target.value)} placeholder="Begründung (Pflicht)" className="w-[220px] h-8 text-[12px]" />
        <Button variant="primary" size="sm" loading={busy} disabled={!grund.trim()} onClick={() => onStatus(wechsel, grund.trim())}>
          Bestätigen
        </Button>
        <Button variant="ghost" size="sm" onClick={() => { setWechsel(null); setGrund(''); }}>Abbrechen</Button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      {optionen.map(o => (
        <Button key={o} variant={o === 'freigegeben' ? 'primary' : 'outline'} size="sm" onClick={() => setWechsel(o)}>
          {o === 'freigegeben' ? 'Freigeben' : o === 'stillgelegt' ? 'Stilllegen' : 'Zurück in Entwurf'}
        </Button>
      ))}
    </div>
  );
}

/** Versions-Historie (newest-first) mit Text-Diff + Rollback (als neue Version). */
function VersionenPanel({ baustein, canEdit, onRollback }: {
  baustein: TextbausteinRecord; canEdit: boolean; onRollback: (snap: TextbausteinSnapshot) => void;
}): React.ReactElement {
  const historie = baustein.historie;
  if (historie.length <= 1) {
    return (
      <p className="text-[12.5px] text-[var(--tf-text-tertiary)] py-4">
        Noch keine früheren Versionen. Sobald der Baustein bearbeitet oder sein Status geändert wird, erscheint hier die Historie (max. 10 Stände) mit Diff und Rollback.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2.5">
      {historie.map((snap, i) => (
        <VersionEintrag
          key={`${snap.version}-${i}`}
          snap={snap}
          vor={historie[i + 1]}
          istAktuell={i === 0}
          canRollback={i !== 0 && canEdit}
          onRollback={() => onRollback(snap)}
        />
      ))}
    </div>
  );
}

function VersionEintrag({ snap, vor, istAktuell, canRollback, onRollback }: {
  snap: TextbausteinSnapshot; vor?: TextbausteinSnapshot; istAktuell: boolean; canRollback: boolean; onRollback: () => void;
}): React.ReactElement {
  const [open, setOpen] = useState(istAktuell);
  const zeilen = vor ? diffLines(vor.text, snap.text).filter(z => z.typ !== 'gleich') : [];
  const hatDiff = zeilen.length > 0 || (vor && vor.status !== snap.status);
  return (
    <div className="rounded-[10px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg)]">
      <div className="flex items-center gap-2.5 px-3.5 py-2.5">
        <button type="button" onClick={() => setOpen(o => !o)} disabled={!hatDiff} className="inline-flex items-center gap-1.5 text-[13px] text-[var(--tf-text)] disabled:opacity-60">
          {hatDiff ? (open ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span className="w-3.5" />}
          <span className="font-medium">v{snap.version}</span>
          <Badge variant={STATUS_VARIANT[snap.status]}>{STATUS_LABEL[snap.status]}</Badge>
          {istAktuell && <span className="text-[10.5px] px-1.5 py-0.5 rounded-[5px] bg-[var(--tf-primary-light)] text-[var(--tf-primary)]">aktuell</span>}
        </button>
        <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
          {snap.geaendertAm.slice(0, 10)}{snap.geaendertVon ? ` · ${snap.geaendertVon}` : ''}
        </span>
        <span className="flex-1" />
        {canRollback && (
          <button type="button" onClick={onRollback} className="inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-[8px] border-[0.5px] border-[var(--tf-border-hover)] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-hover)]">
            <RotateCcw size={12} /> Zurücksetzen
          </button>
        )}
      </div>
      {snap.begruendung && <div className="px-3.5 pb-2 -mt-1 text-[12px] text-[var(--tf-text-secondary)] italic">„{snap.begruendung}"</div>}
      {open && zeilen.length > 0 && (
        <div className="px-3.5 pb-3.5 pt-1 border-t-[0.5px] border-[var(--tf-border)]">
          <pre className="rounded-[8px] bg-[var(--tf-bg-secondary)] px-3 py-2.5 font-mono text-[12px] leading-[1.6] m-0 whitespace-pre-wrap overflow-x-auto">
            {zeilen.map((z, i) => (
              <div key={i} className="px-1 rounded-[3px]" style={{
                color: z.typ === 'hinzu' ? 'var(--tf-success-text)' : 'var(--tf-danger-text)',
                background: z.typ === 'hinzu' ? 'var(--tf-success-bg)' : 'var(--tf-danger-bg)',
              }}>
                {z.typ === 'hinzu' ? '+ ' : '− '}{z.text || ' '}
              </div>
            ))}
          </pre>
        </div>
      )}
    </div>
  );
}
