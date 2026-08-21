/**
 * Detail-Formular von „Änderungen der letzten Nacht" (v4.135).
 *
 * Eigene Datei statt eines dritten Zweigs in `WidgetConfigForm`: die Karte hat
 * sechs Regler aus drei verschiedenen Richtungen (Umfang, Zeitraum, Grundmenge),
 * und die beiden vorhandenen Formulare dort sind bereits je ~90 Zeilen lang.
 * Der Dispatcher bleibt die eine Wahrheit darüber, WELCHES Formular erscheint.
 *
 * Zahlen mit lokalem Puffer und Commit `onBlur`/Enter — wie `AmpelConfigForm`,
 * aus demselben Grund: die Config wird bei jedem `onUpdate` nach IDB geschrieben
 * und in die persönlichen Einstellungen gespiegelt; ein Persist je Tastendruck
 * wäre ein Schreibvorgang je Ziffer.
 */
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type {
  NachtlaufAusschnitt,
  NachtlaufSortierung,
  NachtlaufWidgetConfig,
  WidgetSpezifischeConfig,
} from './types';

/** Die angebotenen Zeitfenster. `0` = das bisherige Verhalten (ein Lauf). */
const ZEITRAEUME: ReadonlyArray<{ wert: number; label: string }> = [
  { wert: 0, label: 'Nur der letzte Lauf' },
  { wert: 3, label: 'Letzte 3 Tage' },
  { wert: 7, label: 'Letzte 7 Tage' },
  { wert: 14, label: 'Letzte 14 Tage' },
];

function FeldLabel({ children }: { children: React.ReactNode }): React.ReactElement {
  return <p className="text-[12px] text-[var(--tf-text-secondary)] mb-1.5">{children}</p>;
}

function Hinweis({ children }: { children: React.ReactNode }): React.ReactElement {
  return <p className="mt-1.5 text-[11px] text-[var(--tf-text-tertiary)]">{children}</p>;
}

export function NachtlaufConfigForm({ cfg, onUpdate }: {
  cfg: NachtlaufWidgetConfig;
  onUpdate: (config: WidgetSpezifischeConfig) => Promise<void>;
}): React.ReactElement {
  const [zeilen, setZeilen] = useState(String(cfg.maxZeilen));
  const [kuerzel, setKuerzel] = useState(String(cfg.maxKuerzel));
  useEffect(() => { setZeilen(String(cfg.maxZeilen)); }, [cfg.maxZeilen]);
  useEffect(() => { setKuerzel(String(cfg.maxKuerzel)); }, [cfg.maxKuerzel]);

  const commit = (): void => {
    // 1 statt 0 als Untergrenze: eine Karte, die nichts zeigen darf, ist keine
    // Einstellung, sondern ein Ausblenden — dafür gibt es das `⋯`-Menü.
    const z = Math.min(50, Math.max(1, Math.round(Number(zeilen)) || cfg.maxZeilen));
    const k = Math.min(12, Math.max(1, Math.round(Number(kuerzel)) || cfg.maxKuerzel));
    setZeilen(String(z));
    setKuerzel(String(k));
    if (z !== cfg.maxZeilen || k !== cfg.maxKuerzel) {
      void onUpdate({ ...cfg, maxZeilen: z, maxKuerzel: k });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <FeldLabel>Zeitraum</FeldLabel>
        <Select
          value={String(cfg.rueckblickTage)}
          onValueChange={v => { void onUpdate({ ...cfg, rueckblickTage: Number(v) }); }}
        >
          <SelectTrigger className="w-full max-w-[320px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ZEITRAEUME.map(z => (
              <SelectItem key={z.wert} value={String(z.wert)}>{z.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Hinweis>
          „Nur der letzte Lauf" zeigt den jüngsten Export mit Änderungen — brachte der letzte
          Export nichts, rückt der davor nach. Ein Zeitraum tut das nicht: er zeigt genau, was
          in ihm belegt ist, auch wenn das nichts ist.
        </Hinweis>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-[12px] text-[var(--tf-text-secondary)] inline-flex items-center gap-2">
          Höchstens
          <Input
            type="number"
            min={1}
            max={50}
            value={zeilen}
            onChange={e => setZeilen(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            className="w-[72px] h-8 text-[12.5px]"
          />
          Vorgänge
        </label>
        <label className="text-[12px] text-[var(--tf-text-secondary)] inline-flex items-center gap-2">
          und
          <Input
            type="number"
            min={1}
            max={12}
            value={kuerzel}
            onChange={e => setKuerzel(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            className="w-[72px] h-8 text-[12.5px]"
          />
          Kürzel je Zeile
        </label>
      </div>
      <Hinweis>
        Beides kappt nur die Aufzählung, nie die Zahlen: der Zähler in der Kopfzeile nennt
        weiterhin alle Änderungen, und was wegfällt, steht im Tooltip von „+N".
      </Hinweis>

      <div>
        <FeldLabel>Reihenfolge</FeldLabel>
        <Select
          value={cfg.sortierung}
          onValueChange={v => { void onUpdate({ ...cfg, sortierung: v as NachtlaufSortierung }); }}
        >
          <SelectTrigger className="w-full max-w-[320px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="anzahl">Änderungsreichste zuerst</SelectItem>
            <SelectItem value="label">Alphabetisch nach Akronym</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <FeldLabel>Welche Vorgänge</FeldLabel>
        <Select
          value={cfg.ausschnitt}
          onValueChange={v => { void onUpdate({ ...cfg, ausschnitt: v as NachtlaufAusschnitt }); }}
        >
          <SelectTrigger className="w-full max-w-[320px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="chip">Wie im Seitenkopf eingestellt</SelectItem>
            <SelectItem value="meine">Immer nur meine</SelectItem>
            <SelectItem value="alle">Immer alle</SelectItem>
          </SelectContent>
        </Select>
        <Hinweis>
          Übersteuert nur den Umschalter im Seitenkopf. Ein Ausschnitt aus einer Frage und ein
          per Anmeldung festgelegtes Kürzel bleiben davon unberührt — die Kopfzeile der Karte
          nennt in jedem Fall, welcher Ausschnitt gerade gilt.
        </Hinweis>
      </div>

      <label className="flex items-center gap-2.5 text-[12.5px] text-[var(--tf-text)] cursor-pointer">
        <Switch
          checked={cfg.fusszeilen}
          onCheckedChange={v => { void onUpdate({ ...cfg, fusszeilen: v === true }); }}
        />
        Erklärende Fußzeilen anzeigen
      </label>
      <Hinweis>
        „… und N weitere Vorgänge" sowie „N weitere Änderungen betrafen Vorgänge außerhalb Ihres
        Ausschnitts". Ausgeschaltet spart die Karte zwei Zeilen — und sagt dann nicht mehr, wie
        viel sie weglässt.
      </Hinweis>
    </div>
  );
}
