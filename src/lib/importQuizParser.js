/**
 * importQuizParser.js
 *
 * Parse + validate file JSON/CSV chứa câu hỏi trắc nghiệm từ AI ngoài.
 *
 * Tách rõ 2 tầng lỗi:
 *   Tầng 1 — FileParseError: file-level, throw ngay, không thể tiếp tục.
 *   Tầng 2 — per-question errors: validate từng câu độc lập, không fail cả file.
 *
 * SECURITY NOTE: Tất cả nội dung từ file AI được xử lý là plain text.
 * Không dùng dangerouslySetInnerHTML ở bất kỳ đâu với dữ liệu này.
 * Nếu sau này cần rich-text render, phải sanitize bằng DOMPurify trước.
 */

import { z } from 'zod';
import Papa from 'papaparse';

// ─── Custom Error class ────────────────────────────────────────────────────────

export class FileParseError extends Error {
  constructor(userMessage, originalError) {
    super(userMessage);
    this.name = 'FileParseError';
    this.originalError = originalError;
  }
}

// ─── Zod schema cho từng câu hỏi (raw từ file) ────────────────────────────────

const RawQuestionSchema = z.object({
  question: z.string().min(1, 'Nội dung câu hỏi không được để trống'),
  options: z
    .array(z.string())
    .min(2, 'Cần ít nhất 2 đáp án')
    .max(8, 'Tối đa 8 đáp án'),
  correct_answer: z.number().int('correct_answer phải là số nguyên'),
  explanation: z.string().optional().default(''),
});

// ─── Tầng 1: Làm sạch + Parse file ───────────────────────────────────────────

/**
 * Xóa BOM, code fence (```json...```) và whitespace thừa mà AI hay thêm vào.
 */
function cleanJsonString(raw) {
  // Xóa BOM UTF-8
  let s = raw.replace(/^\uFEFF/, '');
  // Xóa code fence: ```json ... ``` hoặc ``` ... ```
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return s.trim();
}

/**
 * Parse file JSON.
 * @throws {FileParseError} nếu file sai cú pháp hoặc thiếu field `questions`.
 */
function parseJsonFile(text) {
  let parsed;
  try {
    parsed = JSON.parse(cleanJsonString(text));
  } catch (err) {
    throw new FileParseError(
      'File JSON không đúng cú pháp. Hãy thử: (1) copy lại prompt mẫu, (2) yêu cầu AI "chỉ trả JSON thuần, không thêm giải thích hay markdown", (3) lưu file và upload lại.',
      err
    );
  }

  const questions = parsed?.questions;
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new FileParseError(
      'File JSON hợp lệ nhưng thiếu mảng "questions" hoặc mảng rỗng. Kiểm tra lại cấu trúc file theo schema mẫu.',
      null
    );
  }

  return { title: parsed.quiz_title || '', rawQuestions: questions };
}

/**
 * Parse file CSV (dùng papaparse).
 * Cột chuẩn: question, option_a, option_b, option_c, option_d, correct_answer (a/b/c/d), explanation
 * @throws {FileParseError} nếu CSV không có cột bắt buộc.
 */
function parseCsvFile(text) {
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
  });

  if (result.errors && result.errors.length > 0) {
    const firstErr = result.errors[0];
    throw new FileParseError(
      `File CSV bị lỗi cú pháp ở dòng ${firstErr.row + 2}: ${firstErr.message}. Kiểm tra lại định dạng CSV.`,
      new Error(firstErr.message)
    );
  }

  const rows = result.data;
  if (!rows || rows.length === 0) {
    throw new FileParseError('File CSV rỗng hoặc không có dòng dữ liệu.', null);
  }

  // Kiểm tra cột bắt buộc
  const requiredCols = ['question', 'option_a', 'option_b', 'correct_answer'];
  const headers = Object.keys(rows[0]);
  const missingCols = requiredCols.filter((c) => !headers.includes(c));
  if (missingCols.length > 0) {
    throw new FileParseError(
      `File CSV thiếu cột bắt buộc: ${missingCols.join(', ')}. Cột chuẩn: question, option_a, option_b, option_c, option_d, correct_answer, explanation.`,
      null
    );
  }

  // Chuyển đổi từng dòng CSV sang cấu trúc raw question
  const LETTER_TO_INDEX = { a: 0, b: 1, c: 2, d: 3, e: 4, f: 5, g: 6, h: 7 };

  const rawQuestions = rows.map((row) => {
    const options = ['option_a', 'option_b', 'option_c', 'option_d', 'option_e', 'option_f']
      .map((col) => row[col])
      .filter((v) => v && v.trim() !== '');

    const correctLetter = (row['correct_answer'] || '').trim().toLowerCase();
    const correctIndex = LETTER_TO_INDEX[correctLetter] ?? -1;

    return {
      question: (row['question'] || '').trim(),
      options,
      correct_answer: correctIndex,
      explanation: (row['explanation'] || '').trim(),
    };
  });

  return { title: '', rawQuestions };
}

/**
 * Tầng 1 entry point — dispatch theo loại file.
 * @param {string} text — nội dung file dạng string
 * @param {'json'|'csv'} fileType
 * @returns {{ title: string, rawQuestions: object[] }}
 * @throws {FileParseError}
 */
export function parseFile(text, fileType) {
  if (fileType === 'json') return parseJsonFile(text);
  if (fileType === 'csv') return parseCsvFile(text);
  throw new FileParseError(`Định dạng file không được hỗ trợ: ${fileType}. Chỉ chấp nhận .json và .csv.`, null);
}

// ─── Tầng 2: Validate từng câu độc lập ────────────────────────────────────────

/**
 * Validate danh sách câu hỏi raw. Không throw — luôn trả về 2 nhóm.
 *
 * @param {object[]} rawQuestions — mảng câu hỏi raw từ parseFile()
 * @param {Set<string>} existingContents — Set các content đã có trong DB (trim+lowercase)
 * @returns {{ validQuestions: ParsedQuestion[], invalidQuestions: InvalidQuestion[] }}
 */
export function validateQuestions(rawQuestions, existingContents = new Set()) {
  const validQuestions = [];
  const invalidQuestions = [];

  // Track nội dung trong file để phát hiện trùng lặp nội bộ
  const seenInFile = new Set();

  rawQuestions.forEach((raw, index) => {
    const errors = [];

    // Zod validate
    const parseResult = RawQuestionSchema.safeParse(raw);

    if (!parseResult.success) {
      parseResult.error.issues.forEach((issue) => {
        const field = issue.path.join('.');
        errors.push(`${field ? `[${field}] ` : ''}${issue.message}`);
      });
    } else {
      const data = parseResult.data;

      // Kiểm tra correct_answer nằm trong phạm vi options
      if (data.correct_answer < 0 || data.correct_answer >= data.options.length) {
        errors.push(
          `correct_answer = ${data.correct_answer} nằm ngoài phạm vi (options có ${data.options.length} phần tử, index hợp lệ: 0–${data.options.length - 1})`
        );
      }

      if (errors.length === 0) {
        const normalizedContent = data.question.trim().toLowerCase();

        // Kiểm tra trùng trong file
        if (seenInFile.has(normalizedContent)) {
          errors.push('Câu hỏi này bị trùng lặp với câu khác trong cùng file import');
        }
        // Kiểm tra trùng với ngân hàng câu hỏi hiện có trong DB
        else if (existingContents.has(normalizedContent)) {
          errors.push('Câu hỏi này đã tồn tại trong ngân hàng câu hỏi của khóa học');
        } else {
          seenInFile.add(normalizedContent);
        }
      }
    }

    if (errors.length === 0) {
      const data = parseResult.data;
      // Chuyển sang cấu trúc nội bộ chuẩn hóa
      validQuestions.push({
        _id: `import_${index}_${Date.now()}`, // ID tạm thời cho React key
        content: data.question.trim(),
        explanation: data.explanation || '',
        options: data.options.map((opt, i) => ({
          content: opt.trim(),
          is_correct: i === data.correct_answer,
        })),
      });
    } else {
      invalidQuestions.push({
        _id: `invalid_${index}_${Date.now()}`,
        originalIndex: index + 1, // 1-based để hiển thị cho user
        raw, // giữ nguyên để user sửa
        errors,
        // Trạng thái sửa tay
        editedContent: raw.question || '',
        editedOptions: (raw.options || ['', '', '', '']).map((o, i) => ({
          content: typeof o === 'string' ? o : '',
          is_correct: i === raw.correct_answer,
        })),
        editedExplanation: raw.explanation || '',
      });
    }
  });

  return { validQuestions, invalidQuestions };
}
