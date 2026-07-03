import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';

export function exportToExcel(data: Record<string, unknown>[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, `${filename}_${dayjs().format('YYYY-MM-DD')}.xlsx`);
}

export function exportToPDF(
  title: string,
  columns: string[],
  rows: (string | number)[][][],
  filename: string
) {
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(16);
  doc.text(title, 14, 15);
  doc.setFontSize(10);
  doc.text(`Generated: ${dayjs().format('DD MMM YYYY, hh:mm A')}`, 14, 22);
  autoTable(doc, {
    head: [columns],
    body: rows as unknown as string[][],
    startY: 28,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [99, 102, 241] },
  });
  doc.save(`${filename}_${dayjs().format('YYYY-MM-DD')}.pdf`);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

export function formatDate(date: string | undefined): string {
  if (!date) return '-';
  return dayjs(date).format('DD MMM YYYY');
}

export function formatDateTime(date: string | undefined): string {
  if (!date) return '-';
  return dayjs(date).format('DD MMM YYYY, hh:mm A');
}
