/**
 * Projekt-Canvas: 3×3-Raster mit Leitfragen.
 *
 * Deterministische Felder (Arbeitsplan, Budget, Antragsteller, Schutzrechte)
 * kommen aus dem Strukturmodell, die vier Textfelder aus dem Extraktions-Lauf.
 * Als „vage" oder „fehlt" gekennzeichnete Felder werden amber und gestrichelt
 * dargestellt — die Lücke ist das Prüfergebnis, nicht ein Darstellungsproblem.
 *
 * Rein darstellend.
 */
import type { Belegtheit, CanvasFeld, CanvasTexte } from '../infografik/schema';
import type { MapEinreichung } from '../types';

const RAHMEN: Record<Belegtheit, React.CSSProperties> = {
  belegt: { border: '0.5px solid var(--tf-border)' },
  vage: { border: '1px dashed var(--tf-warning, #f59e0b)' },
  fehlt: { border: '1px dashed var(--tf-warning, #f59e0b)' },
};

const LEER_TEXT: Record<Belegtheit, string> = {
  belegt: '',
  vage: 'In der Vorhabensbeschreibung nur vage beschrieben.',
  fehlt: 'In der Vorhabensbeschreibung nicht belegt.',
};

function Zelle({ titel, frage, children, stil }: {
  titel: string; frage?: string; children: React.ReactNode; stil?: React.CSSProperties;
}): React.ReactElement {
  return (
    <div
      className="rounded-[var(--tf-radius-md,8px)] px-3 py-2.5 flex flex-col gap-1 min-h-[110px]"
      style={stil ?? { border: '0.5px solid var(--tf-border)' }}
    >
      <p className="text-[11.5px] font-medium text-[var(--tf-text)] uppercase tracking-wide">{titel}</p>
      {frage != null && (
        <p className="text-[10.5px] text-[var(--tf-text-tertiary)] leading-snug">{frage}</p>
      )}
      <div className="text-[12px] text-[var(--tf-text-secondary)] leading-relaxed mt-0.5">
        {children}
      </div>
    </div>
  );
}

function TextZelle({ titel, frage, feld }: {
  titel: string; frage: string; feld: CanvasFeld;
}): React.ReactElement {
  return (
    <Zelle titel={titel} frage={frage} stil={RAHMEN[feld.belegtheit]}>
      {feld.belegtheit === 'fehlt' || feld.text.length === 0 ? (
        <em style={{ color: 'var(--tf-warning, #f59e0b)' }}>{LEER_TEXT[feld.belegtheit] || LEER_TEXT.fehlt}</em>
      ) : (
        <>
          {feld.text}
          {feld.belegtheit === 'vage' && (
            <span className="block mt-1 text-[11px]" style={{ color: 'var(--tf-warning, #f59e0b)' }}>
              nur vage belegt
            </span>
          )}
          {feld.sektionIds.length > 0 && (
            <span className="block mt-1 text-[10.5px] text-[var(--tf-text-tertiary)]">
              Fundstelle: {feld.sektionIds.join(', ')}
            </span>
          )}
        </>
      )}
    </Zelle>
  );
}

const euro = (n: number | null): string =>
  n === null ? '—' : `${n.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`;

export function ProjektCanvas({
  einreichung, texte,
}: {
  einreichung: MapEinreichung;
  texte: CanvasTexte | null;
}): React.ReactElement {
  const leer: CanvasFeld = { text: '', sektionIds: [], belegtheit: 'fehlt' };
  const t = texte ?? {
    problemSdt: leer, innovation: leer, technischesRisiko: leer, marktVerwertung: leer,
  };

  const gesetzteMerkmale = einreichung.merkmale.technologieneuerung.filter(m => m.gesetzt);
  const patente = einreichung.merkmale.patentsituation.filter(m => m.gesetzt);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
      <TextZelle
        titel="Problem & Stand der Technik"
        frage="Welches Problem wird gelöst, was ist heute möglich?"
        feld={t.problemSdt}
      />
      <TextZelle
        titel="Innovation"
        frage="Was ist neu gegenüber dem Bestehenden?"
        feld={t.innovation}
      />
      <TextZelle
        titel="Technisches Risiko"
        frage="Welche Entwicklungshürden bestehen?"
        feld={t.technischesRisiko}
      />

      <Zelle titel="Arbeitsplan" frage="Wie ist das Vorhaben gegliedert?">
        <ul className="flex flex-col gap-0.5">
          {einreichung.arbeitspakete.slice(0, 6).map(ap => (
            <li key={`${ap.laufnummer}-${ap.name}`} className="flex justify-between gap-2">
              <span className="truncate">{ap.name}</span>
              <span className="tabular-nums shrink-0 text-[var(--tf-text-tertiary)]">
                {ap.aufwandPm ?? '—'} PM
              </span>
            </li>
          ))}
          {einreichung.arbeitspakete.length > 6 && (
            <li className="text-[var(--tf-text-tertiary)]">
              … {einreichung.arbeitspakete.length - 6} weitere
            </li>
          )}
        </ul>
      </Zelle>

      <Zelle titel="Budget" frage="Was kostet es, was wird beantragt?">
        <p>Gesamt {euro(einreichung.kosten.gesamt)}</p>
        <p>Zuwendung {euro(einreichung.kosten.beantragteZuwendung)}</p>
        <p className="text-[var(--tf-text-tertiary)]">
          {einreichung.laufzeit.monate ?? '—'} Monate ·{' '}
          {einreichung.summen.personenmonateEinsatz ?? '—'} PM
        </p>
      </Zelle>

      <Zelle titel="Antragsteller" frage="Wer entwickelt?">
        {einreichung.antragsteller.kurzprofil === null
          ? <em className="text-[var(--tf-text-tertiary)]">Kein Kurzprofil hinterlegt.</em>
          : (
            <span>
              {einreichung.antragsteller.kurzprofil.length > 220
                ? `${einreichung.antragsteller.kurzprofil.slice(0, 219)}…`
                : einreichung.antragsteller.kurzprofil}
            </span>
          )}
      </Zelle>

      <TextZelle
        titel="Markt & Verwertung"
        frage="Welche Märkte, wie wird verwertet?"
        feld={t.marktVerwertung}
      />

      <Zelle titel="Schutzrechte" frage="Was ist zur Patentsituation angegeben?">
        {patente.length === 0
          ? <em className="text-[var(--tf-text-tertiary)]">Keine Angabe gesetzt.</em>
          : (
            <ul className="flex flex-col gap-0.5">
              {patente.map(p => <li key={p.key}>{p.label}</li>)}
            </ul>
          )}
      </Zelle>

      <Zelle titel="Innovationstyp" frage="Wie ordnet der Antragsteller ein?">
        {gesetzteMerkmale.length === 0
          ? <em className="text-[var(--tf-text-tertiary)]">Keine Angabe gesetzt.</em>
          : (
            <ul className="flex flex-col gap-0.5">
              {gesetzteMerkmale.map(m => <li key={m.key}>{m.label}</li>)}
            </ul>
          )}
      </Zelle>
    </div>
  );
}
