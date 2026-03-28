import type { Document } from '@/plugins/dokumente/store';
import { bauDokumente1 } from './dokumente-bau-1';
import { bauDokumente2 } from './dokumente-bau-2';
import { forschungDokumente } from './dokumente-forschung';

export const allDokumente: Document[] = [
  ...bauDokumente1,
  ...bauDokumente2,
  ...forschungDokumente,
];
