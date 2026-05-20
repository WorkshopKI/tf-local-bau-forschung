import type { Document } from '@/plugins/dokumente/store';

// Formblätter (6)
import { doc as doc001 } from './docs/bau-001-formular-ba001';
import { doc as doc002 } from './docs/bau-002-formular-ba002';
import { doc as doc003 } from './docs/bau-003-formular-ba008';
import { doc as doc004 } from './docs/bau-004-formular-ba012';
import { doc as doc005 } from './docs/bau-005-formular-ba018';
import { doc as doc006 } from './docs/bau-006-formular-ba024';

// Statik/Tragwerk (6)
import { doc as doc007 } from './docs/bau-007-statik-ba002';
import { doc as doc008 } from './docs/bau-008-statik-ba004';
import { doc as doc009 } from './docs/bau-009-statik-ba010';
import { doc as doc010 } from './docs/bau-010-statik-ba011';
import { doc as doc011 } from './docs/bau-011-statik-ba016';
import { doc as doc012 } from './docs/bau-012-statik-ba024';

// Brandschutz (5)
import { doc as doc013 } from './docs/bau-013-brandschutz-ba002';
import { doc as doc014 } from './docs/bau-014-brandschutz-ba006';
import { doc as doc015 } from './docs/bau-015-brandschutz-ba012';
import { doc as doc016 } from './docs/bau-016-brandschutz-ba013';
import { doc as doc017 } from './docs/bau-017-brandschutz-ba018';

// Schallschutz (3)
import { doc as doc018 } from './docs/bau-018-schallschutz-ba002';
import { doc as doc019 } from './docs/bau-019-schallschutz-ba011';
import { doc as doc020 } from './docs/bau-020-schallschutz-ba013';

// Energienachweis (4)
import { doc as doc021 } from './docs/bau-021-energie-ba001';
import { doc as doc022 } from './docs/bau-022-energie-ba002';
import { doc as doc023 } from './docs/bau-023-energie-ba009';
import { doc as doc024 } from './docs/bau-024-energie-ba014';

// Stellungnahmen (5)
import { doc as doc025 } from './docs/bau-025-stellungnahme-ba002';
import { doc as doc026 } from './docs/bau-026-stellungnahme-ba005';
import { doc as doc027 } from './docs/bau-027-stellungnahme-ba021';
import { doc as doc028 } from './docs/bau-028-stellungnahme-ba019';
import { doc as doc029 } from './docs/bau-029-stellungnahme-ba020';

// Gutachten Spezial (4)
import { doc as doc030 } from './docs/bau-030-altlasten-ba006';
import { doc as doc031 } from './docs/bau-031-hydrogeologie-ba010';
import { doc as doc032 } from './docs/bau-032-mobilitaet-ba016';
import { doc as doc033 } from './docs/bau-033-artenschutz-ba019';

// Nachforderungen (2)
import { doc as doc034 } from './docs/bau-034-nachforderung-ba004';
import { doc as doc035 } from './docs/bau-035-nachforderung-ba017';

// Forschungs-Dokumente (forschung-001..025) wurden entfernt — gehoerten zum
// alten Forschungs-Demo-Modell, werden vom Real-Fixtures-Loader
// (`src/core/services/seed/fixture-loader.ts`) abgeloest.

export const allDokumente: Document[] = [
  doc001, doc002, doc003, doc004, doc005, doc006,
  doc007, doc008, doc009, doc010, doc011, doc012,
  doc013, doc014, doc015, doc016, doc017,
  doc018, doc019, doc020,
  doc021, doc022, doc023, doc024,
  doc025, doc026, doc027, doc028, doc029,
  doc030, doc031, doc032, doc033,
  doc034, doc035,
];
