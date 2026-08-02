/**
 * Kürzel-Tab — das Verzeichnis der Vorgangskürzel des Fachsystems, kuratierbar.
 *
 * Gezeigt wird der Ordnerbaum (Verbund und Teilvorhaben getrennt), darin je
 * Kürzel eine Zeile mit allem, was die PL entscheidet: Name, Ordner, wer den
 * Eintrag setzt (AB/FB/QS/PA/Juristen — Mehrfachauswahl, leer = jeder),
 * **Relevanz**, Prominenz und die **ZAH-Phase** des Datums.
 *
 * Die ZAH-Phase am Feld beantwortet „welches Datum gehört zum aktuellen
 * Status?" — sie speist die „seit"-Angabe der Erklärung und die Marke in der
 * Chronik. Leer heißt „trägt nichts bei"; so ist der Großteil des Code-Katalogs
 * ausgeliefert, weil eine geratene Zuordnung schlechter wäre als keine. Sie
 * leitet **keinen Status ab** (Pitfall #44) — Spine-Phase, Rang und das
 * Terminal-Häkchen, die das taten, sind mit v2.385 entfallen.
 *
 * Zwei Dinge macht der Tab seit dem Vorgangssystem zusätzlich:
 *
 * - **Relevanz-Häkchen** (Konzept 4.1): markiert die Kürzel, die für die
 *   Antragsbearbeitung zählen. Sie grenzen Navigator, Wächter und die
 *   Status-Erklärung ein — ohne sie bleibt die Kandidatenliste unbrauchbar groß.
 * - **Trigger-Wirkung**: was ein Kürzel im Foyer auslöst, in Satzform aus der
 *   importierten Trigger-Tabelle. Aufklappbar in der Zeile, damit die Tabelle
 *   nicht noch eine Spalte breiter wird.
 *
 * Die Frage „hat das Kürzel überhaupt eine `D_`-Spalte im Export?" beantwortet
 * die vorhandene Spalte **CSV-Spalte** (leer = nirgends gemappt); dafür braucht
 * es keine zweite Spalte, nur den passenden Filter.
 *
 * Der Abgleich mit den Fremddaten (Auslieferung, CSV-Quellen) steht in
 * [FelderAbgleich](./FelderAbgleich.tsx) — andere Frage, andere Datei.
 *
 * **Alle Ordner starten zugeklappt**, und was der Nutzer öffnet, bleibt für den
 * nächsten Seitenaufruf offen (`useCollapsedSection`, localStorage, gerätelokal).
 */
import { useMemo, useState } from 'react';
import { ChevronRight, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ToggleChip } from '@/components/ui/ToggleChip';
import { useCollapsedSection } from '@/core/hooks/useCollapsedSection';
import { isVorgangssystemEnabled } from '@/config/feature-flags';
import {
  flacheBaumListe, NICHT_ZUGEORDNET_ID, ROLLEN, ROLLE_LABEL, ROLLE_LANG,
  betrifftRolle, rollenVonFeld, sortiereRollen, wirkungZeilen, baueLegende,
  type Prominenz, type Rolle, type ZahPhaseId,
  ZAH_PHASEN_REIHENFOLGE, ZAH_PHASE_LABEL,
  type StatusFeldEintrag, type StatusKategorie, type TriggerZeile, type WirkungsZeile,
} from '@/core/status';
import type { StatusCockpitApi } from './useStatusCockpit';
import {
  EBENE_LABEL, PROMINENZ_LABEL, PROMINENZ_WERTE, TYP_LABEL,
  feldKlasse, feldStil,
} from './labels';
import { KategorieEditor } from './KategorieEditor';
import { FelderAbgleich } from './FelderAbgleich';

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

function FeldZeile({ f, csvSpalte, api, ordnerWahl, wirkung, spalten }: {
  f: StatusFeldEintrag;
  csvSpalte: string;
  api: StatusCockpitApi;
  ordnerWahl: { id: string; label: string }[];
  /** Trigger-Wirkung dieses Kürzels je Programm; leer ohne importierte Tabelle. */
  wirkung: WirkungsZeile[];
  /** Spaltenzahl der Tabelle — für die aufgeklappte Wirkungs-Zeile. */
  spalten: number;
}): React.ReactElement {
  const [offen, setOffen] = useState(false);
  const set = (patch: Partial<StatusFeldEintrag>): void => api.setFeld(f.feldId, patch);
  const vorgangssystem = isVorgangssystemEnabled();
  return (
    <>
      <tr className="border-b border-[var(--tf-border)] hover:bg-[var(--tf-hover)]">
        <td className={`${tdKlasse} text-[12px] text-[var(--tf-text-secondary)] font-mono whitespace-nowrap`} title={f.feldId}>
          <div className="flex items-center gap-1.5">
            <span>{f.code ?? f.feldId}</span>
            {f.unkuratiert && <Badge variant="warning">neu</Badge>}
            {/* Die Wirkung sitzt am Code, nicht in einer eigenen Spalte: dort
                sucht sie der Leser, und die Tabelle bleibt schmal. */}
            {vorgangssystem && wirkung.length > 0 && (
              <button
                type="button" onClick={() => setOffen(v => !v)} aria-expanded={offen}
                title={`${wirkung.length} Trigger-Zeile${wirkung.length === 1 ? '' : 'n'} anzeigen`}
                className="inline-flex items-center gap-0.5 text-[10.5px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
              >
                <Zap size={11} />
                {wirkung.length}
              </button>
            )}
          </div>
        </td>
        <td className={`${tdKlasse} text-[12px] text-[var(--tf-text-tertiary)] font-mono whitespace-nowrap`}>
          {csvSpalte}
        </td>
        <td className={`${tdKlasse} min-w-[240px]`}>
          <input value={f.label} placeholder={f.feldId} className={feldKlasse} style={feldStil}
            onChange={e => set({ label: e.target.value })} />
        </td>
        {vorgangssystem && (
          <td className={`${tdKlasse} text-center`}>
            <input type="checkbox" className="accent-[var(--tf-primary)] cursor-pointer"
              title="Für die Antragsbearbeitung relevant — grenzt Navigator und Wächter ein"
              checked={f.relevant === true} onChange={e => set({ relevant: e.target.checked })} />
          </td>
        )}
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
        {/* Wert-Felder tragen ihre Phase am WERT, nicht am Feld — hier wäre die
            Eingabe wirkungslos und würde nur in die Irre führen. */}
        <td className={`${tdKlasse} min-w-[132px]`}>
          {f.typ === 'wert' ? <span className="text-[12px] text-[var(--tf-text-tertiary)]">je Wert</span> : (
            <select
              value={f.zahPhaseId ?? ''} className={feldKlasse} style={feldStil}
              title="Zu welcher Phase gehört dieses Datum? Beantwortet „seit wann gilt der Status“ und beschriftet die Chronik-Marke. Leer = trägt nichts bei."
              onChange={e => set({ zahPhaseId: e.target.value === '' ? null : e.target.value as ZahPhaseId })}
            >
              <option value="">—</option>
              {ZAH_PHASEN_REIHENFOLGE.map(p => (
                <option key={p} value={p}>{ZAH_PHASE_LABEL[p]}</option>
              ))}
            </select>
          )}
        </td>
        <td className={`${tdKlasse} text-center`}>
          <input type="checkbox" className="accent-[var(--tf-primary)] cursor-pointer"
            checked={f.aktiv} onChange={e => set({ aktiv: e.target.checked })} />
        </td>
      </tr>
      {offen && (
        <tr className="border-b border-[var(--tf-border)] bg-[var(--tf-bg-secondary)]">
          <td colSpan={spalten} className="px-2 py-2">
            {/* Das Programm steht an JEDER Zeile: dasselbe Kürzel wirkt je
                Richtlinie verschieden, und ohne die Nummer stünden hier
                widersprüchliche Sätze untereinander. */}
            <ul className="flex flex-col gap-0.5">
              {wirkung.map((w, i) => (
                <li key={`${f.feldId}-${i}`} className="text-[11.5px] text-[var(--tf-text-secondary)]">
                  <span className="text-[var(--tf-text-tertiary)] font-mono mr-1.5">
                    {w.programm || '—'}/{w.folge}
                  </span>
                  {w.satz}
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
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
function OrdnerGruppe({ kategorie, tiefe, felder, api, ordnerWahl, suchModus, trigger, legende }: {
  kategorie: StatusKategorie;
  tiefe: number;
  felder: StatusFeldEintrag[];
  api: StatusCockpitApi;
  ordnerWahl: Record<'verbund' | 'tv', { id: string; label: string }[]>;
  suchModus: boolean;
  legende: ReturnType<typeof baueLegende>;
  trigger: readonly TriggerZeile[];
}): React.ReactElement {
  const [offen, toggleOffen] = useCollapsedSection(
    `status-cockpit:felder:${kategorie.id}`, { defaultOpen: false },
  );
  const zeigeOffen = offen || suchModus;
  const vorgangssystem = isVorgangssystemEnabled();
  // Code, CSV-Spalte, Bezeichnung, [relevant], Typ, Ordner, Rollen, Prominenz,
  // ZAH-Phase, aktiv.
  const spalten = vorgangssystem ? 10 : 9;

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
              {vorgangssystem && (
                <th
                  className={`${thKlasse} text-center`}
                  title="Für die Antragsbearbeitung relevant — grenzt Navigator, Wächter und Erklärung ein"
                >
                  relevant
                </th>
              )}
              <th className={thKlasse}>Typ</th>
              <th className={thKlasse}>Ordner</th>
              <th
                className={thKlasse}
                title="Rollen des Fachsystems: AB, FB, QS, PA, Juristen. Keine Auswahl = jeder darf setzen."
              >
                wird gesetzt von <span className="font-normal">(leer = alle)</span>
              </th>
              <th className={thKlasse}>Prominenz</th>
              <th className={thKlasse}>ZAH-Phase</th>
              <th className={`${thKlasse} text-center`}>aktiv</th>
            </tr>
          </thead>
          <tbody>
            {felder.map(f => (
              <FeldZeile
                key={f.feldId} f={f} api={api} ordnerWahl={ordnerWahl[f.ebene]}
                csvSpalte={api.csvSpalten.get(f.feldId)?.join(', ') ?? '—'}
                wirkung={f.code ? wirkungZeilen(trigger, f.code, legende) : []}
                spalten={spalten}
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
  const [nurRelevante, setNurRelevante] = useState(false);
  const [nurMitSpalte, setNurMitSpalte] = useState(false);
  // Auf-/Zu bleibt über Seitenaufrufe erhalten (localStorage, gerätelokal).
  const [ordnerOffen, toggleOrdnerOffen] = useCollapsedSection(
    'status-cockpit:ordner-editor', { defaultOpen: false },
  );
  const suchModus = suche.trim() !== '';
  const vorgangssystem = isVorgangssystemEnabled();

  const entwurf = api.entwurf;
  const kategorien = useMemo(() => entwurf?.kategorien ?? [], [entwurf]);
  const trigger = api.trigger.datei?.trigger ?? [];
  const legende = useMemo(() => baueLegende(entwurf?.textbausteine), [entwurf?.textbausteine]);

  /** Ordner-Auswahl je Ebene, in Baum-Reihenfolge und eingerückt beschriftet. */
  const ordnerWahl = useMemo(() => {
    const je: Record<'verbund' | 'tv', { id: string; label: string }[]> = { verbund: [], tv: [] };
    for (const ebene of ['verbund', 'tv'] as const) {
      je[ebene] = flacheBaumListe(kategorien, ebene)
        .map(({ kategorie, tiefe }) => ({ id: kategorie.id, label: `${'  '.repeat(tiefe)}${kategorie.label}` }));
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
      if (nurRelevante && f.relevant !== true) return false;
      // „Hat das Kürzel eine Spalte im Export?" ist genau die Frage, die die
      // Spalte CSV-Spalte beantwortet — ohne Eintrag ist es nirgends gemappt.
      if (nurMitSpalte && (api.csvSpalten.get(f.feldId)?.length ?? 0) === 0) return false;
      if (!q) return true;
      const spalten = api.csvSpalten.get(f.feldId)?.join(' ') ?? '';
      return `${f.code ?? ''} ${f.feldId} ${f.label} ${spalten}`.toLowerCase().includes(q);
    });
  }, [entwurf, suche, ebeneFilter, rolleFilter, nurRelevante, nurMitSpalte, api.csvSpalten]);

  if (!entwurf) return null;

  const proOrdner = new Map<string, StatusFeldEintrag[]>();
  for (const f of gefiltert) {
    const id = ordnerVon(f);
    const liste = proOrdner.get(id);
    if (liste) liste.push(f); else proOrdner.set(id, [f]);
  }

  const mitPhase = entwurf.felder.filter(f => f.zahPhaseId != null).length;
  const relevanteAnzahl = entwurf.felder.filter(f => f.relevant === true).length;

  return (
    <div className="flex flex-col gap-3 pt-3">
      <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
        {entwurf.felder.length} Kürzel in {kategorien.length} Ordnern · {mitPhase} davon tragen eine
        ZAH-Phase. Ein Kürzel ohne Phase wird erfasst und angezeigt, erklärt aber kein „seit wann".
        {vorgangssystem && (
          <>
            {' '}{relevanteAnzahl} als relevant markiert
            {relevanteAnzahl === 0 && ' — ohne Markierung prüft der Navigator alle Kürzel'}
            {trigger.length === 0 && ' · Trigger-Tabelle nicht importiert (keine Wirkungen)'}.
          </>
        )}
      </p>

      <FelderAbgleich api={api} />

      <div className="flex flex-col gap-2">
        <input
          value={suche} placeholder="Kürzel, Spalte oder Bezeichnung suchen …"
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
          {vorgangssystem && (
            <ToggleChip label="nur relevante" selected={nurRelevante} onToggle={() => setNurRelevante(v => !v)} />
          )}
          <ToggleChip label="nur mit CSV-Spalte" selected={nurMitSpalte} onToggle={() => setNurMitSpalte(v => !v)} />
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
                  api={api} ordnerWahl={ordnerWahl} suchModus={suchModus} trigger={trigger}
                  legende={legende}
                />
              ))}
          </section>
        ))}

      {gefiltert.length === 0 && (
        <p className="text-[12.5px] text-[var(--tf-text-tertiary)] px-3 py-4">
          Keine Kürzel für die aktuellen Filter.
        </p>
      )}
    </div>
  );
}
