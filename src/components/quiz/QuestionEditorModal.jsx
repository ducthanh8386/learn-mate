import React, { useState } from 'react';
import { useAppAuth } from '../../context/AuthContext';
import { X, Plus, Trash2, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';

export const QuestionEditorModal = ({ isOpen, onClose, courseId, classId, onSaved }) => {
  const { supabaseClient } = useAppAuth();

  const [type, setType] = useState('multiple_choice'); // 'multiple_choice' | 'multiple_select' | 'true_false' | 'fill_blank' | 'essay'
  const [content, setContent] = useState('');
  const [points, setPoints] = useState(1);
  const [explanation, setExplanation] = useState('');

  // Options for multiple_choice & multiple_select
  const [options, setOptions] = useState([
    { content: '', is_correct: true },
    { content: '', is_correct: false },
    { content: '', is_correct: false },
    { content: '', is_correct: false },
  ]);

  // True / False selection
  const [tfCorrect, setTfCorrect] = useState('true'); // 'true' | 'false'

  // Fill in blank accepted answers
  const [acceptedAnswersText, setAcceptedAnswersText] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleOptionChange = (index, field, value) => {
    const newOptions = [...options];
    if (field === 'is_correct' && type === 'multiple_choice') {
      // Radio behavior for single choice
      newOptions.forEach((opt, i) => {
        opt.is_correct = i === index;
      });
    } else {
      newOptions[index][field] = value;
    }
    setOptions(newOptions);
  };

  const handleAddOption = () => {
    if (options.length >= 8) return;
    setOptions([...options, { content: '', is_correct: false }]);
  };

  const handleRemoveOption = (index) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!content.trim()) throw new Error('Vui lòng nhập nội dung câu hỏi.');

      let acceptedAnswers = null;
      let finalOptions = [];

      if (type === 'multiple_choice' || type === 'multiple_select') {
        const validOptions = options.filter((o) => o.content.trim() !== '');
        if (validOptions.length < 2) throw new Error('Cần ít nhất 2 đáp án lựa chọn.');
        if (!validOptions.some((o) => o.is_correct)) {
          throw new Error('Vui lòng chọn ít nhất 1 đáp án đúng.');
        }
        finalOptions = validOptions;
      } else if (type === 'true_false') {
        finalOptions = [
          { content: 'Đúng', is_correct: tfCorrect === 'true', order_index: 0 },
          { content: 'Sai', is_correct: tfCorrect === 'false', order_index: 1 },
        ];
      } else if (type === 'fill_blank') {
        const list = acceptedAnswersText
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean);
        if (list.length === 0) throw new Error('Vui lòng nhập ít nhất 1 đáp án chấp nhận.');
        acceptedAnswers = list;
      }

      // 1. Insert question
      const { data: insertedQ, error: qErr } = await supabaseClient
        .from('questions')
        .insert({
          course_id: courseId,
          class_id: classId,
          type,
          content: content.trim(),
          points: Number(points) || 1,
          explanation: explanation.trim() || null,
          accepted_answers: acceptedAnswers,
        })
        .select()
        .single();

      if (qErr) throw qErr;

      // 2. Insert answer options if applicable
      if (finalOptions.length > 0) {
        const optionsPayload = finalOptions.map((opt, idx) => ({
          question_id: insertedQ.id,
          content: opt.content.trim(),
          is_correct: !!opt.is_correct,
          order_index: idx,
        }));

        const { error: optErr } = await supabaseClient
          .from('answer_options')
          .insert(optionsPayload);

        if (optErr) throw optErr;
      }

      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error('Error saving question:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '20px'
    }}>
      <div className="glass-card" style={{
        maxWidth: '680px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        backgroundColor: 'var(--bg-surface)',
        padding: '32px',
        position: 'relative'
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer'
          }}
        >
          <X size={20} />
        </button>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>Tạo Câu Hỏi Mới</h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Lưu vào ngân hàng câu hỏi dùng chung cho khóa học</p>
          </div>

          {error && (
            <div style={{
              backgroundColor: 'var(--danger-50)',
              color: 'var(--danger-600)',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '6px' }}>
                Loại câu hỏi *
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-page)',
                  color: 'var(--text-primary)'
                }}
              >
                <option value="multiple_choice">Trắc nghiệm 1 đáp án đúng (Multiple Choice)</option>
                <option value="multiple_select">Trắc nghiệm nhiều đáp án đúng (Multiple Select)</option>
                <option value="true_false">Đúng / Sai (True / False)</option>
                <option value="fill_blank">Điền từ vào chỗ trống (Fill in Blank)</option>
                <option value="essay">Tự luận (Essay - Chấm tay)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '6px' }}>
                Điểm số mặc định
              </label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-page)',
                  color: 'var(--text-primary)'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '6px' }}>
              Nội dung câu hỏi *
            </label>
            <textarea
              rows={3}
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Nhập đề bài câu hỏi..."
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-page)',
                color: 'var(--text-primary)',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Type-Specific Answer Options */}
          {(type === 'multiple_choice' || type === 'multiple_select') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: '600' }}>
                  Các phương án lựa chọn (Tick chọn đáp án đúng):
                </label>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleAddOption}
                  disabled={options.length >= 8}
                  style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                >
                  <Plus size={12} /> Thêm phương án
                </button>
              </div>

              {options.map((opt, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type={type === 'multiple_choice' ? 'radio' : 'checkbox'}
                    name="correct_option"
                    checked={opt.is_correct}
                    onChange={(e) => handleOptionChange(idx, 'is_correct', type === 'multiple_choice' ? true : e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary-500)' }}
                    title="Đánh dấu đáp án đúng"
                  />
                  <input
                    type="text"
                    required
                    value={opt.content}
                    onChange={(e) => handleOptionChange(idx, 'content', e.target.value)}
                    placeholder={`Phương án ${String.fromCharCode(65 + idx)}...`}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-page)',
                      color: 'var(--text-primary)',
                      fontSize: '0.875rem'
                    }}
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(idx)}
                      style={{ background: 'none', border: 'none', color: 'var(--danger-500)', cursor: 'pointer', padding: '4px' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {type === 'true_false' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '8px' }}>
                Đáp án đúng:
              </label>
              <div style={{ display: 'flex', gap: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.925rem' }}>
                  <input
                    type="radio"
                    name="tf_answer"
                    value="true"
                    checked={tfCorrect === 'true'}
                    onChange={() => setTfCorrect('true')}
                    style={{ accentColor: 'var(--primary-500)' }}
                  />
                  <span>Đúng (True)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.925rem' }}>
                  <input
                    type="radio"
                    name="tf_answer"
                    value="false"
                    checked={tfCorrect === 'false'}
                    onChange={() => setTfCorrect('false')}
                    style={{ accentColor: 'var(--primary-500)' }}
                  />
                  <span>Sai (False)</span>
                </label>
              </div>
            </div>
          )}

          {type === 'fill_blank' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '6px' }}>
                Các đáp án được chấp nhận (phân cách bằng dấu phẩy, không phân biệt hoa/thường) *
              </label>
              <input
                type="text"
                required
                value={acceptedAnswersText}
                onChange={(e) => setAcceptedAnswersText(e.target.value)}
                placeholder="VD: Paris, Pa-ri, PARIS"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-page)',
                  color: 'var(--text-primary)'
                }}
              />
            </div>
          )}

          {type === 'essay' && (
            <div style={{ padding: '12px 16px', backgroundColor: 'var(--primary-50)', borderRadius: 'var(--radius-md)', color: 'var(--primary-700)', fontSize: '0.875rem' }}>
              Câu hỏi tự luận sẽ yêu cầu học sinh nhập văn bản trả lời và gia sư sẽ chấm điểm thủ công sau khi học sinh nộp bài.
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '6px' }}>
              Lời giải chi tiết / Hướng dẫn (Hiển thị sau khi học sinh nộp bài)
            </label>
            <textarea
              rows={2}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Giải thích vì sao đáp án này đúng..."
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-page)',
                color: 'var(--text-primary)',
                resize: 'vertical'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>
              Hủy
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1 }}>
              {loading ? 'Đang lưu...' : 'Lưu vào Ngân hàng câu hỏi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
