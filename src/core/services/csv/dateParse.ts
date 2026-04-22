export function parseGermanDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  // DD.MM.YYYY or DD.MM.YY
  const dmy = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
  if (dmy && dmy[1] && dmy[2] && dmy[3]) {
    const day = parseInt(dmy[1], 10);
    const month = parseInt(dmy[2], 10);
    let year = parseInt(dmy[3], 10);
    if (dmy[3].length === 2) year = year < 70 ? 2000 + year : 1900 + year;
    return toIsoDate(year, month, day);
  }

  // YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso && iso[1] && iso[2] && iso[3]) {
    return toIsoDate(parseInt(iso[1], 10), parseInt(iso[2], 10), parseInt(iso[3], 10));
  }

  // ISO datetime (e.g. "2026-04-19T03:00:00")
  const isoDt = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})T/);
  if (isoDt && isoDt[1] && isoDt[2] && isoDt[3]) {
    return toIsoDate(parseInt(isoDt[1], 10), parseInt(isoDt[2], 10), parseInt(isoDt[3], 10));
  }

  return null;
}

function toIsoDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

export function formatGermanDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]}`;
}
