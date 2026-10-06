import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import VideoGrid from './components/VideoGrid';
import VideoPlayer from './components/VideoPlayer';
import BottomNav from './components/BottomNav';
import WatchHistory from './components/WatchHistory';
import SavedVideos from './components/SavedVideos';
import ProfileView from './components/ProfileView';
import EarnTimeView from './components/EarnTimeView';
import ForceSubModal from './components/ForceSubModal';
import { fetchVideos, searchVideos } from './utils/api';
import { syncSavedVideosFromFirebase } from './utils/storage';

export default function App() {
  const [activeNav, setActiveNav] = useState('home');
  const [videos, setVideos] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [currentVideo, setCurrentVideo] = useState(null);

  // User Watch Time & Ad Packs State
  const [watchTimeSeconds, setWatchTimeSeconds] = useState(180);
  const [adPacksProgress, setAdPacksProgress] = useState({});

  // Force-Sub Lock State & Blocked State
  const [isSubscribed, setIsSubscribed] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [unjoinedChannels, setUnjoinedChannels] = useState([]);

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Ref to prevent duplicate concurrent page loads
  const loadingRef = useRef(false);

  const tg = window.Telegram?.WebApp;
  const userId = tg?.initDataUnsafe?.user?.id || 'guest_user';

  // Sync user activity to Firebase (record lastActive timestamp & fetch latest watch time/packs)
  const syncUserActivity = useCallback(async () => {
    const user = tg?.initDataUnsafe?.user;
    if (user && user.id) {
      try {
        const res = await fetch('/api/user/activity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(user)
        });
        const data = await res.json();
        if (data && data.isBlocked) {
          setIsBlocked(true);
        }
      } catch (err) {
        console.warn('User activity sync error:', err);
      }
    }

    // Fetch user watch time & packs from Firebase
    if (userId && userId !== 'guest_user') {
      try {
        const dataRes = await fetch(`/api/user/data?userId=${userId}`);
        const dataJson = await dataRes.json();
        if (dataJson && dataJson.success && dataJson.data) {
          if (dataJson.data.watchTimeSeconds !== undefined) {
            setWatchTimeSeconds(dataJson.data.watchTimeSeconds);
          }
          if (dataJson.data.adPacksProgress) {
            setAdPacksProgress(dataJson.data.adPacksProgress);
          }
        }
      } catch (e) {
        console.warn('Failed to load user data:', e);
      }

      // Sync Saved Videos from Firebase
      syncSavedVideosFromFirebase(userId);
    }
  }, [userId, tg]);

  // Live Subscription & Block Checker (Real Telegram Sessions only, bypass on localhost)
  const checkSubscriptionStatus = useCallback(async () => {
    const tg = window.Telegram?.WebApp;
    const userId = tg?.initDataUnsafe?.user?.id;

    if (!userId || String(userId) === '100000001') {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isLocalhost) {
        setIsSubscribed(true);
        return; // Dev preview mode
      }
    }

    if (userId) {
      try {
        const res = await fetch(`/api/check-subscription?userId=${userId}`);
        const data = await res.json();
        if (data) {
          if (data.isBlocked) {
            setIsBlocked(true);
            setIsSubscribed(false);
            return;
          }
          setIsBlocked(false);
          if (data.success) {
            setIsSubscribed(data.isSubscribed);
            setUnjoinedChannels(data.unjoined || []);
          }
        }
      } catch (e) {
        console.warn('Subscription check error:', e);
      }
    }
  }, []);

  // Lock body scroll when Fullscreen Video Player is open
  useEffect(() => {
    if (currentVideo || isBlocked) {
      document.body.style.overflow = 'hidden';
    } else if (isSubscribed) {
      document.body.style.overflow = '';
    }
  }, [currentVideo, isSubscribed, isBlocked]);

  // Telegram SDK Init & Deep Link Auto-Play
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.expand();
      tg.ready();
    }

    // Sync activity & check subscription immediately on app launch
    syncUserActivity();
    checkSubscriptionStatus();

    // Re-verify periodically every 30s
    const timer = setInterval(() => {
      syncUserActivity();
      checkSubscriptionStatus();
    }, 30000);

    try {
      const urlParams = new URLSearchParams(window.location.search);
      let param = tg?.initDataUnsafe?.start_param || urlParams.get('start');
      if (param) {
        if (param.startsWith('v_')) param = param.substring(2);
        try {
          const decoded = atob(param);
          if (decoded && decoded.startsWith('http')) {
            setCurrentVideo({
              title: 'Now Playing',
              url: decoded,
              thumbnail: '/logo.jpg'
            });
          }
        } catch (e) {
          if (param.startsWith('http')) {
            setCurrentVideo({
              title: 'Now Playing',
              url: param,
              thumbnail: '/logo.jpg'
            });
          }
        }
      }
    } catch (err) {
      console.warn('Could not parse start param:', err);
    }

    return () => clearInterval(timer);
  }, [checkSubscriptionStatus, syncUserActivity]);

  // Realtime Infinite Video Loader
  const loadMoreVideos = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoading(true);

    const currentPage = page;
    const newVideos = await fetchVideos(currentPage);

    if (newVideos && newVideos.length > 0) {
      setVideos(prev => {
        const seen = new Set(prev.map(v => v.url));
        const filtered = newVideos.filter(v => !seen.has(v.url));
        return [...prev, ...filtered];
      });
      setPage(prev => prev + 1);
      setHasMore(true);
    } else {
      // If a page returns empty, keep hasMore true or wait for next attempt
      setHasMore(false);
    }

    loadingRef.current = false;
    setLoading(false);
  }, [page, hasMore]);

  // Initial Load on mount
  useEffect(() => {
    loadMoreVideos();
  }, []);

  // Real-time Search Handler with debounce
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const results = await searchVideos(q, 1);
      if (results && results.length > 0) {
        setSearchResults(results);
      } else {
        // Fallback to local filter if backend search returns nothing
        const local = videos.filter(v => (v.title || '').toLowerCase().includes(q.toLowerCase()));
        setSearchResults(local);
      }
      setIsSearching(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery, videos]);

  const displayedVideos = searchQuery.trim() ? searchResults : videos;

  return (
    <div className="app-container">
      {/* Strict Account Suspended / Blocked Screen */}
      {isBlocked && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(7, 8, 12, 0.98)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          zIndex: 9999999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center'
        }}>
          <div style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: '24px',
            padding: '36px 24px',
            maxWidth: '420px',
            width: '100%',
            boxShadow: '0 20px 50px rgba(0,0,0,0.85)'
          }}>
            <div style={{ fontSize: '54px', marginBottom: '16px' }}>🚫</div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#ef4444', marginBottom: '10px' }}>
              Account Suspended
            </h2>
            <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '1.6', marginBottom: '24px' }}>
              Aapka account administrator dwara block kar diya gaya hai. Access ke liye official support se contact karein.
            </p>
            <a 
              href="https://t.me/landy_tv" 
              target="_blank" 
              rel="noreferrer"
              style={{
                display: 'inline-block',
                background: 'linear-gradient(135deg, #ef4444, #f43f5e)',
                color: '#ffffff',
                textDecoration: 'none',
                padding: '12px 28px',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '14px',
                boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)'
              }}
            >
              Contact Support
            </a>
          </div>
        </div>
      )}

      {/* Strict Force-Sub Lock Modal if not subscribed and not blocked */}
      {!isBlocked && !isSubscribed && (
        <ForceSubModal 
          unjoined={unjoinedChannels} 
          onVerifySuccess={() => {
            setIsSubscribed(true);
            setUnjoinedChannels([]);
          }} 
        />
      )}

      {/* Top Header */}
      <Header 
        showSearch={showSearch} 
        setShowSearch={setShowSearch}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      {/* Main Content Area */}
      <main style={{ flex: 1 }}>
        {activeNav === 'home' && (
          <VideoGrid 
            videos={displayedVideos} 
            loading={loading || isSearching} 
            hasMore={hasMore && !searchQuery.trim()} 
            onLoadMore={loadMoreVideos}
            onSelectVideo={setCurrentVideo}
          />
        )}

        {activeNav === 'recent' && (
          <WatchHistory onSelectVideo={setCurrentVideo} />
        )}

        {activeNav === 'earn_time' && (
          <EarnTimeView 
            watchTimeSeconds={watchTimeSeconds}
            setWatchTimeSeconds={setWatchTimeSeconds}
            adPacksProgress={adPacksProgress}
            setAdPacksProgress={setAdPacksProgress}
            userId={userId}
          />
        )}

        {activeNav === 'saved' && (
          <SavedVideos onSelectVideo={setCurrentVideo} />
        )}

        {activeNav === 'profile' && (
          <ProfileView />
        )}
      </main>

      {/* Fullscreen Video Player Overlay */}
      {currentVideo && (
        <VideoPlayer 
          video={currentVideo} 
          onClose={() => setCurrentVideo(null)}
          onSelectVideo={setCurrentVideo}
          watchTimeSeconds={watchTimeSeconds}
          setWatchTimeSeconds={setWatchTimeSeconds}
          onOpenEarnTime={() => {
            setCurrentVideo(null);
            setActiveNav('earn_time');
          }}
          userId={userId}
        />
      )}

      {/* Bottom Navigation */}
      <BottomNav activeNav={activeNav} onSelectNav={setActiveNav} />
    </div>
  );
}
