/**
 * Artefakt-Werkbank auf der Verbund-Detailseite (Feature-Flag `artefaktWerkbank`,
 * nur dev). EIN Workspace in ≤ 4 sichtbaren Schritten: offene Punkte erfassen →
 * ankreuzen → Bausteine bestätigen → Entwurf. Ersetzt bei aktivem Flag die
 * `NachforderungenSection`; die Generierung läuft über deren NF-Maschine
 * (`useWerkbank` → `useNachforderungen.generiereWerkbank`), kein zweiter Pfad.
 *
 * Entwurf ≠ Entscheidung: es wird NICHTS versendet — der Mensch öffnet/prüft/sendet.
 */
import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Plus, X } from 'lucide-react';
import { useCollapsedSection } from '@/core/hooks/useCollapsedSection';
import { sektionOffenDefault, sektionsKey } from '../detailSektionen';
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
import { ANKER_BY_TYP, DATEI_PREFIX_BY_TYP, LABEL_BY_TYP, type BescheidTyp } from '../nachforderungen/artefakt-typ';
import { pruefeKonsistenz } from '../nachforderungen/bescheid-freigabe';
import { freigegebeneBausteine } from '@/core/services/skills';
import { useWerkbank } from './useWerkbank';
import { BausteinBestaetigung } from './BausteinBestaetigung';
import { BescheidFreigabe } from './BescheidFreigabe';
import { todoPunkte, type Auswahl } from './bausteinAuswahl';
import type { WerkbankPunkt } from './types';

type ArtefaktTyp = BescheidTyp;

export function WerkbankSection({ ctx, vorbelegung }: {
  ctx: KurzfassungContext;
  /** Von der Widerspruchs-Ansicht: Punkt-Keys vorankreuzen (nonce triggert erneut). */
  vorbelegung?: { keys: string[]; nonce: number };
}): React.ReactElement {
  const w = useWerkbank(ctx);
  const [open, toggleOpen] = useCollapsedSection(
    sektionsKey('werkbank'), { defaultOpen: sektionOffenDefault('werkbank') },
  );
  const [gewaehlt, setGewaehlt] = useState<Set<string>>(new Set());
  const [auswahl, setAuswahl] = useState<Auswahl>({});
  const [artefaktTyp, setArtefaktTyp] = useState<ArtefaktTyp>('nf');
  const [dialogTv, setDialogTv] = useState<NfEntwurf | null>(null);

  // „Antwort in der Werkbank vorbereiten" (Phase 6): die offenen Gründe vorankreuzen.
  // `nonce` in den Deps, damit dieselbe Vorbelegung erneut greift, wenn der Nutzer
  // den Knopf zweimal drückt; der aufklappbare Body wird geöffnet.
  useEffect(() => {
    if (!vorbelegung || vorbelegung.keys.length === 0) return;
    setGewaehlt(new Set(vorbelegung.keys));
    if (!open) toggleOpen();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur auf den nonce reagieren
  }, [vorbelegung?.nonce]);

  // Der Verbund (oder der Punkt-Bestand) wechselt — Auswahl und Zuordnung des
  // VORIGEN gehören nicht mit. `VerbundDetail` wird beim Wechsel nicht neu
  // gemountet, und die Punkt-Keys sind aus dem Text gehasht: gleich formulierte
  // Standard-Punkte wären in Verbund B vorangekreuzt, samt Baustein-Auswahl aus
  // A. Die Zahl am Knopf stand außerdem stehen, während der Klick wirkungslos
  // blieb (v4.124).
  useEffect(() => {
    setGewaehlt(new Set());
    setAuswahl({});
    setArtefaktTyp('nf');
  }, [ctx.key]);

  const gewaehltePunkte = useMemo(() => w.punkte.filter(p => gewaehlt.has(p.key)), [w.punkte, gewaehlt]);
  // Typ-bewusst (siehe `todoPunkte`): ein NF-Baustein versorgt keinen ABL-Punkt.
  const offeneTodos = todoPunkte(gewaehltePunkte, auswahl, w.katalog, artefaktTyp);
  const istBescheid = artefaktTyp !== 'nf';
  // Für RNE/ABL blockiert ein unzugeordneter Punkt die Generierung (Bescheid braucht
  // eine tragende Begründung je Punkt); bei NF ist TODO erlaubt (→ [TODO]-Markierung).
  const generierenGesperrt = w.nf.busy || (istBescheid && offeneTodos.length > 0);
  // Konsistenz-Warnungen aus den bestätigten Bausteinen vs. MAP-Fachbewertung (RNE/ABL).
  const bestaetigteBausteine = useMemo(() => {
    const ids = new Set(gewaehltePunkte.flatMap(p => auswahl[p.key] ?? []));
    return freigegebeneBausteine(w.katalog, artefaktTyp).filter(b => ids.has(b.id));
  }, [gewaehltePunkte, auswahl, w.katalog, artefaktTyp]);
  const warnungen = useMemo(
    () => (istBescheid ? pruefeKonsistenz(bestaetigteBausteine, w.mapBewertung.bewertung) : []),
    [istBescheid, bestaetigteBausteine, w.mapBewertung],
  );
  const bausteineImTyp = useMemo(() => freigegebeneBausteine(w.katalog, artefaktTyp).length, [w.katalog, artefaktTyp]);

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
        {/* An den vorhandenen PUNKTEN gemessen, nicht am Key-Set: das kann Keys
            tragen, die es am geöffneten Verbund nicht (mehr) gibt — der Knopf
            stand dann mit einer Zahl da und der Klick tat nichts (v4.124). */}
        {w.nf.vbVorhanden && gewaehltePunkte.length > 0 && (
          w.nf.busy ? (
            <Button variant="secondary" onClick={w.nf.stop}>Stopp</Button>
          ) : (
            <Button
              variant="primary"
              disabled={generierenGesperrt}
              onClick={() => w.generiere(gewaehltePunkte.map(p => p.key), auswahl, artefaktTyp, { warnungen, offeneTodos: offeneTodos.length })}
              title={
                istBescheid && offeneTodos.length > 0
                  ? 'Bei einem Bescheid muss jeder gewählte Punkt einen Baustein tragen (kein TODO).'
                  : `Erzeugt je Teilvorhaben einen ${LABEL_BY_TYP[artefaktTyp]}-Entwurf aus den bestätigten Bausteinen.`
              }
            >
              Entwurf erzeugen ({gewaehltePunkte.length})
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
              {bausteineImTyp === 0 && (
                <p className="mt-2 text-[11.5px] text-[var(--tf-text-tertiary)]">
                  Für {LABEL_BY_TYP[artefaktTyp]} sind noch keine freigegebenen Bausteine im Katalog — in der Skill-Verwaltung (Reiter „Textbausteine") anlegen und freigeben.
                </p>
              )}
            </Schritt>

            {/* Schritt 3 — Bausteine bestätigen */}
            {gewaehltePunkte.length > 0 && (
              <Schritt nr={3} titel="Bausteine bestätigen">
                <div className="flex flex-col gap-2.5">
                  {gewaehltePunkte.map(p => (
                    <BausteinBestaetigung key={p.key} punkt={p} katalog={w.katalog} artefaktTyp={artefaktTyp} gewaehlteIds={auswahl[p.key] ?? []} onToggle={id => toggleBaustein(p.key, id)} />
                  ))}
                </div>
                {offeneTodos.length > 0 && (
                  <p className="mt-2 text-[11.5px] text-[var(--tf-text-tertiary)]">
                    {offeneTodos.length} Punkt(e) ohne Baustein — {istBescheid
                      ? 'bei einem Bescheid muss jeder Punkt einen Baustein tragen (blockiert die Generierung).'
                      : 'der Entwurf trägt dort eine „[TODO Baustein zuordnen]"-Markierung.'}
                  </p>
                )}
              </Schritt>
            )}

            {/* Schritt 4 — Entwürfe */}
            {w.nf.entwuerfe.length > 0 && (
              <Schritt nr={4} titel="Entwürfe">
                <div className="flex flex-col gap-3">
                  {w.nf.entwuerfe.map(e => (
                    e.artefaktTyp === 'nf' ? (
                      <NfEntwurfCard key={e.aktenzeichen} entwurf={e} onExport={() => setDialogTv(e)} />
                    ) : (
                      <BescheidFreigabe
                        key={e.aktenzeichen}
                        entwurf={e}
                        warnungen={e.pruefstand?.warnungen ?? warnungen}
                        offeneTodos={e.pruefstand?.offeneTodos ?? offeneTodos.length}
                        bewertungGefunden={w.mapBewertung.gefunden}
                        onExport={() => setDialogTv(e)}
                      />
                    )
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
          sections={[{ id: 'NF', anker: ANKER_BY_TYP[dialogTv.artefaktTyp], finalerText: dialogTv.text }]}
          dateiPrefix={DATEI_PREFIX_BY_TYP[dialogTv.artefaktTyp]}
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

/** NF | RNE | ABL — RNE/ABL erzeugen einen Bescheid-Entwurf (strengeres Freigabe-Tor). */
function ArtefaktSchalter({ wert, onChange }: { wert: ArtefaktTyp; onChange: (t: ArtefaktTyp) => void }): React.ReactElement {
  const items: Array<{ typ: ArtefaktTyp; label: string }> = [
    { typ: 'nf', label: LABEL_BY_TYP.nf },
    { typ: 'rne', label: LABEL_BY_TYP.rne },
    { typ: 'abl', label: LABEL_BY_TYP.abl },
  ];
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {items.map(i => (
        <button
          key={i.typ}
          type="button"
          aria-pressed={wert === i.typ}
          onClick={() => onChange(i.typ)}
          className={`text-[12px] px-3 py-1.5 rounded-[8px] border transition-colors cursor-pointer hover:border-[var(--tf-border-hover)] ${
            wert === i.typ ? 'border-[var(--tf-primary)] bg-[var(--tf-primary)] text-white' : 'border-[var(--tf-border)] text-[var(--tf-text-secondary)]'
          }`}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}
