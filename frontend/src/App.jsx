import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import VideoGrid from './components/VideoGrid';
import VideoPlayer from './components/VideoPlayer';
import BottomNav from './components/BottomNav';
import WatchHistory from './components/WatchHistory';
import SavedVideos from './components/SavedVideos';
import ProfileView from './components/ProfileView';
import { fetchVideos, searchVideos } from './utils/api';

export default function App() {
  const [activeNav, setActiveNav] = useState('home');
  const [videos, setVideos] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [currentVideo, setCurrentVideo] = useState(null);

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Ref to prevent duplicate concurrent page loads
  const loadingRef = useRef(false);

  // Telegram SDK Init & Deep Link Auto-Play
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.expand();
      tg.ready();
    }

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
  }, []);

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
        />
      )}

      {/* Bottom Navigation */}
      <BottomNav activeNav={activeNav} onSelectNav={setActiveNav} />
    </div>
  );
}
