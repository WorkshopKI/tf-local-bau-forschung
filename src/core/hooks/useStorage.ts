import { createContext, useContext } from 'react';
import { StorageService } from '@/core/services/storage';

export const StorageContext = createContext<StorageService | null>(null);

export function useStorage(): StorageService {
  const ctx = useContext(StorageContext);
  if (!ctx) throw new Error('useStorage must be used within StorageProvider');
  return ctx;
}
