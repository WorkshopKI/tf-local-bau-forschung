// Re-Export-Shim (P1b): `src/ui/` ist nur noch ein Kompatibilitäts-Barrel.
// Einzige UI-Bibliothek = `src/components/ui/`. Neuer Code importiert direkt
// `@/components/ui/*`. Lokal bleiben hier nur der Dialog-Adapter und (vorerst,
// STOPP #2) der TF-Select.
export { Button } from '@/components/ui/button';
export { Card } from '@/components/ui/card';
export { Input } from '@/components/ui/input';
export { Dialog } from './Dialog';
export { Badge } from '@/components/ui/badge';
export { Tabs } from '@/components/ui/tabs';
export { Select } from './Select';
export { FileDropZone } from '@/components/ui/FileDropZone';
export { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
export { SectionHeader } from '@/components/ui/SectionHeader';
export { ListItem } from '@/components/ui/ListItem';
export { RowAction } from '@/components/ui/RowAction';
export { TagInput } from '@/components/ui/TagInput';
export { Field } from '@/components/ui/Field';
export { CollapsibleSection } from '@/components/ui/CollapsibleSection';
export { ProgressBar } from '@/components/ui/ProgressBar';
export { Tooltip } from '@/components/ui/Tooltip';
export { SegmentedToggle } from '@/components/ui/SegmentedToggle';
export type { SegmentedToggleOption } from '@/components/ui/SegmentedToggle';
