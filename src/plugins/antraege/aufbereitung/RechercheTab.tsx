/**
 * Recherche-Tab (v2.221). Leitet aus den Steckbrief-Daten + Stammdaten fertige
 * **Suchanfragen zum Kopieren** ab (Marktzahlen / Wettbewerb / Stand der Technik) — als
 * Startpunkte für die externe Recherche des Prüfers. Rein deterministisch (kein eigener
 * LLM-Lauf; nutzt den Steckbrief-Baustein), KEINE Live-Links (bleibt `file://`/DSGVO).
 * Zustände wie die übrigen KI-Tabs (der Steckbrief-Baustein liefert die Datengrundlage).
 */
import { useMemo } from 'react';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAsyncAction, type UseAsyncActionResult } from '@/core/hooks/useAsyncAction';
import type { SteckbriefDaten } from './steckbrief';
import { baueRechercheAnfragen, type RechercheStammdaten } from './recherche';
import type { BausteinUiState } from './useAufbereitung';

interface Props {
  steckbrief: BausteinUiState<SteckbriefDaten>;
  stammdaten: RechercheStammdaten;
  bausteine: UseAsyncActionResult<[]>;
}

export function RechercheTab({ steckbrief, stammdaten, bausteine }: Props): React.ReactElement {
  if (steckbrief.status === 'fehlt') {
    return (
      <div className="py-16 flex flex-col items-center gap-3 text-center">
        {bausteine.error ? (
          <div className="mb-1 rounded-lg px-3 py-2 text-[13px] text-[var(--tf-danger-text)]" style={{ border: '0.5px solid var(--tf-border)' }}>{bausteine.error}</div>
        ) : null}
        <div className="text-[15px] font-medium text-[var(--tf-text)]">Recherche-Hilfen noch nicht verfügbar</div>
        <div className="max-w-[460px] text-[13px] text-[var(--tf-text-tertiary)]">
          Die Suchanfragen leiten sich aus dem Steckbrief ab (Zielmärkte, FuE-Gegenstand, Kern-Zielwert).
          Starte die KI-Aufbereitung, um sie zu erzeugen.
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
  return <RechercheInhalt daten={steckbrief.daten ?? null} stammdaten={stammdaten} />;
}

function RechercheInhalt({ daten, stammdaten }: { daten: SteckbriefDaten | null; stammdaten: RechercheStammdaten }): React.ReactElement {
  const gruppen = useMemo(() => baueRechercheAnfragen(daten, stammdaten), [daten, stammdaten]);

  if (gruppen.length === 0) {
    return <div className="py-14 text-center text-[13px] text-[var(--tf-text-tertiary)]">Zu wenige Steckbrief-Angaben (Zielmärkte / FuE-Gegenstand) für Recherche-Hilfen.</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12px] text-[var(--tf-text-tertiary)]">
        Startpunkte für die eigene Recherche außerhalb der App — jede Anfrage lässt sich kopieren. Keine Links, keine automatische Suche.
      </p>
      {gruppen.map(g => (
        <div key={g.id} className="rounded-xl p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <span className="text-[13px] font-medium text-[var(--tf-text)]">{g.titel}</span>
              <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">{g.anfragen.length}</span>
            </div>
            <KopierAlle texte={g.anfragen.map(a => a.text)} />
          </div>
          <div className="flex flex-col gap-1.5">
            {g.anfragen.map(a => <KopierAnfrage key={a.text} text={a.text} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function KopierAnfrage({ text }: { text: string }): React.ReactElement {
  const kopieren = useAsyncAction(async () => { await navigator.clipboard.writeText(text); });
  return (
    <button
      type="button"
      onClick={() => kopieren.run()}
      disabled={kopieren.busy}
      title="In die Zwischenablage kopieren"
      className="group flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-[var(--tf-hover)]"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      <span className="min-w-0 truncate text-[12.5px] text-[var(--tf-text)]">{text}</span>
      <span className="shrink-0 inline-flex items-center gap-1 text-[11px] text-[var(--tf-text-tertiary)] group-hover:text-[var(--tf-primary)]">
        <Copy size={12} /> {kopieren.error ? 'Fehler' : 'kopieren'}
      </span>
    </button>
  );
}

function KopierAlle({ texte }: { texte: string[] }): React.ReactElement {
  const kopieren = useAsyncAction(async () => { await navigator.clipboard.writeText(texte.join('\n')); });
  return (
    <button
      type="button"
      onClick={() => kopieren.run()}
      disabled={kopieren.busy}
      className="inline-flex items-center gap-1 text-[11.5px] text-[var(--tf-primary)] hover:underline disabled:opacity-50"
    >
      <Copy size={12} /> {kopieren.error ? 'Fehler' : 'Alle kopieren'}
    </button>
  );
}
