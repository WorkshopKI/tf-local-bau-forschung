import { createContext, useContext } from 'react';
import { AIBridge } from '@/core/services/ai/bridge';

export const AIBridgeContext = createContext<AIBridge | null>(null);

export function useAIBridge(): AIBridge {
  const ctx = useContext(AIBridgeContext);
  if (!ctx) throw new Error('useAIBridge must be used within AIBridgeProvider');
  return ctx;
}
