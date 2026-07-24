/**
 * Artefakt-Werkbank auf der Verbund-Detailseite (Feature-Flag `artefaktWerkbank`,
 * nur dev). EIN Workspace in ≤ 4 sichtbaren Schritten: offene Punkte erfassen →
 * ankreuzen → Bausteine bestätigen → Entwurf. Ersetzt bei aktivem Flag die
 * `NachforderungenSection`; die Generierung läuft über deren NF-Maschine
 * (`useWerkbank` → `useNachforderungen.generiereWerkbank`), kein zweiter Pfad.
 *
 * Entwurf ≠ Entscheidung: es wird NICHTS versendet — der Mensch öffnet/prüft/sendet.
 */
import { useMemo, useState } from 'react';
import { ChevronRight, Plus, X } from 'lucide-react';
import { useCollapsedSection } from '@/core/hooks/useCollapsedSection';
import { DokumentAufnahme } from '@/core/components/DokumentAufnahme';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { Antrag } from '@/core/services/csv/types';
import { PRUEF_ASPEKTE } from '@/plugins/antraege/aufbereitung/aspekt-katalog';
import { VorlageDialog } from '../kurzfassung/VorlageDialog';
import type { KurzfassungContext } from '../kurzfassung/types';
import { NfEntwurfCard } from '../nachforderungen/NachforderungenSection';
import type { NfEntwurf } from '../nachforderungen/useNachforderungen';
import { useWerkbank } from './useWerkbank';
import { BausteinBestaetigung } from './BausteinBestaetigung';
import { todoPunkte, type Auswahl } from './bausteinAuswahl';
import type { WerkbankPunkt } from './types';

type ArtefaktTyp = 'nf' | 'rne' | 'abl';

export function WerkbankSection({ ctx }: { ctx: KurzfassungContext }): React.ReactElement {
  const w = useWerkbank(ctx);
  const [open, toggleOpen] = useCollapsedSection('verbund_werkbank_collapsed');
  const [gewaehlt, setGewaehlt] = useState<Set<string>>(new Set());
  const [auswahl, setAuswahl] = useState<Auswahl>({});
  const [artefaktTyp, setArtefaktTyp] = useState<ArtefaktTyp>('nf');
  const [dialogTv, setDialogTv] = useState<NfEntwurf | null>(null);

  const gewaehltePunkte = useMemo(() => w.punkte.filter(p => gewaehlt.has(p.key)), [w.punkte, gewaehlt]);
  const offeneTodos = todoPunkte(gewaehltePunkte, auswahl);

  const togglePunkt = (key: string): void =>
    setGewaehlt(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const toggleBaustein = (punktKey: string, bausteinId: string): void =>
    setAuswahl(a => {
      const ids = a[punktKey] ?? [];
      return { ...a, [punktKey]: ids.includes(bausteinId) ? ids.filter(x => x !== bausteinId) : [...ids, bausteinId] };
    });

  const dialogAntrag = useMemo<Antrag | null>(() => {
    if (!dialogTv) return null;
    return {
      aktenzeichen: dialogTv.aktenzeichen, programm_id: '',
      ...(dialogTv.titel ? { titel: dialogTv.titel } : {}),
      ...(dialogTv.antragsteller ? { antragsteller: dialogTv.antragsteller } : {}),
      _field_sources: {}, _updated_at: '',
    };
  }, [dialogTv]);

  return (
    <div>
      <div className="flex items-center gap-3.5 mb-4">
        <button type="button" onClick={toggleOpen} aria-expanded={open} className="flex items-center gap-1.5 cursor-pointer">
          <ChevronRight size={15} className="text-[var(--tf-text-tertiary)] transition-transform duration-200 shrink-0" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }} />
          <span className="text-[16px] font-medium text-[var(--tf-text)]">Artefakt-Werkbank</span>
        </button>
        {w.punkte.length > 0 && <span className="text-[12px] text-[var(--tf-text-tertiary)]">{w.punkte.length} Punkte</span>}
        <span className="flex-1" />
        {w.nf.vbVorhanden && gewaehlt.size > 0 && (
          w.nf.busy ? (
            <Button variant="secondary" onClick={w.nf.stop}>Stopp</Button>
          ) : (
            <Button
              variant="primary"
              disabled={artefaktTyp !== 'nf'}
              onClick={() => w.generiere([...gewaehlt], auswahl)}
              title={artefaktTyp === 'nf' ? 'Erzeugt je Teilvorhaben einen NF-Entwurf aus den bestätigten Bausteinen.' : 'RNE/ABL folgen in einer späteren Ausbaustufe.'}
            >
              Entwurf erzeugen ({gewaehlt.size})
            </Button>
          )
        )}
      </div>

      <div className={open ? undefined : 'hidden'}>
        {w.nf.busy && (
          <div className="mb-3 flex items-center gap-2 text-[12px] text-[var(--tf-text-secondary)]">
            <span className="w-3 h-3 rounded-full border-[1.5px] border-[var(--tf-text-tertiary)] border-t-transparent animate-spin" />
            Erzeuge Entwürfe …
          </div>
        )}
        {w.nf.error && (
          <div className="my-2 rounded-[8px] px-3 py-2 text-[12px] text-[var(--tf-danger-text)] bg-[var(--tf-danger-bg)]">{w.nf.error}</div>
        )}

        {w.loading ? (
          <div className="py-3 text-[13px] text-[var(--tf-text-tertiary)]">Laden …</div>
        ) : !w.nf.vbVorhanden ? (
          <div className="py-2">
            <p className="text-[13px] text-[var(--tf-text-secondary)] mb-3">
              Für die Werkbank wird die Vorhabensbeschreibung (VB) des Verbundes benötigt. Legen Sie sie hier ab — das Förderkennzeichen wird aus dem Dateinamen erkannt.
            </p>
            <DokumentAufnahme relationTag={ctx.key} knownIds={ctx.knownIds} onIngested={w.nf.refreshVb} offenHalten />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Schritt 1 — offene Punkte */}
            <Schritt nr={1} titel="Offene Punkte erfassen und ankreuzen">
              <PunktErfassung onAdd={w.addPunkt} />
              <PunkteGruppen punkte={w.punkte} gewaehlt={gewaehlt} onToggle={togglePunkt} onSelectGroup={keys => setGewaehlt(s => new Set([...s, ...keys]))} onRemove={w.removePunkt} onErledigt={w.toggleErledigt} />
            </Schritt>

            {/* Schritt 2 — Artefakt wählen */}
            <Schritt nr={2} titel="Artefakt wählen">
              <ArtefaktSchalter wert={artefaktTyp} onChange={setArtefaktTyp} />
            </Schritt>

            {/* Schritt 3 — Bausteine bestätigen */}
            {gewaehltePunkte.length > 0 && (
              <Schritt nr={3} titel="Bausteine bestätigen">
                <div className="flex flex-col gap-2.5">
                  {gewaehltePunkte.map(p => (
                    <BausteinBestaetigung key={p.key} punkt={p} katalog={w.katalog} gewaehlteIds={auswahl[p.key] ?? []} onToggle={id => toggleBaustein(p.key, id)} />
                  ))}
                </div>
                {offeneTodos.length > 0 && (
                  <p className="mt-2 text-[11.5px] text-[var(--tf-text-tertiary)]">
                    {offeneTodos.length} Punkt(e) ohne Baustein — der Entwurf trägt dort eine „[TODO Baustein zuordnen]"-Markierung.
                  </p>
                )}
              </Schritt>
            )}

            {/* Schritt 4 — Entwürfe */}
            {w.nf.entwuerfe.length > 0 && (
              <Schritt nr={4} titel="Entwürfe">
                <div className="flex flex-col gap-3">
                  {w.nf.entwuerfe.map(e => (
                    <NfEntwurfCard key={e.aktenzeichen} entwurf={e} onExport={() => setDialogTv(e)} />
                  ))}
                </div>
              </Schritt>
            )}
          </div>
        )}
      </div>

      {dialogTv && dialogAntrag && (
        <VorlageDialog
          open
          antrag={dialogAntrag}
          sections={[{ id: 'NF', anker: 'Nachforderungen', finalerText: dialogTv.text }]}
          dateiPrefix="ZIM-Nachforderung"
          onClose={() => setDialogTv(null)}
        />
      )}
    </div>
  );
}

function Schritt({ nr, titel, children }: { nr: number; titel: string; children: React.ReactNode }): React.ReactElement {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2.5">
        <span className="w-5 h-5 rounded-full bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)] text-[11px] flex items-center justify-center shrink-0">{nr}</span>
        <span className="text-[13px] font-medium text-[var(--tf-text)]">{titel}</span>
      </div>
      <div className="ml-7">{children}</div>
    </section>
  );
}

/** Schnelle manuelle Erfassung: Text + Aspekt-Chip + optionale Fundstelle. */
function PunktErfassung({ onAdd }: { onAdd: (text: string, aspektId: string | null, fundstellen: string[]) => void }): React.ReactElement {
  const [text, setText] = useState('');
  const [aspektId, setAspektId] = useState<string | null>(null);
  const [fundstelle, setFundstelle] = useState('');
  const submit = (): void => {
    if (!text.trim()) return;
    onAdd(text, aspektId, fundstelle.trim() ? [fundstelle.trim()] : []);
    setText(''); setAspektId(null); setFundstelle('');
  };
  return (
    <div className="rounded-[10px] border-[0.5px] border-dashed border-[var(--tf-border-hover)] px-3.5 py-3 mb-3 flex flex-col gap-2">
      <Textarea value={text} onChange={e => setText(e.target.value)} rows={2} placeholder="Offener Punkt / Klärungsbedarf …" className="text-[12.5px]" />
      <div className="flex flex-wrap items-center gap-1.5">
        {PRUEF_ASPEKTE.map(a => (
          <button
            key={a.id}
            type="button"
            title={`${a.id}: ${a.name}`}
            aria-pressed={aspektId === a.id}
            onClick={() => setAspektId(id => (id === a.id ? null : a.id))}
            className={`min-w-[28px] text-[11.5px] px-1.5 py-0.5 rounded-[6px] border transition-colors ${
              aspektId === a.id ? 'border-[var(--tf-primary)] bg-[var(--tf-primary)] text-white' : 'border-[var(--tf-border)] text-[var(--tf-text-secondary)] hover:border-[var(--tf-border-hover)]'
            }`}
          >
            {a.id}
          </button>
        ))}
        <span className="flex-1" />
        <Input value={fundstelle} onChange={e => setFundstelle(e.target.value)} placeholder="Fundstelle (opt.)" className="w-[140px] h-7 text-[11.5px]" />
        <Button variant="outline" size="sm" disabled={!text.trim()} onClick={submit} className="h-7">
          <Plus size={12} className="mr-1" /> Punkt
        </Button>
      </div>
    </div>
  );
}

/** Punkte nach Aspekt gruppiert (A–J + „ohne Aspekt"), auf-/zuklappbar, „alle wählen". */
function PunkteGruppen({ punkte, gewaehlt, onToggle, onSelectGroup, onRemove, onErledigt }: {
  punkte: readonly WerkbankPunkt[];
  gewaehlt: ReadonlySet<string>;
  onToggle: (key: string) => void;
  onSelectGroup: (keys: string[]) => void;
  onRemove: (key: string) => void;
  onErledigt: (key: string, erledigt: boolean) => void;
}): React.ReactElement {
  const gruppen = useMemo(() => {
    const map = new Map<string, WerkbankPunkt[]>();
    for (const p of punkte) {
      const g = p.aspektId ?? '—';
      (map.get(g) ?? map.set(g, []).get(g)!).push(p);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [punkte]);

  if (punkte.length === 0) {
    return <p className="text-[12.5px] text-[var(--tf-text-tertiary)]">Noch keine Punkte — oben erfassen.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {gruppen.map(([aspekt, ps]) => (
        <div key={aspekt}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-medium text-[var(--tf-text-secondary)]">{aspekt === '—' ? 'Ohne Aspekt' : `Aspekt ${aspekt}`}</span>
            <span className="text-[10.5px] text-[var(--tf-text-tertiary)]">{ps.length}</span>
            <button type="button" className="text-[10.5px] text-[var(--tf-primary)] hover:underline" onClick={() => onSelectGroup(ps.map(p => p.key))}>alle wählen</button>
          </div>
          <div className="flex flex-col gap-1">
            {ps.map(p => (
              <div key={p.key} className={`flex items-start gap-2 rounded-[8px] px-2.5 py-1.5 ${gewaehlt.has(p.key) ? 'bg-[var(--tf-primary-light)]' : 'hover:bg-[var(--tf-hover)]'}`}>
                <input type="checkbox" checked={gewaehlt.has(p.key)} onChange={() => onToggle(p.key)} className="mt-0.5 shrink-0" />
                <span className={`flex-1 text-[12.5px] ${p.erledigt ? 'line-through text-[var(--tf-text-tertiary)]' : 'text-[var(--tf-text)]'}`}>
                  {p.text}
                  {p.fundstellen.length > 0 && <span className="ml-2 font-mono text-[10.5px] text-[var(--tf-text-tertiary)]">§ {p.fundstellen.join(', ')}</span>}
                </span>
                <button type="button" className="text-[10.5px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] shrink-0" onClick={() => onErledigt(p.key, !p.erledigt)}>
                  {p.erledigt ? 'offen' : 'erledigt'}
                </button>
                <button type="button" className="text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)] shrink-0" onClick={() => onRemove(p.key)} aria-label="Punkt entfernen">
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** NF | RNE | ABL — RNE/ABL bis zur nächsten Ausbaustufe deaktiviert. */
function ArtefaktSchalter({ wert, onChange }: { wert: ArtefaktTyp; onChange: (t: ArtefaktTyp) => void }): React.ReactElement {
  const items: Array<{ typ: ArtefaktTyp; label: string; aktiv: boolean }> = [
    { typ: 'nf', label: 'Nachforderung', aktiv: true },
    { typ: 'rne', label: 'Rücknahmeempfehlung', aktiv: false },
    { typ: 'abl', label: 'Ablehnung', aktiv: false },
  ];
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {items.map(i => (
        <button
          key={i.typ}
          type="button"
          disabled={!i.aktiv}
          aria-pressed={wert === i.typ}
          onClick={() => i.aktiv && onChange(i.typ)}
          title={i.aktiv ? undefined : 'Folgt in einer späteren Ausbaustufe.'}
          className={`text-[12px] px-3 py-1.5 rounded-[8px] border transition-colors ${
            wert === i.typ ? 'border-[var(--tf-primary)] bg-[var(--tf-primary)] text-white' : 'border-[var(--tf-border)] text-[var(--tf-text-secondary)]'
          } ${i.aktiv ? 'cursor-pointer hover:border-[var(--tf-border-hover)]' : 'opacity-50 cursor-default'}`}
        >
          {i.label}{!i.aktiv && ' (bald)'}
        </button>
      ))}
    </div>
  );
}
