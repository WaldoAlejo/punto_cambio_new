import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

type ExcelRow = Record<string, string | number | boolean | null | undefined>;

export const exportToExcel = (
  data: ExcelRow[],
  fileName: string,
  dateFrom?: string,
  dateTo?: string,
  selectedPointName?: string | null,
  sheetName: string = "Reporte"
): void => {
  if (!data.length) return;

  const numericKeys = Object.keys(data[0]).filter(
    (key) => typeof data[0][key] === "number"
  );

  const totals: ExcelRow = {};
  for (const key of Object.keys(data[0])) {
    if (numericKeys.includes(key)) {
      totals[key] = data.reduce((sum, row) => {
        const value = row[key];
        return sum + (typeof value === "number" ? value : 0);
      }, 0);
    } else if (key.toLowerCase().includes("punto")) {
      totals[key] = "Totales:";
    } else {
      totals[key] = "";
    }
  }

  const metadata: ExcelRow[] = [];

  if (selectedPointName) {
    metadata.push({ "Punto de Atención": selectedPointName });
  }

  if (dateFrom && dateTo) {
    metadata.push({ "Reporte generado desde": dateFrom, hasta: dateTo });
  }

  if (metadata.length > 0) {
    metadata.push({}); // línea vacía como separador
  }

  const finalData = [...metadata, ...data, totals];

  const worksheet = XLSX.utils.json_to_sheet(finalData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const excelBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });

  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  saveAs(blob, `${fileName}.xlsx`);
};
