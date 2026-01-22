const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const generateMonths = (startDate, endDate = new Date()) => {
  const months = {};
  const start = new Date(startDate);
  const end = endDate;
  let current = new Date(start);
  
  while (current <= end) {
    const year = current.getFullYear();
    const month = current.getMonth();
    const monthName = MONTH_NAMES[month];
    const key = monthName.toLowerCase() + year;
    
    const lastDay = year === end.getFullYear() && month === end.getMonth()
      ? end.getDate()
      : new Date(year, month + 1, 0).getDate();
    
    months[key] = {
      start: `${year}-${String(month + 1).padStart(2, '0')}-01`,
      end: `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
      name: `${monthName} ${year}`
    };
    
    current.setMonth(current.getMonth() + 1);
  }
  
  return months;
};

const getCurrentMonth = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthName = MONTH_NAMES[month];
  const key = monthName.toLowerCase() + year;
  
  return {
    key,
    start: `${year}-${String(month + 1).padStart(2, '0')}-01`,
    end: `${year}-${String(month + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    name: `${monthName} ${year}`
  };
};

const escapeHtml = (text) => text
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

module.exports = {
  MONTH_NAMES,
  generateMonths,
  getCurrentMonth,
  escapeHtml
};
