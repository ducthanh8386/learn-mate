import * as XLSX from 'xlsx';

/**
 * Exports data to an Excel file with formatted sheet
 * @param {Array<object>} data - Array of row objects
 * @param {string} fileName - File name without extension
 * @param {string} sheetName - Sheet name
 */
export const exportToExcel = (data, fileName = 'bao-cao', sheetName = 'DuLieu') => {
  if (!data || data.length === 0) {
    alert('Không có dữ liệu để xuất file Excel.');
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Auto-fit column widths
  const maxProps = {};
  data.forEach((row) => {
    Object.keys(row).forEach((key) => {
      const valStr = String(row[key] || '');
      maxProps[key] = Math.max(maxProps[key] || key.length, valStr.length);
    });
  });

  worksheet['!cols'] = Object.keys(maxProps).map((key) => ({
    wch: Math.min(Math.max(maxProps[key] + 4, 12), 40),
  }));

  const safeFileName = `${fileName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(workbook, safeFileName);
};
