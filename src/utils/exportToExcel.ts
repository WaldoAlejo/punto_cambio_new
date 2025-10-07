import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

// Row type accepted by the exporter
export type ExcelRow = Record<
  string,
  string | number | boolean | Date | null | undefined
>;

// Small helper to prettify headers: "punto_origen" -> "Punto origen", "montoTotal" -> "Monto total"
const prettifyHeader = (key: string): string => {
  if (!key) return key;
  // Replace underscores with spaces
  let label = key.replace(/_/g, " ");
  // Split camelCase into words: montoTotal -> monto Total
  label = label.replace(/([a-z])([A-Z])/g, "$1 $2");
  // Lowercase everything then capitalize first letter
  label = label.toLowerCase();
  return label.charAt(0).toUpperCase() + label.slice(1);
};

// Heuristics to classify columns
const isMoneyKey = (k: string) =>
  /monto|saldo|total|margen|importe|amount|balance|valor/i.test(k);
const isRateKey = (k: string) => /tasa|rate|spread|porcentaje|percent/i.test(k);
const isDateKey = (k: string) =>
  /fecha|date|creado|actualizado|hora|timestamp|created_at|updated_at/i.test(k);

const isIsoDateString = (v: unknown): v is string =>
  typeof v === "string" &&
  /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v) &&
  !isNaN(Date.parse(v));

export const exportToExcel = (
  data: ExcelRow[],
  fileName: string,
  dateFrom?: string,
  dateTo?: string,
  selectedPointName?: string | null,
  sheetName: string = "Reporte"
): void => {
  if (!data || data.length === 0) return;

  // ✅ Normalizar datos: combinar monto con signo y eliminar campo signo
  const normalizedData = data.map((row) => {
    if ("signo" in row && "monto" in row) {
      const { signo, monto, ...rest } = row;
      const montoValue = typeof monto === "number" ? monto : 0;
      const montoConSigno = signo === "-" ? -montoValue : montoValue;
      return { ...rest, monto: montoConSigno };
    }
    return row;
  });

  // Prepare workbook and sheet
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  // Optional metadata block (shown above the table, not used as headers)
  const metadataRows: { label: string; value: string }[] = [];
  if (selectedPointName) {
    metadataRows.push({
      label: "Punto de atención",
      value: String(selectedPointName),
    });
  }
  if (dateFrom && dateTo) {
    metadataRows.push({
      label: "Rango de fechas",
      value: `${dateFrom} a ${dateTo}`,
    });
  }

  let currentRow = 1;
  if (metadataRows.length > 0) {
    for (const meta of metadataRows) {
      const row = worksheet.getRow(currentRow++);
      row.getCell(1).value = meta.label;
      row.getCell(2).value = meta.value;
      row.getCell(1).font = { bold: true };
      row.commit();
    }
    currentRow++; // empty spacer row
  }

  // Determine headers from the actual data keys (ignore metadata)
  const dataKeys = Object.keys(normalizedData[0]);
  const displayHeaders = dataKeys.map(prettifyHeader);

  // Add header row
  const headerRow = worksheet.getRow(currentRow++);
  displayHeaders.forEach((h, idx) => {
    headerRow.getCell(idx + 1).value = h;
  });
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle", horizontal: "left" };
  headerRow.commit();

  // Determine column kinds based on keys and sample values
  const moneyCols = new Set<number>();
  const rateCols = new Set<number>();
  const dateCols = new Set<number>();
  const numericCols = new Set<number>();

  dataKeys.forEach((k, idx) => {
    const keyLower = k.toLowerCase();
    if (isMoneyKey(keyLower)) moneyCols.add(idx);
    else if (isRateKey(keyLower)) rateCols.add(idx);
    if (isDateKey(keyLower)) dateCols.add(idx);

    // If any row has a number in this column, mark as numeric
    const hasNumber = normalizedData.some((r) => typeof r[k] === "number");
    if (hasNumber) numericCols.add(idx);

    // If not already date by name, try to infer by value
    if (!dateCols.has(idx)) {
      const hasIso = normalizedData.some((r) => isIsoDateString(r[k]));
      if (hasIso) dateCols.add(idx);
    }
  });

  // Write data rows with conversions for dates
  const firstDataRowIndex = currentRow; // keep to apply number formats later
  for (const item of normalizedData) {
    const row = worksheet.getRow(currentRow++);
    dataKeys.forEach((k, idx) => {
      const v = item[k];
      if (v === null || v === undefined) {
        row.getCell(idx + 1).value = "";
        return;
      }
      if (dateCols.has(idx)) {
        // Convert strings that look like ISO to Date, else keep as-is
        const dateVal =
          v instanceof Date ? v : isIsoDateString(v) ? new Date(v) : v;
        row.getCell(idx + 1).value = dateVal as any;
      } else if (typeof v === "number") {
        row.getCell(idx + 1).value = v; // keep numeric for Excel
      } else {
        row.getCell(idx + 1).value = v as any;
      }
    });
    row.commit();
  }

  // Totals row (sum numeric columns)
  if (numericCols.size > 0) {
    const totalsRow = worksheet.getRow(currentRow++);
    dataKeys.forEach((k, idx) => {
      if (numericCols.has(idx)) {
        const total = normalizedData.reduce(
          (sum, r) => sum + (typeof r[k] === "number" ? (r[k] as number) : 0),
          0
        );
        totalsRow.getCell(idx + 1).value = total;
      } else if (k.toLowerCase().includes("punto")) {
        totalsRow.getCell(idx + 1).value = "Totales:";
      } else {
        totalsRow.getCell(idx + 1).value = "";
      }
    });
    totalsRow.font = { bold: true };
    totalsRow.commit();
  }

  // Apply number/date formats per column
  // Money: '#,##0.00'; Rate: '#,##0.0000'; DateTime: 'dd/mm/yyyy hh:mm'
  moneyCols.forEach((idx) => {
    const col = worksheet.getColumn(idx + 1);
    col.numFmt = "#,##0.00";
    col.alignment = { horizontal: "right" };
  });
  rateCols.forEach((idx) => {
    const col = worksheet.getColumn(idx + 1);
    col.numFmt = "#,##0.0000";
    col.alignment = { horizontal: "right" };
  });
  dateCols.forEach((idx) => {
    const col = worksheet.getColumn(idx + 1);
    col.numFmt = "dd/mm/yyyy hh:mm";
  });

  // Auto column widths based on max content length (header and cells)
  const colWidths = dataKeys.map((k, colIdx) => {
    const headerLen = String(displayHeaders[colIdx] ?? "").length;
    const maxCellLen = normalizedData.reduce((max, r) => {
      const v = r[k];
      const len =
        v instanceof Date
          ? 16
          : v === null || v === undefined
          ? 0
          : String(v).length;
      return Math.max(max, len);
    }, 0);
    // Padding and minimum width
    return Math.max(10, Math.min(50, Math.max(headerLen, maxCellLen) + 2));
  });

  worksheet.columns = colWidths.map((w) => ({ width: w }));

  // Freeze header row (and metadata if present)
  worksheet.views = [
    {
      state: "frozen",
      ySplit: metadataRows.length > 0 ? metadataRows.length + 1 : 1,
    },
  ];

  // Generate and download
  workbook.xlsx.writeBuffer().then((buffer) => {
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, `${fileName}.xlsx`);
  });
};
