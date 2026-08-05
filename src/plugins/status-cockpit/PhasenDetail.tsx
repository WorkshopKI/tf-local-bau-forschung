/**
 * Der rechte Bereich des Phasen-Editors: was zum ausgewählten Knoten gehört.
 *
 * Zwei Gestalten, weil der Baum zwei Sorten Knoten führt:
 *
 * - **Phase** — Beschriftung, Arbeitslisten-Vorgabe, Zieltage-Relevanz. Das sind
 *   die drei Angaben, die eine Phase seit v2.409 selbst trägt; früher standen
 *   sie in festen Code-Tabellen.
 * - **Status-Code** — Label, Prominenz, Zieltage, aktiv. Dieselben Felder wie in
 *   der Tabelle, nur an EINER Stelle statt an zwei Zeilen: der Code steht unter
 *   TV- und Verbund-Feld, und beide werden gemeinsam gesetzt.
 *
 * Rein darstellend — jede Änderung geht über die `api`-Setter in den Entwurf.
 */
import { Badge } from '@/components/ui/badge';
import type { StatusCockpitApi } from './useStatusCockpit';
import type { PhasenBaumKnoten } from './phasenKnoten';
import { KATEGORIE_LABEL, KATEGORIE_WERTE, PROMINENZ_LABEL, PROMINENZ_WERTE, feldKlasse, feldStil } from './labels';
import type { Prominenz, StatusCategory, StatusWertEintrag } from '@/core/status';

const feldLabelKlasse = 'text-[11px] uppercase tracking-wide text-[var(--tf-text-tertiary)]';

function Feld({ titel, hinweis, children }: {
  titel: string; hinweis?: string; children: React.ReactNode;
}): React.ReactElement {
  return (
    <label className="flex flex-col gap-1">
      <span className={feldLabelKlasse}>{titel}</span>
      {children}
      {hinweis !== undefined && (
        <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">{hinweis}</span>
      )}
    </label>
  );
}

function PhaseDetail({ knoten, api }: {
  knoten: Extract<PhasenBaumKnoten, { art: 'phase' }>; api: StatusCockpitApi;
}): React.ReactElement {
  const p = knoten.phase;
  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-[14px] font-medium text-[var(--tf-text)]">{p.label}</h3>
        <span className="font-mono text-[11px] text-[var(--tf-text-tertiary)]">
          {p.id} · {knoten.codeAnzahl} Statuswerte · {knoten.vorkommen.toLocaleString('de-DE')} Vorgänge
        </span>
      </div>

      <Feld titel="Beschriftung" hinweis="Frei wählbar — sie erscheint in Leiste, Filter und Auswertung.">
        <input
          value={p.label} className={feldKlasse} style={feldStil}
          onChange={e => api.setZahPhase(p.id, { label: e.target.value })}
        />
      </Feld>

      <Feld
        titel="Arbeitsliste"
        hinweis="In welchen Reiter von Förderanträge Status dieser Phase fallen."
      >
        <select
          value={p.kategorieVorgabe} className={feldKlasse} style={feldStil}
          onChange={e => api.setZahPhase(p.id, {
            kategorieVorgabe: e.target.value as StatusCategory,
          })}
        >
          {KATEGORIE_WERTE.map(k => <option key={k} value={k}>{KATEGORIE_LABEL[k]}</option>)}
        </select>
      </Feld>

      <label className="flex items-start gap-2">
        <input
          type="checkbox" className="mt-0.5 accent-[var(--tf-primary)] cursor-pointer"
          checked={p.zieltageRelevant}
          onChange={e => api.setZahPhase(p.id, { zieltageRelevant: e.target.checked })}
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-[12.5px] text-[var(--tf-text)]">Zieltage sind hier sinnvoll</span>
          <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
            Nur für solche Phasen schlägt das Cockpit Liegezeiten aus dem Ist vor. Bei
            „Begleitung" und „Abgeschlossen" ist „liegt zu lange" keine sinnvolle Frage.
          </span>
        </span>
      </label>
    </div>
  );
}

function CodeDetail({ knoten, api }: {
  knoten: Extract<PhasenBaumKnoten, { art: 'code' }>; api: StatusCockpitApi;
}): React.ReactElement {
  // Der erste Eintrag führt die gemeinsamen Angaben; gesetzt wird auf allen —
  // beide Zeilen desselben Codes müssen dasselbe sagen.
  const eintraege = (api.entwurf?.werte ?? []).filter(w => knoten.wertIds.includes(w.id));
  const erster = eintraege[0];
  const setzeAlle = (patch: Partial<StatusWertEintrag>): void => {
    for (const w of eintraege) api.setWert(w.id, patch);
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-[14px] font-medium text-[var(--tf-text)]">{knoten.label ?? knoten.wert}</h3>
        <span className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-[var(--tf-text-tertiary)]">
          Code {knoten.code} · {knoten.vorkommen.toLocaleString('de-DE')} Vorgänge
          {knoten.verwaist && <Badge variant="warning">verwaist</Badge>}
        </span>
      </div>

      {knoten.verwaist && (
        <p className="text-[12px] text-[var(--tf-warning-text)]">
          Dieser Status zeigt auf einen Verfahrensschritt, den die Fassung nicht mehr führt.
          Er wird bis auf Weiteres als „ohne Phase" gelesen — ein Zug auf eine Phase behebt das.
        </p>
      )}

      {erster === undefined ? (
        <p className="text-[12.5px] text-[var(--tf-text-tertiary)]">
          Kein Wert-Eintrag zu diesem Code in der Fassung.
        </p>
      ) : (
        <>
          <Feld titel="Label" hinweis={`Leer heißt: es gilt der Rohwert „${knoten.wert}".`}>
            <input
              value={erster.label ?? ''} placeholder="wie Rohwert"
              className={feldKlasse} style={feldStil}
              onChange={e => setzeAlle({ label: e.target.value })}
            />
          </Feld>

          <Feld titel="Prominenz">
            <select
              value={erster.prominenz} className={feldKlasse} style={feldStil}
              onChange={e => setzeAlle({ prominenz: e.target.value as Prominenz })}
            >
              {PROMINENZ_WERTE.map(p => <option key={p} value={p}>{PROMINENZ_LABEL[p]}</option>)}
            </select>
          </Feld>

          <Feld
            titel="Zieltage"
            hinweis="Nach wie vielen Tagen ohne Aktivität gilt der Status als hängend? Leer = nicht bewertbar, nicht: unauffällig."
          >
            <input
              type="number" min={0} value={erster.zieltage ?? ''} placeholder="—"
              className={feldKlasse} style={feldStil}
              onChange={e => setzeAlle({
                zieltage: e.target.value === '' ? null
                  : (Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : null),
              })}
            />
          </Feld>

          <label className="flex items-center gap-2">
            <input
              type="checkbox" className="accent-[var(--tf-primary)] cursor-pointer"
              checked={erster.aktiv}
              onChange={e => setzeAlle({ aktiv: e.target.checked })}
            />
            <span className="text-[12.5px] text-[var(--tf-text)]">aktiv</span>
          </label>

          <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
            Gilt für {eintraege.length === 1 ? 'den Eintrag' : `beide Einträge`} dieses Codes
            ({eintraege.map(w => w.feldId).join(', ')}) — sie dürfen nicht auseinanderlaufen.
          </p>
        </>
      )}
    </div>
  );
}

export function PhasenDetail({ knoten, api }: {
  knoten: PhasenBaumKnoten; api: StatusCockpitApi;
}): React.ReactElement | null {
  if (knoten.art === 'phase') return <PhaseDetail knoten={knoten} api={api} />;
  if (knoten.art === 'code') return <CodeDetail knoten={knoten} api={api} />;
  if (knoten.art === 'ohne-phase') {
    return (
      <div className="flex flex-col gap-2 p-3">
        <h3 className="text-[14px] font-medium text-[var(--tf-text)]">Ohne Phase</h3>
        <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
          {knoten.codeAnzahl} Statuswerte laufen <strong>neben</strong> dem Verfahren:
          Irrläufer, Sonderstatus, Partner-Kennzeichen. Das ist ein gültiger Zustand und
          kein Fehler — sie bekommen bewusst keine Position im Ablauf und tauchen deshalb
          in Leiste, Zieltagen und Stillstands-Wächter nicht auf.
        </p>
        <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
          Ein Eintrag, der hier <em>versehentlich</em> liegt, wird per Zug in die richtige
          Phase gehängt.
        </p>
      </div>
    );
  }
  return null;
}
