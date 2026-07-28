/**
 * Felder-Tab — der Statuskatalog des Fachsystems kuratieren.
 *
 * Gezeigt wird der Ordnerbaum (Verbund und Teilvorhaben getrennt), darin je Feld
 * eine Zeile mit allem, was die PL entscheidet: Name, Ordner, wer den Eintrag
 * setzt (AB/FB/QS/PA/Juristen — Mehrfachauswahl, leer = jeder), Prominenz und
 * — der wirksame Teil — Spine-Phase, Rang und terminal.
 * **Ohne Rang trägt ein Feld nicht zur Statusableitung bei**; so ist der ganze
 * Code-Katalog ausgeliefert.
 *
 * Darüber zwei Übernahme-Blöcke: was die Auslieferung mitbringt und was in den
 * CSV-Quellen gefunden wurde. Rein darstellend — jede Änderung geht über die
 * `api`-Setter in den Entwurf.
 *
 * **Alle Ordner starten zugeklappt**, und was der Nutzer öffnet, bleibt für den
 * nächsten Seitenaufruf offen (`useCollapsedSection`, localStorage, gerätelokal).
 */
import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ToggleChip } from '@/components/ui/ToggleChip';
import { useCollapsedSection } from '@/core/hooks/useCollapsedSection';
import {
  flacheBaumListe, NICHT_ZUGEORDNET_ID, ROLLEN, ROLLE_LABEL, ROLLE_LANG,
  betrifftRolle, rollenVonFeld, sortiereRollen,
  type Prominenz, type Rolle, type SpinePhase,
  type StatusFeldEintrag, type StatusKategorie,
} from '@/core/status';
import type { StatusCockpitApi } from './useStatusCockpit';
import {
  EBENE_LABEL, PROMINENZ_LABEL, PROMINENZ_WERTE, SPINE_LABEL, SPINE_WERTE, TYP_LABEL,
  feldKlasse, feldStil,
} from './labels';
import { KategorieEditor } from './KategorieEditor';

const thKlasse = 'text-left font-medium text-[11px] text-[var(--tf-text-tertiary)] px-2 py-1.5 whitespace-nowrap';
const tdKlasse = 'px-2 py-1.5 align-middle';

/** Ohne Zuordnung sichtbar bleiben: Felder ohne Ordner landen im Sammelordner. */
function ordnerVon(feld: StatusFeldEintrag): string {
  return feld.kategorieId ?? NICHT_ZUGEORDNET_ID[feld.ebene];
}

/**
 * Wer den Eintrag setzt — Mehrfachauswahl, weil das Fachsystem Kombinationen
 * führt (`AB/FB/QS`, `AB/QS/Juristen`). KEINE Auswahl heißt „jeder darf";
 * das steht in der Spaltenüberschrift, damit die Zeile ohne Zusatz-Zeichen
 * auskommt und in jeder Zeile gleich breit bleibt.
 */
function RollenWahl({ f, set }: {
  f: StatusFeldEintrag;
  set: (patch: Partial<StatusFeldEintrag>) => void;
}): React.ReactElement {
  const aktiv = rollenVonFeld(f);
  const toggle = (r: Rolle): void => {
    const next = aktiv.includes(r) ? aktiv.filter(x => x !== r) : sortiereRollen([...aktiv, r]);
    // Den abgelösten Wert gleich mit ausbuchen: sonst bliebe er als toter
    // Ballast in der Fassung stehen und würde beim nächsten Export mitwandern.
    set({ rollen: next, zustaendigkeit: undefined });
  };
  return (
    <div className="flex items-center gap-1">
      {ROLLEN.map(r => {
        const an = aktiv.includes(r);
        return (
          <button
            key={r} type="button" onClick={() => toggle(r)} aria-pressed={an} title={ROLLE_LANG[r]}
            className={`text-[11px] leading-none rounded px-1.5 py-1 cursor-pointer ${
              an ? 'text-white' : 'text-[var(--tf-text-tertiary)]'}`}
            style={an ? { background: 'var(--tf-primary)' } : feldStil}
          >
            {ROLLE_LABEL[r]}
          </button>
        );
      })}
    </div>
  );
}

function FeldZeile({ f, csvSpalte, api, ordnerWahl }: {
  f: StatusFeldEintrag;
  csvSpalte: string;
  api: StatusCockpitApi;
  ordnerWahl: { id: string; label: string }[];
}): React.ReactElement {
  const set = (patch: Partial<StatusFeldEintrag>): void => api.setFeld(f.feldId, patch);
  return (
    <tr className="border-b border-[var(--tf-border)] hover:bg-[var(--tf-hover)]">
      <td className={`${tdKlasse} text-[12px] text-[var(--tf-text-secondary)] font-mono whitespace-nowrap`} title={f.feldId}>
        <div className="flex items-center gap-1.5">
          <span>{f.code ?? f.feldId}</span>
          {f.unkuratiert && <Badge variant="warning">neu</Badge>}
        </div>
      </td>
      <td className={`${tdKlasse} text-[12px] text-[var(--tf-text-tertiary)] font-mono whitespace-nowrap`}>
        {csvSpalte}
      </td>
      <td className={`${tdKlasse} min-w-[240px]`}>
        <input value={f.label} placeholder={f.feldId} className={feldKlasse} style={feldStil}
          onChange={e => set({ label: e.target.value })} />
      </td>
      <td className={`${tdKlasse} text-[12px] text-[var(--tf-text-secondary)]`}>{TYP_LABEL[f.typ]}</td>
      <td className={`${tdKlasse} min-w-[190px]`}>
        <select value={ordnerVon(f)} className={feldKlasse} style={feldStil}
          onChange={e => set({ kategorieId: e.target.value })}>
          {ordnerWahl.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </td>
      <td className={`${tdKlasse} whitespace-nowrap`}>
        <RollenWahl f={f} set={set} />
      </td>
      <td className={`${tdKlasse} min-w-[124px]`}>
        <select value={f.prominenzDefault} className={feldKlasse} style={feldStil}
          onChange={e => set({ prominenzDefault: e.target.value as Prominenz })}>
          {PROMINENZ_WERTE.map(p => <option key={p} value={p}>{PROMINENZ_LABEL[p]}</option>)}
        </select>
      </td>
      {/* Wert-Felder holen Phase und Rang aus dem Wert, nicht aus dem Feld —
          dort wären die Eingaben wirkungslos und würden nur in die Irre führen. */}
      <td className={`${tdKlasse} min-w-[124px]`}>
        {f.typ === 'wert' ? <span className="text-[12px] text-[var(--tf-text-tertiary)]">je Wert</span> : (
          <select value={f.spinePhase ?? 'keine'} className={feldKlasse} style={feldStil}
            onChange={e => set({ spinePhase: e.target.value as SpinePhase })}>
            {SPINE_WERTE.map(p => <option key={p} value={p}>{SPINE_LABEL[p]}</option>)}
          </select>
        )}
      </td>
      <td className={`${tdKlasse} w-[64px]`}>
        {f.typ === 'wert' ? null : (
          <input type="number" value={f.rang ?? 0} className={feldKlasse} style={feldStil}
            title="0 = trägt nicht zur Statusableitung bei"
            onChange={e => set({ rang: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : 0 })} />
        )}
      </td>
      <td className={`${tdKlasse} text-center`}>
        {f.typ === 'wert' ? null : (
          <input type="checkbox" className="accent-[var(--tf-primary)] cursor-pointer"
            checked={f.terminal === true} onChange={e => set({ terminal: e.target.checked })} />
        )}
      </td>
      <td className={`${tdKlasse} text-center`}>
        <input type="checkbox" className="accent-[var(--tf-primary)] cursor-pointer"
          checked={f.aktiv} onChange={e => set({ aktiv: e.target.checked })} />
      </td>
    </tr>
  );
}

/**
 * Ein Ordner mit seinen Feldern.
 *
 * Eigene Komponente, weil der Auf-/Zu-Zustand **je Ordner gemerkt** wird und
 * `useCollapsedSection` als Hook nur am Kopf einer Komponente stehen darf.
 * Default ZU: 512 Felder in 19 Ordnern wären aufgeklappt eine Seite, die
 * niemand überblickt — was einmal geöffnet wurde, bleibt beim nächsten Aufruf
 * offen.
 *
 * Bei aktiver Suche stehen alle Ordner offen (sonst versteckte die Seite genau
 * die Treffer) und der Umschalter ruht, statt wirkungslos zu klicken.
 */
function OrdnerGruppe({ kategorie, tiefe, felder, api, ordnerWahl, suchModus }: {
  kategorie: StatusKategorie;
  tiefe: number;
  felder: StatusFeldEintrag[];
  api: StatusCockpitApi;
  ordnerWahl: Record<'verbund' | 'tv', { id: string; label: string }[]>;
  suchModus: boolean;
}): React.ReactElement {
  const [offen, toggleOffen] = useCollapsedSection(
    `status-cockpit:felder:${kategorie.id}`, { defaultOpen: false },
  );
  const zeigeOffen = offen || suchModus;

  return (
    <div style={{ marginLeft: tiefe * 14 }}>
      <button
        type="button" aria-expanded={zeigeOffen} disabled={suchModus}
        title={suchModus ? 'Während der Suche stehen alle Ordner offen' : undefined}
        className="flex items-center gap-1.5 py-1 cursor-pointer disabled:cursor-default"
        onClick={toggleOffen}
      >
        <ChevronRight
          size={13} className="text-[var(--tf-text-tertiary)] transition-transform duration-200 shrink-0"
          style={{ transform: zeigeOffen ? 'rotate(90deg)' : 'rotate(0deg)' }}
        />
        <span className="text-[13px] font-medium text-[var(--tf-text)]">{kategorie.label}</span>
        <span className="text-[11px] text-[var(--tf-text-tertiary)]">{felder.length}</span>
        {!kategorie.aktiv && <Badge variant="default">stillgelegt</Badge>}
      </button>
      <div className={zeigeOffen ? 'overflow-x-auto rounded' : 'hidden'} style={feldStil}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--tf-border)] bg-[var(--tf-bg-secondary)]">
              <th className={thKlasse}>Code</th>
              <th className={thKlasse}>CSV-Spalte</th>
              <th className={thKlasse}>Bezeichnung</th>
              <th className={thKlasse}>Typ</th>
              <th className={thKlasse}>Ordner</th>
              <th
                className={thKlasse}
                title="Rollen des Fachsystems: AB, FB, QS, PA, Juristen. Keine Auswahl = jeder darf setzen."
              >
                wird gesetzt von <span className="font-normal">(leer = alle)</span>
              </th>
              <th className={thKlasse}>Prominenz</th>
              <th className={thKlasse}>Spine-Phase</th>
              <th className={thKlasse}>Rang</th>
              <th className={`${thKlasse} text-center`}>terminal</th>
              <th className={`${thKlasse} text-center`}>aktiv</th>
            </tr>
          </thead>
          <tbody>
            {felder.map(f => (
              <FeldZeile
                key={f.feldId} f={f} api={api} ordnerWahl={ordnerWahl[f.ebene]}
                csvSpalte={api.csvSpalten.get(f.feldId)?.join(', ') ?? '—'}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function FelderTab({ api }: { api: StatusCockpitApi }): React.ReactElement | null {
  const [suche, setSuche] = useState('');
  const [ebeneFilter, setEbeneFilter] = useState<'alle' | 'verbund' | 'tv'>('alle');
  const [rolleFilter, setRolleFilter] = useState<'alle' | Rolle>('alle');
  const [nurMitRang, setNurMitRang] = useState(false);
  const [abweichungenOffen, setAbweichungenOffen] = useState(false);
  // Auf-/Zu bleibt über Seitenaufrufe erhalten (localStorage, gerätelokal).
  const [ordnerOffen, toggleOrdnerOffen] = useCollapsedSection(
    'status-cockpit:ordner-editor', { defaultOpen: false },
  );
  const suchModus = suche.trim() !== '';

  const entwurf = api.entwurf;
  const kategorien = useMemo(() => entwurf?.kategorien ?? [], [entwurf]);

  /** Ordner-Auswahl je Ebene, in Baum-Reihenfolge und eingerückt beschriftet. */
  const ordnerWahl = useMemo(() => {
    const je: Record<'verbund' | 'tv', { id: string; label: string }[]> = { verbund: [], tv: [] };
    for (const ebene of ['verbund', 'tv'] as const) {
      je[ebene] = flacheBaumListe(kategorien, ebene)
        .map(({ kategorie, tiefe }) => ({ id: kategorie.id, label: `${'  '.repeat(tiefe)}${kategorie.label}` }));
    }
    return je;
  }, [kategorien]);

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return (entwurf?.felder ?? []).filter(f => {
      if (ebeneFilter !== 'alle' && f.ebene !== ebeneFilter) return false;
      // Neutrale Einträge (ohne Rollen) bleiben unter jeder Wahl sichtbar —
      // „jeder darf setzen", nicht „niemand".
      if (!betrifftRolle(f, rolleFilter)) return false;
      if (nurMitRang && (f.rang ?? 0) === 0) return false;
      if (!q) return true;
      const spalten = api.csvSpalten.get(f.feldId)?.join(' ') ?? '';
      return `${f.code ?? ''} ${f.feldId} ${f.label} ${spalten}`.toLowerCase().includes(q);
    });
  }, [entwurf, suche, ebeneFilter, rolleFilter, nurMitRang, api.csvSpalten]);

  if (!entwurf) return null;

  const proOrdner = new Map<string, StatusFeldEintrag[]>();
  for (const f of gefiltert) {
    const id = ordnerVon(f);
    const liste = proOrdner.get(id);
    if (liste) liste.push(f); else proOrdner.set(id, [f]);
  }

  const mitRang = entwurf.felder.filter(f => (f.rang ?? 0) > 0).length;

  return (
    <div className="flex flex-col gap-3 pt-3">
      <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
        {entwurf.felder.length} Felder in {kategorien.length} Ordnern · {mitRang} davon wirken auf die
        Statusableitung. Ein Feld ohne Rang wird erfasst und angezeigt, hebt aber keine Phase.
      </p>

      {api.seedLuecke.felder > 0 && (
        <div className="flex items-center justify-between gap-2 rounded px-2.5 py-2" style={feldStil}>
          <span className="text-[12.5px] text-[var(--tf-text)]">
            Die Auslieferung führt {api.seedLuecke.felder} Statusfelder
            {api.seedLuecke.kategorien > 0 ? ` und ${api.seedLuecke.kategorien} Ordner` : ''}, die dieser
            Fassung fehlen.
          </span>
          <Button variant="secondary" size="sm" onClick={api.seedNachziehen}>Nachziehen</Button>
        </div>
      )}

      {api.textAbweichungen.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded px-2.5 py-2" style={feldStil}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12.5px] text-[var(--tf-text)]">
              Bei {api.textAbweichungen.length} Feldern weichen Bezeichnung oder Rollen von der
              Kürzel-Zuarbeit des Fachsystems ab. Ordner, Phase und Rang bleiben unangetastet.
            </span>
            <Button variant="secondary" size="sm" onClick={api.texteUebernehmen}>
              Zuarbeit übernehmen
            </Button>
          </div>
          <button
            type="button" onClick={() => setAbweichungenOffen(v => !v)} aria-expanded={abweichungenOffen}
            className="self-start text-[12px] text-[var(--tf-text-tertiary)] cursor-pointer underline"
          >
            {abweichungenOffen ? 'Vorschau ausblenden' : 'Vorschau anzeigen'}
          </button>
          {abweichungenOffen && (
            <ul className="flex flex-col gap-0.5 max-h-[220px] overflow-y-auto">
              {api.textAbweichungen.map(a => (
                <li key={a.feldId} className="text-[11.5px] text-[var(--tf-text-secondary)] flex gap-2">
                  <span className="font-mono text-[var(--tf-text-tertiary)] shrink-0 w-[72px] truncate">
                    {a.code ?? a.feldId}
                  </span>
                  <span className="min-w-0">
                    <span className="line-through">{a.altesLabel}</span>
                    {' → '}
                    <span className="text-[var(--tf-text)]">{a.neuesLabel}</span>
                    {a.alteRollen.join('/') !== a.neueRollen.join('/') && (
                      <span className="text-[var(--tf-text-tertiary)]">
                        {' · '}
                        {a.alteRollen.length ? a.alteRollen.map(r => ROLLE_LABEL[r]).join('/') : 'alle'}
                        {' → '}
                        {a.neueRollen.length ? a.neueRollen.map(r => ROLLE_LABEL[r]).join('/') : 'alle'}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {api.unkuratierteFelder.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h3 className="text-[12px] font-medium text-[var(--tf-text-secondary)] uppercase tracking-wide">
            In den CSV-Quellen gefunden — noch nicht im Katalog
          </h3>
          {api.unkuratierteFelder.map(f => (
            <div key={f.feldId} className="flex items-center justify-between gap-2 rounded px-2.5 py-2" style={feldStil}>
              <div className="min-w-0 flex items-center gap-2 flex-wrap">
                <Badge variant="warning">neu</Badge>
                <span className="text-[11px] font-mono text-[var(--tf-text-tertiary)]">{f.feldId}</span>
                <span className="text-[12.5px] text-[var(--tf-text)]">{f.label}</span>
                <span className="text-[11px] text-[var(--tf-text-tertiary)]">{EBENE_LABEL[f.ebene]}</span>
              </div>
              <Button
                variant="secondary" size="sm"
                onClick={() => api.uebernehmeFeld(f, NICHT_ZUGEORDNET_ID[f.ebene])}
              >
                Übernehmen
              </Button>
            </div>
          ))}
        </section>
      )}

      <div className="flex flex-col gap-2">
        <input
          value={suche} placeholder="Code, Spalte oder Bezeichnung suchen …"
          className="w-full max-w-[360px] text-[12.5px] rounded px-2.5 py-1.5 bg-[var(--tf-bg)] text-[var(--tf-text)]"
          style={feldStil} onChange={e => setSuche(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {(['alle', 'verbund', 'tv'] as const).map(e => (
            <ToggleChip
              key={e} label={e === 'alle' ? 'Alle Ebenen' : EBENE_LABEL[e]}
              selected={ebeneFilter === e} onToggle={() => setEbeneFilter(e)}
            />
          ))}
          <span className="w-2" />
          {(['alle', ...ROLLEN] as const).map(r => (
            <ToggleChip
              key={r} label={r === 'alle' ? 'Alle Rollen' : ROLLE_LABEL[r]}
              selected={rolleFilter === r} onToggle={() => setRolleFilter(r)}
            />
          ))}
          <span className="w-2" />
          <ToggleChip label="nur mit Rang" selected={nurMitRang} onToggle={() => setNurMitRang(v => !v)} />
        </div>
      </div>

      <div>
        <button
          type="button" onClick={toggleOrdnerOffen} aria-expanded={ordnerOffen}
          className="flex items-center gap-1.5 cursor-pointer"
        >
          <ChevronRight
            size={14} className="text-[var(--tf-text-tertiary)] transition-transform duration-200 shrink-0"
            style={{ transform: ordnerOffen ? 'rotate(90deg)' : 'rotate(0deg)' }}
          />
          <span className="text-[13px] font-medium text-[var(--tf-text)]">Ordner bearbeiten</span>
        </button>
        <div className={ordnerOffen ? 'mt-2' : 'hidden'}>
          <KategorieEditor api={api} />
        </div>
      </div>

      {(['verbund', 'tv'] as const)
        .filter(ebene => ebeneFilter === 'alle' || ebeneFilter === ebene)
        .map(ebene => (
          <section key={ebene} className="flex flex-col gap-1">
            <h3 className="text-[12px] font-medium text-[var(--tf-text-secondary)] uppercase tracking-wide">
              {EBENE_LABEL[ebene]}
            </h3>
            {flacheBaumListe(kategorien, ebene)
              .map(({ kategorie, tiefe }) => ({
                kategorie, tiefe, felder: proOrdner.get(kategorie.id) ?? [],
              }))
              .filter(g => g.felder.length > 0)
              .map(g => (
                <OrdnerGruppe
                  key={g.kategorie.id}
                  kategorie={g.kategorie} tiefe={g.tiefe} felder={g.felder}
                  api={api} ordnerWahl={ordnerWahl} suchModus={suchModus}
                />
              ))}
          </section>
        ))}

      {gefiltert.length === 0 && (
        <p className="text-[12.5px] text-[var(--tf-text-tertiary)] px-3 py-4">
          Keine Felder für die aktuellen Filter.
        </p>
      )}
    </div>
  );
}
