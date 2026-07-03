/**
 * Dialog-Orchestrierung der CSV-Sources-Seite (Konsolidierung 2026-07 aus
 * CsvSourcesPage.tsx extrahiert). Bündelt die fünf Dialoge (Wizard, Reimport,
 * Add-Columns, Remap, Detail) + ihre Verkettung (Reimport → Add-Columns,
 * Wizard → Reimport). Reine Präsentation/Verdrahtung; die Request-Zustände leben
 * im Container (CsvSourcesPage), damit auch die Liste + Datei-Picker sie setzen können.
 */
import type { CsvSchema } from '@/core/services/csv/types';
import { CsvSourceWizard } from './wizard/CsvSourceWizard';
import { CsvSourceReimportDialog } from './CsvSourceReimportDialog';
import { CsvAddColumnsDialog } from './CsvAddColumnsDialog';
import { RemapCsvColumnsDialog } from './RemapCsvColumnsDialog';
import { CsvSchemaDetailDialog } from './CsvSchemaDetailDialog';

export interface ReimportRequest {
  schema: CsvSchema;
  file: File;
  sourceHandle: FileSystemFileHandle | null;
  trigger: 'reselect' | 'auto-update';
}

export interface AddColumnsRequest {
  schema: CsvSchema;
  file: File;
  sourceHandle: FileSystemFileHandle | null;
  newColumns: string[];
}

export interface SourceModalsProps {
  programmId: string | null;
  wizardOpen: boolean;
  onCloseWizard: () => void;
  reimportRequest: ReimportRequest | null;
  setReimportRequest: (r: ReimportRequest | null) => void;
  addColumnsRequest: AddColumnsRequest | null;
  setAddColumnsRequest: (r: AddColumnsRequest | null) => void;
  remapSchema: CsvSchema | null;
  setRemapSchema: (s: CsvSchema | null) => void;
  detailSchema: CsvSchema | null;
  setDetailSchema: (s: CsvSchema | null) => void;
  /** Nach jedem erfolgreichen Dialog-Abschluss: Schema-Liste neu laden. */
  onRefresh: () => void;
}

export function SourceModals(props: SourceModalsProps): React.ReactElement {
  const {
    programmId, wizardOpen, onCloseWizard,
    reimportRequest, setReimportRequest,
    addColumnsRequest, setAddColumnsRequest,
    remapSchema, setRemapSchema,
    detailSchema, setDetailSchema,
    onRefresh,
  } = props;

  return (
    <>
      {programmId ? (
        <CsvSourceWizard
          open={wizardOpen}
          onClose={onCloseWizard}
          programmId={programmId}
          onCompleted={onRefresh}
          onUseExistingSchema={(schema, file) => setReimportRequest({
            schema,
            file,
            sourceHandle: null,
            trigger: 'reselect',
          })}
        />
      ) : null}

      {reimportRequest ? (
        <CsvSourceReimportDialog
          schema={reimportRequest.schema}
          file={reimportRequest.file}
          sourceHandle={reimportRequest.sourceHandle}
          trigger={reimportRequest.trigger}
          onClose={() => setReimportRequest(null)}
          onCompleted={onRefresh}
          onAddNewColumns={newColumns => {
            setAddColumnsRequest({
              schema: reimportRequest.schema,
              file: reimportRequest.file,
              sourceHandle: reimportRequest.sourceHandle,
              newColumns,
            });
            setReimportRequest(null);
          }}
        />
      ) : null}

      {addColumnsRequest ? (
        <CsvAddColumnsDialog
          schema={addColumnsRequest.schema}
          file={addColumnsRequest.file}
          sourceHandle={addColumnsRequest.sourceHandle}
          newColumns={addColumnsRequest.newColumns}
          onClose={() => setAddColumnsRequest(null)}
          onCompleted={onRefresh}
        />
      ) : null}

      {remapSchema ? (
        <RemapCsvColumnsDialog
          schema={remapSchema}
          onClose={() => setRemapSchema(null)}
          onCompleted={onRefresh}
        />
      ) : null}

      {detailSchema ? (
        <CsvSchemaDetailDialog
          schema={detailSchema}
          onClose={() => setDetailSchema(null)}
          onSaved={onRefresh}
        />
      ) : null}
    </>
  );
}
