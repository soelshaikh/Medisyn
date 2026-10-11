import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type {
  SalesReport,
  OrdersReport,
  ReportPreset,
} from "@/api/reports.api";

/* ── Shared helpers ── */

const BRAND: [number, number, number] = [22, 119, 168]; // #1677A8 as RGB

type Row = Record<string, string | number>;

function filename(type: string, preset: ReportPreset, ext: "xlsx" | "pdf"): string {
  const d = new Date().toISOString().slice(0, 10);
  return `medisyn-${type}-${preset}-${d}.${ext}`;
}

function buildXlsx(
  type: string,
  preset: ReportPreset,
  sheets: Array<{ name: string; rows: Row[] }>,
) {
  const wb = XLSX.utils.book_new();
  for (const { name, rows } of sheets) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name);
  }
  XLSX.writeFile(wb, filename(type, preset, "xlsx"));
}

interface PdfTable {
  title: string;
  head: string[][];
  body: (string | number)[][];
}

function buildPdf(
  type: string,
  preset: ReportPreset,
  tables: PdfTable[],
  period?: { start: string; end: string },
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const label = type.charAt(0).toUpperCase() + type.slice(1);

  doc.setFontSize(16);
  doc.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.text(`MediSyn — ${label} Report`, 14, 15);

  doc.setFontSize(9);
  doc.setTextColor(113, 128, 150); // #718096
  const periodLine = period
    ? `Period: ${period.start.slice(0, 10)} → ${period.end.slice(0, 10)}  |  Preset: ${preset}`
    : `Preset: ${preset}`;
  doc.text(periodLine, 14, 22);
  doc.text(`Generated: ${new Date().toLocaleString("en-CA")}`, 14, 27);

  let startY = 35;

  for (const { title, head, body } of tables) {
    doc.setFontSize(11);
    doc.setTextColor(26, 32, 44); // #1A202C
    doc.text(title, 14, startY);

    autoTable(doc, {
      startY: startY + 4,
      head,
      body,
      theme: "striped",
      headStyles: {
        fillColor: BRAND,
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: "bold",
      },
      bodyStyles: { fontSize: 8, textColor: [26, 32, 44] },
      alternateRowStyles: { fillColor: [247, 249, 251] },
      margin: { left: 14, right: 14 },
      didDrawPage: () => {
        doc.setFontSize(7);
        doc.setTextColor(160, 160, 160);
        doc.text(
          `MediSyn Admin  |  ${new Date().toLocaleDateString("en-CA")}`,
          14,
          doc.internal.pageSize.height - 8,
        );
      },
    });

    const withTable = doc as unknown as { lastAutoTable: { finalY: number } };
    startY = withTable.lastAutoTable.finalY + 12;
  }

  doc.save(filename(type, preset, "pdf"));
}

/* ── Sales ── */

export function exportSalesExcel(data: SalesReport, preset: ReportPreset) {
  buildXlsx("sales", preset, [
    {
      name: "Summary",
      rows: [
        {
          "Revenue (CAD)":      data.summary.revenueCAD,
          "Orders":             data.summary.orderCount,
          "Avg Order Value (CAD)": data.summary.aovCAD,
          "Discounts (CAD)":    data.summary.discountCAD,
        },
      ],
    },
    {
      name: "Daily",
      rows: data.chart.map((r) => ({
        Date:            r.date,
        "Revenue (CAD)": (r.revenue / 100).toFixed(2),
        Orders:          r.count,
      })),
    },
  ]);
}

export function exportSalesPdf(data: SalesReport, preset: ReportPreset) {
  buildPdf(
    "sales",
    preset,
    [
      {
        title: "Summary",
        head:  [["Metric", "Value"]],
        body:  [
          ["Total Revenue (CAD)",      `$${data.summary.revenueCAD}`],
          ["Orders",                    data.summary.orderCount],
          ["Avg Order Value (CAD)",    `$${data.summary.aovCAD}`],
          ["Total Discounts (CAD)",    `$${data.summary.discountCAD}`],
        ],
      },
      {
        title: "Daily Breakdown",
        head:  [["Date", "Revenue (CAD)", "Orders"]],
        body:  data.chart.map((r) => [
          r.date,
          `$${(r.revenue / 100).toFixed(2)}`,
          r.count,
        ]),
      },
    ],
    data.period,
  );
}

/* ── Orders ── */

export function exportOrdersExcel(data: OrdersReport, preset: ReportPreset) {
  buildXlsx("orders", preset, [
    {
      name: "By Status",
      rows: data.byStatus.map((s) => ({
        Status: s.status.replace(/_/g, " "),
        Orders: s.count,
      })),
    },
    {
      name: "Daily",
      rows: data.dailyChart.map((r) => ({ Date: r.date, Orders: r.count })),
    },
    {
      name: "Guest vs Registered",
      rows: data.guestVsUser.map((g) => ({ Type: g.type, Orders: g.count })),
    },
  ]);
}

export function exportOrdersPdf(data: OrdersReport, preset: ReportPreset) {
  buildPdf(
    "orders",
    preset,
    [
      {
        title: "Orders by Status",
        head:  [["Status", "Count"]],
        body:  data.byStatus.map((s) => [s.status.replace(/_/g, " "), s.count]),
      },
      {
        title: "Guest vs Registered",
        head:  [["Type", "Count"]],
        body:  data.guestVsUser.map((g) => [g.type, g.count]),
      },
      {
        title: "Daily Orders",
        head:  [["Date", "Orders"]],
        body:  data.dailyChart.map((r) => [r.date, r.count]),
      },
    ],
    data.period,
  );
}
