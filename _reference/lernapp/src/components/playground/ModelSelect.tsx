import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  STANDARD_MODELS,
  PREMIUM_MODELS,
  OPEN_SOURCE_MODELS,
  getAllModels,
} from "@/data/models";

/** Wiederverwendbare Modell-Gruppen (Standard / Premium / Open Source / Eigene).
 *  Wird in PlaygroundHeader und ComparisonView geteilt — Änderungen an der
 *  Modell-Liste müssen nur hier angepasst werden. */
export function ModelSelectGroups() {
  const custom = getAllModels().filter((m) => m.isCustom);
  return (
    <>
      <SelectGroup>
        <SelectLabel>Standard</SelectLabel>
        {STANDARD_MODELS.map((m) => (
          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
        ))}
      </SelectGroup>
      <SelectSeparator />
      <SelectGroup>
        <SelectLabel>Premium</SelectLabel>
        {PREMIUM_MODELS.map((m) => (
          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
        ))}
      </SelectGroup>
      <SelectSeparator />
      <SelectGroup>
        <SelectLabel>Open Source</SelectLabel>
        {OPEN_SOURCE_MODELS.map((m) => (
          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
        ))}
      </SelectGroup>
      {custom.length > 0 && (
        <>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Eigene</SelectLabel>
            {custom.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectGroup>
        </>
      )}
    </>
  );
}

interface ModelSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  triggerClassName?: string;
}

/** Kompletter Model-Selector mit Trigger + Dropdown. */
export function ModelSelect({ value, onValueChange, disabled, triggerClassName = "text-xs" }: ModelSelectProps) {
  return (
    <div data-feedback-ref="prompt-labor.modell-auswahl" data-feedback-label="Modell-Auswahl">
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className={triggerClassName}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <ModelSelectGroups />
        </SelectContent>
      </Select>
    </div>
  );
}
