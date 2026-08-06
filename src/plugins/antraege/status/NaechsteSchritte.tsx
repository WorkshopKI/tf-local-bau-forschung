/**
 * „Nächste Schritte (in C16 zu setzen)" — der Nächster-Schritt-Navigator am
 * Verbund.
 *
 * Die App setzt nichts. Sie liest die importierte Trigger-Tabelle und sagt,
 * welche Kürzel unter dem aktuellen Status überhaupt greifen würden — mit
 * Wirkung, Rolle und, wo eine Bedingung nicht auswertbar war, dem Grund dafür.
 *
 * **Die Überschrift ist bewusst umständlich.** „Nächste Schritte" allein hieße,
 * die App wüsste, was fachlich ansteht; sie weiß nur, was C16 maschinell
 * zulässt. Der Zusatz „(in C16 zu setzen)" sagt außerdem, wo gehandelt wird —
 * nicht hier.
 *
 * Die eigene Rolle aus dem Profil ist **Vorauswahl, keine Sperre** (wie in
 * `StatusCodeListe`); neutrale Kürzel bleiben unter jeder Wahl sichtbar.
 */
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ToggleChip } from '@/components/ui/ToggleChip';
import { useProfile } from '@/core/hooks/useProfile';
import { useRichtlinienLabels, richtlinienLabel } from '@/core/hooks/useRichtlinienLabels';
import { useStorage } from '@/core/hooks/useStorage';
import { isVorgangssystemEnabled } from '@/config/feature-flags';
import {
  ROLLEN, ROLLE_LABEL, ROLLE_LANG, baueLegende, erklaerKatalog, findeStatusCode, ladeTrigger,
  leseStatusRolle, navigatorKandidaten,
  type FeldVorkommen, type MappingVersion, type NavigatorKandidat, type Rolle,
  type TriggerZeile,
} from '@/core/status';
import { ErklaerterSatz } from '@/components/vorgang/ErklaerterSatz';

/** Mehr als das überblickt niemand; der Rest wird gezählt, nicht verschwiegen. */
const MAX_ANZEIGE = 12;

/**
 * Lädt die Trigger-Tabelle einmal. Eigene, winzige Ladeschleife statt eines
 * Umwegs über `useStatusVerlauf`: die Trigger sind eine eigene Sidecar mit
 * eigenem Stand, und die Detailseite soll ohne sie vollständig funktionieren.
 */
function useTriggerTabelle(): { trigger: TriggerZeile[]; geladen: boolean } {
  const idb = useStorage().idb;
  const [stand, setStand] = useState<{ trigger: TriggerZeile[]; geladen: boolean }>(
    { trigger: [], geladen: false },
  );
  useEffect(() => {
    let abgebrochen = false;
    void (async () => {
      try {
        const s = await ladeTrigger(idb);
        if (!abgebrochen) setStand({ trigger: s.datei?.trigger ?? [], geladen: true });
      } catch {
        if (!abgebrochen) setStand({ trigger: [], geladen: true });
      }
    })();
    return () => { abgebrochen = true; };
  }, [idb]);
  return stand;
}

function Kandidat({ k }: { k: NavigatorKandidat }): React.ReactElement {
  return (
    <li className="flex flex-col gap-0.5 border-t border-[var(--tf-border)] pt-1.5 first:border-t-0 first:pt-0">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="font-mono text-[12.5px] text-[var(--tf-text)]">{k.kuerzel}</span>
        <span className="text-[12.5px] text-[var(--tf-text-secondary)]">{k.label}</span>
        <span className="text-[11px] text-[var(--tf-text-tertiary)]">{k.rollenText}</span>
        {k.unbekannt && <Badge variant="warning">nicht im Katalog</Badge>}
      </div>
      <ul className="flex flex-col gap-0.5">
        {k.wirkung.map(w => (
          <li key={w.folge} className="text-[11.5px] text-[var(--tf-text-secondary)]">
            → <ErklaerterSatz segmente={w.segmente} />
            {w.urteil === 'unpruefbar' && (
              <span className="text-[var(--tf-warning-text)]"> · Bedingung nicht prüfbar</span>
            )}
            {w.gruende.length > 0 && (
              <span className="text-[var(--tf-text-tertiary)]"> {w.gruende.join(' ')}</span>
            )}
          </li>
        ))}
      </ul>
      {k.platzhalter.length > 0 && (
        <p className="text-[11px] text-[var(--tf-text-tertiary)]">
          Empfänger-Platzhalter des Fachsystems: {k.platzhalter.join(', ')} — die Auflösung auf
          Personen ist an C16 noch nicht verifiziert.
        </p>
      )}
    </li>
  );
}

export function NaechsteSchritte({ version, vorkommen, statusRoh, programm }: {
  version: MappingVersion;
  /** Alle gesetzten Statuseinträge des Verbunds (`sammleVorkommen`). */
  vorkommen: readonly FeldVorkommen[];
  /** Der amtliche Verbund-Status als Rohtext aus dem Export. */
  statusRoh?: string | null;
  /** Programm-/Richtlinien-Nummer des Vorhabens; `null` = unbekannt. */
  programm: string | null;
}): React.ReactElement | null {
  const { profile } = useProfile();
  const labels = useRichtlinienLabels();
  const [rolle, setRolle] = useState<Rolle | 'alle'>(() => leseStatusRolle(profile?.status_rolle));
  const [alleZeigen, setAlleZeigen] = useState(false);
  const { trigger, geladen } = useTriggerTabelle();

  const legende = useMemo(() => baueLegende(version.textbausteine), [version.textbausteine]);
  const ergebnis = useMemo(() => navigatorKandidaten({
    trigger,
    programm,
    felder: version.felder,
    vorkommen,
    statusCode: findeStatusCode(statusRoh ?? '')?.eintrag.code ?? null,
    rolle,
    legende,
    // Damit `ABB` und `59` in den Regelsätzen dasselbe erklären wie im
    // Herleitungs-Popover — beides steht auf dieser Seite untereinander.
    katalog: erklaerKatalog(version),
  }), [trigger, programm, version, vorkommen, statusRoh, rolle, legende]);

  /** Teilvorhaben, für die überhaupt Einträge vorliegen. */
  const tvAnzahl = useMemo(
    () => new Set(vorkommen.map(v => v.tvId).filter(Boolean)).size,
    [vorkommen],
  );

  if (!isVorgangssystemEnabled()) return null;

  const sichtbar = alleZeigen ? ergebnis.kandidaten : ergebnis.kandidaten.slice(0, MAX_ANZEIGE);
  const rest = ergebnis.kandidaten.length - sichtbar.length;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <h4 className="text-[13px] font-medium text-[var(--tf-text)]">
          Nächste Schritte (in C16 zu setzen)
        </h4>
        <span className="text-[12px] text-[var(--tf-text-tertiary)]">{ergebnis.kandidaten.length}</span>
        <span className="flex-1" />
        {(['alle', ...ROLLEN] as const).map(r => (
          <ToggleChip
            key={r}
            label={r === 'alle' ? 'Alle' : ROLLE_LABEL[r]}
            title={r === 'alle' ? undefined : ROLLE_LANG[r]}
            selected={rolle === r}
            onToggle={() => setRolle(r)}
          />
        ))}
      </div>

      {!geladen ? (
        <p className="text-[12px] text-[var(--tf-text-tertiary)]">Lädt …</p>
      ) : trigger.length === 0 ? (
        <p className="flex items-start gap-1.5 text-[12px] text-[var(--tf-warning-text)]">
          <AlertTriangle size={13} className="shrink-0 mt-[2px]" />
          <span>
            Trigger-Tabelle nicht importiert — ohne sie lassen sich keine Kandidaten ermitteln.
            Import im Status-Katalog unter „Referenzdaten".
          </span>
        </p>
      ) : ergebnis.programmUnbekannt ? (
        // Drei Gründe für „leer", drei verschiedene Sätze: nicht importiert,
        // Programm unbekannt, Programm ohne Trigger. Sie zu einem „keine
        // Kandidaten" zusammenzuziehen verschwiege, was zu tun wäre.
        <p className="flex items-start gap-1.5 text-[12px] text-[var(--tf-warning-text)]">
          <AlertTriangle size={13} className="shrink-0 mt-[2px]" />
          <span>
            Programm des Vorhabens unbekannt (Spalte FM_NUMMER nicht gemappt) — Trigger gelten je
            Richtlinie, deshalb wird hier nichts geraten.
          </span>
        </p>
      ) : ergebnis.programmOhneTrigger ? (
        <p className="flex items-start gap-1.5 text-[12px] text-[var(--tf-warning-text)]">
          <AlertTriangle size={13} className="shrink-0 mt-[2px]" />
          <span>
            Für „{richtlinienLabel(programm ?? '', labels)}" ({programm}) sind keine Trigger
            importiert. Die Zuarbeit führt sie je Richtlinie — Import im Status-Katalog unter
            „Referenzdaten".
          </span>
        </p>
      ) : (
        <>
          <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
            Aus den Vorbedingungen der Trigger-Tabelle für „{richtlinienLabel(programm ?? '', labels)}"
            abgeleitet: was das Fachsystem unter dem aktuellen Status zuließe. Was fachlich ansteht,
            weiß die App nicht.
            {!ergebnis.relevanzGefiltert
              && ' Es sind noch keine Kürzel als relevant markiert — geprüft werden deshalb alle.'}
            {tvAnzahl > 1
              && ` TV-Bedingungen sind über alle ${tvAnzahl} Teilvorhaben des Verbunds geprüft.`}
          </p>

          {ergebnis.kandidaten.length === 0 ? (
            <p className="text-[12px] text-[var(--tf-text-tertiary)]">
              Keine Kandidaten ermittelbar
              {ergebnis.nichtInterpretiert > 0
                && ` (${ergebnis.nichtInterpretiert} Trigger-Zeilen nicht interpretierbar)`}.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {sichtbar.map(k => <Kandidat key={k.kuerzel} k={k} />)}
            </ul>
          )}

          {rest > 0 && (
            <button
              type="button" onClick={() => setAlleZeigen(true)}
              className="self-start text-[12px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer underline"
            >
              {rest} weitere anzeigen
            </button>
          )}

          <p className="text-[11px] text-[var(--tf-text-tertiary)]">
            {ergebnis.geprueft} Kürzel geprüft · {ergebnis.bereitsGesetzt} bereits gesetzt
            {' · '}{ergebnis.verletzt} durch Vorbedingung ausgeschlossen
            {/* Ausgeblendet, aber nicht verschwiegen — sonst fehlten in 78 und
                138 drei Kürzel, ohne dass jemand den Grund sähe. */}
            {ergebnis.testKuerzel > 0
              && ` · ${ergebnis.testKuerzel} Testkürzel der Zuarbeit ausgeblendet`}
            {ergebnis.nichtInterpretiert > 0
              && ` · ${ergebnis.nichtInterpretiert} Trigger-Zeilen nicht interpretiert`}
          </p>
        </>
      )}
    </section>
  );
}
