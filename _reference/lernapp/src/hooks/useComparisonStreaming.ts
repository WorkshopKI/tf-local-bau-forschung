/**
 * Shared streaming logic for model comparison views.
 * Encapsulates accumulator refs, abort controllers, done-counting,
 * budget exhaustion handling, and stop-all logic.
 */
import { useRef, useState, useCallback } from "react";
import { streamChat } from "@/services/llmService";
import type { Msg } from "@/types";
import { toast } from "sonner";

export interface StreamSlot {
  model: string;
  messages: Msg[];
  /** Label for error messages, e.g. "Modell A" */
  label: string;
  /** Called on every delta and on completion (streaming=false) */
  onUpdate: (content: string, streaming: boolean) => void;
}

interface UseComparisonStreamingOptions {
  onBudgetExhausted: () => void;
}

export function useComparisonStreaming({ onBudgetExhausted }: UseComparisonStreamingOptions) {
  const [isRunning, setIsRunning] = useState(false);
  const abortControllers = useRef<AbortController[]>([]);
  const doneCount = useRef(0);
  const accumulators = useRef<string[]>([]);

  const streamAll = useCallback((
    slots: StreamSlot[],
    options?: { reasoning?: { effort: string }; onAllDone?: () => void },
  ) => {
    if (isRunning) return;

    const total = slots.length;
    setIsRunning(true);
    doneCount.current = 0;
    accumulators.current = slots.map(() => "");
    abortControllers.current = slots.map(() => new AbortController());

    const markDone = () => {
      doneCount.current++;
      if (doneCount.current >= total) {
        setIsRunning(false);
        options?.onAllDone?.();
      }
    };

    slots.forEach((slot, i) => {
      streamChat({
        messages: slot.messages,
        model: slot.model,
        reasoning: options?.reasoning,
        signal: abortControllers.current[i].signal,
        onDelta: (text) => {
          accumulators.current[i] += text;
          slot.onUpdate(accumulators.current[i], true);
        },
        onDone: () => {
          slot.onUpdate(accumulators.current[i], false);
          markDone();
        },
        onError: (error, status) => {
          if (status === 402 || error === "budget_exhausted") {
            onBudgetExhausted();
          } else {
            toast.error(`${slot.label}: ${error}`);
          }
          slot.onUpdate(accumulators.current[i], false);
          markDone();
        },
      });
    });
  }, [isRunning, onBudgetExhausted]);

  const stopAll = useCallback(() => {
    abortControllers.current.forEach((ac) => ac.abort());
    setIsRunning(false);
  }, []);

  /** Get accumulated content for slot at index */
  const getContent = useCallback((index: number) => accumulators.current[index] ?? "", []);

  return { streamAll, stopAll, isRunning, getContent };
}
