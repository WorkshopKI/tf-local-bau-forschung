/**
 * Prüf-Stepper: Kriterien nach Gruppen, Fortschritt, Innovationsgrad.
 *
 * Rein darstellend — Punkte, Gates und Abschlussfähigkeit kommen fertig aus
 * `bewerte()`.
 */
import { ProgressBar } from '@/components/ui/ProgressBar';
import type { AspektMapping } from '@/plugins/antraege/aufbereitung';
import type { VbSektion } from '@/plugins/antraege/aufbereitung/gliederung';
import type { MapBewertungsErgebnis } from '../checkliste/bewertung';
import type { MapChecklistenDefinition, MapItemStatus, MapStufe } from '../checkliste/typen';
import { fundstellenFuerItem } from '../vb/fundstellen';
import { ItemKarte } from './ItemKarte';
import { SkalaKarte } from './SkalaKarte';

function InnoScoreKarte({
  ergebnis, definition,
}: {
  ergebnis: MapBewertungsErgebnis;
  definition: MapChecklistenDefinition;
}): React.ReactElement {
  const { innoScore } = ergebnis;
  const farbe = innoScore.nullWegenB0
    ? 'var(--tf-danger, #dc2626)'
    : innoScore.vertiefungNoetig ? 'var(--tf-warning, #f59e0b)' : 'var(--tf-success, #16a34a)';

  return (
    <div
      className="rounded-[var(--tf-radius-md,8px)] px-3 py-2.5"
      style={{ border: '0.5px solid var(--tf-border)', borderLeft: `3px solid ${farbe}` }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-[var(--tf-text)]">Innovationsgrad</span>
        <span className="text-[16px] font-medium tabular-nums" style={{ color: farbe }}>
          {innoScore.vollstaendig || innoScore.rohSumme > 0 ? innoScore.punkte : '—'}
          <span className="text-[12px] text-[var(--tf-text-tertiary)]"> / {innoScore.maxPunkte}</span>
        </span>
      </div>

      {innoScore.nullWegenB0 && (
        <p className="text-[11.5px] mt-1" style={{ color: 'var(--tf-danger, #dc2626)' }}>
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
  const gruppen = [...new Set(ergebnis.zustaende.map(z => z.item.gruppe))];
  const { erledigt, gesamt } = ergebnis.fortschritt;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[12.5px] text-[var(--tf-text-secondary)]">
            <span className="tabular-nums font-medium text-[var(--tf-text)]">{erledigt}</span> von{' '}
            <span className="tabular-nums">{gesamt}</span> Kriterien bewertet
          </span>
          <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
            {definition.titel} · Fassung {definition.version}
          </span>
        </div>
        <ProgressBar value={gesamt === 0 ? 0 : erledigt / gesamt} />
      </div>

      {versionVeraltet && (
        <div
          className="rounded px-3 py-2 text-[12.5px]"
          style={{
            background: 'color-mix(in srgb, var(--tf-warning, #f59e0b) 10%, var(--tf-bg))',
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

      <InnoScoreKarte ergebnis={ergebnis} definition={definition} />

      {gruppen.map(gruppe => {
        const zustaende = ergebnis.zustaende.filter(z => z.item.gruppe === gruppe);
        return (
          <section key={gruppe} className="flex flex-col gap-2">
            <h3 className="text-[12px] font-medium text-[var(--tf-text-secondary)] uppercase tracking-wide">
              {gruppe}
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
