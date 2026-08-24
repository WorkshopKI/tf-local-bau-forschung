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
import { modellLabel } from '@/core/services/ai/bridge-modelle';
import { useState } from 'react';
import { Check, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { DokumentAufnahme, DOKUMENT_TYP_OPTIONEN } from '@/core/components/DokumentAufnahme';
import type { AufbereitungRun } from './types';
import type { KorpusMass } from './quellen';
import type { LaufZiel } from './lauf-ziel';

const CAPS_LABEL = 'text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--tf-text)]';

/** Typ-Pills der Aufbereitungs-Aufnahme = geteiltes volles Vokabular (eine Quelle in DokumentAufnahme). */
export const AUFBEREITUNG_TYP_OPTIONEN = DOKUMENT_TYP_OPTIONEN;

interface Props {
  ctx: { key: string; knownIds: string[] };
  run: AufbereitungRun | null;
  /** Umfang des Korpus gegen das Kontextfenster (aus `useAufbereitung`). */
  korpusMass?: KorpusMass | null;
  /** Genutzte KI + ob die agentische Notausfahrt anzubieten ist (aus `useAufbereitung`). */
  laufZiel?: LaufZiel;
  /** Notausfahrt umlegen (starkes Modell für diesen Antrag). */
  onStarkErzwungen?: (an: boolean) => void;
  /** Coalesced Neu-Aufbereiten nach erfolgreicher Aufnahme (aus `useAufbereitung`). */
  onIngested: () => void;
}

/**
 * Der Korpus wird auf der Baustein-Schiene weder gekürzt noch gewarnt. Sobald
 * neben der VB weitere Dokumente einfliessen, ist das Kontextfenster real
 * erreichbar — und ein stillschweigend abgeschnittener Text ist schlimmer als
 * eine fehlende Analyse, weil das Ergebnis vollständig aussieht.
 *
 * Zweiter Zweck: die **Notausfahrt**. Die Aufbereitung läuft fest auf der Rolle
 * `standard` (`lauf-ziel.ts`); passt der Korpus dort nicht hinein, bietet dieser Block den Wechsel
 * auf die Rolle `stark` mit ihrem grösseren Kontextfenster an — vollständig statt
 * schnell, vom Prüfer entschieden. Der Schalter bleibt sichtbar, WÄHREND er genutzt
 * wird (`notausfahrtAnbieten` hängt am Standard-Fenster, nicht am aktuellen Ziel),
 * sonst gäbe es keinen Weg zurück.
 */
function KorpusWarnung({ mass, laufZiel, onStarkErzwungen }: {
  mass: KorpusMass | null | undefined;
  laufZiel?: LaufZiel;
  onStarkErzwungen?: (an: boolean) => void;
}): React.ReactElement | null {
  const stark = laufZiel?.ziel === 'stark';
  const notausfahrt = !!laufZiel?.notausfahrtAnbieten && !!onStarkErzwungen;
  if (!mass?.ueberCap && !notausfahrt) return null;
  return (
    <div
      className="mx-3.5 mb-3 rounded px-3 py-2 text-[12.5px]"
      style={{ background: 'color-mix(in srgb, var(--tf-warning, #f59e0b) 10%, var(--tf-bg))' }}
    >
      {mass?.ueberCap ? (
        <>
          <p className="text-[var(--tf-text)]">
            Die Dokumente ergeben zusammen {mass.zeichen.toLocaleString('de-DE')} Zeichen und
            passen damit nicht ins Kontextfenster von {modellLabel(stark ? 'stark' : 'standard')}
            {' '}({mass.cap.toLocaleString('de-DE')}).
          </p>
          {/* Der Satz spricht über den NÄCHSTEN Lauf, nicht über die angezeigten
              Ergebnisse: der Baustein-Cache trägt sein Ziel nicht, und der
              Notausfahrt-Schalter ist Sitzungszustand. Ein Antrag, dessen
              Bausteine mit dem grossen Fenster vollstaendig gerechnet wurden,
              bekam beim nächsten Öffnen die Behauptung, sie hätten das Ende
              nicht gesehen — obwohl sie genau das getan hatten (v4.124). */}
          <p className="text-[var(--tf-text-secondary)] mt-0.5">
            Ein KI-Lauf {stark ? 'auf dieser KI ' : ''}sieht das Ende des Textes nicht.
            Bereits vorliegende Bausteine können aus einem Lauf mit größerem Fenster stammen.
            Deterministische Auswertungen — Zeitplan, Tabellen, Gliederung — sind davon unberührt.
          </p>
        </>
      ) : (
        <p className="text-[var(--tf-text)]">
          Die Dokumente ({mass?.zeichen.toLocaleString('de-DE')} Zeichen) passen nicht in das
          Kontextfenster von {modellLabel('standard')}. Dieser Antrag wird deshalb mit
          {' '}{modellLabel('stark')} aufbereitet — es sieht den ganzen Text, braucht dafür aber
          deutlich länger.
        </p>
      )}
      {notausfahrt ? (
        <button
          type="button"
          onClick={() => onStarkErzwungen(!stark)}
          className="mt-1.5 text-[12px] text-[var(--tf-primary)] hover:underline"
        >
          {stark
            ? `Zurück zu ${modellLabel('standard')} (schneller, sieht nur den Anfang)`
            : `Diesen Antrag mit ${modellLabel('stark')} aufbereiten (sieht den ganzen Text, deutlich langsamer)`}
        </button>
      ) : null}
    </div>
  );
}

export function QuellenPanel({ ctx, run, korpusMass, laufZiel, onStarkErzwungen, onIngested }: Props): React.ReactElement {
  const vbQuelle = run?.quellen.find(q => q.rolle === 'vb') ?? null;
  const anlageQuelle = run?.quellen.find(q => q.rolle === 'anlage5') ?? null;
  const marketingNamen = (run?.quellen.filter(q => q.rolle === 'verwertung') ?? []).map(q => q.name);
  // Im Verbund (≥2 TV) trägt der Run pro-TV-Zeitpläne — dann pro TV eine Anlage-5-Zeile.
  const teilplaene = run?.teilplaene ?? null;
  // Die Anlage 5 liegt oft NICHT als eigenes Dokument bei, sondern als Abschnitt am Ende
  // der VB (`baueRun` liest sie dann von dort). Sie zählt als vorhanden, sobald der
  // Zeitplan sie als Quelle nennt — sonst stünde „fehlt — ohne sie kein Zeitplan" über
  // einem sichtbaren Zeitplan samt Kapazitätsprüfung.
  const anlageHerkunft = run?.zeitplan?.herkunft;
  const anlageAusVb = !anlageQuelle && (anlageHerkunft === 'anlage5' || anlageHerkunft === 'beide');
  // Nur nach einer Aufbereitung wissen wir sicher, dass Anlage 5 fehlt (Solo-Fall).
  const anlageFehlt = !!run && !teilplaene && !anlageQuelle && !anlageAusVb;

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
              : ` · Anlage 5 ${anlageQuelle || anlageAusVb ? '✓' : '–'}`}
            {marketingNamen.length ? ` · Marketing ✓` : ''}
          </span>
        )}
      </button>

      {/* Ausserhalb von `offen`: eine eingeklappte Sektion darf die Warnung nicht verstecken. */}
      <KorpusWarnung mass={korpusMass} laufZiel={laufZiel} onStarkErzwungen={onStarkErzwungen} />

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
              zusatz={anlageAusVb ? `als Abschnitt in ${vbQuelle?.name ?? 'der Vorhabensbeschreibung'}` : undefined}
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
  label, name, zusatz, fehltHinweis, warnen,
}: {
  label: string;
  name: string | null;
  /** Vorhanden, aber nicht als eigene Datei — woher sie stammt (z. B. Abschnitt der VB). */
  zusatz?: string;
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
      ) : zusatz ? (
        <span className="inline-flex items-center gap-1.5 min-w-0">
          <Check size={13} className="text-[var(--tf-success-text)] shrink-0" />
          <span className="text-[var(--tf-text-secondary)] truncate" title={zusatz}>{zusatz}</span>
        </span>
      ) : (
        <span className={warnen ? 'text-[var(--tf-warning-text)]' : 'text-[var(--tf-text-tertiary)]'}>
          {warnen ? '⚠ ' : '– '}{fehltHinweis ?? 'nicht hinterlegt'}
        </span>
      )}
    </div>
  );
}
