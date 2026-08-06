/**
 * Ein Kürzel, lesend: was es heißt, in welcher Spalte es steht, wer es setzt, wo
 * es im Ordnerbaum hängt, wie oft es vorkommt — und was es auslöst.
 *
 * Die Statuswirkung steht nach WORTLAUT gebündelt („in 131, 133 und 137") statt
 * einer Zeile je Richtlinie: das Glossar erklärt das Kürzel, nicht den
 * Unterschied zwischen den Richtlinien. Gerechnet wird das in `wirkungGruppen`
 * neben `wirkungZeilen` — eine zweite Trigger-Auswertung gibt es nicht.
 */
import { useMemo } from 'react';
import { ErklaerterSatz } from '@/components/vorgang/ErklaerterSatz';
import { Badge } from '@/components/ui/badge';
import {
  baueLegende, erklaerKatalog, richtlinienSatz, wirkungGruppen,
  type MappingVersion, type TriggerStand,
} from '@/core/status';
import { regelnZuKuerzel, sonderErklaerung, type KuerzelZeile, type RegelZeile } from './glossarZeilen';
import { Abschnitt, DetailKopf, Feld, Felder } from './GlossarFelder';
import { RegelnVerweis } from './RegelnVerweis';

/** Was das Kürzel im Fachsystem auslöst — oder warum hier nichts steht. */
function Wirkung({ zeile, version, trigger, onStatus }: {
  zeile: KuerzelZeile;
  version: MappingVersion;
  trigger: TriggerStand | null;
  onStatus: (code: number) => void;
}): React.ReactElement {
  const gruppen = useMemo(
    () => (trigger?.datei
      ? wirkungGruppen(
        trigger.datei.trigger, zeile.code,
        erklaerKatalog(version), baueLegende(version.textbausteine),
      )
      : []),
    [trigger, zeile.code, version],
  );

  if (trigger === null) {
    return <p className="text-[12.5px] text-[var(--tf-text-tertiary)]">Wird geladen …</p>;
  }
  if (trigger.datei === null) {
    return (
      <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
        Die Trigger-Tabelle ist nicht eingelesen — ohne sie lässt sich nicht sagen, was
        dieses Kürzel auslöst.
      </p>
    );
  }
  if (gruppen.length === 0) {
    return (
      <>
        <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
          Die Trigger-Tabelle kennt keine Wirkung dieses Kürzels.
        </p>
        <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
          Das ist eine Aussage, kein Fehler: es hält dann nur fest, dass ein Schritt
          passiert ist, ohne selbst etwas zu ändern.
        </p>
      </>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {gruppen.map((g, i) => (
        <li key={i} className="flex flex-col gap-0.5">
          <span className="text-[12.5px] leading-[1.35] text-[var(--tf-text-secondary)]">
            <ErklaerterSatz segmente={g.segmente} />
          </span>
          <span className="flex flex-wrap items-baseline gap-x-2 text-[11px] text-[var(--tf-text-tertiary)]">
            {g.programme.length > 0 && richtlinienSatz(g.programme)}
            {g.zielStatus.map(code => (
              <button
                key={code}
                type="button"
                onClick={() => onStatus(code)}
                title={`Status ${code} im Glossar nachschlagen`}
                className="cursor-pointer text-[var(--tf-primary)] underline underline-offset-2"
              >
                Status {code}
              </button>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Welche To-do-Regeln dieses Kürzel prüfen — reine Auflistung.
 *
 * **Keine Vorhersage.** Was am Ende als To-do erscheint, hinge an der ganzen
 * Kaskade samt Sperren; eine solche Behauptung wäre genau dann falsch, wenn sie
 * interessant wird. Hier steht nur, WO das Kürzel vorkommt.
 */
function Verwendung({ regeln, onRegel }: {
  regeln: readonly RegelZeile[];
  onRegel: (id: string) => void;
}): React.ReactElement {
  if (regeln.length === 0) {
    return (
      <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
        Keine To-do-Regel prüft dieses Kürzel.
      </p>
    );
  }
  return (
    <>
      <ul className="flex flex-col gap-1.5">
        {regeln.map(r => (
          <li key={r.regel.id} className="flex flex-col">
            <button
              type="button"
              onClick={() => onRegel(`regel:${r.regel.id}`)}
              className="cursor-pointer text-left text-[12.5px] text-[var(--tf-primary)] underline underline-offset-2"
            >
              {r.regel.beschreibung}
            </button>
            <span className="text-[11.5px] leading-[1.35] text-[var(--tf-text-tertiary)]">
              wenn {r.satz}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-[var(--tf-text-tertiary)]">
        Wo es geprüft wird — nicht, welches To-do daraus folgt: das entscheidet die
        ganze Kaskade samt ihren Sperren.
      </p>
    </>
  );
}

export function KuerzelDetail({ zeile, version, regeln, trigger, onStatus, onRegel }: {
  zeile: KuerzelZeile;
  version: MappingVersion;
  regeln: readonly RegelZeile[];
  trigger: TriggerStand | null;
  /** Sprung auf den Zielstatus — Kürzel → Status → Verfahrensschritt in zwei Klicks. */
  onStatus: (code: number) => void;
  onRegel: (id: string) => void;
}): React.ReactElement {
  const sonder = sonderErklaerung(zeile.code);
  const verwendet = useMemo(() => regelnZuKuerzel(regeln, zeile.code), [regeln, zeile.code]);

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto px-6 py-5">
      <DetailKopf titel={zeile.code} unter={zeile.label} />

      {sonder !== null && (
        <p className="flex items-baseline gap-1.5 text-[12px] text-[var(--tf-text-secondary)]">
          <Badge variant="info">Sonderfall</Badge> {sonder}
        </p>
      )}

      <Felder>
        <Feld label="Spalte">
          <span className="font-mono text-[11.5px]">{zeile.csvSpalte}</span>
        </Feld>
        <Feld label="Wird gesetzt von">
          {zeile.neutral
            ? <span className="text-[var(--tf-text-secondary)]">
                alle — kein Rollen-Vermerk in der Zuarbeit
              </span>
            : zeile.rollenText}
        </Feld>
        <Feld label="Ordner" leer="nicht zugeordnet">{zeile.ordner}</Feld>
        <Feld label="Vorkommen" leer="wird gezählt …">
          {zeile.vorkommen !== null
            ? `${zeile.vorkommen.toLocaleString('de-DE')} Vorgänge tragen es`
            : ''}
        </Feld>
      </Felder>

      <Abschnitt titel="Löst aus">
        <Wirkung zeile={zeile} version={version} trigger={trigger} onStatus={onStatus} />
      </Abschnitt>

      <Abschnitt titel="Wird verwendet von">
        <Verwendung regeln={verwendet} onRegel={onRegel} />
        {verwendet.length > 0 && <RegelnVerweis />}
      </Abschnitt>
    </div>
  );
}
