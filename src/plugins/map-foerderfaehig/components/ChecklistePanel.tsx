/**
 * Prüf-Stepper: Kriterien nach Gruppen, Fortschritt, Innovationsgrad.
 *
 * Rein darstellend — Punkte, Gates und Abschlussfähigkeit kommen fertig aus
 * `bewerte()`.
 */
import { ProgressBar } from '@/components/ui/ProgressBar';
import type { AspektMapping } from '@/plugins/antraege/aufbereitung';
import type { VbSektion } from '@/plugins/antraege/aufbereitung/gliederung';
import { signalFuerInnoScore, type Signalstufe } from '../ansicht/bewertungs-signal';
import { baueGruppenFortschritt } from '../ansicht/gruppen';
import type { MapBewertungsErgebnis } from '../checkliste/bewertung';
import type { MapChecklistenDefinition, MapItemStatus, MapStufe } from '../checkliste/typen';
import { fundstellenFuerItem } from '../vb/fundstellen';
import { ItemKarte } from './ItemKarte';
import { SkalaKarte } from './SkalaKarte';

/**
 * Signalstufe → Tokens. Die Einstufung liegt in `bewertungs-signal`; wichtig
 * ist dort, dass „vollständig bewertet" allein noch kein Grün rechtfertigt.
 */
const INNO_TON: Record<Signalstufe, string> = {
  kritisch: 'var(--tf-danger-text)',
  warnung: 'var(--tf-warning-text)',
  neutral: 'var(--tf-text-secondary)',
  gut: 'var(--tf-success-text)',
};

const INNO_FLAECHE: Record<Signalstufe, string> = {
  kritisch: 'var(--tf-danger-bg)',
  warnung: 'var(--tf-warning-bg)',
  neutral: 'var(--tf-card-surface, var(--tf-bg))',
  gut: 'var(--tf-success-bg)',
};

function InnoScoreKarte({
  ergebnis, definition,
}: {
  ergebnis: MapBewertungsErgebnis;
  definition: MapChecklistenDefinition;
}): React.ReactElement {
  const { innoScore } = ergebnis;
  const signal = signalFuerInnoScore(innoScore);
  const farbe = INNO_TON[signal];

  const flaeche = INNO_FLAECHE[signal];

  return (
    <div
      className="rounded-[11px] px-4 py-3.5"
      style={{ border: '0.5px solid var(--tf-border)', background: flaeche }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-[var(--tf-text)]">Innovationsgrad</span>
        <span className="text-[17px] font-medium tabular-nums" style={{ color: farbe }}>
          {innoScore.vollstaendig || innoScore.rohSumme > 0 ? innoScore.punkte : '—'}
          <span className="text-[12px] text-[var(--tf-text-tertiary)]"> / {innoScore.maxPunkte}</span>
        </span>
      </div>

      {innoScore.nullWegenB0 && (
        <p className="text-[11.5px] mt-1" style={{ color: 'var(--tf-danger-text)' }}>
          Mindestens eine Kategorie ist mit B0 bewertet — damit ist der Innovationsgrad
          unzureichend, unabhängig von den übrigen Kategorien. Die Einzelsumme wäre {innoScore.rohSumme}.
        </p>
      )}

      {!innoScore.nullWegenB0 && (
        <p className="text-[11.5px] text-[var(--tf-text-secondary)] mt-1">
          {innoScore.vertiefungNoetig
            ? `Unterhalb des Kurzpfads (${definition.innoScoreKurzpfad} Punkte) — die vertiefte Einzelprüfung ist erforderlich.`
            : `Kurzpfad erreicht — die vertiefte Einzelprüfung entfällt.`}
        </p>
      )}

      {!innoScore.vollstaendig && (
        <p className="text-[11.5px] text-[var(--tf-text-tertiary)] mt-1">
          Noch nicht alle drei Kategorien bewertet.
        </p>
      )}
    </div>
  );
}

export function ChecklistePanel({
  definition, ergebnis, versionVeraltet, aspektMapping, gliederung, vbMarkdown,
  onBewerte, onStufe, onBedingung, onNachziehen,
}: {
  definition: MapChecklistenDefinition;
  ergebnis: MapBewertungsErgebnis;
  versionVeraltet: boolean;
  aspektMapping: AspektMapping | null;
  gliederung: readonly VbSektion[];
  vbMarkdown: string;
  onBewerte: (itemId: string, status: MapItemStatus, bemerkung?: string) => void;
  onStufe: (itemId: string, stufe: MapStufe, bemerkung?: string) => void;
  onBedingung: (itemId: string, wert: boolean) => void;
  onNachziehen: () => void;
}): React.ReactElement {
  const gruppen = baueGruppenFortschritt(ergebnis);
  const { erledigt, gesamt } = ergebnis.fortschritt;

  return (
    <div className="flex flex-col gap-4">
      {/* Klebt am oberen Rand des Schritt-Inhalts: bei 20+ Kriterien bleiben
          Fortschritt und Innovationsgrad beim Scrollen sichtbar. Das negative
          `top` hebt das Padding des Scroll-Containers auf. */}
      <div
        className="sticky -top-5 z-[5] grid grid-cols-1 md:grid-cols-2 gap-3 py-1.5
                   bg-[var(--tf-sheet)]"
      >
        <div
          className="rounded-[11px] bg-[var(--tf-card-surface,var(--tf-bg))] px-4 py-3.5"
          style={{ border: '0.5px solid var(--tf-border)' }}
        >
          <div className="text-[13px] text-[var(--tf-text-secondary)]">
            <span className="text-[16px] font-medium tabular-nums text-[var(--tf-text)]">{erledigt}</span>
            {' von '}
            <span className="tabular-nums">{gesamt}</span> Kriterien bewertet
          </div>
          <div className="my-2">
            <ProgressBar value={gesamt === 0 ? 0 : erledigt / gesamt} />
          </div>
          <div className="text-[11px] text-[var(--tf-text-tertiary)] truncate">
            {definition.titel} · Fassung {definition.version}
          </div>
        </div>

        <InnoScoreKarte ergebnis={ergebnis} definition={definition} />
      </div>

      {versionVeraltet && (
        <div
          className="rounded px-3 py-2 text-[12.5px]"
          style={{
            background: 'color-mix(in srgb, var(--tf-warning-text) 10%, var(--tf-bg))',
            color: 'var(--tf-text)',
          }}
        >
          Diese Prüfung läuft auf einer älteren Fassung der Checkliste. Sie bleibt bewusst
          darauf, damit sich die Grundlage einer laufenden Bewertung nicht unter der Hand ändert.
          <button
            type="button"
            onClick={onNachziehen}
            className="ml-2 underline cursor-pointer text-[var(--tf-primary)]"
          >
            Auf Fassung {definition.version} nachziehen
          </button>
        </div>
      )}

      {gruppen.map(({ gruppe, erledigt: gErledigt, gesamt: gGesamt }) => {
        const zustaende = ergebnis.zustaende.filter(z => z.item.gruppe === gruppe);
        return (
          <section key={gruppe} className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2.5 text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--tf-text-secondary)] mt-1">
              {gruppe}
              <span className="text-[10.5px] tabular-nums font-normal tracking-normal rounded-full px-2 py-px bg-[var(--tf-hover)] text-[var(--tf-text-tertiary)]">
                {gErledigt}/{gGesamt}
              </span>
            </h3>
            {zustaende.map(z =>
              z.item.art === 'skala' ? (
                <SkalaKarte
                  key={z.item.id}
                  zustand={z}
                  onStufe={(stufe, bemerkung) => onStufe(z.item.id, stufe, bemerkung)}
                />
              ) : (
                <ItemKarte
                  key={z.item.id}
                  zustand={z}
                  fundstellen={fundstellenFuerItem(z.item, aspektMapping, gliederung, vbMarkdown)}
                  onBewerte={(status, bemerkung) => onBewerte(z.item.id, status, bemerkung)}
                  onBedingung={wert => onBedingung(z.item.id, wert)}
                />
              ),
            )}
          </section>
        );
      })}
    </div>
  );
}
