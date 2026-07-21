/**
 * „Dokumente zum Vorhaben" — Quellen-Panel der Antrag-Aufbereitung.
 *
 * Zeigt die aufgelösten Quellen (VB / Arbeitsplan-Anlage 5 / Marketing-Verwertung)
 * aus `run.quellen` und bietet eine inline `DokumentAufnahme`-Drop-Zone, mit der der
 * Gutachter fehlende Dokumente DIREKT hier nachreicht (statt die Seite zu verlassen).
 * Der Uploader taggt beim Ablegen, was drinsteht (dieselben Typ-Pills wie im
 * Gutachten-Fluss, hier um „Arbeitsplan" + „Marketing-/Verwertungskonzept" erweitert).
 *
 * WICHTIG: `defaultTyp='sonstiges'` — eine per Dateiname sofort aufgenommene Datei
 * darf NICHT als VB getaggt werden (sonst überschriebe sie die VB-Auflösung).
 * Nach jeder Aufnahme ruft `onIngested` das coalescte Neu-Aufbereiten des Callers.
 */
import { useState } from 'react';
import { Check, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { DokumentAufnahme, DOKUMENT_TYP_OPTIONEN } from '@/core/components/DokumentAufnahme';
import type { AufbereitungRun } from './types';
import type { KorpusMass } from './quellen';

const CAPS_LABEL = 'text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--tf-text)]';

/** Typ-Pills der Aufbereitungs-Aufnahme = geteiltes volles Vokabular (eine Quelle in DokumentAufnahme). */
export const AUFBEREITUNG_TYP_OPTIONEN = DOKUMENT_TYP_OPTIONEN;

interface Props {
  ctx: { key: string; knownIds: string[] };
  run: AufbereitungRun | null;
  /** Umfang des Korpus gegen das Kontextfenster (aus `useAufbereitung`). */
  korpusMass?: KorpusMass | null;
  /** Coalesced Neu-Aufbereiten nach erfolgreicher Aufnahme (aus `useAufbereitung`). */
  onIngested: () => void;
}

/**
 * Der Korpus wird auf der Baustein-Schiene weder gekürzt noch gewarnt. Sobald
 * neben der VB weitere Dokumente einfliessen, ist das Kontextfenster real
 * erreichbar — und ein stillschweigend abgeschnittener Text ist schlimmer als
 * eine fehlende Analyse, weil das Ergebnis vollständig aussieht.
 */
function KorpusWarnung({ mass }: { mass: KorpusMass | null | undefined }): React.ReactElement | null {
  if (!mass?.ueberCap) return null;
  return (
    <div
      className="mx-3.5 mb-3 rounded px-3 py-2 text-[12.5px]"
      style={{ background: 'color-mix(in srgb, var(--tf-warning, #f59e0b) 10%, var(--tf-bg))' }}
    >
      <p className="text-[var(--tf-text)]">
        Die Dokumente ergeben zusammen {mass.zeichen.toLocaleString('de-DE')} Zeichen und
        passen damit nicht ins Kontextfenster des Modells ({mass.cap.toLocaleString('de-DE')}).
      </p>
      <p className="text-[var(--tf-text-secondary)] mt-0.5">
        Die KI-Bausteine haben das Ende des Textes nicht gesehen. Deterministische
        Auswertungen — Zeitplan, Tabellen, Gliederung — sind davon unberührt.
      </p>
    </div>
  );
}

export function QuellenPanel({ ctx, run, korpusMass, onIngested }: Props): React.ReactElement {
  const vbQuelle = run?.quellen.find(q => q.rolle === 'vb') ?? null;
  const anlageQuelle = run?.quellen.find(q => q.rolle === 'anlage5') ?? null;
  const marketingNamen = (run?.quellen.filter(q => q.rolle === 'verwertung') ?? []).map(q => q.name);
  // Im Verbund (≥2 TV) trägt der Run pro-TV-Zeitpläne — dann pro TV eine Anlage-5-Zeile.
  const teilplaene = run?.teilplaene ?? null;
  // Nur nach einer Aufbereitung wissen wir sicher, dass Anlage 5 fehlt (Solo-Fall).
  const anlageFehlt = !!run && !teilplaene && !anlageQuelle;

  const [offen, setOffen] = useState(true);
  const [aufnahmeManuell, setAufnahmeManuell] = useState(false);
  const aufnahmeSichtbar = aufnahmeManuell || anlageFehlt;

  return (
    <div className="mt-4 rounded-[10px]" style={{ border: '0.5px solid var(--tf-border)' }}>
      <button
        type="button"
        onClick={() => setOffen(o => !o)}
        className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left"
      >
        {offen ? <ChevronDown size={15} className="text-[var(--tf-text-tertiary)]" />
          : <ChevronRight size={15} className="text-[var(--tf-text-tertiary)]" />}
        <span className={CAPS_LABEL}>Dokumente zum Vorhaben</span>
        {!offen && (
          <span className="ml-auto text-[11.5px] text-[var(--tf-text-tertiary)]">
            VB {vbQuelle ? '✓' : '–'}
            {teilplaene
              ? ` · Anlage 5 ${teilplaene.filter(t => t.anlage).length}/${teilplaene.length} TV`
              : ` · Anlage 5 ${anlageQuelle ? '✓' : '–'}`}
            {marketingNamen.length ? ` · Marketing ✓` : ''}
          </span>
        )}
      </button>

      {/* Ausserhalb von `offen`: eine eingeklappte Sektion darf die Warnung nicht verstecken. */}
      <KorpusWarnung mass={korpusMass} />

      {offen && (
        <div className="px-3.5 pb-3.5 pt-0.5 flex flex-col gap-1">
          <QuelleZeile label="Vorhabensbeschreibung" name={vbQuelle?.name ?? null} />
          {teilplaene ? (
            <>
              {teilplaene.map(tp => (
                <QuelleZeile
                  key={tp.tvAz}
                  label={`Anlage 5 — TV ${tp.nr} (${tp.tvAkronym ?? tp.tvAz})`}
                  name={tp.anlage?.name ?? null}
                  fehltHinweis="fehlt — ohne sie kein Zeitplan für dieses TV"
                  warnen={!tp.anlage}
                />
              ))}
              {run?.anlagenOhneTv?.length ? (
                <QuelleZeile
                  label="Anlage 5 — ohne TV-Zuordnung"
                  name={run.anlagenOhneTv.join(', ')}
                />
              ) : null}
            </>
          ) : (
            <QuelleZeile
              label="Arbeitsplan / Anlage 5"
              name={anlageQuelle?.name ?? null}
              fehltHinweis="fehlt — ohne sie kein Zeitplan / keine Kapazitätsprüfung"
              warnen={anlageFehlt}
            />
          )}
          <QuelleZeile
            label="Marketing-/Verwertungskonzept"
            name={marketingNamen.length ? marketingNamen.join(', ') : null}
            fehltHinweis="optional — kann auch in der Vorhabensbeschreibung stehen"
          />

          {aufnahmeSichtbar ? (
            <div className="mt-2.5 pt-2.5" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
              <p className="text-[12.5px] text-[var(--tf-text-secondary)] mb-2">
                Fehlende oder weitere Dokumente hier ablegen und beim Ablegen den Typ wählen —
                das Förderkennzeichen wird aus dem Dateinamen erkannt.
              </p>
              <DokumentAufnahme
                relationTag={ctx.key}
                knownIds={ctx.knownIds}
                defaultTyp="sonstiges"
                typOptionen={AUFBEREITUNG_TYP_OPTIONEN}
                onIngested={onIngested}
              />
              {aufnahmeManuell && !anlageFehlt && (
                <button
                  type="button"
                  onClick={() => setAufnahmeManuell(false)}
                  className="mt-2 text-[12px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text-secondary)]"
                >
                  Schließen
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAufnahmeManuell(true)}
              className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] text-[var(--tf-primary)] hover:underline w-fit"
            >
              <Plus size={13} /> Dokument hinzufügen / ersetzen
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function QuelleZeile({
  label, name, fehltHinweis, warnen,
}: {
  label: string;
  name: string | null;
  fehltHinweis?: string;
  warnen?: boolean;
}): React.ReactElement {
  return (
    <div className="flex items-start gap-2 text-[13px] py-0.5">
      <span className="w-[210px] shrink-0 text-[var(--tf-text-secondary)]">{label}</span>
      {name ? (
        <span className="inline-flex items-center gap-1.5 min-w-0">
          <Check size={13} className="text-[var(--tf-success-text)] shrink-0" />
          <span className="font-mono text-[12px] text-[var(--tf-text)] truncate" title={name}>{name}</span>
        </span>
      ) : (
        <span className={warnen ? 'text-[var(--tf-warning-text)]' : 'text-[var(--tf-text-tertiary)]'}>
          {warnen ? '⚠ ' : '– '}{fehltHinweis ?? 'nicht hinterlegt'}
        </span>
      )}
    </div>
  );
}
