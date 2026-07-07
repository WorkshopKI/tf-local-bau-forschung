// Datei-Typ-Icon (v2.199.1): wählt anhand der Dateiendung das passende lucide-Icon
// (aus FEEDBACK_FILE_TYPES). Fallback: generisches File-Icon.

import { File, FileSpreadsheet, FileText, Presentation } from 'lucide-react';
import { feedbackFileTypeForName } from './feedbackAttachments';

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  FileText,
  FileSpreadsheet,
  Presentation,
  File,
};

interface Props {
  name: string;
  size?: number;
  className?: string;
}

export function FileTypeIcon({ name, size = 15, className }: Props): React.ReactElement {
  const iconName = feedbackFileTypeForName(name)?.icon ?? 'File';
  const Icon = ICONS[iconName] ?? File;
  return <Icon size={size} className={className} />;
}
