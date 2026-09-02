/**
 * Tiện ích định dạng dữ liệu dùng chung trong LearnMate LMS
 */

/**
 * Định dạng số tiền VNĐ chuẩn (ví dụ: 500.000 đ)
 * @param {number|string|null|undefined} amount 
 * @param {boolean} withSymbol - Có hiển thị kèm chữ "đ" hay không (mặc định: true)
 * @returns {string}
 */
export const formatCurrency = (amount, withSymbol = true) => {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return `0 ${withSymbol ? 'đ' : ''}`.trim();
  }

  const formatted = Number(amount).toLocaleString('vi-VN');
  return withSymbol ? `${formatted} đ` : formatted;
};

/**
 * Định dạng ngày giờ chuẩn Việt Nam (DD/MM/YYYY HH:mm)
 * @param {string|Date|null|undefined} dateStr 
 * @returns {string}
 */
export const formatDateTime = (dateStr) => {
  if (!dateStr) return '--';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(dateStr);
  }
};

/**
 * Định dạng ngày chuẩn Việt Nam (DD/MM/YYYY)
 * @param {string|Date|null|undefined} dateStr 
 * @returns {string}
 */
export const formatDate = (dateStr) => {
  if (!dateStr) return '--';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return String(dateStr);
  }
};
