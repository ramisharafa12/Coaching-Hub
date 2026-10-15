"use client";

/** Read the first sheet of an .xlsx file as rows of strings. */
export async function readRows(file: File): Promise<string[][]> {
  const { readSheet } = await import("read-excel-file/universal");
  const data = await readSheet(file);
  return data.map((row) => row.map((cell) => (cell === null || cell === undefined ? "" : String(cell).trim())));
}

/** Turn rows into objects keyed by lower-cased header names. */
export function rowsToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.toLowerCase().replace(/\s+/g, " ").trim());
  return rows
    .slice(1)
    .filter((r) => r.some((c) => c !== ""))
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
}

/** Download a simple .xlsx made of a header row plus example rows. */
export async function downloadTemplate(fileName: string, rows: (string | number)[][]) {
  const { default: writeExcelFile } = await import("write-excel-file/browser");
  const sheet = rows.map((r, i) => r.map((value) => ({ value, fontWeight: i === 0 ? ("bold" as const) : undefined })));
  await writeExcelFile(sheet).toFile(fileName);
}
