import React, { useState } from 'react';
import { useAppAuth } from '../../context/AuthContext';
import { uploadFileToStorage } from '../../lib/storage';
import { 
  Video, 
  FileText, 
  Plus, 
  Trash2, 
  Upload, 
  ExternalLink, 
  Check, 
  AlertCircle,
  X 
} from 'lucide-react';

export const LessonContentEditor = ({ classId, lessonId, contents = [], onUpdate }) => {
  const { supabaseClient } = useAppAuth();
  const [activeTab, setActiveTab] = useState('video'); // 'video' | 'document'
  const [title, setTitle] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [isAdding, setIsAdding] = useState(false);

  const handleAddVideo = async (e) => {
    e.preventDefault();
    setError(null);
    setUploading(true);

    try {
      if (!youtubeUrl.trim()) throw new Error('Vui lòng nhập đường dẫn YouTube.');

      const nextOrder = contents.length;
      const { error: insertErr } = await supabaseClient
        .from('lesson_contents')
        .insert({
          lesson_id: lessonId,
          class_id: classId,
          type: 'video',
          title: title.trim() || 'Video bài giảng',
          content_data: { youtube_url: youtubeUrl.trim() },
          order_index: nextOrder,
        });

      if (insertErr) throw insertErr;

      setTitle('');
      setYoutubeUrl('');
      setIsAdding(false);
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Error adding video content:', err);
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleAddDocument = async (e) => {
    e.preventDefault();
    setError(null);
    setUploading(true);

    try {
      if (!file) throw new Error('Vui lòng chọn file tài liệu PDF hoặc Word.');

      // Upload file to materials bucket
      const uploadRes = await uploadFileToStorage(supabaseClient, 'materials', classId, file);

      const nextOrder = contents.length;
      const { error: insertErr } = await supabaseClient
        .from('lesson_contents')
        .insert({
          lesson_id: lessonId,
          class_id: classId,
          type: 'document',
          title: title.trim() || file.name,
          content_data: { 
            storage_path: uploadRes.path,
            file_name: file.name,
            file_size: file.size
          },
          order_index: nextOrder,
        });

      if (insertErr) throw insertErr;

      setTitle('');
      setFile(null);
      setIsAdding(false);
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Error adding document content:', err);
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteContent = async (contentId) => {
    if (!window.confirm('Bạn có chắc muốn xóa nội dung này khỏi bài học?')) return;
    try {
      const { error: delErr } = await supabaseClient
        .from('lesson_contents')
        .delete()
        .eq('id', contentId);

      if (delErr) throw delErr;
      if (onUpdate) onUpdate();
    } catch (err) {
      alert('Không thể xóa: ' + err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
      {/* List Existing Contents */}
      {contents.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {contents.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                backgroundColor: 'var(--bg-page)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {item.type === 'video' ? (
                  <Video size={18} color="var(--danger-500)" />
                ) : (
                  <FileText size={18} color="var(--primary-500)" />
                )}
                <div>
                  <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                    {item.title}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                    {item.type === 'video' ? 'YouTube Video' : 'Tài liệu học tập'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleDeleteContent(item.id)}
                className="btn btn-secondary btn-sm"
                style={{ padding: '6px', color: 'var(--danger-600)' }}
                title="Xóa nội dung"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Content Form or Button */}
      {isAdding ? (
        <div style={{
          padding: '16px',
          backgroundColor: 'var(--bg-subtle)',
          borderRadius: 'var(--radius-md)',
          border: '1px dashed var(--primary-300)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className={`btn btn-sm ${activeTab === 'video' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('video')}
              >
                <Video size={14} /> Nhúng Video YouTube
              </button>
              <button
                type="button"
                className={`btn btn-sm ${activeTab === 'document' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('document')}
              >
                <FileText size={14} /> Tải Tài liệu (PDF/Word)
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              <X size={16} />
            </button>
          </div>

          {error && (
            <div style={{
              backgroundColor: 'var(--danger-50)',
              color: 'var(--danger-600)',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8125rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'video' ? (
            <form onSubmit={handleAddVideo} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Tiêu đề video bài giảng (tùy chọn)"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem'
                }}
              />
              <input
                type="url"
                required
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="Đường dẫn YouTube (VD: https://www.youtube.com/watch?v=...)"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem'
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsAdding(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={uploading}>
                  {uploading ? 'Đang lưu...' : '+ Thêm Video'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleAddDocument} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Tên tài liệu (VD: Bài tập tự luyện chuyên đề Hàm Số)"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem'
                }}
              />
              <input
                type="file"
                required
                accept=".pdf,.doc,.docx,.ppt,.pptx"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem'
                }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Hỗ trợ PDF, Word, PowerPoint (Tối đa 10MB/file)
              </span>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsAdding(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={uploading || !file}>
                  {uploading ? 'Đang tải lên...' : '+ Tải lên Tài liệu'}
                </button>
              </div>
            </form>
          )}
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setIsAdding(true)}
          style={{ width: 'fit-content', borderStyle: 'dashed' }}
        >
          <Plus size={14} /> Thêm Video hoặc Tài liệu vào bài này
        </button>
      )}
    </div>
  );
};
