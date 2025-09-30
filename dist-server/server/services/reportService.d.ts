import { ReportData, ReportRequest, SummaryReportResponse } from "../types/reportTypes.js";
export declare const reportService: {
    generateReport(request: ReportRequest, userId?: string): Promise<ReportData[] | SummaryReportResponse>;
};
