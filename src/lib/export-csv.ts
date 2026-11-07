/**
 * CSV writer shared by the export route and its tests.
 *
 * Byte-for-byte the format Android `CsvExport.kt` writes (and the format the
 * old route produced): same header order, bare LF, no trailing newline, no
 * UTF-8 BOM, `null` → empty field, object columns always quoted compact JSON,
 * text quoted only for `,`, `"` or `\n`.
 *
 * No BOM on purpose: Android compares downloads against this exact byte
 * sequence, and Excel's BOM preference is not worth breaking that parity.
 */

export const CSV_HEADERS = [
  "date",
  "mood",
  "mood_emoji",
  "sleep_quality",
  "stress",
  "activities",
  "habits",
  "gratitude",
  "note",
  "scale_values",
] as const;

export type CsvHeader = (typeof CSV_HEADERS)[number];

/** Columns whose database value is a JSON array/object. */
export const CSV_JSON_COLUMNS: ReadonlySet<string> = new Set([
  "activities",
  "habits",
  "gratitude",
  "scale_values",
]);

export const CSV_LINE_SEPARATOR = "\n";

/** Quote and double inner quotes. */
export function quoteCsv(text: string): string {
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Plain text field: empty for `null`/`undefined`, quoted only when it holds a
 * comma, a double quote or a newline (same test as the Android twin).
 */
export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return text.includes(",") || text.includes('"') || text.includes("\n")
    ? quoteCsv(text)
    : text;
}

/**
 * JSON field. `null`/`undefined` → empty; everything else is compact
 * `JSON.stringify` output, **always** quoted, with inner quotes doubled.
 */
export function csvJsonField(value: unknown): string {
  if (value === null || value === undefined) return "";
  return quoteCsv(JSON.stringify(value));
}

/** One column, using the rule for that header. */
export function csvField(header: string, value: unknown): string {
  return CSV_JSON_COLUMNS.has(header) ? csvJsonField(value) : csvEscape(value);
}

/** One data line, built by walking the header list so order cannot drift. */
export function csvRow(entry: Record<string, unknown>): string {
  return CSV_HEADERS.map((header) => csvField(header, entry[header])).join(",");
}

/** The whole document: header line, then one line per entry. */
export function buildCsv(entries: readonly Record<string, unknown>[]): string {
  return [CSV_HEADERS.join(","), ...entries.map(csvRow)].join(CSV_LINE_SEPARATOR);
}

/**
 * Android `ExportState.fileName` shape: `diarium-export-YYYY-MM-DD.csv`.
 * Takes the already-local ISO day from the caller — never a UTC timestamp.
 */
export function csvFileName(todayISO: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(todayISO)) {
    throw new Error("csvFileName requires a YYYY-MM-DD date");
  }
  return `diarium-export-${todayISO}.csv`;
}
