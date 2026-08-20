/**
 * Einspiel-Hälfte des Kuratur-Paket-Dialogs: Datei wählen → **Vorschau** →
 * je Eintrag entscheiden → schreiben → Bericht.
 *
 * Die Vorschau ist der Sinn der Sache: wer ein Paket auf einen fremden Share
 * spielt, weiß oft nicht, was dort steht. Deshalb wird nichts geschrieben,
 * bevor die Zeilen gelesen werden konnten — und identische Einträge sind
 * standardmäßig ausgeblendet, damit die echten Änderungen nicht in 200 Zeilen
 * „unverändert" untergehen.
 */
import { useMemo, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import {
  parseKuraturPaket, vergleichePaket, vorbelegung, wendePaketAn, zeilenSchluessel,
  PAKET_ARTEN,
  type EinspielBericht, type Entscheidung, type Entscheidungen, type KuraturPaket,
  type PaketArt, type PaketZeile, type SkillRegistryFile, type TextbausteinKatalog,
} from '@/core/services/skills';

const ART_LABEL: Record<PaketArt, string> = {
  regel: 'Regeln', skill: 'Skills', workflow: 'Workflows', baustein: 'Textbausteine',
};

const ENTSCHEIDUNG_LABEL: Record<Entscheidung, string> = {
  uebernehmen: 'übernehmen',
  aktualisieren: 'aktualisieren',
  kopie: 'als Kopie',
  ueberspringen: 'überspringen',
};

const ZUSTAND_LABEL: Record<PaketZeile['zustand'], string> = {
  neu: 'neu', geaendert: 'geändert', identisch: 'unverändert',
};

const ZUSTAND_FARBE: Record<PaketZeile['zustand'], string> = {
  neu: 'var(--tf-primary)',
  geaendert: 'var(--tf-warning-text)',
  identisch: 'var(--tf-text-tertiary)',
};

interface Props {
  file: SkillRegistryFile;
  katalog: TextbausteinKatalog | null;
  canEdit: boolean;
  persistRegistry: (next: SkillRegistryFile) => Promise<void>;
  persistKatalog: (next: TextbausteinKatalog) => Promise<void>;
  onEingespielt: () => void;
}

export function PaketImportPanel({
  file, katalog, canEdit, persistRegistry, persistKatalog, onEingespielt,
}: Props): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const meinKuerzel = useMeinKuerzel();
  const [paket, setPaket] = useState<KuraturPaket | null>(null);
  const [dateiName, setDateiName] = useState<string | null>(null);
  const [parseFehler, setParseFehler] = useState<string | null>(null);
  const [entscheidungen, setEntscheidungen] = useState<Entscheidungen>({});
  const [nurAenderungen, setNurAenderungen] = useState(true);
  const [bericht, setBericht] = useState<EinspielBericht | null>(null);

  const zeilen = useMemo(
    () => (paket ? vergleichePaket(paket, file, katalog) : []),
    [paket, file, katalog],
  );

  const onPick = async (f: File | undefined): Promise<void> => {
    if (!f) return;
    setDateiName(f.name);
    setParseFehler(null);
    setPaket(null);
    setBericht(null);
    try {
      const geparst = parseKuraturPaket(JSON.parse(await f.text()));
      if (!geparst) { setParseFehler('Keine gültige Kuratur-Paket-Datei.'); return; }
      setPaket(geparst);
      setEntscheidungen(vorbelegung(vergleichePaket(geparst, file, katalog)));
    } catch {
      setParseFehler('Datei ist kein gültiges JSON.');
    }
  };

  const setzeEine = (z: PaketZeile, wert: Entscheidung): void => {
    setEntscheidungen(prev => ({ ...prev, [zeilenSchluessel(z.art, z.id)]: wert }));
  };

  /** Gruppen-Aktion: nur dort setzen, wo die Entscheidung überhaupt zulässig ist. */
  const setzeGruppe = (art: PaketArt, wert: Entscheidung): void => {
    setEntscheidungen(prev => {
      const next = { ...prev };
      for (const z of zeilen) {
        if (z.art === art && z.moeglich.includes(wert)) next[zeilenSchluessel(z.art, z.id)] = wert;
      }
      return next;
    });
  };

  const einspielen = useAsyncAction(async () => {
    if (!paket) return;
    const res = wendePaketAn(file, katalog, paket, entscheidungen, {
      zeitpunkt: new Date().toISOString(),
      userId: meinKuerzel,
      begruendung: `Kuratur-Paket vom ${paket.erstellt_am.slice(0, 10)}`,
      newId: () => crypto.randomUUID(),
    });
    let registryGeschrieben = false;
    try {
      if (res.bericht.registryGeaendert) {
        await persistRegistry(res.file);
        registryGeschrieben = true;
      }
      if (res.bericht.katalogGeaendert && res.katalog) await persistKatalog(res.katalog);
    } catch (err) {
      const grund = err instanceof Error ? err.message : String(err);
      // Zwei Ablagen, zwei Writes — ein halber Durchlauf muss sich als halber
      // zu erkennen geben, sonst sucht man den fehlenden Teil an der falschen Stelle.
      throw new Error(registryGeschrieben
        ? `${grund} Skills, Regeln und Workflows sind bereits gespeichert — die Textbausteine nicht.`
        : grund);
    }
    setBericht(res.bericht);
    onEingespielt();
  });

  const sichtbare = zeilen.filter(z => !nurAenderungen || z.zustand !== 'identisch');
  const zuTun = zeilen.filter(z => (entscheidungen[zeilenSchluessel(z.art, z.id)] ?? 'ueberspringen') !== 'ueberspringen');

  return (
    <div className="flex flex-col gap-3 min-h-0">
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={e => { void onPick(e.target.files?.[0]); }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 text-[13px] px-4 py-3 rounded-[8px] border-[0.5px] border-dashed border-[var(--tf-border-hover)] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]"
      >
        <Upload size={14} /> {dateiName ?? 'Paket-Datei wählen (.json)'}
      </button>

      {parseFehler && (
        <div className="rounded p-2.5 text-[12px]" style={{ background: 'var(--tf-danger-bg)', color: 'var(--tf-danger-text)' }}>⚠ {parseFehler}</div>
      )}

      {bericht && <BerichtBlock bericht={bericht} />}

      {paket && !bericht && (
        <>
          <div className="flex items-center gap-3 text-[11.5px] text-[var(--tf-text-secondary)]">
            <span>
              Paket vom {paket.erstellt_am.slice(0, 10)}
              {paket.quelle ? ` · ${paket.quelle}` : ''}
            </span>
            <label className="ml-auto flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={nurAenderungen}
                onChange={e => setNurAenderungen(e.target.checked)}
                className="accent-[var(--tf-primary)]"
              />
              nur Änderungen zeigen
            </label>
          </div>

          <div className="min-h-0 overflow-y-auto rounded-[8px] border-[0.5px] border-[var(--tf-border)]">
            {PAKET_ARTEN.map(art => {
              const alle = zeilen.filter(z => z.art === art);
              const zeigen = sichtbare.filter(z => z.art === art);
              if (alle.length === 0) return null;
              return (
                <Gruppe
                  key={art}
                  art={art}
                  alle={alle}
                  zeigen={zeigen}
                  entscheidungen={entscheidungen}
                  onSetzeEine={setzeEine}
                  onSetzeGruppe={setzeGruppe}
                />
              );
            })}
            {sichtbare.length === 0 && (
              <div className="px-3 py-4 text-[12px] text-[var(--tf-text-tertiary)]">
                Nichts zu tun — das Paket entspricht dem Stand dieses Shares.
              </div>
            )}
          </div>

          {!canEdit && (
            <div className="rounded p-2.5 text-[12px]" style={{ background: 'var(--tf-warning-bg)', color: 'var(--tf-warning-text)' }}>
              Nur Ansicht — zum Einspielen braucht es Schreibrecht auf dem Daten-Share (Kurator/PL).
            </div>
          )}

          {einspielen.error && (
            <div className="rounded p-2.5 text-[12px]" style={{ background: 'var(--tf-danger-bg)', color: 'var(--tf-danger-text)' }}>⚠ {einspielen.error}</div>
          )}

          <div className="flex items-center gap-3">
            <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
              {zuTun.length === 0 ? 'keine Änderung ausgewählt' : `${zuTun.length} Einträge werden geschrieben`}
            </span>
            <Button
              variant="primary"
              size="sm"
              className="ml-auto"
              disabled={!canEdit || zuTun.length === 0}
              loading={einspielen.busy}
              onClick={() => { void einspielen.run(); }}
            >
              Einspielen
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

interface GruppeProps {
  art: PaketArt;
  alle: PaketZeile[];
  zeigen: PaketZeile[];
  entscheidungen: Entscheidungen;
  onSetzeEine: (z: PaketZeile, wert: Entscheidung) => void;
  onSetzeGruppe: (art: PaketArt, wert: Entscheidung) => void;
}

function Gruppe({ art, alle, zeigen, entscheidungen, onSetzeEine, onSetzeGruppe }: GruppeProps): React.ReactElement {
  const neu = alle.filter(z => z.zustand === 'neu').length;
  const geaendert = alle.filter(z => z.zustand === 'geaendert').length;
  return (
    <div>
      <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-1.5 bg-[var(--tf-bg-secondary)] border-b-[0.5px] border-[var(--tf-border)]">
        <span className="text-[12px] font-medium text-[var(--tf-text)]">{ART_LABEL[art]}</span>
        <span className="text-[11px] text-[var(--tf-text-tertiary)]">
          {alle.length} · {neu} neu · {geaendert} geändert
        </span>
        {(neu > 0 || geaendert > 0) && (
          <div className="ml-auto flex items-center gap-2">
            <GruppenAktion label="alle übernehmen" onClick={() => { onSetzeGruppe(art, 'uebernehmen'); onSetzeGruppe(art, 'aktualisieren'); }} />
            <GruppenAktion label="alle überspringen" onClick={() => onSetzeGruppe(art, 'ueberspringen')} />
          </div>
        )}
      </div>
      {zeigen.map(z => {
        const wert = entscheidungen[zeilenSchluessel(z.art, z.id)] ?? 'ueberspringen';
        return (
          <div key={z.id} className="flex items-center gap-2 px-3 py-1 border-b-[0.5px] border-[var(--tf-border)] last:border-b-0">
            <span className="flex-1 min-w-0 truncate text-[12.5px] text-[var(--tf-text)]" title={z.id}>{z.name}</span>
            <span className="text-[11px] shrink-0" style={{ color: ZUSTAND_FARBE[z.zustand] }}>{ZUSTAND_LABEL[z.zustand]}</span>
            <span className="text-[11px] text-[var(--tf-text-tertiary)] tabular-nums shrink-0 w-[64px] text-right">
              {fassungen(z)}
            </span>
            <select
              value={z.moeglich.includes(wert) ? wert : z.moeglich[0]}
              onChange={e => onSetzeEine(z, e.target.value as Entscheidung)}
              disabled={z.moeglich.length === 1}
              className="shrink-0 h-6 text-[11.5px] rounded-[6px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg)] text-[var(--tf-text)] px-1 disabled:opacity-50"
            >
              {z.moeglich.map(m => <option key={m} value={m}>{ENTSCHEIDUNG_LABEL[m]}</option>)}
            </select>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Fassungs-Spalte. Ein Pfeil steht nur da, wo sich die Nummern unterscheiden —
 * „v5 → v5" liest sich wie „ändert nichts", obwohl daneben „geändert" steht:
 * ein Paket trägt den Inhalt seines Standes, nicht zwingend eine höhere Nummer.
 */
function fassungen(z: PaketZeile): string {
  if (z.paketVersion === undefined) return '';
  if (z.zielVersion === undefined || z.zielVersion === z.paketVersion) return `v${z.paketVersion}`;
  return `v${z.zielVersion} → v${z.paketVersion}`;
}

function GruppenAktion({ label, onClick }: { label: string; onClick: () => void }): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[11px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-primary)] underline decoration-dotted underline-offset-2"
    >
      {label}
    </button>
  );
}

function BerichtBlock({ bericht }: { bericht: EinspielBericht }): React.ReactElement {
  const { gesamt } = bericht;
  return (
    <div className="rounded-[8px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg-secondary)] px-3.5 py-3">
      <div className="text-[13px] font-medium text-[var(--tf-text)]">Eingespielt</div>
      <div className="text-[12px] text-[var(--tf-text-secondary)] mt-1">
        {gesamt.neu} neu · {gesamt.aktualisiert} aktualisiert · {gesamt.kopiert} als Kopie · {gesamt.uebersprungen} übersprungen
      </div>
      <div className="mt-2 space-y-0.5">
        {PAKET_ARTEN.map(art => {
          const z = bericht.proArt[art];
          const summe = z.neu + z.aktualisiert + z.kopiert;
          if (summe === 0) return null;
          return (
            <div key={art} className="text-[11.5px] text-[var(--tf-text-tertiary)]">
              {ART_LABEL[art]}: {z.neu} neu, {z.aktualisiert} aktualisiert{z.kopiert > 0 ? `, ${z.kopiert} kopiert` : ''}
            </div>
          );
        })}
      </div>
      {bericht.entfalleneSchritte > 0 && (
        <div className="text-[11.5px] text-[var(--tf-warning-text)] mt-1.5">
          {bericht.entfalleneSchritte} Workflow-Schritt(e) sind entfallen — sie standen im Ziel, aber nicht mehr im Paket.
        </div>
      )}
      {bericht.statuswechsel > 0 && (
        <div className="text-[11.5px] text-[var(--tf-text-secondary)] mt-1">
          {bericht.statuswechsel} Textbaustein(e) haben durch das Paket einen anderen Freigabe-Status.
        </div>
      )}
      <div className="text-[11.5px] text-[var(--tf-text-tertiary)] mt-2">
        Aktualisierte Einträge behalten ihren bisherigen Stand in der Fassungsliste — jeder lässt sich dort zurückholen.
      </div>
    </div>
  );
}
