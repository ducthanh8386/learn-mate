/**
 * ImportReviewStep.jsx
 *
 * Sub-component review câu hỏi sau khi parse từ file import.
 * Hiển thị 2 nhóm: câu hợp lệ + câu lỗi.
 * Câu lỗi có thể sửa tay inline → tự động chuyển sang nhóm valid khi hợp lệ.
 *
 * SECURITY NOTE: Render content là text node thuần (không dùng dangerouslySetInnerHTML).
 * Nếu sau này cần rich-text, phải sanitize bằng DOMPurify trước.
 */

import React, { useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, Trash2, ChevronDown, ChevronRight, Edit3, RefreshCw } from 'lucide-react';

/**
 * @param {{ content, explanation, options: [{content, is_correct}] }[]} initialValidQuestions
 * @param {{ _id, originalIndex, raw, errors, editedContent, editedOptions, editedExplanation }[]} initialInvalidQuestions
 * @param {(valid, invalid) => void} onQuestionsChange — callback khi danh sách thay đổi
 */
export const ImportReviewStep = ({ initialValidQuestions, initialInvalidQuestions, onQuestionsChange }) => {
  const [validQuestions, setValidQuestions] = useState(initialValidQuestions || []);
  const [invalidQuestions, setInvalidQuestions] = useState(initialInvalidQuestions || []);
  const [expandedInvalid, setExpandedInvalid] = useState(new Set());
  const [editingInvalid, setEditingInvalid] = useState(new Set());

  const notify = useCallback(
    (newValid, newInvalid) => {
      if (onQuestionsChange) onQuestionsChange(newValid, newInvalid);
    },
    [onQuestionsChange]
  );

  // ─── Valid questions: xóa ───────────────────────────────────────────────────

  const handleRemoveValid = (id) => {
    const updated = validQuestions.filter((q) => q._id !== id);
    setValidQuestions(updated);
    notify(updated, invalidQuestions);
  };

  // ─── Invalid questions: expand / chỉnh sửa inline ─────────────────────────

  const toggleExpand = (id) => {
    setExpandedInvalid((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleEdit = (id) => {
    setEditingInvalid((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        next.add(id);
        // Auto-expand khi mở chỉnh sửa
        setExpandedInvalid((e) => new Set([...e, id]));
      }
      return next;
    });
  };

  const updateInvalidField = (id, field, value) => {
    setInvalidQuestions((prev) =>
      prev.map((q) => (q._id === id ? { ...q, [field]: value } : q))
    );
  };

  const updateInvalidOption = (id, optIdx, field, value) => {
    setInvalidQuestions((prev) =>
      prev.map((q) => {
        if (q._id !== id) return q;
        const newOptions = q.editedOptions.map((o, i) => {
          if (i !== optIdx) return field === 'is_correct' ? { ...o, is_correct: false } : o;
          return { ...o, [field]: value };
        });
        return { ...q, editedOptions: newOptions };
      })
    );
  };

  const handleRemoveInvalid = (id) => {
    const updated = invalidQuestions.filter((q) => q._id !== id);
    setInvalidQuestions(updated);
    notify(validQuestions, updated);
  };

  /**
   * Thử validate lại câu đang sửa — nếu hợp lệ, chuyển sang nhóm valid.
   */
  const handleRetryValidate = (q) => {
    const content = q.editedContent.trim();
    const options = q.editedOptions.filter((o) => o.content.trim() !== '');
    const correctIdx = q.editedOptions.findIndex((o) => o.is_correct);
    const errors = [];

    if (!content) errors.push('Nội dung câu hỏi không được để trống');
    if (options.length < 2) errors.push('Cần ít nhất 2 đáp án');
    if (correctIdx < 0) errors.push('Chưa chọn đáp án đúng');

    if (errors.length > 0) {
      // Cập nhật lỗi mới
      setInvalidQuestions((prev) =>
        prev.map((iq) => (iq._id === q._id ? { ...iq, errors } : iq))
      );
      return;
    }

    // Hợp lệ → chuyển sang valid
    const newValid = {
      _id: q._id,
      content,
      explanation: q.editedExplanation.trim(),
      options: q.editedOptions
        .filter((o) => o.content.trim() !== '')
        .map((o) => ({ content: o.content.trim(), is_correct: o.is_correct })),
    };

    const updatedValid = [...validQuestions, newValid];
    const updatedInvalid = invalidQuestions.filter((iq) => iq._id !== q._id);

    setValidQuestions(updatedValid);
    setInvalidQuestions(updatedInvalid);
    setEditingInvalid((prev) => {
      const next = new Set(prev);
      next.delete(q._id);
      return next;
    });
    notify(updatedValid, updatedInvalid);
  };

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-subtle)',
    backgroundColor: 'var(--bg-page)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Summary bar */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          padding: '12px 16px',
          backgroundColor: 'var(--bg-subtle)',
          borderRadius: 'var(--radius-md)',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--success-700)',
            fontWeight: '700',
            fontSize: '0.925rem',
          }}
        >
          <CheckCircle2 size={16} />
          {validQuestions.length} câu hợp lệ
        </span>
        {invalidQuestions.length > 0 && (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--danger-600)',
              fontWeight: '700',
              fontSize: '0.925rem',
            }}
          >
            <AlertTriangle size={16} />
            {invalidQuestions.length} câu cần sửa
          </span>
        )}
        {invalidQuestions.length === 0 && validQuestions.length > 0 && (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', alignSelf: 'center' }}>
            — Sẵn sàng publish!
          </span>
        )}
      </div>

      {/* ── Valid questions ── */}
      {validQuestions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h3 style={{ fontSize: '0.9375rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '2px' }}>
            Câu hỏi hợp lệ
          </h3>
          {validQuestions.map((q, idx) => (
            <div
              key={q._id}
              className="glass-card"
              style={{
                padding: '14px 16px',
                borderLeft: '3px solid var(--success-500)',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start',
              }}
            >
              <span
                style={{
                  minWidth: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  backgroundColor: 'var(--success-100)',
                  color: 'var(--success-700)',
                  fontWeight: '800',
                  fontSize: '0.75rem',
                  flexShrink: 0,
                }}
              >
                {idx + 1}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* SECURITY: text node only, no HTML */}
                <p style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px', wordBreak: 'break-word' }}>
                  {q.content}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '6px' }}>
                  {q.options.map((opt, oIdx) => (
                    <div
                      key={oIdx}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid',
                        borderColor: opt.is_correct ? 'var(--success-400)' : 'var(--border-subtle)',
                        backgroundColor: opt.is_correct ? 'var(--success-50)' : 'var(--bg-page)',
                        fontSize: '0.8125rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span style={{ fontWeight: '700', color: opt.is_correct ? 'var(--success-700)' : 'var(--text-muted)', minWidth: '14px' }}>
                        {String.fromCharCode(65 + oIdx)}.
                      </span>
                      {/* SECURITY: text node only */}
                      <span style={{ color: opt.is_correct ? 'var(--success-700)' : 'var(--text-primary)' }}>
                        {opt.content}
                      </span>
                    </div>
                  ))}
                </div>
                {q.explanation && (
                  <p style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    💡 {q.explanation}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleRemoveValid(q._id)}
                title="Xóa câu hỏi này"
                style={{ background: 'none', border: 'none', color: 'var(--danger-400)', cursor: 'pointer', padding: '4px', flexShrink: 0 }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Invalid questions ── */}
      {invalidQuestions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h3 style={{ fontSize: '0.9375rem', fontWeight: '700', color: 'var(--danger-600)', marginBottom: '2px' }}>
            Câu hỏi cần sửa
          </h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '-8px' }}>
            Chỉnh sửa trực tiếp rồi bấm "Kiểm tra lại" để chuyển sang nhóm hợp lệ, hoặc xóa bỏ nếu không cần.
          </p>
          {invalidQuestions.map((q) => {
            const isExpanded = expandedInvalid.has(q._id);
            const isEditing = editingInvalid.has(q._id);

            return (
              <div
                key={q._id}
                className="glass-card"
                style={{ padding: '14px 16px', borderLeft: '3px solid var(--danger-500)' }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    onClick={() => toggleExpand(q._id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', flexShrink: 0 }}
                  >
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--danger-600)', fontWeight: '700' }}>
                      Câu {q.originalIndex}:{' '}
                    </span>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                      {q.editedContent || q.raw?.question || '(Không có nội dung)'}
                    </span>
                    <div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {q.errors.map((err, i) => (
                        <span
                          key={i}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundColor: 'var(--danger-50)',
                            color: 'var(--danger-700)',
                            padding: '2px 8px',
                            borderRadius: '99px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                          }}
                        >
                          <AlertTriangle size={11} />
                          {err}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button
                      onClick={() => toggleEdit(q._id)}
                      title="Sửa câu hỏi"
                      style={{
                        background: 'none',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--primary-500)',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.75rem',
                      }}
                    >
                      <Edit3 size={13} />
                      {isEditing ? 'Thu gọn' : 'Sửa'}
                    </button>
                    <button
                      onClick={() => handleRemoveInvalid(q._id)}
                      title="Xóa câu hỏi này"
                      style={{ background: 'none', border: 'none', color: 'var(--danger-400)', cursor: 'pointer', padding: '4px' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Edit form */}
                {isEditing && (
                  <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
                    {/* Nội dung câu hỏi */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '600', marginBottom: '5px', color: 'var(--text-secondary)' }}>
                        Nội dung câu hỏi *
                      </label>
                      <textarea
                        rows={2}
                        value={q.editedContent}
                        onChange={(e) => updateInvalidField(q._id, 'editedContent', e.target.value)}
                        style={{ ...inputStyle, resize: 'vertical' }}
                      />
                    </div>

                    {/* Đáp án */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '600', marginBottom: '5px', color: 'var(--text-secondary)' }}>
                        Các đáp án (radio = đáp án đúng) *
                      </label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {(q.editedOptions || []).map((opt, oIdx) => (
                          <div key={oIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="radio"
                              name={`correct_${q._id}`}
                              checked={opt.is_correct}
                              onChange={() => updateInvalidOption(q._id, oIdx, 'is_correct', true)}
                              style={{ accentColor: 'var(--primary-500)', width: '16px', height: '16px' }}
                              title="Đáp án đúng"
                            />
                            <span style={{ fontWeight: '700', color: 'var(--text-muted)', width: '18px', fontSize: '0.8125rem' }}>
                              {String.fromCharCode(65 + oIdx)}.
                            </span>
                            <input
                              type="text"
                              value={opt.content}
                              onChange={(e) => updateInvalidOption(q._id, oIdx, 'content', e.target.value)}
                              placeholder={`Đáp án ${String.fromCharCode(65 + oIdx)}...`}
                              style={{ ...inputStyle, flex: 1 }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Giải thích */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '600', marginBottom: '5px', color: 'var(--text-secondary)' }}>
                        Lời giải (tuỳ chọn)
                      </label>
                      <input
                        type="text"
                        value={q.editedExplanation}
                        onChange={(e) => updateInvalidField(q._id, 'editedExplanation', e.target.value)}
                        placeholder="Giải thích tại sao đáp án này đúng..."
                        style={inputStyle}
                      />
                    </div>

                    {/* Action */}
                    <button
                      onClick={() => handleRetryValidate(q)}
                      className="btn btn-primary"
                      style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <RefreshCw size={14} />
                      Kiểm tra lại và chuyển sang hợp lệ
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {validQuestions.length === 0 && invalidQuestions.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
          Không có câu hỏi nào để hiển thị.
        </div>
      )}
    </div>
  );
};
