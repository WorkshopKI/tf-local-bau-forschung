// Deterministischer Generator für einen realistischen Performance-Test-Korpus.
// 5000 Anträge in stammdaten-big, 3000 Deskriptor-Zeilen.

const ANTRAGSTELLER = [
  'Müller GmbH',
  'Huber AG',
  'Schmidt KG',
  'Bau-Kollektiv eG',
  'Stadtwerke Süd',
  'TechNova AG',
  'ÖkoBau GmbH',
  'Fertigbau Nord GmbH',
  'Planwerk GmbH',
  'Netzwerk-Institut',
  'Grünbau AG',
  'Hydro Consulting',
  'Mobility Labs',
  'Klima-Service GmbH',
  'AgriTech eG',
];

const STATUS_WEIGHTS: [string, number][] = [
  ['bewilligt', 0.60],
  ['in_pruefung', 0.20],
  ['abgelehnt', 0.15],
  ['zurueckgezogen', 0.05],
];

const AKRONYM_PARTS_A = [
  'SMART', 'GREEN', 'ENERGY', 'URBAN', 'CIRCLE', 'LOW', 'HEAT', 'GRID', 'AGRI',
  'MOB', 'DIGITAL', 'RESIL', 'WATER', 'SOLAR', 'WIND', 'BIO', 'ECO', 'CYBER',
  'NET', 'FLEX', 'ZUKUNFT', 'KLIMA', 'BAU', 'PLAN', 'STADT',
];
const AKRONYM_PARTS_B = [
  'CITY', 'MOBILITY', 'PLUS', 'GREEN', 'BUILD', 'CARBON', 'PUMP', 'FLEX',
  'VOLT', 'FUTURE', 'PLAN', 'NET', 'SMART', 'FACADE', 'HAUS', 'WOHNEN',
  'NETZ', 'CONNECT', 'HUB', 'MAP',
];

const TITEL_TEMPLATES = [
  '{A} für urbane Infrastruktur',
  '{A} im Quartierskontext',
  '{A}-Forschung und Pilot',
  '{A} Integration Stadtplanung',
  'Nachhaltige {A}-Systeme',
  '{A}-Retrofit im Bestand',
  'Modulare {A}-Konzepte',
  '{A} für Mittelstadt-Anwendung',
  'Skalierbares {A}-Netzwerk',
  '{A} Pilotanlage mit Monitoring',
];

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function pickWeighted(rand: () => number, table: [string, number][]): string {
  const r = rand();
  let acc = 0;
  for (const [v, w] of table) {
    acc += w;
    if (r < acc) return v;
  }
  const last = table[table.length - 1];
  return last ? last[0] : '';
}

function pick<T>(rand: () => number, arr: T[]): T {
  const v = arr[Math.floor(rand() * arr.length)];
  if (v === undefined) throw new Error('pick: empty array');
  return v;
}

// Gauss-ähnliche Auswahl für Antragsteller (manche viel häufiger)
function pickGauss(rand: () => number, arr: string[]): string {
  // Box-Muller-ish: zwei uniform → bias auf mitte
  const r = (rand() + rand() + rand()) / 3;
  const idx = Math.min(arr.length - 1, Math.floor(r * arr.length));
  return arr[idx] ?? '';
}

function randomDate(rand: () => number, yearRange: [number, number]): string {
  const yearSpan = yearRange[1] - yearRange[0];
  // Ungleichmäßige Jahres-Verteilung: quadratisch zu den neueren Jahren tendieren
  const biased = rand() * rand(); // mehr Masse bei kleinen Werten
  const year = yearRange[0] + Math.floor((1 - biased) * (yearSpan + 1));
  const month = 1 + Math.floor(rand() * 12);
  const day = 1 + Math.floor(rand() * 28);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function esc(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function generateBigStammdaten(rowCount = 5000): string {
  const rand = lcg(0xC0FFEE);
  const header = 'AKZ_LFD,PROJ_KURZ,TITEL,ANTRAGSTELLER,STATUS_FLG,VB_NR,BEW_DAT,EXPORT_TS';
  const lines: string[] = [header];

  // 800 Verbünde mit je 2-8 Teilanträgen + Rest Einzel
  // Verbund-Anträge insgesamt: ~800 × 4 = 3200
  // Einzel: ~1800
  const totalVerbundAntraege = 3200;
  const verbundCount = 800;

  // Build Verbund-Sequenz
  interface VbEntry { vb: string; akronym: string; size: number; assigned: number; }
  const verbuende: VbEntry[] = [];
  for (let i = 0; i < verbundCount; i++) {
    const size = 2 + Math.floor(rand() * 7); // 2-8
    const akro = `${pick(rand, AKRONYM_PARTS_A)}-${pick(rand, AKRONYM_PARTS_B)}-${i}`;
    verbuende.push({
      vb: `VB-${2015 + Math.floor(rand() * 11)}-${String(100 + i).padStart(4, '0')}`,
      akronym: akro,
      size,
      assigned: 0,
    });
  }

  let vbLeft = totalVerbundAntraege;
  let singleLeft = rowCount - totalVerbundAntraege;
  if (singleLeft < 0) singleLeft = 0;

  for (let i = 1; i <= rowCount; i++) {
    const az = `FKZ-BIG-${String(i).padStart(6, '0')}`;
    let vbNr = '';
    let akronym = '';

    // Decide: verbund or single
    const total = vbLeft + singleLeft;
    const wantVb = total > 0 && rand() < vbLeft / total;

    if (wantVb && vbLeft > 0) {
      // Find a verbund with capacity
      for (let tries = 0; tries < 10; tries++) {
        const cand = verbuende[Math.floor(rand() * verbuende.length)];
        if (cand && cand.assigned < cand.size) {
          cand.assigned++;
          vbNr = cand.vb;
          akronym = cand.akronym;
          vbLeft--;
          break;
        }
      }
      if (!vbNr) {
        // Fallback: single
        singleLeft--;
        akronym = `${pick(rand, AKRONYM_PARTS_A)}-${pick(rand, AKRONYM_PARTS_B)}-${i}`;
      }
    } else {
      singleLeft--;
      akronym = `${pick(rand, AKRONYM_PARTS_A)}-${pick(rand, AKRONYM_PARTS_B)}-${i}`;
    }

    const status = pickWeighted(rand, STATUS_WEIGHTS);
    const titelTemplate = pick(rand, TITEL_TEMPLATES);
    const titel = titelTemplate.replace('{A}', akronym);
    const antragsteller = pickGauss(rand, ANTRAGSTELLER);
    const bewDat = status === 'bewilligt' ? randomDate(rand, [2015, 2026]) : '';
    const exportTs = '2026-04-19T03:00:00';

    lines.push([az, akronym, titel, antragsteller, status, vbNr, bewDat, exportTs].map(esc).join(','));
  }

  return lines.join('\n') + '\n';
}

export function generateBigDeskriptoren(rowCount = 3000): string {
  const rand = lcg(0xBADF00D);
  const header = 'AKRONYM,THEMA_URBAN,THEMA_ENERGIE,THEMA_MOBILITAET,THEMA_DIGITAL,THEMA_KLIMA,DESKRIPTOR_INNOVATION,DESKRIPTOR_FORSCHUNG,NOTIZ';
  const lines: string[] = [header];

  // Generate unique akronyms (Teilmenge der Stammdaten)
  // Diese Korrelieren nicht 1:1, aber das ist OK — Filter-Logik soll auch mit "leeren"
  // Joins umgehen können.
  const notizen = [
    'Gutachter-Hinweis zur Ressourcen-Effizienz',
    'Teilaspekt im Kontext urbaner Transformation',
    'Hohe Relevanz für Förderprioritäten 2024+',
    '',
    '',
    'Antrag mit Pilotcharakter',
    '',
    'Skalierungs-Potenzial im Programm identifiziert',
    '',
  ];

  for (let i = 1; i <= rowCount; i++) {
    const akronym = `${pick(rand, AKRONYM_PARTS_A)}-${pick(rand, AKRONYM_PARTS_B)}-${i}`;
    // 10-20% ja, 80-90% nein
    const jaN = () => (rand() < 0.15 ? 'ja' : 'nein');
    lines.push([
      akronym,
      jaN(),
      jaN(),
      jaN(),
      jaN(),
      jaN(),
      jaN(),
      jaN(),
      pick(rand, notizen),
    ].map(esc).join(','));
  }
  return lines.join('\n') + '\n';
}
