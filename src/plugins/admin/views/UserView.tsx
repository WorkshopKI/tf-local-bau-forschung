interface UserViewProps {
  chunkCount: number;
  docCount: number;
  lastUpdate: string | null;
  activeModelLabel: string;
  hasGPU: boolean;
  fsConnected: boolean;
  ampelColor: string;
  qualityPct: number | null;
  metadataLLMLabel: string;
  smokeTestScore: number | null;
}

function StatBox({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex-1 bg-[var(--tf-bg-secondary)] rounded-[var(--tf-radius)] p-3.5">
      {children}
    </div>
  );
}

function Dot({ active }: { active: boolean }): React.ReactElement {
  return (
    <span className={`inline-block w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-[var(--tf-text-tertiary)]'}`} />
  );
}

function DetailRow({ label, value, dot }: { label: string; value: string; dot?: boolean }): React.ReactElement {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="flex items-center gap-2 text-[12px] text-[var(--tf-text-secondary)]">
        {dot !== undefined && <Dot active={dot} />}
        {label}
      </span>
      <span className="text-[12px] text-[var(--tf-text)]">{value}</span>
    </div>
  );
}

export function UserView({
  chunkCount, docCount, lastUpdate, activeModelLabel,
  hasGPU, fsConnected, ampelColor, qualityPct,
  metadataLLMLabel, smokeTestScore,
}: UserViewProps): React.ReactElement {
  const hasIndex = chunkCount > 0;
  const updateStr = lastUpdate
    ? new Date(lastUpdate).toLocaleDateString('de-DE')
    : '\u2014';

  const searchValue = hasIndex ? 'BM25 + Vektor + Hybrid' : 'Inaktiv';

  const metadataValue = metadataLLMLabel === 'Kein LLM (regelbasiert)' || metadataLLMLabel === 'Kein LLM'
    ? 'Kein LLM'
    : smokeTestScore !== null
      ? `${metadataLLMLabel.split('(')[0]?.trim()} \u00b7 \u00d8 ${smokeTestScore}`
      : metadataLLMLabel.split('(')[0]?.trim() ?? metadataLLMLabel;

  return (
    <div className="space-y-5">
      {/* Stat Boxes */}
      <div className="flex gap-2.5">
        <StatBox>
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full ${ampelColor}`} />
            <span className="text-[13px] font-medium text-[var(--tf-text)]">
              {hasIndex ? 'Aktuell' : 'Leer'}
            </span>
          </div>
          <span className="text-[11px] text-[var(--tf-text-tertiary)]">Index-Status</span>
        </StatBox>
        <StatBox>
          <p className="text-[18px] font-medium text-[var(--tf-text)] mb-0.5">{chunkCount}</p>
          <span className="text-[11px] text-[var(--tf-text-tertiary)]">Textabschnitte</span>
        </StatBox>
        <StatBox>
          <p className="text-[18px] font-medium text-[var(--tf-text)] mb-0.5">{docCount}</p>
          <span className="text-[11px] text-[var(--tf-text-tertiary)]">Dokumente</span>
        </StatBox>
        <StatBox>
          <p className="text-[18px] font-medium text-[var(--tf-text)] mb-0.5">
            {qualityPct !== null ? `${qualityPct}%` : '\u2014'}
          </p>
          <span className="text-[11px] text-[var(--tf-text-tertiary)]">Suchqualitaet</span>
        </StatBox>
      </div>

      {/* Detail Grid */}
      <div className="grid grid-cols-2 gap-x-6 py-3"
        style={{ borderTop: '0.5px solid var(--tf-border)', borderBottom: '0.5px solid var(--tf-border)' }}>
        <div>
          <DetailRow label="Datenserver" value={fsConnected ? 'Verbunden' : 'Nicht verbunden'} dot={fsConnected} />
          <DetailRow label="Suche" value={searchValue} dot={hasIndex} />
          <DetailRow label="Metadata-KI" value={metadataValue} />
        </div>
        <div style={{ borderLeft: '0.5px solid var(--tf-border)', paddingLeft: '1.5rem' }}>
          <DetailRow label="Modell" value={activeModelLabel} />
          <DetailRow label="Backend" value={hasGPU ? 'WebGPU' : 'CPU'} />
          <DetailRow label="Letztes Update" value={updateStr} />
        </div>
      </div>

      {/* Hint */}
      <p className="text-[11px] text-[var(--tf-text-tertiary)] text-center">
        {'Fuer Verwaltung \u2192 Tab \u201eVerwaltung\u201c'}
      </p>
    </div>
  );
}
