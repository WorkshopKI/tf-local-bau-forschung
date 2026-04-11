import { useState, useEffect, useRef, useCallback } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { applyTransition } from '@/core/services/workflow/engine';
import { loadHistory, addHistoryEntry } from '@/core/services/workflow/history';
import { getDaysUntilDeadline, isOverdue } from '@/core/services/workflow/deadlines';
import type { Vorgang } from '@/core/types/vorgang';
import type { HistoryEntry } from '@/core/services/workflow/history';
import type { StorageService } from '@/core/services/storage';

interface UseVorgangDetailParams {
  vorgang: Vorgang | undefined;
  update: (vorgang: any, storage: StorageService) => Promise<void>;
}

interface UseVorgangDetailReturn {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  showForm: boolean;
  setShowForm: (show: boolean) => void;
  showDelete: boolean;
  setShowDelete: (show: boolean) => void;
  notes: string;
  saved: boolean;
  history: HistoryEntry[];
  handleNotesChange: (value: string) => void;
  handleStatusChange: (targetStatus: string, comment?: string) => Promise<void>;
  daysLeft: number | null;
  overdue: boolean;
}

export function useVorgangDetail({ vorgang, update }: UseVorgangDetailParams): UseVorgangDetailReturn {
  const storage = useStorage();
  const [activeTab, setActiveTab] = useState('uebersicht');
  const [showForm, setShowForm] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (vorgang) { setNotes(vorgang.notes); loadHistory(vorgang.id, storage).then(setHistory); }
  }, [vorgang, storage]);

  const handleNotesChange = useCallback((value: string) => {
    setNotes(value); setSaved(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      if (vorgang) { await update({ ...vorgang, notes: value }, storage); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    }, 1000);
  }, [vorgang, update, storage]);

  const handleStatusChange = useCallback(async (targetStatus: string, comment?: string): Promise<void> => {
    if (!vorgang) return;
    const { vorgang: updated, entry } = applyTransition(vorgang, targetStatus, '', comment);
    await update(updated, storage);
    await addHistoryEntry(vorgang.id, entry, storage);
    setHistory(prev => [entry, ...prev]);
  }, [vorgang, update, storage]);

  const daysLeft = vorgang ? getDaysUntilDeadline(vorgang) : null;
  const overdue = vorgang ? isOverdue(vorgang) : false;

  return {
    activeTab, setActiveTab, showForm, setShowForm, showDelete, setShowDelete,
    notes, saved, history, handleNotesChange, handleStatusChange, daysLeft, overdue,
  };
}
