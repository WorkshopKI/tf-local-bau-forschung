/**
 * Zahlen-Tab (Paket 4). Listet die vom LLM ausgewählten Zahlen-Claims — nach
 * Kategorie gruppiert, je Claim Wert + Einheit + Kontext + Fundstellen-Chip. Die
 * deterministischen Quervergleiche (`pruefeZahlWidersprueche`: Laufzeit vs.
 * Zeitplan-Horizont, PM vs. Anlage 5) erscheinen als StatusDot + Befundzeile am
 * betroffenen Claim und speisen die bestehende `offenePunkte`-Mechanik. Monochrom,
 * Farbe nur über StatusDot/Badges.
 *
 * Nicht prüfrelevante Kategorien (`pausierte-module`) erscheinen als ausgegraute,
 * zugeklappte Gruppe — Zähler sichtbar, Claims aufklappbar (reines Anzeige-Gate: der
 * Katalog, der Prompt und der Parser bleiben vollständig). Solange der Zeitplan pausiert
 * ist, entfallen die Quervergleiche — sie vergleichen ausschließlich gegen ihn.
 */
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScopeTabs } from '@/components/ui/ScopeTabs';
import { StatusDot } from '@/components/ui/StatusBadge';
import type { UseAsyncActionResult } from '@/core/hooks/useAsyncAction';
import { BausteinFehler } from './BausteinFehler';
import { cn } from '@/lib/utils';
import { FundstelleChip } from './FundstelleChip';
import { ZAHL_KATEGORIE_PAUSE_HINWEIS, ZEITPLAN_PAUSIERT, istZahlKategorieGesperrt } from './pausierte-module';
import { ZAHL_KATEGORIEN, pruefeZahlWidersprueche, type ZahlClaim, type ZahlBefund, type ZahlenDaten } from './zahlen';
import type { BausteinUiState } from './useAufbereitung';
import type { AufbereitungRun } from './types';
import type { VbSektion } from './gliederung';

const WARN = 'var(--tf-warning-text)';

interface Props {
  run: AufbereitungRun | null;
  zahlen: BausteinUiState<ZahlenDaten>;
  vbMarkdown: string | null;
  bausteine: UseAsyncActionResult<[]>;
  bausteineNeu: UseAsyncActionResult<[]>;
  toggle: UseAsyncActionResult<[string]>;
}

const LEER: ZahlenDaten = { schemaVersion: 1, claims: [] };

export function ZahlenTab({ run, zahlen, vbMarkdown, bausteine, bausteineNeu, toggle }: Props): React.ReactElement {
  if (zahlen.status === 'fehlt' || (!run && zahlen.status !== 'laeuft')) {
    return (
      <div className="py-16 flex flex-col items-center gap-3 text-center">
        {bausteine.error ? (
          <div className="mb-1 rounded-lg px-3 py-2 text-[13px] text-[var(--tf-danger-text)]" style={{ border: '0.5px solid var(--tf-border)' }}>{bausteine.error}</div>
        ) : null}
        <div className="text-[15px] font-medium text-[var(--tf-text)]">Zahlen-Inventar noch nicht erstellt</div>
        <div className="max-w-[460px] text-[13px] text-[var(--tf-text-tertiary)]">
          {/* Kein Versprechen auf die Quervergleiche, solange `ZEITPLAN_PAUSIERT`
              gilt: `zeitplanBefunde` liefert dann fest die leere Liste, und der
              Prüfer könnte „geprüft, nichts gefunden" nicht von „gar nicht
              geprüft" unterscheiden (v4.124). */}
          Ein interner KI-Lauf sammelt die Zahlenwerte der Vorhabensbeschreibung — jeder mit Fundstelle.
          {ZEITPLAN_PAUSIERT
            ? ' Quervergleiche mit dem Zeitplan (Laufzeit, Personenmonate) sind derzeit pausiert.'
            : ' Quervergleiche mit dem Zeitplan (Laufzeit, Personenmonate) rechnet die App deterministisch.'}
        </div>
        <Button variant="primary" size="sm" loading={bausteine.busy} onClick={() => bausteine.run()} className="mt-1">
          {bausteine.busy ? 'KI-Aufbereitung läuft …' : 'KI-Aufbereitung starten'}
        </Button>
      </div>
    );
  }
  if (zahlen.status === 'laeuft') {
    return <div className="py-16 text-center text-[13px] text-[var(--tf-text-tertiary)]">KI-Aufbereitung läuft — Zahlen-Inventar wird erstellt …</div>;
  }
  if (zahlen.status === 'fehler') {
    return <BausteinFehler begruendung={zahlen.begruendung} bausteine={bausteine} />;
  }
  return (
    <ZahlenInhalt
      run={run!}
      daten={zahlen.daten ?? LEER}
      degradiert={zahlen.status === 'degradiert'}
      rohtext={zahlen.status === 'degradiert' ? zahlen.rohtext : undefined}
      begruendung={zahlen.begruendung}
      vbMarkdown={vbMarkdown}
      bausteineNeu={bausteineNeu}
      toggle={toggle}
    />
  );
}

function ZahlenInhalt({
  run, daten, degradiert, rohtext, begruendung, vbMarkdown, bausteineNeu, toggle,
}: {
  run: AufbereitungRun;
  daten: ZahlenDaten;
  degradiert: boolean;
  rohtext?: string;
  begruendung?: string;
  vbMarkdown: string | null;
  bausteineNeu: UseAsyncActionResult<[]>;
  toggle: UseAsyncActionResult<[string]>;
}): React.ReactElement {
  const byId = useMemo(() => new Map(run.gliederung.map(s => [s.id, s])), [run.gliederung]);
  const chips = (ids: string[]): React.ReactElement[] =>
    ids.map(id => byId.get(id)).filter((s): s is VbSektion => !!s).map(s => <FundstelleChip key={s.id} sektion={s} vbMarkdown={vbMarkdown} />);

  // Quervergleiche vergleichen ausschließlich gegen den Zeitplan — pausiert er, schweigen sie.
  // Gate bewusst hier (nicht in der reinen `pruefeZahlWidersprueche`): die bleibt intakt + getestet.
  const befunde = useMemo(
    () => (ZEITPLAN_PAUSIERT ? [] : pruefeZahlWidersprueche(daten.claims, run)),
    [daten.claims, run],
  );
  const befundeProWert = useMemo(() => {
    const m = new Map<string, ZahlBefund[]>();
    for (const b of befunde) {
      const arr = m.get(b.claimWert);
      if (arr) arr.push(b); else m.set(b.claimWert, [b]);
    }
    return m;
  }, [befunde]);

  // Filter „Kernzahlen" (Default) vs. „Alle anzeigen" — reine Anzeige-Selektion.
  const [nurKern, setNurKern] = useState(true);
  const kernAnzahl = useMemo(() => daten.claims.filter(c => c.relevanz === 'kern').length, [daten.claims]);
  const sichtbar = useMemo(() => (nurKern ? daten.claims.filter(c => c.relevanz === 'kern') : daten.claims), [daten.claims, nurKern]);

  const gruppen = useMemo(
    () => ZAHL_KATEGORIEN
      .map(k => ({ kat: k, gesperrt: istZahlKategorieGesperrt(k.id), claims: sichtbar.filter(c => c.kategorie === k.id) }))
      .filter(g => g.claims.length > 0),
    [sichtbar],
  );

  return (
    <div>
      {degradiert ? (
        <details className="mb-4 rounded-lg px-3 py-2 text-[12.5px]" style={{ border: '0.5px solid var(--tf-warning-border)', background: 'var(--tf-warning-soft)' }}>
          <summary className="cursor-pointer text-[var(--tf-warning-text)]">
            {begruendung ?? 'Unstrukturiertes KI-Ergebnis'} — Zahlen-Inventar nur teilweise verwertbar.{' '}
            <button type="button" onClick={(e) => { e.preventDefault(); bausteineNeu.run(); }} disabled={bausteineNeu.busy} className="underline disabled:opacity-50">neu berechnen</button>
          </summary>
          {rohtext ? <pre className="mt-2 max-h-[240px] overflow-auto whitespace-pre-wrap text-[11px] text-[var(--tf-text-secondary)]">{rohtext}</pre> : null}
        </details>
      ) : null}

      {daten.claims.length === 0 ? (
        <div className="py-14 text-center text-[13px] text-[var(--tf-text-tertiary)]">Keine Zahlen-Claims gefunden.</div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <ScopeTabs
              variant="pills"
              items={[
                { key: 'kern', label: 'Kernzahlen', count: kernAnzahl },
                { key: 'alle', label: 'Alle anzeigen', count: daten.claims.length },
              ]}
              activeKey={nurKern ? 'kern' : 'alle'}
              onChange={(k) => setNurKern(k === 'kern')}
              aria-label="Zahlen-Filter: Kernzahlen oder alle"
            />
            <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">{sichtbar.length} von {daten.claims.length} angezeigt</span>
          </div>
          {befunde.length > 0 ? (
            <div className="text-[12px] text-[var(--tf-warning-text)]">
              {befunde.length} {befunde.length === 1 ? 'Zahlen-Widerspruch' : 'Zahlen-Widersprüche'} zum Zeitplan / zur Anlage 5.
            </div>
          ) : null}
          {gruppen.length === 0 ? (
            <div className="py-8 text-center text-[12.5px] text-[var(--tf-text-tertiary)]">
              Keine Kernzahlen markiert — auf „Alle anzeigen" umschalten.
            </div>
          ) : gruppen.map(g => (
            <KategorieGruppe
              key={g.kat.id}
              name={g.kat.name}
              gesperrt={g.gesperrt}
              claims={g.claims}
              befundeProWert={befundeProWert}
              offenePunkte={run.offenePunkte}
              toggleBusy={toggle.busy}
              onToggle={(key) => toggle.run(key)}
              chips={chips}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Eine Kategorie-Gruppe; bei > 8 Claims standardmäßig eingeklappt (nichts still
 * verstecken — der Zähler bleibt sichtbar). `gesperrt` = derzeit nicht prüfrelevant:
 * tertiärer Kopf + immer eingeklappt, Claims bleiben per Klick erreichbar. Ausgegraut
 * über die Text-Farbe, NICHT über `opacity-*` (Hausstil, vgl. Tab-Gating).
 */
function KategorieGruppe({
  name, gesperrt, claims, befundeProWert, offenePunkte, toggleBusy, onToggle, chips,
}: {
  name: string;
  gesperrt: boolean;
  claims: ZahlClaim[];
  befundeProWert: Map<string, ZahlBefund[]>;
  offenePunkte: string[];
  toggleBusy: boolean;
  onToggle: (key: string) => void;
  chips: (ids: string[]) => React.ReactElement[];
}): React.ReactElement {
  const einklappbar = gesperrt || claims.length > 8;
  const zeilen = claims.map((c, i) => (
    <ClaimZeile
      key={`${c.wert}:${i}`}
      claim={c}
      befunde={befundeProWert.get(c.wert) ?? []}
      offenePunkte={offenePunkte}
      toggleBusy={toggleBusy}
      onToggle={onToggle}
      chips={chips}
      letzte={i === claims.length - 1}
    />
  ));
  if (!einklappbar) {
    return (
      <div className="rounded-xl p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
        <div className="mb-2 flex items-baseline gap-2">
          <span className="text-[13px] font-medium text-[var(--tf-text)]">{name}</span>
          <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">{claims.length}</span>
        </div>
        {zeilen}
      </div>
    );
  }
  return (
    <details className="rounded-xl p-4 group" style={{ border: '0.5px solid var(--tf-border)' }} title={gesperrt ? ZAHL_KATEGORIE_PAUSE_HINWEIS : undefined}>
      <summary className="mb-2 flex cursor-pointer items-baseline gap-2 list-none">
        <span className={cn('text-[13px]', gesperrt ? 'text-[var(--tf-text-tertiary)]' : 'font-medium text-[var(--tf-text)]')}>{name}</span>
        <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">{claims.length}</span>
        {gesperrt ? <span className="text-[11px] text-[var(--tf-text-tertiary)]">— {ZAHL_KATEGORIE_PAUSE_HINWEIS}</span> : null}
        <span className="text-[11px] text-[var(--tf-text-tertiary)] group-open:hidden">— aufklappen</span>
      </summary>
      {zeilen}
    </details>
  );
}

function ClaimZeile({
  claim, befunde, offenePunkte, toggleBusy, onToggle, chips, letzte,
}: {
  claim: ZahlClaim;
  befunde: ZahlBefund[];
  offenePunkte: string[];
  toggleBusy: boolean;
  onToggle: (key: string) => void;
  chips: (ids: string[]) => React.ReactElement[];
  letzte: boolean;
}): React.ReactElement {
  return (
    <div className="flex items-start gap-2.5 py-2" style={{ borderBottom: letzte ? undefined : '0.5px solid var(--tf-border)' }}>
      <div className="w-[150px] shrink-0 flex items-start gap-1.5">
        {befunde.length > 0 ? <StatusDot color={WARN} size={7} className="mt-1" title="Widerspruch zum Zeitplan / zur Anlage 5" /> : null}
        <span className="text-[13px] font-medium text-[var(--tf-text)] break-words">{claim.wert}</span>
      </div>
      <div className="min-w-0 flex-1">
        {claim.kontext ? <div className="text-[12.5px] leading-snug text-[var(--tf-text-secondary)]">{claim.kontext}</div> : null}
        {befunde.map(b => {
          const offen = offenePunkte.includes(b.key);
          return (
            <div key={b.key} className="mt-1 flex items-start gap-2">
              <div className="min-w-0 flex-1 text-[12px] leading-snug text-[var(--tf-warning-text)]">{b.text}</div>
              <button
                type="button"
                onClick={() => onToggle(b.key)}
                disabled={toggleBusy}
                title="wird später an Nachforderungen angebunden"
                className="shrink-0 text-[11.5px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] disabled:opacity-50"
              >
                {offen ? '✓ Offener Punkt' : 'Als offenen Punkt übernehmen'}
              </button>
            </div>
          );
        })}
      </div>
      <div className="shrink-0 flex items-center gap-1.5">
        {claim.einheit ? <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">{claim.einheit}</span> : null}
        {chips(claim.sektionIds)}
      </div>
    </div>
  );
}
