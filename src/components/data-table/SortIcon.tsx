/**
 * Pfeil-Indikator fuer sortierbare Tabellen-Header.
 *  - inaktiv: ↕ (ArrowUpDown, tertiary-Farbe)
 *  - asc:    ↑ (ArrowUp, primary-Text-Farbe)
 *  - desc:   ↓ (ArrowDown, primary-Text-Farbe)
 */
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { SortDirection } from './types';

export interface SortIconProps {
  active: boolean;
  direction: SortDirection;
  size?: number;
}

export function SortIcon({ active, direction, size = 11 }: SortIconProps): React.ReactElement {
  if (!active) {
    return <ArrowUpDown size={size} style={{ color: 'var(--tf-text-tertiary)' }} />;
  }
  return direction === 'asc'
    ? <ArrowUp size={size} style={{ color: 'var(--tf-text)' }} />
    : <ArrowDown size={size} style={{ color: 'var(--tf-text)' }} />;
}
