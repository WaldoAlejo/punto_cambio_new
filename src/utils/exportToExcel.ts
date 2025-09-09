import ExcelJS from "exceljs";
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

  // Crear workbook y hoja con ExcelJS
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  // Escribir filas: la primera fila usará los keys como encabezados
  const headers = Object.keys(finalData[0]);
  worksheet.addRow(headers);
  for (const row of finalData) {
    worksheet.addRow(headers.map((h) => row[h] ?? ""));
  }

  // Generar buffer y descargar
  workbook.xlsx.writeBuffer().then((buffer) => {
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, `${fileName}.xlsx`);
  });
};
