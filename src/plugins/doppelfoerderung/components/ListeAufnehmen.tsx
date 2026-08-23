/**
 * Phase 1: die Meldungsliste aufnehmen und zeigen, was aus ihr wird.
 *
 * Die Vorschau nennt **alle drei** Gruppen — geprüft, unter der Schwelle, Betrag
 * nicht lesbar. Eine Zeile, deren Betragszelle „k. A." trägt, verschwände sonst
 * lautlos zwischen den zu kleinen, und niemand sähe, dass sie nie geprüft wurde.
 */
import { useCallback, useState } from 'react';
import { FileSpreadsheet, Play, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileDropZone } from '@/components/ui/FileDropZone';
import { ToggleChip } from '@/components/ui/ToggleChip';
import { istLeseFehler } from '@/core/status/import/xlsx-tabelle';
import {
  leseMeldungsListe, teileZeilen, SCHWELLE_VORGABE, type ZeilenAufteilung,
} from '../services/liste-lesen';
import type { BereichsWahl, MeldungsListe, MeldungsZeile } from '../types';

export interface ListeAufnehmenProps {
  bereich: BereichsWahl;
  onBereich: (b: BereichsWahl) => void;
  onStart: (zeilen: readonly MeldungsZeile[]) => void;
  laeuft: boolean;
}

const EURO = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

function Gruppe(props: { titel: string; zeilen: readonly MeldungsZeile[]; ton: 'an' | 'aus' }): React.ReactElement {
  const { titel, zeilen, ton } = props;
  const farbe = ton === 'an' ? 'var(--tf-text)' : 'var(--tf-text-tertiary)';
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[12.5px] font-medium" style={{ color: farbe }}>
        {titel} <span className="tabular-nums">({zeilen.length})</span>
      </div>
      <ul className="flex flex-col gap-0.5">
        {zeilen.slice(0, 4).map(z => (
          <li key={z.zeilenNr} className="truncate text-[12px] text-[var(--tf-text-tertiary)]">
            {z.fkz && <span className="tabular-nums">{z.fkz} · </span>}
            {z.thema || '(ohne Thema)'}
          </li>
        ))}
        {zeilen.length > 4 && (
          <li className="text-[12px] text-[var(--tf-text-tertiary)]">… und {zeilen.length - 4} weitere</li>
        )}
      </ul>
    </div>
  );
}

export function ListeAufnehmen(props: ListeAufnehmenProps): React.ReactElement {
  const { bereich, onBereich, onStart, laeuft } = props;

  const [liste, setListe] = useState<MeldungsListe | null>(null);
  const [dateiName, setDateiName] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const [schwelle, setSchwelle] = useState(SCHWELLE_VORGABE);
  const [ohneBetragMitnehmen, setOhneBetragMitnehmen] = useState(false);

  const nimmDatei = useCallback((dateien: File[]) => {
    const datei = dateien[0];
    if (!datei) return;
    setFehler(null);
    setDateiName(datei.name);
    void leseMeldungsListe(datei).then(e => {
      if (istLeseFehler(e)) { setListe(null); setFehler(e.fehler); return; }
      setListe(e);
    });
  }, []);

  const aufteilung: ZeilenAufteilung | null = liste ? teileZeilen(liste.zeilen, schwelle) : null;
  const zuPruefen = aufteilung
    ? [...aufteilung.zuPruefen, ...(ohneBetragMitnehmen ? aufteilung.ohneBetrag : [])]
    : [];

  return (
    <div className="flex w-full max-w-4xl flex-col gap-5">
      <FileDropZone onFiles={nimmDatei} accept=".xlsx" padding="px-6 py-8">
        <FileSpreadsheet size={22} className="text-[var(--tf-text-tertiary)]" />
        <span className="text-[13px] text-[var(--tf-text-secondary)]">
          {dateiName || 'Gemeldete Frühkoordinierungs-Liste hierher ziehen (.xlsx)'}
        </span>
        <span className="text-[12px] text-[var(--tf-text-tertiary)]">
          Erwartet werden die Spalten „Thema", „Aufgabenbeschreibung" und „Bundesmittel".
        </span>
      </FileDropZone>

      {fehler && (
        <div
          className="rounded-[var(--tf-radius)] px-3 py-2 text-[12.5px] text-[var(--tf-text)]"
          style={{ border: '0.5px solid var(--tf-border)', background: 'var(--tf-bg-secondary)' }}
        >
          {fehler}
        </div>
      )}

      {liste && aufteilung && (
        <>
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-[12px] text-[var(--tf-text-secondary)]">Zuwendung mindestens</span>
              <input
                type="number" min={0} step={10_000} value={schwelle}
                onChange={e => setSchwelle(Math.max(0, Number(e.target.value) || 0))}
                className="h-8 w-[140px] rounded-[8px] bg-[var(--tf-bg)] px-2 text-[13px] tabular-nums text-[var(--tf-text)]"
                style={{ border: '0.5px solid var(--tf-border)' }}
              />
            </label>
            <span className="pb-1.5 text-[12px] text-[var(--tf-text-tertiary)]">
              {EURO.format(schwelle)} · Blatt „{liste.blatt}" · {liste.zeilen.length} Zeilen gelesen
            </span>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <Gruppe titel="Wird geprüft" zeilen={aufteilung.zuPruefen} ton="an" />
            <Gruppe titel="Unter der Schwelle" zeilen={aufteilung.unterSchwelle} ton="aus" />
            <div className="flex flex-col gap-2">
              <Gruppe titel="Betrag nicht lesbar" zeilen={aufteilung.ohneBetrag} ton="aus" />
              {aufteilung.ohneBetrag.length > 0 && (
                <ToggleChip
                  label="trotzdem prüfen"
                  selected={ohneBetragMitnehmen}
                  onToggle={() => setOhneBetragMitnehmen(v => !v)}
                  title="Zeilen ohne lesbaren Betrag in die Prüfung aufnehmen"
                />
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[12px] text-[var(--tf-text-secondary)]">
              Verglichen wird gegen
            </span>
            <div className="flex flex-wrap gap-1.5">
              <ToggleChip
                label="Anträge der letzten 5 Jahre"
                selected={bereich.jahre !== null}
                onToggle={() => onBereich({ ...bereich, jahre: bereich.jahre === null ? 5 : null })}
                title="Antragsdatum ab heute minus fünf Jahre"
              />
              <ToggleChip
                label="FuE-Vorhaben, Netzwerke und Studien"
                selected={bereich.nurFueNetzwerkStudie}
                onToggle={() => onBereich({ ...bereich, nurFueNetzwerkStudie: !bereich.nurFueNetzwerkStudie })}
                title="Ohne Dienstleistungsvorhaben und Irrläufer"
              />
              <ToggleChip
                label="ohne abgelehnte und zurückgezogene"
                selected={bereich.ohneAbgelehnte}
                onToggle={() => onBereich({ ...bereich, ohneAbgelehnte: !bereich.ohneAbgelehnte })}
                title={'Der amtliche Endzustand „abgelehnt/zurückgezogen" bleibt draußen'}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="primary" icon={Play}
              disabled={laeuft || zuPruefen.length === 0}
              onClick={() => onStart(zuPruefen)}
            >
              {zuPruefen.length} Zeilen prüfen
            </Button>
            <button
              type="button"
              onClick={() => { setListe(null); setDateiName(''); setFehler(null); }}
              className="inline-flex h-8 items-center gap-1 rounded-[8px] px-2 text-[12.5px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer"
            >
              <X size={13} /> Andere Datei
            </button>
          </div>
        </>
      )}
    </div>
  );
}
