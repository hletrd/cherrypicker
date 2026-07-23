export interface SupportedStatementFormat {
  label: string;
  extensions: readonly string[];
  mimeTypes: readonly string[];
}

export const SUPPORTED_STATEMENT_FORMATS = [
  { label: 'CSV/TSV', extensions: ['.csv', '.tsv'], mimeTypes: ['text/csv', 'text/tab-separated-values'] },
  {
    label: 'Excel',
    extensions: ['.xlsx', '.xls'],
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ],
  },
  { label: 'PDF', extensions: ['.pdf'], mimeTypes: ['application/pdf'] },
  { label: 'JSON', extensions: ['.json'], mimeTypes: ['application/json'] },
  { label: 'OFX/QFX', extensions: ['.ofx', '.qfx'], mimeTypes: ['application/ofx', 'application/x-ofx'] },
  { label: 'HTML', extensions: ['.html', '.htm'], mimeTypes: ['text/html'] },
] as const satisfies readonly SupportedStatementFormat[];

export const ACCEPTED_STATEMENT_EXTENSIONS = SUPPORTED_STATEMENT_FORMATS.flatMap(format => [...format.extensions]);
export const ACCEPTED_STATEMENT_MIME_TYPES = SUPPORTED_STATEMENT_FORMATS.flatMap(format => [...format.mimeTypes]);
export const STATEMENT_FILE_ACCEPT = ACCEPTED_STATEMENT_EXTENSIONS.join(',');
export const SUPPORTED_STATEMENT_FORMAT_LABELS = SUPPORTED_STATEMENT_FORMATS.map(format => format.label).join(', ');

export function isSupportedStatementFile(file: Pick<File, 'name' | 'type'>): boolean {
  const name = file.name.toLowerCase();
  return SUPPORTED_STATEMENT_FORMATS.some(format =>
    format.mimeTypes.some(mimeType => mimeType === file.type)
    || format.extensions.some(extension => name.endsWith(extension)),
  );
}
