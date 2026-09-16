import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Heart, Bookmark, Share2, Eye, Clock, Sparkles } from 'lucide-react';
import { fetchVideoSource, fetchRelatedVideos } from '../utils/api';
import { isVideoSaved, toggleSaveVideo, addToWatchHistory } from '../utils/storage';

export default function VideoPlayer({ video, onClose, onSelectVideo }) {
  const [sourceUrl, setSourceUrl] = useState(video.videoSource || null);
  const [loading, setLoading] = useState(!video.videoSource);
  const [saved, setSaved] = useState(isVideoSaved(video.url));
  const [liked, setLiked] = useState(false);
  const [tapFeedback, setTapFeedback] = useState(null);
  const [relatedVideos, setRelatedVideos] = useState([]);
  const [loadingRelated, setLoadingRelated] = useState(true);
  const [loadingMoreRelated, setLoadingMoreRelated] = useState(false);
  const [relatedPage, setRelatedPage] = useState(1);
  const [hasMoreRelated, setHasMoreRelated] = useState(true);
  const [toast, setToast] = useState(null);

  const videoRef = useRef(null);
  const lastTapRef = useRef(0);
  const scrollContainerRef = useRef(null);

  // Lock background / home page scroll completely when player is open
  useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalOverscroll = document.body.style.overscrollBehavior;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overscrollBehavior = originalOverscroll;
    };
  }, []);

  // Telegram BackButton integration
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg?.BackButton) {
      tg.BackButton.show();
      const handleTgBack = () => onClose();
      tg.onEvent('backButtonClicked', handleTgBack);
      return () => {
        tg.BackButton.hide();
        tg.offEvent('backButtonClicked', handleTgBack);
      };
    }
  }, [onClose]);

  // Track in history
  useEffect(() => {
    addToWatchHistory(video);
    setSaved(isVideoSaved(video.url));
  }, [video]);

  // Fetch playable video source & related videos
  useEffect(() => {
    let isMounted = true;
    setLoading(!video.videoSource);
    setSourceUrl(video.videoSource || null);
    setLoadingRelated(true);
    setLoadingMoreRelated(false);
    setRelatedPage(1);
    setHasMoreRelated(true);
    setRelatedVideos([]);

    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }

    async function loadData() {
      // 1. Fetch Source if not already present
      if (!video.videoSource) {
        const src = await fetchVideoSource(video.url);
        if (isMounted) {
          if (src) {
            setSourceUrl(src);
          } else {
            showToast('Video source could not be resolved.');
          }
          setLoading(false);
        }
      } else {
        if (isMounted) setLoading(false);
      }

      // 2. Fetch Related suggestions (page 1)
      const rel = await fetchRelatedVideos(video.url, 1);
      if (isMounted) {
        setRelatedVideos(rel);
        setLoadingRelated(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [video]);

  // Infinite scroll loader for suggested videos
  const loadMoreRelated = async () => {
    if (loadingMoreRelated || !hasMoreRelated) return;
    setLoadingMoreRelated(true);
    const nextPage = relatedPage + 1;
    const more = await fetchRelatedVideos(video.url, nextPage);
    if (more && more.length > 0) {
      setRelatedVideos(prev => {
        const existingUrls = new Set(prev.map(p => p.url));
        const filtered = more.filter(m => !existingUrls.has(m.url) && m.url !== video.url);
        return [...prev, ...filtered];
      });
      setRelatedPage(nextPage);
    } else {
      setHasMoreRelated(false);
    }
    setLoadingMoreRelated(false);
  };

  const handleSuggestedScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + clientHeight) < 300) {
      loadMoreRelated();
    }
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleToggleSave = () => {
    const nowSaved = toggleSaveVideo(video);
    setSaved(nowSaved);
    showToast(nowSaved ? 'Added to Saved!' : 'Removed from Saved!');
  };

  const handleShare = () => {
    const botUsername = 'landytv_bot';
    const videoParam = btoa(video.url);
    const text = encodeURIComponent(`Watch "${video.title}" on Landy TV!`);
    const shareUrl = `https://t.me/share/url?url=https://t.me/${botUsername}?start=${videoParam}&text=${text}`;

    const tg = window.Telegram?.WebApp;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }
  };

  // Double Tap to Seek Forward / Backward
  const handleVideoAreaClick = (e) => {
    const now = Date.now();
    const timeDiff = now - lastTapRef.current;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const isRightSide = clickX > rect.width / 2;

    if (timeDiff < 300) {
      if (videoRef.current) {
        if (isRightSide) {
          videoRef.current.currentTime = Math.min(videoRef.current.duration, videoRef.current.currentTime + 10);
          setTapFeedback({ side: 'right', text: '+10s' });
        } else {
          videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
          setTapFeedback({ side: 'left', text: '-10s' });
        }
        setTimeout(() => setTapFeedback(null), 600);
      }
    }
    lastTapRef.current = now;
  };

  return (
    <div className="player-overlay">
      {/* Top Floating Header */}
      <div className="player-top-nav glass">
        <button className="icon-btn" onClick={onClose}>
          <ArrowLeft size={20} />
        </button>
        <span className="player-header-title">Now Playing</span>
        <div style={{ width: '40px' }} />
      </div>

      {/* Fixed Sticky Header for Video & Controls */}
      <div className="player-fixed-container">
        {/* Video Canvas Container */}
        <div className="video-canvas-wrapper" onClick={handleVideoAreaClick}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
              <div className="spinner" />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Resolving ultra-fast stream...</span>
            </div>
          ) : sourceUrl ? (
            <video 
              ref={videoRef}
              src={sourceUrl}
              poster={video.thumbnail}
              controls
              autoPlay
              playsInline
              className="video-player-el"
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--accent)' }}>
              <span>Failed to load video stream</span>
            </div>
          )}

          {/* Tap Feedback Badge */}
          {tapFeedback && (
            <div className={`tap-feedback ${tapFeedback.side}`}>
              {tapFeedback.text}
            </div>
          )}
        </div>

        {/* Pinned Info & Actions (NEVER scrolls away) */}
        <div className="player-pinned-controls">
          <div className="player-pinned-title-row">
            <h1 className="player-title" title={video.title}>{video.title}</h1>
          </div>

          <div className="player-meta-bar">
            <span className="views-badge">
              <Eye size={13} /> {video.views || '15K views'}
            </span>
            {video.duration && (
              <span className="views-badge">
                <Clock size={13} /> {video.duration}
              </span>
            )}
          </div>

          {/* Action Buttons: Like, Save, Share */}
          <div className="action-buttons-row">
            <button 
              className={`action-btn ${liked ? 'active-accent' : ''}`}
              onClick={() => setLiked(!liked)}
            >
              <Heart size={15} fill={liked ? '#ffffff' : 'none'} />
              <span>{liked ? 'Liked' : 'Like'}</span>
            </button>

            <button 
              className={`action-btn ${saved ? 'active-accent' : ''}`}
              onClick={handleToggleSave}
            >
              <Bookmark size={15} fill={saved ? '#ffffff' : 'none'} />
              <span>{saved ? 'Saved' : 'Save'}</span>
            </button>

            <button className="action-btn" onClick={handleShare}>
              <Share2 size={15} />
              <span>Share</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Scrollable Section (Smooth momentum scroll with infinite suggestions) */}
      <div 
        className="player-suggested-scrollable" 
        ref={scrollContainerRef}
        onScroll={handleSuggestedScroll}
      >
        <div className="suggested-header-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={14} color="var(--accent)" />
            <span className="suggested-heading">Up Next & Recommendations</span>
          </div>
          <span className="suggested-count">{loadingRelated ? 'Fetching...' : `${relatedVideos.length} loaded`}</span>
        </div>

        {/* Shimmer skeleton while loading initial suggestions */}
        {loadingRelated && (
          <div className="suggested-list">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={`skel-rel-${i}`} className="suggested-card-item" style={{ pointerEvents: 'none' }}>
                <div className="skeleton" style={{ width: '120px', minWidth: '120px', aspectRatio: '16/9', borderRadius: '8px' }} />
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '6px', justifyContent: 'center' }}>
                  <div className="skeleton" style={{ height: '14px', width: '92%' }} />
                  <div className="skeleton" style={{ height: '11px', width: '55%' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loadingRelated && relatedVideos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
            No more suggestions right now.
          </div>
        ) : (
          !loadingRelated && (
            <>
              <div className="suggested-list">
                {relatedVideos.map((rel, idx) => (
                  <div 
                    key={`${rel.url}-${idx}`}
                    className="suggested-card-item"
                    onClick={() => onSelectVideo(rel)}
                  >
                    <div style={{ width: '120px', minWidth: '120px', aspectRatio: '16/9', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
                      <img 
                        src={rel.thumbnail || '/logo.jpg'} 
                        alt={rel.title} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        loading="lazy"
                        onError={(e) => { e.target.src = '/logo.jpg'; }}
                      />
                      {rel.duration && (
                        <span className="duration-chip" style={{ fontSize: '0.65rem', padding: '2px 4px' }}>
                          {rel.duration}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, minWidth: 0 }}>
                      <h4 style={{ 
                        fontSize: '0.82rem', 
                        fontWeight: 600, 
                        color: 'var(--text-main)', 
                        lineHeight: '1.3',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {rel.title}
                      </h4>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                        {rel.views || '10K views'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Endless Scroll Loading Indicator */}
              {loadingMoreRelated && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 0', gap: '8px' }}>
                  <div className="spinner" style={{ width: '20px', height: '20px', margin: 0, borderWidth: '2px' }} />
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Loading more recommendations...</span>
                </div>
              )}
            </>
          )
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--accent-gradient)',
          color: '#ffffff',
          padding: '10px 20px',
          borderRadius: 'var(--radius-full)',
          fontSize: '0.85rem',
          fontWeight: 700,
          boxShadow: '0 8px 20px rgba(0,0,0,0.5)',
          zIndex: 200,
          animation: 'tapPop 0.3s ease-out'
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
