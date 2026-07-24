/**
 * Freigabe-Tor eines RNE/ABL-Entwurfs: strenger als NF, weil ein Bescheid eine
 * Rechtsfolge trägt. Zeigt den Platzhalter-Status, die Konsistenz-Warnungen (einzeln
 * zu quittieren) und die Pflicht-Checkbox; der DOCX-Export ist erst frei, wenn alle
 * Tore passiert sind. Reine Darstellung über `bescheidFreigabeTor`.
 */
import { useState } from 'react';
import { NfEntwurfCard } from '../nachforderungen/NachforderungenSection';
import type { NfEntwurf } from '../nachforderungen/useNachforderungen';
import { bescheidFreigabeTor, type KonsistenzWarnung } from '../nachforderungen/bescheid-freigabe';

export function BescheidFreigabe({ entwurf, warnungen, offeneTodos, bewertungGefunden, onExport }: {
  entwurf: NfEntwurf;
  warnungen: KonsistenzWarnung[];
  offeneTodos: number;
  bewertungGefunden: boolean;
  onExport: () => void;
}): React.ReactElement {
  const [quittiert, setQuittiert] = useState<Set<string>>(new Set());
  const [bestaetigt, setBestaetigt] = useState(false);

  const tor = bescheidFreigabeTor({
    finalerText: entwurf.text,
    offeneTodos,
    warnungen,
    bewertungGefunden,
    quittiert,
    freigabeBestaetigt: bestaetigt,
  });

  const toggleQuittiert = (key: string): void =>
    setQuittiert(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });

  return (
    <div className="rounded-[12px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg)] px-4 py-3 flex flex-col gap-3">
      <NfEntwurfCard entwurf={entwurf} onExport={onExport} exportDisabled={!tor.exportErlaubt} />

      <div className="rounded-[10px] bg-[var(--tf-bg-secondary)] px-3.5 py-3 flex flex-col gap-2">
        <div className="text-[12px] font-medium text-[var(--tf-text)]">Freigabe-Tor (Bescheid)</div>

        <TorZeile ok={tor.platzhalterOk} text={tor.platzhalterOk ? 'Keine ungefüllten Platzhalter.' : 'Ungefüllte Platzhalter im Text — vor der Freigabe füllen.'} />
        <TorZeile ok={tor.vollstaendig} text={tor.vollstaendig ? 'Jeder Punkt hat einen Baustein.' : `${offeneTodos} Punkt(e) ohne Baustein — bei einem Bescheid nicht zulässig.`} />

        {bewertungGefunden ? (
          warnungen.length === 0 ? (
            <TorZeile ok text="Konsistenz-Checks bestanden (keine Widersprüche zur Fachbewertung)." />
          ) : (
            <div className="flex flex-col gap-1.5">
              <div className="text-[11.5px] text-[var(--tf-warning-text)]">
                {warnungen.length} Konsistenz-Warnung(en) — bitte einzeln prüfen und quittieren:
              </div>
              {warnungen.map(w => (
                <label key={w.key} className="flex items-start gap-2 text-[11.5px] text-[var(--tf-text-secondary)] cursor-pointer">
                  <input type="checkbox" checked={quittiert.has(w.key)} onChange={() => toggleQuittiert(w.key)} className="mt-0.5 shrink-0" />
                  <span>{w.text}</span>
                </label>
              ))}
            </div>
          )
        ) : (
          <div className="text-[11.5px] text-[var(--tf-text-tertiary)]">
            ● Keine MAP-Fachbewertung vorhanden — Konsistenz-Checks übersprungen.
          </div>
        )}

        <label className="flex items-center gap-2 text-[12px] text-[var(--tf-text)] cursor-pointer mt-1 pt-2 border-t-[0.5px] border-[var(--tf-border)]">
          <input type="checkbox" checked={bestaetigt} onChange={e => setBestaetigt(e.target.checked)} />
          Geprüft und zur Weiterverarbeitung freigegeben
        </label>
        {!tor.exportErlaubt && (
          <div className="text-[11px] text-[var(--tf-text-tertiary)]">
            Der DOCX-Export ist frei, sobald alle Tore erfüllt und die Freigabe bestätigt ist.
          </div>
        )}
      </div>
    </div>
  );
}

function TorZeile({ ok, text }: { ok: boolean; text: string }): React.ReactElement {
  return (
    <div className="flex items-center gap-2 text-[11.5px]">
      <span className={ok ? 'text-[var(--tf-success-text)]' : 'text-[var(--tf-danger-text)]'}>{ok ? '✓' : '✗'}</span>
      <span className="text-[var(--tf-text-secondary)]">{text}</span>
    </div>
  );
}
