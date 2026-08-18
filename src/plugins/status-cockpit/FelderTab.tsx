/**
 * Kürzel-Tab — das Verzeichnis der Vorgangskürzel des Fachsystems, kuratierbar.
 *
 * Gezeigt wird der Ordnerbaum (Verbund und Teilvorhaben getrennt), darin je
 * Kürzel eine schmale Zeile: Code, CSV-Spalte, Bezeichnung, **Relevanz**, Typ,
 * wer den Eintrag setzt (AB/FB/QS/PA/Juristen — Mehrfachauswahl, leer = jeder)
 * und aktiv.
 *
 * **Die Zeile führt nur, was hier auch entschieden wird** (seit v4.92). Ordner,
 * Prominenz und der Verfahrensschritt des Datums stehen in der aufklappbaren
 * [ZeilenKlappe](#) darunter — die Messung an der laufenden Fassung 23 hatte
 * ergeben, dass an den ersten beiden über 23 Fassungen hinweg **keine einzige**
 * Änderung vorgenommen wurde (sie kommen richtig aus der Kürzel-Zuarbeit),
 * während der dritte für 91 % der Kürzel gar keine Antwort haben kann. Drei
 * Auswahlfelder in 509 Zeilen waren damit vor allem eines: eine Aufforderung.
 * Was wirklich Handarbeit ist, ist die **Relevanz** — und die bleibt in der Zeile.
 *
 * Die Relevanz (Konzept 4.1) markiert die Kürzel, die für die Antragsbearbeitung
 * zählen. Sie grenzen Navigator, Wächter und die Status-Erklärung ein — ohne sie
 * bleibt die Kandidatenliste unbrauchbar groß.
 *
 * Der Verfahrensschritt am Feld beantwortet „welches Datum gehört zum aktuellen
 * Status?" — er speist die „seit"-Angabe der Erklärung und die Marke in der
 * Chronik. Leer heißt „trägt nichts bei". Wer wissen will, welche Datumsfelder
 * einen Schritt speisen (und welcher Schritt leer ausgeht), sieht das am Schritt
 * selbst im Reiter *Statuswerte* — dort, wo die Phase lebt. Sie leitet **keinen
 * Status ab** (Pitfall #44).
 *
 * Die Frage „hat das Kürzel überhaupt eine `D_`-Spalte im Export?" beantwortet
 * die vorhandene Spalte **CSV-Spalte** (leer = nirgends gemappt); dafür braucht
 * es keine zweite Spalte, nur den passenden Filter.
 *
 * **Der Ordnerbaum führt nur, was im Blick ist.** Knapp die Hälfte des Katalogs
 * kommt in keiner CSV-Quelle vor und kann deshalb weder eine Phase noch eine
 * Regel noch eine Frage tragen; diese Kürzel stehen zugeklappt in
 * [RuhendeKuerzel](./RuhendeKuerzel.tsx) statt zwischen den arbeitenden. Was
 * ruht und warum, leitet `ruhende-kuerzel.ts` ab — hier wird nur gezeigt.
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
import { zaehlwort } from '@/core/utils/zaehlwort';
import {
  flacheBaumListe, NICHT_ZUGEORDNET_ID, ROLLEN, ROLLE_LABEL, ROLLE_LANG,
  betrifftRolle, rollenVonFeld, sortiereRollen, wirkungZeilen, baueLegende,
  hatSpalteAus, ruheGrund, schlafendeKuerzel,
  type Prominenz, type Rolle, type ZahPhaseId,
  zahPhasenVon,
  type StatusFeldEintrag, type StatusKategorie, type TriggerZeile, type WirkungsZeile,
} from '@/core/status';
import type { StatusCockpitApi } from './useStatusCockpit';
import {
  EBENE_LABEL, PROMINENZ_LABEL, PROMINENZ_WERTE, TYP_LABEL,
  feldKlasse, feldStil,
} from './labels';
import { KategorieEditor } from './KategorieEditor';
import { FelderAbgleich } from './FelderAbgleich';
import { BestandslaufBlock } from './BestandslaufBlock';
import { RuhendeKuerzel, type RuhendeZeile } from './RuhendeKuerzel';
import { useVerlaufErhebung } from './useVerlaufErhebung';
import { useFristErhebung } from './useFristErhebung';
import { useEinsatzErhebung } from './useEinsatzErhebung';

const thKlasse = 'text-left font-medium text-[11px] text-[var(--tf-text-tertiary)] px-2 py-1.5 whitespace-nowrap';
const tdKlasse = 'px-2 py-1.5 align-middle';
const klappenLabelKlasse = 'text-[11px] uppercase tracking-wide text-[var(--tf-text-tertiary)]';

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

/**
 * Die Klappe einer Kürzel-Zeile: was selten gebraucht wird, und was das
 * Fachsystem schon beantwortet hat.
 *
 * **Warum das nicht mehr in der Zeile steht.** Gemessen an der laufenden Fassung
 * hat in 23 Fassungen niemand einen Ordner und niemand eine Prominenz geändert —
 * beide kamen richtig aus der Kürzel-Zuarbeit. Als Auswahlfeld in 509 Zeilen
 * waren sie trotzdem 1.018 Aufforderungen zu einer Entscheidung, die nie nötig
 * war. Die ZAH-Phase wiederum kann für 91 % der Kürzel gar keine Antwort haben:
 * die Trigger-Tabelle sagt nur für eine Handvoll, welchen Status ein Kürzel
 * setzt. Eine Spalte, die dauerhaft leer bleiben muss, liest sich als Rückstand.
 *
 * Wegnehmen wäre falsch — umhängen kommt vor, nur eben selten. Also steht es
 * hier, mit der Herkunft dabei.
 */
function ZeilenKlappe({ f, api, ordnerWahl, wirkung, spalten }: {
  f: StatusFeldEintrag;
  api: StatusCockpitApi;
  ordnerWahl: { id: string; label: string }[];
  wirkung: WirkungsZeile[];
  spalten: number;
}): React.ReactElement {
  const set = (patch: Partial<StatusFeldEintrag>): void => api.setFeld(f.feldId, patch);
  return (
    <tr className="border-b border-[var(--tf-border)] bg-[var(--tf-bg-secondary)]">
      <td colSpan={spalten} className="px-3 py-2.5">
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
            <label className="flex flex-col gap-1">
              <span className={klappenLabelKlasse}>Ordner</span>
              <select
                value={ordnerVon(f)} className={`${feldKlasse} min-w-[200px]`} style={feldStil}
                onChange={e => set({ kategorieId: e.target.value })}
              >
                {ordnerWahl.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className={klappenLabelKlasse}>Prominenz</span>
              <select
                value={f.prominenzDefault} className={`${feldKlasse} min-w-[140px]`} style={feldStil}
                title="Wie stark wird der Punkt in der Chronik gezeichnet? Hat nichts mit dem Meilenstein-Plan zu tun."
                onChange={e => set({ prominenzDefault: e.target.value as Prominenz })}
              >
                {PROMINENZ_WERTE.map(p => <option key={p} value={p}>{PROMINENZ_LABEL[p]}</option>)}
              </select>
            </label>
            {/* Wert-Felder tragen ihre Phase am WERT, nicht am Feld — hier wäre
                die Eingabe wirkungslos und würde nur in die Irre führen. */}
            {f.typ !== 'wert' && (
              <label className="flex flex-col gap-1">
                <span className={klappenLabelKlasse}>Verfahrensschritt des Datums</span>
                <select
                  value={f.zahPhaseId ?? ''} className={`${feldKlasse} min-w-[150px]`} style={feldStil}
                  title="Beantwortet „seit wann gilt der Status“ und beschriftet die Chronik-Marke. Leer = trägt nichts bei."
                  onChange={e => set({ zahPhaseId: e.target.value === '' ? null : e.target.value as ZahPhaseId })}
                >
                  <option value="">—</option>
                  {zahPhasenVon(api.entwurf?.zahPhasen).map(p => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
            Ordner und Prominenz kommen aus der Kürzel-Zuarbeit und stimmen dort bereits —
            ändern nur, wenn das Fachsystem etwas anderes sagt. Der Verfahrensschritt
            entscheidet allein, welches Datum die Erklärung als „seit wann" zeigt;
            leer lassen ist der Normalfall.
          </p>
          {wirkung.length > 0 && (
            <div className="flex flex-col gap-1 pt-0.5 border-t border-[var(--tf-border)]">
              <span className={`${klappenLabelKlasse} pt-1.5`}>
                Was das Kürzel in C16 auslöst
              </span>
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
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

function FeldZeile({ f, csvSpalte, api, ordnerWahl, wirkung, spalten }: {
  f: StatusFeldEintrag;
  csvSpalte: string;
  api: StatusCockpitApi;
  ordnerWahl: { id: string; label: string }[];
  /** Trigger-Wirkung dieses Kürzels je Programm; leer ohne importierte Tabelle. */
  wirkung: WirkungsZeile[];
  /** Spaltenzahl der Tabelle — für die aufgeklappte Zeile. */
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
            {/* EIN Griff für alles Seltene. Er ist immer da — bis v4.92 erschien
                er nur bei vorhandener Trigger-Wirkung, und die Zeilen ohne ihn
                sahen aus, als hätten sie nichts zu zeigen. */}
            <button
              type="button" onClick={() => setOffen(v => !v)} aria-expanded={offen}
              title={offen ? 'Zuklappen' : 'Ordner, Prominenz, Verfahrensschritt und Wirkung zeigen'}
              className="inline-flex items-center text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
            >
              <ChevronRight
                size={12} className="transition-transform duration-200"
                style={{ transform: offen ? 'rotate(90deg)' : 'rotate(0deg)' }}
              />
            </button>
            <span>{f.code ?? f.feldId}</span>
            {f.unkuratiert && <Badge variant="warning">neu</Badge>}
            {/* Die Wirkung sitzt am Code, nicht in einer eigenen Spalte: dort
                sucht sie der Leser, und die Tabelle bleibt schmal. */}
            {vorgangssystem && wirkung.length > 0 && (
              <span
                title={`${zaehlwort(wirkung.length, 'Trigger-Zeile', 'Trigger-Zeilen')} — aufklappen`}
                className="inline-flex items-center gap-0.5 text-[10.5px] text-[var(--tf-text-tertiary)]"
              >
                <Zap size={11} />
                {wirkung.length}
              </span>
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
        <td className={`${tdKlasse} whitespace-nowrap`}>
          <RollenWahl f={f} set={set} />
        </td>
        <td className={`${tdKlasse} text-center`}>
          <input type="checkbox" className="accent-[var(--tf-primary)] cursor-pointer"
            checked={f.aktiv} onChange={e => set({ aktiv: e.target.checked })} />
        </td>
      </tr>
      {offen && (
        <ZeilenKlappe
          f={f} api={api} ordnerWahl={ordnerWahl} wirkung={wirkung} spalten={spalten}
        />
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
  // Code, CSV-Spalte, Bezeichnung, [relevant], Typ, Rollen, aktiv. Ordner,
  // Prominenz und Verfahrensschritt stehen in der Klappe (siehe ZeilenKlappe).
  const spalten = vorgangssystem ? 7 : 6;

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
              <th
                className={thKlasse}
                title="Rollen des Fachsystems: AB, FB, QS, PA, Juristen. Keine Auswahl = jeder darf setzen."
              >
                wird gesetzt von <span className="font-normal">(leer = alle)</span>
              </th>
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
  // Vor dem Early-Return: die Hook-Reihenfolge hängt an der Aufrufreihenfolge,
  // und `tsc` fängt einen Verstoß nicht (React #310).
  const verlauf = useVerlaufErhebung(api.entwurf);
  const frist = useFristErhebung(api.entwurf);
  const einsatz = useEinsatzErhebung(api.entwurf);

  const entwurf = api.entwurf;
  const kategorien = useMemo(() => entwurf?.kategorien ?? [], [entwurf]);
  const trigger = api.trigger.datei?.trigger ?? [];
  const legende = useMemo(() => baueLegende(entwurf?.textbausteine), [entwurf?.textbausteine]);

  /**
   * Ruhe wird bei jedem Rendern abgeleitet, nie gespeichert (Pitfall #45): ein
   * neu gemapptes Kürzel wacht damit auf, sobald das Schema es führt.
   */
  const hatSpalte = useMemo(() => hatSpalteAus(api.csvSpalten), [api.csvSpalten]);
  const alleRuhenden = useMemo(
    () => (entwurf?.felder ?? []).filter(f => ruheGrund(f, hatSpalte(f)) !== null),
    [entwurf, hatSpalte],
  );
  const schlafend = useMemo(
    () => (entwurf && einsatz.treffer
      ? schlafendeKuerzel(entwurf.felder, einsatz.treffer, hatSpalte)
      : []),
    [entwurf, einsatz.treffer, hatSpalte],
  );

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

  // Der Ordnerbaum führt nur, was im Blick ist; die ruhenden stehen zugeklappt
  // darunter. Beide Mengen kommen aus DERSELBEN Filterung — sonst zeigte eine
  // Suche in der einen Hälfte Treffer und in der anderen nicht.
  const ordnerLabel = new Map(kategorien.map(k => [k.id, k.label]));
  const proOrdner = new Map<string, StatusFeldEintrag[]>();
  const ruhendeZeilen: RuhendeZeile[] = [];
  for (const f of gefiltert) {
    const grund = ruheGrund(f, hatSpalte(f));
    if (grund !== null) {
      const code = f.code?.normalize('NFC');
      const t = code !== undefined ? einsatz.treffer?.get(code) : undefined;
      ruhendeZeilen.push({
        feld: f, grund,
        ordner: ordnerLabel.get(ordnerVon(f)) ?? 'Nicht zugeordnet',
        frueher: t === undefined ? null : t.frueher,
      });
      continue;
    }
    const id = ordnerVon(f);
    const liste = proOrdner.get(id);
    if (liste) liste.push(f); else proOrdner.set(id, [f]);
  }

  const mitPhase = entwurf.felder.filter(f => f.zahPhaseId != null).length;
  const relevanteAnzahl = entwurf.felder.filter(f => f.relevant === true).length;
  const phasenZahlen = api.feldPhasenAuswahl.kennzahlen;
  const ruhendeIds = new Set(alleRuhenden.map(f => f.feldId));
  const relevanteRuhende = alleRuhenden.filter(f => f.relevant === true).map(f => f.feldId);

  return (
    <div className="flex flex-col gap-3 pt-3">
      <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
        {entwurf.felder.length} Kürzel in {zaehlwort(kategorien.length, 'Ordner', 'Ordnern')}
        {alleRuhenden.length > 0 && (
          <> · {entwurf.felder.length - alleRuhenden.length} im Blick, {alleRuhenden.length} ruhen</>
        )}
        {' · '}{mitPhase} sind einem Verfahrensschritt zugeordnet und liefern damit das
        „seit wann" (zu sehen im Reiter <em>Statuswerte</em> am Schritt selbst).
        {vorgangssystem && (
          <>
            {' '}{relevanteAnzahl} als relevant markiert
            {relevanteAnzahl === 0 && ' — ohne Markierung prüft der Navigator alle Kürzel'}
            {trigger.length === 0 && ' · Trigger-Tabelle nicht importiert (keine Wirkungen)'}.
          </>
        )}
      </p>

      {/* Ohne diesen Satz liest sich „46 von 508" wie 9 % erledigt und schickt
          den Nächsten auf die Suche nach einer Lücke, die keine ist. Die Zahlen
          werden gerechnet, nicht gesetzt — sie ändern sich mit jedem Import. */}
      {vorgangssystem && trigger.length > 0 && (
        <p className="text-[12px] text-[var(--tf-text-tertiary)] -mt-2">
          Mehr ist aus den beiden Quellen nicht ableitbar: von {phasenZahlen.mitCode} Kürzeln setzen
          nur {phasenZahlen.mitStatusTrigger} überhaupt einen Status, und die Auslieferung kuratiert
          {' '}{phasenZahlen.seedPhasen} Phasen von Hand. Die übrigen Kürzel erklären kein „seit
          wann" und brauchen keine Phase.
        </p>
      )}

      <FelderAbgleich api={api} />

      {/* Der Bestandslauf sitzt hier, weil er über die Kürzel und ihre
          Statuswirkung Auskunft gibt — dieselbe Sache wie der Rest des Reiters,
          nur über den Bestand statt über den Katalog. Ein Beleg im Befund
          filtert deshalb die Tabelle weiter unten, statt woandershin zu führen. */}
      {vorgangssystem && (
        <BestandslaufBlock
          verlauf={verlauf} frist={frist} einsatz={einsatz} onKuerzelFilter={setSuche}
        />
      )}

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

      <RuhendeKuerzel
        zeilen={ruhendeZeilen} schlafend={schlafend} jahre={einsatz.jahre}
        relevanteRuhende={relevanteRuhende} suchModus={suchModus}
        onBeachten={feldId => api.setFeld(feldId, { ruht: false })}
        onRuhenLassen={() => api.ruhenLassen(schlafend.map(s => s.feldId))}
        onRelevanzRaeumen={() => api.relevanzDerRuhendenRaeumen(ruhendeIds)}
      />

      {gefiltert.length === 0 && (
        <p className="text-[12.5px] text-[var(--tf-text-tertiary)] px-3 py-4">
          Keine Kürzel für die aktuellen Filter.
        </p>
      )}
    </div>
  );
}
