/**
 * ImportQuizModal.jsx
 *
 * Modal 4-step để import hàng loạt câu hỏi trắc nghiệm từ file JSON/CSV do AI ngoài tạo.
 *
 * Step 1 — Hướng dẫn & Prompt mẫu (Copy prompt)
 * Step 2 — Upload file (.json / .csv) + parse
 * Step 3 — Review & sửa lỗi (dùng ImportReviewStep)
 * Step 4 — Kết quả sau publish
 *
 * Không có lệnh gọi AI nào trong luồng này (free-tier).
 */

import React, { useState, useRef, useCallback } from 'react';
import { useAppAuth } from '../../context/AuthContext';
import { ImportReviewStep } from './ImportReviewStep';
import { parseFile, validateQuestions, FileParseError } from '../../lib/importQuizParser';
import {
  X,
  Copy,
  Check,
  Upload,
  FileJson,
  FileText,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Info,
} from 'lucide-react';

// ─── Prompt mẫu ───────────────────────────────────────────────────────────────

const SAMPLE_PROMPT = `Đọc đề thi trắc nghiệm trong file đính kèm và chuyển thành JSON theo đúng cấu trúc sau, không thêm bất kỳ văn bản, giải thích hay markdown code fence nào khác ngoài JSON thuần:

{
  "quiz_title": "Tên đề thi",
  "questions": [
    {
      "question": "Nội dung câu hỏi",
      "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
      "correct_answer": 0,
      "explanation": "Giải thích ngắn gọn vì sao đáp án đúng (nếu có trong đề, không có thì để chuỗi rỗng)"
    }
  ]
}

Lưu ý: correct_answer là số thứ tự đáp án đúng, đếm từ 0. Giữ nguyên số lượng câu hỏi và nội dung câu hỏi/đáp án như trong file gốc, không tự bịa thêm.`;

// ─── Step indicator ────────────────────────────────────────────────────────────

const STEPS = ['Hướng dẫn', 'Upload file', 'Xem trước', 'Kết quả'];

const StepIndicator = ({ currentStep }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '28px' }}>
    {STEPS.map((label, idx) => {
      const stepNum = idx + 1;
      const isDone = stepNum < currentStep;
      const isActive = stepNum === currentStep;
      return (
        <React.Fragment key={stepNum}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', minWidth: '60px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isDone
                  ? 'var(--success-500)'
                  : isActive
                  ? 'var(--primary-500)'
                  : 'var(--bg-subtle)',
                color: isDone || isActive ? '#fff' : 'var(--text-muted)',
                fontWeight: '800',
                fontSize: '0.8125rem',
                transition: 'all 0.2s',
              }}
            >
              {isDone ? <Check size={14} /> : stepNum}
            </div>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: isActive ? '700' : '500',
                color: isActive ? 'var(--primary-600)' : isDone ? 'var(--success-600)' : 'var(--text-muted)',
                textAlign: 'center',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </span>
          </div>
          {idx < STEPS.length - 1 && (
            <div
              style={{
                flex: 1,
                height: '2px',
                backgroundColor: isDone ? 'var(--success-400)' : 'var(--border-subtle)',
                marginBottom: '18px',
                transition: 'background-color 0.3s',
              }}
            />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

// ─── Main Component ────────────────────────────────────────────────────────────

export const ImportQuizModal = ({ isOpen, onClose, courseId, classId, onSaved }) => {
  const { supabaseClient } = useAppAuth();

  const [step, setStep] = useState(1);
  const [copied, setCopied] = useState(false);

  // Step 2: upload
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState(null); // FileParseError message
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef(null);

  // Step 3: review
  const [parsedTitle, setParsedTitle] = useState('');
  const [validQuestions, setValidQuestions] = useState([]);
  const [invalidQuestions, setInvalidQuestions] = useState([]);

  // Step 4: publish
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState(null);
  const [publishedCount, setPublishedCount] = useState(0);

  // Review step callback (phải gọi hook trước mọi early return)
  const handleQuestionsChange = useCallback((valid, invalid) => {
    setValidQuestions(valid);
    setInvalidQuestions(invalid);
  }, []);

  if (!isOpen) return null;

  // ─── Copy prompt ─────────────────────────────────────────────────────────────

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(SAMPLE_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback: select text manually
    }
  };

  // ─── File upload & parse ──────────────────────────────────────────────────────

  const processFile = async (file) => {
    setFileError(null);
    setFileName(file.name);

    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'json' && ext !== 'csv') {
      setFileError('Chỉ chấp nhận file .json hoặc .csv.');
      return;
    }

    let text;
    try {
      text = await file.text();
    } catch {
      setFileError('Không đọc được nội dung file. Thử lại với file khác.');
      return;
    }

    // Tầng 1: parse file (có thể throw FileParseError)
    let parsed;
    try {
      parsed = parseFile(text, ext);
    } catch (err) {
      if (err instanceof FileParseError) {
        setFileError(err.message);
      } else {
        setFileError('Đã xảy ra lỗi không xác định khi đọc file.');
      }
      return;
    }

    // Fetch câu hỏi đã có trong ngân hàng để kiểm tra trùng lặp
    let existingSet = new Set();
    try {
      const { data: existing } = await supabaseClient
        .from('questions')
        .select('content')
        .eq('course_id', courseId);
      existingSet = new Set((existing || []).map((q) => q.content.trim().toLowerCase()));
    } catch {
      // Không fail nếu fetch lỗi — chỉ bỏ qua bước check trùng với DB
    }

    // Tầng 2: validate từng câu
    const { validQuestions: vq, invalidQuestions: iq } = validateQuestions(
      parsed.rawQuestions,
      existingSet
    );

    setParsedTitle(parsed.title);
    setValidQuestions(vq);
    setInvalidQuestions(iq);
    setStep(3);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset input để có thể chọn lại cùng file
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };



  // ─── Publish ──────────────────────────────────────────────────────────────────

  const handlePublish = async () => {
    if (validQuestions.length === 0) return;

    setPublishing(true);
    setPublishError(null);

    try {
      // Chuẩn bị payload cho Postgres RPC
      const payload = validQuestions.map((q) => ({
        content: q.content,
        explanation: q.explanation,
        options: q.options, // [{ content, is_correct }]
      }));

      const { data, error } = await supabaseClient.rpc('insert_quiz_questions_batch', {
        p_course_id: courseId,
        p_class_id: classId,
        p_questions: payload,
      });

      if (error) throw error;

      setPublishedCount(data?.inserted_count ?? validQuestions.length);
      if (onSaved) onSaved();
      setStep(4);
    } catch (err) {
      console.error('Publish error:', err);
      setPublishError(
        err.message?.includes('Forbidden')
          ? 'Bạn không có quyền thêm câu hỏi vào khóa học này.'
          : `Đã xảy ra lỗi khi lưu: ${err.message}`
      );
    } finally {
      setPublishing(false);
    }
  };

  // ─── Reset & Close ────────────────────────────────────────────────────────────

  const handleClose = () => {
    setStep(1);
    setCopied(false);
    setFileError(null);
    setFileName('');
    setParsedTitle('');
    setValidQuestions([]);
    setInvalidQuestions([]);
    setPublishing(false);
    setPublishError(null);
    setPublishedCount(0);
    onClose();
  };

  // ─── Styles ───────────────────────────────────────────────────────────────────

  const overlayStyle = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: '16px',
  };

  const modalStyle = {
    maxWidth: '760px',
    width: '100%',
    maxHeight: '92vh',
    overflowY: 'auto',
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    padding: '32px',
    position: 'relative',
    boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
  };

  return (
    <div style={overlayStyle}>
      <div className="glass-card" style={modalStyle}>
        {/* Close button */}
        <button
          onClick={handleClose}
          style={{
            position: 'absolute', top: '16px', right: '16px',
            background: 'none', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', padding: '4px', borderRadius: 'var(--radius-sm)',
          }}
          title="Đóng"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '1.375rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Import Câu Hỏi Từ File
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Dùng AI bên ngoài để chuyển đề thi thành file JSON/CSV, rồi upload vào đây.
          </p>
        </div>

        <StepIndicator currentStep={step} />

        {/* ════════════ STEP 1: Hướng dẫn & Prompt mẫu ════════════ */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* 4-step guide */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
              {[
                { num: '1', icon: '📋', title: 'Copy prompt', desc: 'Sao chép prompt mẫu bên dưới' },
                { num: '2', icon: '🤖', title: 'Hỏi AI', desc: 'Mở ChatGPT, Gemini, Claude… đính kèm file đề thi và dán prompt vào' },
                { num: '3', icon: '💾', title: 'Lưu file', desc: 'AI trả JSON → copy → lưu thành file .json' },
                { num: '4', icon: '⬆️', title: 'Upload', desc: 'Quay lại đây, bấm Tiếp theo rồi upload file' },
              ].map((item) => (
                <div
                  key={item.num}
                  style={{
                    padding: '14px',
                    backgroundColor: 'var(--bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div style={{ fontSize: '1.25rem' }}>{item.icon}</div>
                  <p style={{ fontSize: '0.8125rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                    <span style={{ color: 'var(--primary-500)', marginRight: '4px' }}>Bước {item.num}.</span>
                    {item.title}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.desc}</p>
                </div>
              ))}
            </div>

            {/* Prompt mẫu */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                  Prompt mẫu (copy và dán vào AI):
                </label>
                <button
                  onClick={handleCopyPrompt}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '100px' }}
                >
                  {copied ? <><Check size={14} /> Đã copy!</> : <><Copy size={14} /> Copy</>}
                </button>
              </div>
              <pre
                style={{
                  backgroundColor: 'var(--bg-page)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 16px',
                  fontSize: '0.7813rem',
                  color: 'var(--text-primary)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  lineHeight: 1.6,
                  fontFamily: "'Fira Code', 'Cascadia Code', monospace",
                  maxHeight: '220px',
                  overflowY: 'auto',
                  margin: 0,
                }}
              >
                {SAMPLE_PROMPT}
              </pre>
            </div>

            {/* Ví dụ output mẫu */}
            <div style={{ padding: '12px 14px', backgroundColor: 'var(--primary-50)', borderRadius: 'var(--radius-md)', border: '1px solid var(--primary-100)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <Info size={14} color="var(--primary-500)" />
                <span style={{ fontSize: '0.8125rem', fontWeight: '700', color: 'var(--primary-700)' }}>
                  Ví dụ output AI nên trả về (1 câu):
                </span>
              </div>
              <pre style={{ fontSize: '0.75rem', color: 'var(--primary-800)', margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
{`{
  "quiz_title": "Kiểm tra Toán lớp 10",
  "questions": [
    {
      "question": "Kết quả của 2 + 2 là?",
      "options": ["3", "4", "5", "6"],
      "correct_answer": 1,
      "explanation": "2 + 2 = 4, đáp án ở vị trí index 1 (đếm từ 0)."
    }
  ]
}`}
              </pre>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <button className="btn btn-secondary" onClick={handleClose}>Hủy</button>
              <button
                className="btn btn-primary"
                onClick={() => setStep(2)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                Tiếp theo <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ════════════ STEP 2: Upload file ════════════ */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Dropzone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${isDragging ? 'var(--primary-500)' : fileError ? 'var(--danger-400)' : 'var(--border-subtle)'}`,
                borderRadius: 'var(--radius-lg)',
                padding: '48px 24px',
                textAlign: 'center',
                cursor: 'pointer',
                backgroundColor: isDragging ? 'var(--primary-50)' : fileError ? 'var(--danger-50)' : 'var(--bg-subtle)',
                transition: 'all 0.2s',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.csv"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <Upload size={36} color={fileError ? 'var(--danger-400)' : 'var(--primary-400)'} style={{ margin: '0 auto 12px' }} />
              <p style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>
                {fileName ? `Đã chọn: ${fileName}` : 'Kéo thả file vào đây hoặc bấm để chọn'}
              </p>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Hỗ trợ: <span style={{ fontWeight: '600' }}>.json</span> và <span style={{ fontWeight: '600' }}>.csv</span>
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                  <FileJson size={18} color="var(--primary-500)" /> JSON
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                  <FileText size={18} color="var(--success-500)" /> CSV
                </div>
              </div>
            </div>

            {/* File error */}
            {fileError && (
              <div
                style={{
                  display: 'flex',
                  gap: '10px',
                  padding: '12px 14px',
                  backgroundColor: 'var(--danger-50)',
                  border: '1px solid var(--danger-200)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--danger-700)',
                  fontSize: '0.875rem',
                }}
              >
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
                <div>
                  <p style={{ fontWeight: '700', marginBottom: '2px' }}>Không thể đọc file</p>
                  <p>{fileError}</p>
                  <button
                    onClick={() => setStep(1)}
                    style={{
                      marginTop: '6px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary-600)',
                      cursor: 'pointer',
                      fontSize: '0.8125rem',
                      fontWeight: '600',
                      padding: 0,
                      textDecoration: 'underline',
                    }}
                  >
                    ← Xem lại prompt mẫu
                  </button>
                </div>
              </div>
            )}

            {/* CSV schema hint */}
            <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>Cột CSV chuẩn:</strong>{' '}
              question, option_a, option_b, option_c, option_d, correct_answer (a/b/c/d), explanation
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: '4px' }}>
              <button className="btn btn-secondary" onClick={() => setStep(1)}>← Quay lại</button>
            </div>
          </div>
        )}

        {/* ════════════ STEP 3: Review ════════════ */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {parsedTitle && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: '600' }}>Tiêu đề đề thi:</span>
                <span style={{ fontSize: '0.9375rem', fontWeight: '700', color: 'var(--primary-700)' }}>{parsedTitle}</span>
              </div>
            )}

            <ImportReviewStep
              initialValidQuestions={validQuestions}
              initialInvalidQuestions={invalidQuestions}
              onQuestionsChange={handleQuestionsChange}
            />

            {publishError && (
              <div
                style={{
                  display: 'flex', gap: '8px', padding: '10px 14px',
                  backgroundColor: 'var(--danger-50)', borderRadius: 'var(--radius-md)',
                  color: 'var(--danger-700)', fontSize: '0.875rem',
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                {publishError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
              <button className="btn btn-secondary" onClick={() => setStep(2)}>
                ← Upload file khác
              </button>
              <button
                className="btn btn-primary"
                onClick={handlePublish}
                disabled={publishing || validQuestions.length === 0}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '180px', justifyContent: 'center' }}
              >
                {publishing ? (
                  <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Đang lưu...</>
                ) : (
                  <>Publish {validQuestions.length} câu hỏi</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ════════════ STEP 4: Kết quả ════════════ */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '24px 0' }}>
            <div
              style={{
                width: '72px', height: '72px', borderRadius: '50%',
                backgroundColor: 'var(--success-100)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <CheckCircle2 size={36} color="var(--success-600)" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>
                Import thành công!
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
                Đã thêm{' '}
                <strong style={{ color: 'var(--success-700)', fontSize: '1.125rem' }}>{publishedCount}</strong>{' '}
                câu hỏi vào ngân hàng câu hỏi của khóa học.
              </p>
              {invalidQuestions.length > 0 && (
                <p style={{ marginTop: '8px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  ({invalidQuestions.length} câu bị lỗi đã không được lưu — bạn có thể thêm thủ công sau.)
                </p>
              )}
            </div>
            <button className="btn btn-primary" onClick={handleClose} style={{ minWidth: '160px' }}>
              Xong
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
