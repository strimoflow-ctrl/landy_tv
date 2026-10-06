import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Heart, Bookmark, Share2, Eye, Clock, Sparkles, Maximize, Minimize, Zap, Play } from 'lucide-react';
import { fetchVideoSource, fetchRelatedVideos } from '../utils/api';
import { isVideoSaved, toggleSaveVideo, addToWatchHistory } from '../utils/storage';
import { showRewardedAd } from '../utils/monetag';

export default function VideoPlayer({ 
  video, 
  onClose, 
  onSelectVideo, 
  watchTimeSeconds = 180, 
  setWatchTimeSeconds, 
  onOpenEarnTime,
  userId
}) {
  const [sourceUrl, setSourceUrl] = useState(video.videoSource || null);
  const [loading, setLoading] = useState(!video.videoSource);
  const [saved, setSaved] = useState(isVideoSaved(video.url));
  const [liked, setLiked] = useState(false);
  const [tapFeedback, setTapFeedback] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [relatedVideos, setRelatedVideos] = useState([]);
  const [loadingRelated, setLoadingRelated] = useState(true);
  const [loadingMoreRelated, setLoadingMoreRelated] = useState(false);
  const [relatedPage, setRelatedPage] = useState(1);
  const [hasMoreRelated, setHasMoreRelated] = useState(true);
  const [toast, setToast] = useState(null);
  const [showTimeOutModal, setShowTimeOutModal] = useState(false);
  const [adLoading, setAdLoading] = useState(false);

  const videoRef = useRef(null);
  const lastTapRef = useRef(0);
  const scrollContainerRef = useRef(null);
  const isPlayingRef = useRef(false);
  const pendingDeductionRef = useRef(0);

  // Format seconds to mm:ss
  const formatTime = (secs) => {
    if (!secs || secs <= 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Watch Time Countdown Engine while video is playing
  useEffect(() => {
    const timer = setInterval(() => {
      const v = videoRef.current;
      if (v && !v.paused && !v.ended && v.readyState > 2) {
        setWatchTimeSeconds(prev => {
          const current = prev !== undefined ? prev : 180;
          if (current <= 1) {
            // Time out!
            v.pause();
            setShowTimeOutModal(true);
            return 0;
          }
          pendingDeductionRef.current += 1;
          return current - 1;
        });
      }
    }, 1000);

    // Sync deducted watch time with Firebase periodically every 15s
    const syncTimer = setInterval(() => {
      if (pendingDeductionRef.current > 0 && userId && userId !== 'guest_user') {
        const toDeduct = pendingDeductionRef.current;
        pendingDeductionRef.current = 0;
        fetch('/api/user/watch-time', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, deltaSeconds: -toDeduct })
        }).catch(e => console.warn('Watch time sync error:', e));
      }
    }, 15000);

    return () => {
      clearInterval(timer);
      clearInterval(syncTimer);
      // Flush pending on unmount
      if (pendingDeductionRef.current > 0 && userId && userId !== 'guest_user') {
        const toDeduct = pendingDeductionRef.current;
        pendingDeductionRef.current = 0;
        fetch('/api/user/watch-time', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, deltaSeconds: -toDeduct })
        }).catch(() => {});
      }
    };
  }, [userId, setWatchTimeSeconds]);

  // Handle Quick Refill from timeout modal (+60s)
  const handleWatchAdRefill = async () => {
    if (adLoading) return;
    setAdLoading(true);
    try {
      const res = await showRewardedAd();
      if (res && res.success) {
        const addedSeconds = 60;
        setWatchTimeSeconds(prev => (prev || 0) + addedSeconds);
        setShowTimeOutModal(false);

        if (userId && userId !== 'guest_user') {
          fetch('/api/user/watch-time', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, deltaSeconds: addedSeconds })
          }).catch(() => {});
        }

        showToast('⚡ +1 Minute Watch Time Added! Resuming video...');
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.play().catch(() => {});
          }
        }, 500);
      } else {
        alert(res?.error || 'Ad was closed early. Complete ad to get watch time.');
      }
    } catch (e) {
      console.error('Ad Error:', e);
    } finally {
      setAdLoading(false);
    }
  };

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

  // Fullscreen toggle: Hybrid Native + Telegram Mini App + CSS Theater fallback
  const toggleFullscreen = async (e) => {
    if (e) e.stopPropagation();

    // 1. If currently fullscreen, exit
    if (isFullscreen || document.fullscreenElement || document.webkitFullscreenElement) {
      setIsFullscreen(false);
      try {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
      } catch (err) {}

      const tg = window.Telegram?.WebApp;
      if (tg?.exitFullscreen) {
        try { tg.exitFullscreen(); } catch (err) {}
      }
      return;
    }

    // 2. Try Telegram Mini App 8.0 API
    const tg = window.Telegram?.WebApp;
    if (tg?.requestFullscreen) {
      try { tg.requestFullscreen(); } catch (err) {}
    } else if (tg?.expand) {
      try { tg.expand(); } catch (err) {}
    }

    // 3. Try iOS WebKit Fullscreen (Safari & iOS Telegram)
    if (videoRef.current?.webkitEnterFullscreen) {
      try {
        videoRef.current.webkitEnterFullscreen();
        return;
      } catch (err) {}
    }

    // 4. Try Standard HTML5 Request Fullscreen
    const el = videoRef.current;
    if (el?.requestFullscreen) {
      try {
        await el.requestFullscreen();
        setIsFullscreen(true);
        return;
      } catch (err) {}
    } else if (el?.webkitRequestFullscreen) {
      try {
        await el.webkitRequestFullscreen();
        setIsFullscreen(true);
        return;
      } catch (err) {}
    }

    // 5. 100% Reliable Fallback: CSS Theater Fullscreen (works in all Telegram in-app WebViews)
    setIsFullscreen(true);
  };

  // Listen to native fullscreen changes
  useEffect(() => {
    const handleFsChange = () => {
      const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
      setIsFullscreen(isFs);
    };

    const handleWebkitEnd = () => {
      setIsFullscreen(false);
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);

    const vEl = videoRef.current;
    if (vEl) {
      vEl.addEventListener('webkitendfullscreen', handleWebkitEnd);
    }

    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
      if (vEl) {
        vEl.removeEventListener('webkitendfullscreen', handleWebkitEnd);
      }
    };
  }, []);

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

      {/* Main Content Area (Mobile: Stacked, Desktop: Split Cinema View) */}
      <div className="player-content-body">
        {/* Fixed Sticky Header for Video & Controls */}
        <div className="player-fixed-container">
          {/* Video Canvas Container */}
          <div 
            className={`video-canvas-wrapper ${isFullscreen ? 'theater-fullscreen' : ''}`} 
            onClick={handleVideoAreaClick}
          >
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
                <div className="spinner" />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Resolving ultra-fast stream...</span>
              </div>
            ) : sourceUrl ? (
              <>
                <video 
                  ref={videoRef}
                  src={sourceUrl}
                  poster={video.thumbnail}
                  controls
                  autoPlay
                  playsInline
                  className="video-player-el"
                />

                {/* Dedicated Fullscreen Toggle Button */}
                <button 
                  type="button"
                  className="fullscreen-toggle-btn"
                  onClick={toggleFullscreen}
                  title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                  aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                >
                  {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                </button>
              </>
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

          {/* Pinned Info & Actions */}
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
              {/* Watch Time Badge with Click to Refill */}
              <div 
                onClick={onOpenEarnTime}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: (watchTimeSeconds || 0) < 60 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.2)',
                  border: (watchTimeSeconds || 0) < 60 ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(16, 185, 129, 0.4)',
                  color: (watchTimeSeconds || 0) < 60 ? '#ef4444' : '#10b981',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginLeft: 'auto'
                }}
                title="Click to Earn More Watch Time"
              >
                <Zap size={12} fill="currentColor" />
                <span>{formatTime(watchTimeSeconds)}</span>
              </div>
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
      </div>

      {/* Time Out Refill Modal */}
      {showTimeOutModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(7, 8, 12, 0.94)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          zIndex: 999999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'rgba(18, 21, 31, 0.96)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '24px',
            padding: '28px 22px',
            maxWidth: '380px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 50px rgba(0,0,0,0.85)',
            animation: 'tapPop 0.3s ease-out'
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, #ef4444, #f43f5e)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              margin: '0 auto 16px',
              boxShadow: '0 0 25px rgba(239, 68, 68, 0.5)'
            }}>
              ⏳
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', marginBottom: '8px' }}>
              Watch Time Finished!
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '22px' }}>
              Aapka watch time balance khatam ho gaya hai. Free watch time pane ke liye Monetag ad dekhein!
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={handleWatchAdRefill}
                disabled={adLoading}
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '12px',
                  borderRadius: '14px',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 18px rgba(16, 185, 129, 0.4)',
                  opacity: adLoading ? 0.6 : 1
                }}
              >
                <Zap size={16} fill="#fff" />
                <span>{adLoading ? 'Loading Ad...' : 'Watch Quick Ad (+1 Min)'}</span>
              </button>

              <button
                onClick={() => {
                  onClose();
                  if (onOpenEarnTime) onOpenEarnTime();
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid var(--glass-border)',
                  color: '#ffffff',
                  padding: '11px',
                  borderRadius: '14px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                🎁 Open Watch Time Store
              </button>

              <button
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-dim)',
                  padding: '8px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  marginTop: '4px'
                }}
              >
                Close Video
              </button>
            </div>
          </div>
        </div>
      )}

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
