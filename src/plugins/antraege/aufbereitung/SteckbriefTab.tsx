/**
 * Steckbrief-Tab (Paket 2, Mockup 1). Zwei Spalten: links „Das Vorhaben in einem
 * Satz" / „Innovation & Abgrenzung" / „FuE-Gegenstand" als Karten mit
 * Fundstellen-Chips; rechts „Eckdaten" (Antragsteller + Projektform DETERMINISTISCH
 * aus dem Store, Laufzeit + Kern-Zielwert aus dem Baustein), „Zielmärkte",
 * „Schlüsselpersonal". Leere LLM-Felder zeigen „[Im Antrag nicht gefunden]" — die
 * Lücke ist Information (Default #7).
 */
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ZweiSpaltenResizable } from '@/components/zwei-spalten';
import type { UseAsyncActionResult } from '@/core/hooks/useAsyncAction';
import { FundstelleChip } from './FundstelleChip';
import type { Belegt, SteckbriefDaten } from './steckbrief';
import type { BausteinUiState } from './useAufbereitung';
import type { AufbereitungRun } from './types';
import type { VbSektion } from './gliederung';

export interface SteckbriefStammdaten {
  antragsteller: string | null;
  foerderkennzeichen: string | null;
  projektform: string | null;
}

interface Props {
  run: AufbereitungRun | null;
  steckbrief: BausteinUiState<SteckbriefDaten>;
  vbMarkdown: string | null;
  stammdaten: SteckbriefStammdaten;
  bausteine: UseAsyncActionResult<[]>;
  bausteineNeu: UseAsyncActionResult<[]>;
}

export function SteckbriefTab({ run, steckbrief, vbMarkdown, stammdaten, bausteine, bausteineNeu }: Props): React.ReactElement {
  if (steckbrief.status === 'fehlt' || (!run && steckbrief.status !== 'laeuft')) {
    return (
      <div className="py-16 flex flex-col items-center gap-3 text-center">
        {bausteine.error ? (
          <div className="mb-1 rounded-lg px-3 py-2 text-[13px] text-[var(--tf-danger-text)]" style={{ border: '0.5px solid var(--tf-border)' }}>{bausteine.error}</div>
        ) : null}
        <div className="text-[15px] font-medium text-[var(--tf-text)]">Steckbrief noch nicht erstellt</div>
        <div className="max-w-[440px] text-[13px] text-[var(--tf-text-tertiary)]">
          Ein interner KI-Lauf extrahiert die Kernaussagen der Vorhabensbeschreibung — jede mit Fundstelle.
        </div>
        <Button variant="primary" size="sm" loading={bausteine.busy} onClick={() => bausteine.run()} className="mt-1">
          {bausteine.busy ? 'KI-Aufbereitung läuft …' : 'KI-Aufbereitung starten'}
        </Button>
      </div>
    );
  }
  if (steckbrief.status === 'laeuft') {
    return <div className="py-16 text-center text-[13px] text-[var(--tf-text-tertiary)]">KI-Aufbereitung läuft — Steckbrief wird erstellt …</div>;
  }
  if (steckbrief.status === 'fehler') {
    return (
      <div className="py-12 flex flex-col items-center gap-3 text-center">
        <div className="text-[14px] text-[var(--tf-text)]">KI-Aufbereitung nicht möglich</div>
        <div className="max-w-[420px] text-[12.5px] text-[var(--tf-text-tertiary)]">Der interne KI-Dienst ist derzeit nicht erreichbar.</div>
        <Button variant="secondary" size="sm" loading={bausteine.busy} onClick={() => bausteine.run()}>Erneut versuchen</Button>
      </div>
    );
  }
  return (
    <SteckbriefInhalt
      run={run!}
      daten={steckbrief.daten ?? LEER}
      rohtext={steckbrief.status === 'degradiert' ? steckbrief.rohtext : undefined}
      vbMarkdown={vbMarkdown}
      stammdaten={stammdaten}
      bausteineNeu={bausteineNeu}
    />
  );
}

const LEER: SteckbriefDaten = {
  einSatz: null, innovation: [], fueGegenstand: [], laufzeit: null,
  kernZielwert: null, zielmaerkte: [], personal: [], auftraegeDritte: [],
};

function SteckbriefInhalt({
  run, daten, rohtext, vbMarkdown, stammdaten, bausteineNeu,
}: {
  run: AufbereitungRun;
  daten: SteckbriefDaten;
  rohtext?: string;
  vbMarkdown: string | null;
  stammdaten: SteckbriefStammdaten;
  bausteineNeu: UseAsyncActionResult<[]>;
}): React.ReactElement {
  const byId = useMemo(() => new Map(run.gliederung.map(s => [s.id, s])), [run.gliederung]);
  const chips = (ids: string[]): React.ReactElement[] =>
    ids.map(id => byId.get(id)).filter((s): s is VbSektion => !!s).map(s => <FundstelleChip key={s.id} sektion={s} vbMarkdown={vbMarkdown} />);

  const personalSichtbar = daten.personal.slice(0, 3);
  const personalRest = daten.personal.length - personalSichtbar.length;

  return (
    <div>
      {rohtext !== undefined ? (
        <details className="mb-4 rounded-lg px-3 py-2 text-[12.5px]" style={{ border: '0.5px solid var(--tf-warning-border)', background: 'var(--tf-warning-soft)' }}>
          <summary className="cursor-pointer text-[var(--tf-warning-text)]">
            Unstrukturiertes KI-Ergebnis — Steckbrief nur teilweise verwertbar.{' '}
            <button type="button" onClick={(e) => { e.preventDefault(); bausteineNeu.run(); }} disabled={bausteineNeu.busy} className="underline disabled:opacity-50">neu berechnen</button>
          </summary>
          {rohtext ? <pre className="mt-2 max-h-[240px] overflow-auto whitespace-pre-wrap text-[11px] text-[var(--tf-text-secondary)]">{rohtext}</pre> : null}
        </details>
      ) : null}

      <ZweiSpaltenResizable
        storageKey="teamflow_aufbereitung_eckdaten_breite"
        defaultBreite={320}
        minBreite={280}
        maxBreite={560}
        gapClassName="gap-6"
        ariaLabel="Breite der Eckdaten-Spalte anpassen"
        haupt={
          // Links: Fließtext-Karten
          <div className="flex min-w-0 flex-col gap-4">
          <Card titel="Das Vorhaben in einem Satz">
            {daten.einSatz ? (
              <p className="text-[15px] leading-snug text-[var(--tf-text)]">
                {daten.einSatz.text} <span className="align-middle">{chips(daten.einSatz.sektionIds)}</span>
              </p>
            ) : <NichtGefunden />}
          </Card>

          <Card titel="Innovation & Abgrenzung">
            <BelegtListe eintraege={daten.innovation} chips={chips} />
          </Card>

          <Card titel="FuE-Gegenstand (was wird tatsächlich entwickelt)">
            <BelegtListe eintraege={daten.fueGegenstand} chips={chips} />
          </Card>
          </div>
        }
        seite={
          // Rechts: Eckdaten / Zielmärkte / Schlüsselpersonal
          <div className="flex flex-col gap-4">
          <Card titel="Eckdaten">
            <DefZeile label="Antragsteller" wert={stammdaten.antragsteller} />
            <DefZeile label="Förderkennzeichen" wert={stammdaten.foerderkennzeichen} />
            <DefZeile label="Projektform" wert={stammdaten.projektform} />
            <DefZeile label="Laufzeit" wert={daten.laufzeit?.text ?? null} chips={daten.laufzeit ? chips(daten.laufzeit.sektionIds) : undefined} />
            <DefZeile
              label="Kern-Zielwert"
              wert={daten.kernZielwert?.text ?? null}
              chips={daten.kernZielwert ? chips(daten.kernZielwert.sektionIds) : undefined}
              badge={daten.kernZielwert ? 'Zentraler Claim' : undefined}
            />
            {daten.auftraegeDritte.length > 0 ? (
              <DefZeile label="Auftrag an Dritte" wert={daten.auftraegeDritte.map(a => a.text).join('; ')} chips={chips(daten.auftraegeDritte.flatMap(a => a.sektionIds))} />
            ) : null}
          </Card>

          {daten.zielmaerkte.length > 0 ? (
            <Card titel="Zielmärkte">
              {daten.zielmaerkte.map((z, i) => (
                <div key={i} className="flex items-center justify-between gap-2 py-1.5" style={{ borderBottom: i < daten.zielmaerkte.length - 1 ? '0.5px solid var(--tf-border)' : undefined }}>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--tf-text)]">{z.markt}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {chips(z.sektionIds)}
                    {z.zielwert ? <span className="text-[13px] font-medium text-[var(--tf-text)]">{z.zielwert}</span> : null}
                  </span>
                </div>
              ))}
            </Card>
          ) : null}

          {daten.personal.length > 0 ? (
            <Card titel="Schlüsselpersonal">
              {personalSichtbar.map((p, i) => (
                <div key={i} className="py-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-medium text-[var(--tf-text)]">{p.name}</span>
                    {chips(p.sektionIds)}
                  </div>
                  {p.rolle ? <div className="text-[12px] text-[var(--tf-text-secondary)]">{p.rolle}</div> : null}
                </div>
              ))}
              {personalRest > 0 ? (
                <div className="pt-1 text-[12px] text-[var(--tf-text-tertiary)]">+ {personalRest} weitere im Antrag genannt</div>
              ) : null}
            </Card>
          ) : null}
          </div>
        }
      />
    </div>
  );
}

function Card({ titel, children }: { titel: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="rounded-xl p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
      <div className="mb-2.5 text-[13px] font-medium text-[var(--tf-text)]">{titel}</div>
      {children}
    </div>
  );
}

function BelegtListe({ eintraege, chips }: { eintraege: Belegt[]; chips: (ids: string[]) => React.ReactElement[] }): React.ReactElement {
  if (eintraege.length === 0) return <NichtGefunden />;
  return (
    <ul className="flex flex-col gap-1.5">
      {eintraege.map((e, i) => (
        <li key={i} className="flex gap-2 text-[13px] leading-snug text-[var(--tf-text)]">
          <span className="mt-[3px] shrink-0 text-[var(--tf-text-tertiary)]">·</span>
          <span className="min-w-0">{e.text} <span className="align-middle">{chips(e.sektionIds)}</span></span>
        </li>
      ))}
    </ul>
  );
}

function DefZeile({
  label, wert, chips, badge,
}: {
  label: string;
  wert: string | null;
  chips?: React.ReactElement[];
  badge?: string;
}): React.ReactElement {
  return (
    <div className="mb-3 last:mb-0">
      <div className="text-[11px] text-[var(--tf-text-tertiary)]">{label}</div>
      {wert ? (
        <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-[var(--tf-text)]">
          <span>{wert}</span>
          {chips}
          {badge ? <span className="rounded px-1.5 py-0.5 text-[10.5px] text-[var(--tf-info-text)]" style={{ border: '0.5px solid var(--tf-info-border)', background: 'var(--tf-info-soft)' }}>{badge}</span> : null}
        </div>
      ) : <div className="text-[13px] text-[var(--tf-text-tertiary)]">[Im Antrag nicht gefunden]</div>}
    </div>
  );
}

function NichtGefunden(): React.ReactElement {
  return <div className="text-[13px] text-[var(--tf-text-tertiary)]">[Im Antrag nicht gefunden]</div>;
}
