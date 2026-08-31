import React, { useEffect, useRef, useState } from 'react';
import { useAppAuth } from '../../context/AuthContext';
import { CheckCircle2, Play, AlertCircle } from 'lucide-react';

export const extractYoutubeVideoId = (url) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
};

export const YoutubeEmbed = ({ contentId, youtubeUrl, initialProgress = 0, onProgressUpdate }) => {
  const { supabaseClient, user, role } = useAppAuth();
  const playerRef = useRef(null);
  const intervalRef = useRef(null);
  const containerId = `yt-player-${contentId}`;

  const [percentage, setPercentage] = useState(initialProgress);
  const [completed, setCompleted] = useState(initialProgress >= 90);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const videoId = extractYoutubeVideoId(youtubeUrl);

  const syncProgressToDb = async (currTime, totalDur, pct, isDone) => {
    if (role !== 'student' || !user?.id || !contentId) return;

    try {
      await supabaseClient
        .from('video_progress')
        .upsert(
          {
            student_id: user.id,
            content_id: contentId,
            watched_seconds: Math.round(currTime),
            duration: Math.round(totalDur),
            percentage: Math.min(100, Math.round(pct)),
            completed: isDone,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'student_id,content_id' }
        );
    } catch (err) {
      console.warn('Error saving video progress:', err);
    }
  };

  useEffect(() => {
    if (!videoId) return;

    let playerInstance = null;

    const onPlayerReady = (event) => {
      const dur = event.target.getDuration();
      if (dur > 0) setDuration(dur);
    };

    const onPlayerStateChange = (event) => {
      // YT.PlayerState.PLAYING is 1
      if (event.data === 1) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => {
          if (playerRef.current && playerRef.current.getCurrentTime) {
            const curr = playerRef.current.getCurrentTime();
            const dur = playerRef.current.getDuration() || 1;
            const pct = (curr / dur) * 100;
            const isDone = pct >= 90 || completed;

            setCurrentTime(curr);
            setDuration(dur);
            setPercentage(pct);
            if (isDone && !completed) {
              setCompleted(true);
            }

            if (onProgressUpdate) {
              onProgressUpdate({ currentTime: curr, duration: dur, percentage: pct, completed: isDone });
            }

            syncProgressToDb(curr, dur, pct, isDone);
          }
        }, 5000); // sync every 5 seconds
      } else {
        // Paused or Ended
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (playerRef.current && playerRef.current.getCurrentTime) {
          const curr = playerRef.current.getCurrentTime();
          const dur = playerRef.current.getDuration() || 1;
          const pct = (curr / dur) * 100;
          const isDone = pct >= 90 || completed;
          syncProgressToDb(curr, dur, pct, isDone);
        }
      }
    };

    const initPlayer = () => {
      if (window.YT && window.YT.Player) {
        playerInstance = new window.YT.Player(containerId, {
          videoId,
          playerVars: {
            playsinline: 1,
            modestbranding: 1,
            rel: 0,
          },
          events: {
            onReady: onPlayerReady,
            onStateChange: onPlayerStateChange,
          },
        });
        playerRef.current = playerInstance;
      }
    };

    if (!window.YT || !window.YT.Player) {
      if (!window.onYouTubeIframeAPIReady) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

        window.onYouTubeIframeAPIReady = () => {
          initPlayer();
        };
      } else {
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          prev();
          initPlayer();
        };
      }
    } else {
      initPlayer();
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (playerRef.current && playerRef.current.destroy) {
        playerRef.current.destroy();
      }
    };
  }, [videoId, contentId]);

  if (!videoId) {
    return (
      <div style={{
        padding: '32px',
        backgroundColor: 'var(--bg-subtle)',
        borderRadius: 'var(--radius-lg)',
        textAlign: 'center',
        color: 'var(--text-muted)'
      }}>
        <AlertCircle size={32} style={{ margin: '0 auto 8px' }} />
        <p>Đường dẫn YouTube không hợp lệ hoặc chưa được thiết lập.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Video Container 16:9 */}
      <div style={{
        position: 'relative',
        width: '100%',
        paddingBottom: '56.25%', // 16:9 ratio
        height: 0,
        overflow: 'hidden',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-md)',
        backgroundColor: '#000'
      }}>
        <div
          id={containerId}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
          }}
        />
      </div>

      {/* Progress Bar & Status */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        gap: '16px'
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            <span>Tiến độ xem bài học</span>
            <span style={{ fontWeight: '700', color: completed ? 'var(--success-600)' : 'var(--primary-600)' }}>
              {Math.min(100, Math.round(percentage))}% {completed && '(Đã hoàn thành)'}
            </span>
          </div>
          <div style={{
            width: '100%',
            height: '6px',
            backgroundColor: 'var(--bg-subtle)',
            borderRadius: 'var(--radius-full)',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${Math.min(100, Math.round(percentage))}%`,
              height: '100%',
              backgroundColor: completed ? 'var(--success-500)' : 'var(--primary-500)',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>

        {completed ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success-600)', fontSize: '0.8125rem', fontWeight: '600' }}>
            <CheckCircle2 size={18} />
            <span>Hoàn thành (≥90%)</span>
          </div>
        ) : (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Xem tối thiểu 90% để hoàn thành
          </span>
        )}
      </div>
    </div>
  );
};
