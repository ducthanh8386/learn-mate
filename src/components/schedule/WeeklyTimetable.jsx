import React from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Plus, Video, Users } from 'lucide-react';
import './ScheduleView.css';

const VIETNAMESE_DAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
const HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

export const WeeklyTimetable = ({
  selectedDate = new Date(),
  onSelectDate,
  schedules = [],
  isTeacher = false,
  onSlotClick,
  onScheduleClick,
  title = 'Lịch học',
}) => {
  // Compute start of week (Monday)
  const curr = new Date(selectedDate);
  const dayOfWeek = curr.getDay(); // 0 is Sun, 1 is Mon...
  const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  
  const monday = new Date(curr);
  monday.setDate(curr.getDate() + distanceToMonday);
  monday.setHours(0, 0, 0, 0);

  // Generate 7 days for the current week
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  const sunday = weekDays[6];

  const handlePrevWeek = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 7);
    onSelectDate(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 7);
    onSelectDate(next);
  };

  const handleToday = () => {
    onSelectDate(new Date());
  };

  const formatDate = (date) => {
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  };

  const isSameDay = (d1, d2) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const now = new Date();

  // Find schedules for a specific day and hour slot
  const getSchedulesForSlot = (dayDate, hour) => {
    return schedules.filter((sch) => {
      const schStart = new Date(sch.start_time);
      if (!isSameDay(schStart, dayDate)) return false;
      const schHour = schStart.getHours();
      return schHour === hour;
    });
  };

  return (
    <div className="schedule-container">
      {/* Top Toolbar */}
      <div className="schedule-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CalendarIcon size={20} color="var(--primary-600)" />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Thời khóa biểu &gt;</span>
            <h2 style={{ fontSize: '1.125rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
              {title}
            </h2>
          </div>
        </div>

        {/* Week navigation & date range */}
        <div className="schedule-nav-group">
          <button
            type="button"
            className="schedule-nav-btn"
            onClick={handlePrevWeek}
            title="Tuần trước"
            aria-label="Tuần trước"
          >
            <ChevronLeft size={18} />
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleToday}
            style={{ fontWeight: '700', fontSize: '0.8125rem', padding: '6px 14px' }}
          >
            Hôm nay
          </button>

          <button
            type="button"
            className="schedule-nav-btn"
            onClick={handleNextWeek}
            title="Tuần sau"
            aria-label="Tuần sau"
          >
            <ChevronRight size={18} />
          </button>

          <span className="schedule-week-label" style={{ marginLeft: '6px' }}>
            {formatDate(monday)} – {formatDate(sunday)}
          </span>
        </div>
      </div>

      {/* Timetable Weekly Grid */}
      <div className="timetable-wrapper">
        <div className="timetable-scroll-area">
          <div className="timetable-grid">
            {/* Header: Time Column */}
            <div className="timetable-header-cell time-col-header">
              <Clock size={14} />
              <span>Giờ VN</span>
            </div>

            {/* Header: 7 Days */}
            {weekDays.map((dayDate, idx) => {
              const isTodayCol = isSameDay(dayDate, now);
              const isSelectedCol = isSameDay(dayDate, selectedDate);

              return (
                <div
                  key={idx}
                  className={`timetable-header-cell ${isTodayCol || isSelectedCol ? 'today-header' : ''}`}
                  onClick={() => onSelectDate(dayDate)}
                  style={{ cursor: 'pointer' }}
                >
                  <span className="timetable-header-date">{formatDate(dayDate)}</span>
                  <span className="timetable-header-day">{VIETNAMESE_DAYS[idx]}</span>
                </div>
              );
            })}

            {/* Body: Hour rows */}
            {HOURS.map((hour) => (
              <React.Fragment key={hour}>
                {/* Time label cell */}
                <div className="timetable-time-label">
                  <span>{`${hour}:00`}</span>
                </div>

                {/* 7 day slots for this hour */}
                {weekDays.map((dayDate, dayIdx) => {
                  const isTodayCol = isSameDay(dayDate, now);
                  const slotSchedules = getSchedulesForSlot(dayDate, hour);

                  return (
                    <div
                      key={dayIdx}
                      className={`timetable-slot ${isTodayCol ? 'today-col' : ''} ${
                        isTeacher ? 'slot-clickable' : ''
                      }`}
                      onClick={(e) => {
                        // Only trigger slot click if clicking directly on slot background
                        if (e.target === e.currentTarget && isTeacher && onSlotClick) {
                          onSlotClick(dayDate, hour);
                        }
                      }}
                      title={isTeacher ? `Nhấp để thêm lịch học lúc ${hour}:00 - ${VIETNAMESE_DAYS[dayIdx]}` : ''}
                    >
                      {/* Teacher hover plus indicator */}
                      {isTeacher && slotSchedules.length === 0 && (
                        <div
                          className="slot-add-indicator"
                          onClick={() => onSlotClick && onSlotClick(dayDate, hour)}
                        >
                          <Plus size={14} />
                        </div>
                      )}

                      {/* Render scheduled sessions */}
                      {slotSchedules.map((sch) => {
                        const startD = new Date(sch.start_time);
                        const endD = new Date(sch.end_time);
                        const isPast = endD < now;
                        const isCompleted = sch.status === 'completed';
                        const attendanceCount = sch.attendance?.[0]?.count || 0;

                        return (
                          <div
                            key={sch.id}
                            className={`schedule-card-item ${
                              isCompleted
                                ? 'status-completed'
                                : isPast
                                ? 'status-unmarked'
                                : 'status-scheduled'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onScheduleClick) onScheduleClick(sch);
                            }}
                          >
                            <div className="schedule-card-title" title={sch.title}>
                              {sch.title}
                            </div>

                            <div className="schedule-card-time">
                              <Clock size={10} />
                              <span>
                                {startD.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} -{' '}
                                {endD.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>

                            {sch.classes?.name && (
                              <div className="schedule-card-meta" title={sch.classes.name}>
                                Lớp: {sch.classes.name}
                              </div>
                            )}

                            {sch.meeting_url && (
                              <div className="schedule-card-meta" style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#67e8f9' }}>
                                <Video size={10} />
                                <span>Phòng học trực tuyến</span>
                              </div>
                            )}

                            {isTeacher && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.625rem', marginTop: '2px', opacity: 0.85 }}>
                                <Users size={10} />
                                <span>
                                  {isCompleted
                                    ? 'Đã điểm danh'
                                    : attendanceCount > 0
                                    ? `Có mặt: ${attendanceCount}`
                                    : 'Chưa điểm danh'}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
