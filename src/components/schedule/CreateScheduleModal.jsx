import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Repeat } from 'lucide-react';
import { FormField } from '../common';

const WEEKDAYS = [
  { id: 1, label: 'Thứ 2', short: 'T2' },
  { id: 2, label: 'Thứ 3', short: 'T3' },
  { id: 3, label: 'Thứ 4', short: 'T4' },
  { id: 4, label: 'Thứ 5', short: 'T5' },
  { id: 5, label: 'Thứ 6', short: 'T6' },
  { id: 6, label: 'Thứ 7', short: 'T7' },
  { id: 0, label: 'Chủ nhật', short: 'CN' },
];

export const CreateScheduleModal = ({
  isOpen,
  onClose,
  classes = [],
  selectedClassId = '',
  initialDateTime = null,
  onSuccess,
  supabaseClient,
}) => {
  const [classId, setClassId] = useState(selectedClassId || classes[0]?.id || '');
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  
  // Recurring state
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedDays, setSelectedDays] = useState([]); // array of day numbers: 1 (Mon) - 0 (Sun)
  const [repeatWeeks, setRepeatWeeks] = useState(4); // default 4 weeks

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize dates when modal opens or initialDateTime changes
  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (selectedClassId) {
        setClassId(selectedClassId);
      } else if (classes.length > 0) {
        setClassId(classes[0].id);
      }

      if (initialDateTime && initialDateTime.date) {
        const d = new Date(initialDateTime.date);
        const startH = initialDateTime.hour ?? 8;
        d.setHours(startH, 0, 0, 0);

        const endD = new Date(d);
        endD.setHours(startH + 1, 30, 0, 0); // default 1.5 hours duration

        const formatForInput = (dateObj) => {
          const y = dateObj.getFullYear();
          const m = String(dateObj.getMonth() + 1).padStart(2, '0');
          const day = String(dateObj.getDate()).padStart(2, '0');
          const h = String(dateObj.getHours()).padStart(2, '0');
          const min = String(dateObj.getMinutes()).padStart(2, '0');
          return `${y}-${m}-${day}T${h}:${min}`;
        };

        setStartTime(formatForInput(d));
        setEndTime(formatForInput(endD));

        const dayNum = d.getDay(); // 0-6
        setSelectedDays([dayNum]);
      } else {
        // Default: Next morning 08:00
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(8, 0, 0, 0);
        const endTomorrow = new Date(tomorrow);
        endTomorrow.setHours(9, 30, 0, 0);

        const formatForInput = (dateObj) => {
          const y = dateObj.getFullYear();
          const m = String(dateObj.getMonth() + 1).padStart(2, '0');
          const day = String(dateObj.getDate()).padStart(2, '0');
          const h = String(dateObj.getHours()).padStart(2, '0');
          const min = String(dateObj.getMinutes()).padStart(2, '0');
          return `${y}-${m}-${day}T${h}:${min}`;
        };

        setStartTime(formatForInput(tomorrow));
        setEndTime(formatForInput(endTomorrow));
        setSelectedDays([tomorrow.getDay()]);
      }
    }
  }, [isOpen, initialDateTime, selectedClassId, classes]);

  if (!isOpen) return null;

  const toggleDay = (dayId) => {
    setSelectedDays((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId]
    );
  };

  // Generate preview dates for recurring schedules
  const calculateRecurringDates = () => {
    if (!startTime || !endTime || selectedDays.length === 0) return [];

    const startObj = new Date(startTime);
    const endObj = new Date(endTime);
    if (isNaN(startObj.getTime()) || isNaN(endObj.getTime())) return [];
    if (endObj <= startObj) return [];
    const durationMs = endObj.getTime() - startObj.getTime();

    // Find Monday of the base week
    const dayOfWeek = startObj.getDay();
    const distanceToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const baseMonday = new Date(startObj);
    baseMonday.setDate(startObj.getDate() + distanceToMon);
    baseMonday.setHours(0, 0, 0, 0);

    const generated = [];

    for (let w = 0; w < repeatWeeks; w++) {
      for (const dayId of selectedDays) {
        // dayId: 1 (Mon) -> offset 0; 2 (Tue) -> offset 1 ... 0 (Sun) -> offset 6
        const dayOffset = dayId === 0 ? 6 : dayId - 1;
        const targetDate = new Date(baseMonday);
        targetDate.setDate(baseMonday.getDate() + w * 7 + dayOffset);
        targetDate.setHours(startObj.getHours(), startObj.getMinutes(), 0, 0);

        // Include only dates on or after the initial start date
        if (targetDate.getTime() >= startObj.getTime()) {
          const targetEnd = new Date(targetDate.getTime() + durationMs);
          generated.push({
            start: targetDate,
            end: targetEnd,
          });
        }
      }
    }

    // Sort chronologically
    return generated.sort((a, b) => a.start.getTime() - b.start.getTime());
  };

  const previewDates = isRecurring ? calculateRecurringDates() : [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!classId) {
        throw new Error('Vui lòng chọn lớp học.');
      }
      if (!title.trim()) {
        throw new Error('Vui lòng nhập tiêu đề buổi học.');
      }
      if (!startTime || !endTime) {
        throw new Error('Vui lòng chọn thời gian bắt đầu và kết thúc.');
      }

      const startD = new Date(startTime);
      const endD = new Date(endTime);
      if (isNaN(startD.getTime()) || isNaN(endD.getTime())) {
        throw new Error('Thời gian bắt đầu hoặc kết thúc không hợp lệ.');
      }
      if (endD <= startD) {
        throw new Error('Giờ kết thúc phải sau giờ bắt đầu.');
      }

      if (isRecurring) {
        const recurringList = calculateRecurringDates();
        if (recurringList.length === 0) {
          throw new Error('Vui lòng chọn ít nhất 1 thứ trong tuần để lặp lại.');
        }

        const insertPayload = recurringList.map((item, index) => {
          const sessionTitle =
            recurringList.length > 1
              ? `${title.trim()} (Buổi ${index + 1})`
              : title.trim();

          return {
            class_id: classId,
            title: sessionTitle,
            start_time: item.start.toISOString(),
            end_time: item.end.toISOString(),
            meeting_url: meetingUrl.trim() || null,
            status: 'scheduled',
          };
        });

        const { error: batchErr } = await supabaseClient
          .from('schedules')
          .insert(insertPayload);

        if (batchErr) throw batchErr;
      } else {
        const { error: insErr } = await supabaseClient
          .from('schedules')
          .insert({
            class_id: classId,
            title: title.trim(),
            start_time: startD.toISOString(),
            end_time: endD.toISOString(),
            meeting_url: meetingUrl.trim() || null,
            status: 'scheduled',
          });

        if (insErr) throw insErr;
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error saving schedule:', err);
      setError(err.message || 'Không thể lưu lịch học.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
    >
      <div
        className="glass-card"
        style={{
          maxWidth: '560px',
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          backgroundColor: 'var(--bg-surface)',
          padding: '28px',
          position: 'relative',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
        }}
      >
        <button
          onClick={onClose}
          aria-label="Đóng cửa sổ"
          title="Đóng"
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          <X size={20} />
        </button>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)' }}>
              Lên Lịch Buổi Học Mới
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Tạo buổi học kèm phòng họp trực tuyến Google Meet / Zoom cho học sinh.
            </p>
          </div>

          {error && (
            <div
              style={{
                backgroundColor: 'var(--danger-50)',
                color: 'var(--danger-600)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Class selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.8125rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              Lớp học <span style={{ color: 'var(--danger-500)' }}>*</span>
            </label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-page)',
                color: 'var(--text-primary)',
                fontWeight: '600',
              }}
              required
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.subject})
                </option>
              ))}
            </select>
          </div>

          <FormField
            id="schedule-title"
            label="Tiêu đề buổi học"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="VD: Buổi 1: Luyện đề thi thử Toán học kỳ 1"
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <FormField
              id="schedule-start-time"
              label="Bắt đầu lúc"
              type="datetime-local"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />

            <FormField
              id="schedule-end-time"
              label="Kết thúc lúc"
              type="datetime-local"
              required
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>

          <FormField
            id="schedule-meeting-url"
            label="Liên kết Google Meet / Zoom (tùy chọn)"
            type="url"
            value={meetingUrl}
            onChange={(e) => setMeetingUrl(e.target.value)}
            placeholder="VD: https://meet.google.com/abc-defg-hij"
          />

          {/* Recurring Schedule Section */}
          <div
            style={{
              marginTop: '4px',
              padding: '14px',
              backgroundColor: isRecurring ? 'rgba(99, 102, 241, 0.05)' : 'var(--bg-page)',
              border: `1px solid ${isRecurring ? 'var(--primary-300)' : 'var(--border-subtle)'}`,
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--primary-600)' }}
              />
              <span style={{ fontWeight: '700', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                Lặp lại lịch học hàng tuần cho lớp này
              </span>
            </label>

            {isRecurring && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '6px' }}>
                <div>
                  <span style={{ fontSize: '0.8125rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                    Các ngày trong tuần:
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                    {WEEKDAYS.map((wd) => {
                      const isSelected = selectedDays.includes(wd.id);
                      return (
                        <button
                          key={wd.id}
                          type="button"
                          onClick={() => toggleDay(wd.id)}
                          style={{
                            padding: '6px 10px',
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            borderRadius: 'var(--radius-sm)',
                            border: `1px solid ${isSelected ? 'var(--primary-600)' : 'var(--border-subtle)'}`,
                            backgroundColor: isSelected ? 'var(--primary-600)' : 'var(--bg-surface)',
                            color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {wd.short}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                    Số tuần lặp lại:
                  </span>
                  <select
                    value={repeatWeeks}
                    onChange={(e) => setRepeatWeeks(Number(e.target.value))}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      fontWeight: '700',
                    }}
                  >
                    <option value={2}>2 tuần</option>
                    <option value={4}>4 tuần (1 tháng)</option>
                    <option value={8}>8 tuần (2 tháng)</option>
                    <option value={12}>12 tuần (1 học kỳ)</option>
                    <option value={16}>16 tuần</option>
                  </select>
                </div>

                {previewDates.length > 0 && (
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'rgba(99, 102, 241, 0.08)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                      color: 'var(--primary-700)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Repeat size={14} />
                    <span>
                      Sẽ tạo <strong>{previewDates.length} buổi học</strong> từ ngày{' '}
                      <strong>{previewDates[0]?.start.toLocaleDateString('vi-VN')}</strong> đến{' '}
                      <strong>{previewDates[previewDates.length - 1]?.start.toLocaleDateString('vi-VN')}</strong>
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              style={{ flex: 1 }}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ flex: 1.2 }}
            >
              {loading ? 'Đang tạo...' : isRecurring ? `Tạo ${previewDates.length || ''} Buổi Học` : 'Lên Lịch Ngay'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
