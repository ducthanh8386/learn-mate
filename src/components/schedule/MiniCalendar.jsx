import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const MiniCalendar = ({ selectedDate, onSelectDate, schedules = [] }) => {
  const [viewDate, setViewDate] = useState(selectedDate ? new Date(selectedDate) : new Date());

  useEffect(() => {
    if (selectedDate) {
      setViewDate(new Date(selectedDate));
    }
  }, [selectedDate]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth(); // 0-indexed

  const prevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  // Compute days in month and grid
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();

  // Day of week for 1st of month: 0 (Sun) to 6 (Sat)
  // We want Monday as index 0, Sunday as index 6
  let firstDayIndex = firstDayOfMonth.getDay() - 1;
  if (firstDayIndex === -1) firstDayIndex = 6; // Sunday becomes 6

  // Previous month trailing days
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  const prevDays = [];
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    prevDays.push({
      day: prevMonthLastDay - i,
      month: month - 1,
      year: month === 0 ? year - 1 : year,
      isCurrentMonth: false,
    });
  }

  // Current month days
  const currentDays = [];
  for (let d = 1; d <= daysInMonth; d++) {
    currentDays.push({
      day: d,
      month,
      year,
      isCurrentMonth: true,
    });
  }

  // Next month leading days to complete the 7-col grid (up to 35 or 42 cells)
  const totalSlots = Math.ceil((prevDays.length + currentDays.length) / 7) * 7;
  const nextDaysCount = totalSlots - (prevDays.length + currentDays.length);
  const nextDays = [];
  for (let d = 1; d <= nextDaysCount; d++) {
    nextDays.push({
      day: d,
      month: month + 1,
      year: month === 11 ? year + 1 : year,
      isCurrentMonth: false,
    });
  }

  const allCalendarDays = [...prevDays, ...currentDays, ...nextDays];

  // Set of dates that have schedules: format 'YYYY-MM-DD'
  const scheduleDateSet = new Set(
    schedules.map((s) => {
      const d = new Date(s.start_time);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })
  );

  const isToday = (d, m, y) => {
    const today = new Date();
    return today.getDate() === d && today.getMonth() === m && today.getFullYear() === y;
  };

  const isSelected = (d, m, y) => {
    if (!selectedDate) return false;
    const sel = new Date(selectedDate);
    return sel.getDate() === d && sel.getMonth() === m && sel.getFullYear() === y;
  };

  const handleDayClick = (item) => {
    const clickedDate = new Date(item.year, item.month, item.day, 12, 0, 0);
    onSelectDate(clickedDate);
    if (!item.isCurrentMonth) {
      setViewDate(new Date(item.year, item.month, 1));
    }
  };

  return (
    <div className="mini-calendar-card">
      {/* Month & Year Header */}
      <div className="mini-cal-header">
        <span className="mini-cal-title">
          Tháng {month + 1}-{year}
        </span>
        <div className="mini-cal-nav">
          <button
            type="button"
            className="mini-cal-nav-btn"
            onClick={prevMonth}
            title="Tháng trước"
            aria-label="Tháng trước"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            className="mini-cal-nav-btn"
            onClick={nextMonth}
            title="Tháng sau"
            aria-label="Tháng sau"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Weekday Labels (T2 - CN) */}
      <div className="mini-cal-weekdays">
        <span>T2</span>
        <span>T3</span>
        <span>T4</span>
        <span>T5</span>
        <span>T6</span>
        <span>T7</span>
        <span>Cn</span>
      </div>

      {/* Days Grid */}
      <div className="mini-cal-days-grid">
        {allCalendarDays.map((item, idx) => {
          const dateStr = `${item.year}-${String(item.month + 1).padStart(2, '0')}-${String(item.day).padStart(2, '0')}`;
          const hasDot = scheduleDateSet.has(dateStr);
          const active = isSelected(item.day, item.month, item.year);
          const current = isToday(item.day, item.month, item.year);

          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleDayClick(item)}
              className={`mini-cal-day-cell ${!item.isCurrentMonth ? 'other-month' : ''} ${
                active ? 'selected-day' : ''
              } ${current ? 'current-day' : ''}`}
            >
              <span>{item.day}</span>
              {hasDot && <span className="mini-cal-dot" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};
