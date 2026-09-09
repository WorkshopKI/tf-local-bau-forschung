/**
 * Tagesbrief — Themenwahl.
 *
 * Eine Häkchenliste, nach Familien gruppiert. Gespeichert wird die **Abwahl**
 * (`aus`), nicht die Auswahl: so ist ein später ergänztes Thema von selbst dabei,
 * statt in gewachsenen Configs stumm zu bleiben — dieselbe Überlegung, aus der
 * `reconcileVerfuegbareWidgets` neue Typen nachzieht.
 *
 * Themen, die dieser Build gar nicht bedienen kann (`verfuegbarWenn`), stehen
 * **nicht** in der Liste: „Voraussetzung nicht erfüllt → ausblenden, nicht
 * ausgrauen" (Regel der Quick-Action-Leiste).
 */
import { FAMILIE_LABEL, THEMEN } from './themen';
import type { Familie, TagesbriefWidgetConfig, ThemaId } from './typen';

const FAMILIEN: Familie[] = ['arbeitsvorrat', 'bewegung', 'eigenes', 'umfeld'];

interface Props {
  cfg: TagesbriefWidgetConfig;
  onUpdate: (config: TagesbriefWidgetConfig) => Promise<void>;
}

export function TagesbriefConfigForm({ cfg, onUpdate }: Props): React.ReactElement {
  const abgewaehlt = new Set(cfg.aus);
  const verfuegbar = THEMEN.filter(t => t.verfuegbarWenn());

  const umschalten = (id: ThemaId): void => {
    const naechste = abgewaehlt.has(id)
      ? cfg.aus.filter(x => x !== id)
      : [...cfg.aus, id];
    void onUpdate({ ...cfg, aus: naechste });
  };

  if (verfuegbar.length === 0) {
    return (
      <p className="text-[12px] text-[var(--tf-text-tertiary)]">
        In diesem Build kann der Tagesbrief noch keine Themen führen.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-[var(--tf-text-secondary)]">
        Welche Themen der Brief berücksichtigt. Themen mit Frist bestimmen die
        Reihenfolge; die übrigen stehen zusammengefasst im Nachsatz.
      </p>
      {FAMILIEN.map(familie => {
        const themen = verfuegbar.filter(t => t.familie === familie);
        if (themen.length === 0) return null;
        return (
          <div key={familie}>
            <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--tf-text-tertiary)] mb-1">
              {FAMILIE_LABEL[familie]}
            </p>
            <ul className="space-y-0.5">
              {themen.map(t => (
                <li key={t.id}>
                  <label className="flex items-center gap-2 text-[12.5px] text-[var(--tf-text)] cursor-pointer py-0.5">
                    <input
                      type="checkbox"
                      checked={!abgewaehlt.has(t.id)}
                      onChange={() => umschalten(t.id)}
                      className="accent-[var(--tf-primary)]"
                    />
                    <span className="min-w-0 truncate">{t.label}</span>
                    {t.uhr ? (
                      <span
                        className="ml-auto shrink-0 text-[10.5px] text-[var(--tf-text-tertiary)]"
                        title="Trägt eine Frist und bestimmt damit die Reihenfolge"
                      >
                        Frist
                      </span>
                    ) : null}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
