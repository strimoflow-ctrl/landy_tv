import React, { useEffect, useRef } from 'react';
import VideoCard from './VideoCard';
import { Film, Loader2 } from 'lucide-react';

export default function VideoGrid({ videos, loading, hasMore, onLoadMore, onSelectVideo }) {
  const loaderRef = useRef(null);

  useEffect(() => {
    if (!hasMore || loading) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        onLoadMore();
      }
    }, { rootMargin: '400px' });

    const currentLoader = loaderRef.current;
    if (currentLoader) {
      observer.observe(currentLoader);
    }

    return () => {
      if (currentLoader) observer.unobserve(currentLoader);
      observer.disconnect();
    };
  }, [hasMore, loading, onLoadMore]);

  if (!loading && videos.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
        <Film size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
        <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '6px' }}>No Videos Found</h3>
        <p style={{ fontSize: '0.9rem' }}>Please check your search or pull down to refresh.</p>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: '90px' }}>
      <div className="video-grid">
        {videos.map((video, idx) => (
          <VideoCard 
            key={`${video.url}-${idx}`} 
            video={video} 
            onSelectVideo={onSelectVideo} 
          />
        ))}

        {/* Skeleton cards when loading initial or more */}
        {loading && Array.from({ length: 6 }).map((_, i) => (
          <div key={`skel-${i}`} className="video-card" style={{ pointerEvents: 'none' }}>
            <div className="thumbnail-wrapper skeleton" />
            <div className="video-info-box">
              <div className="skeleton" style={{ height: '14px', width: '90%' }} />
              <div className="skeleton" style={{ height: '12px', width: '60%', marginTop: '6px' }} />
            </div>
          </div>
        ))}
      </div>

      {/* Infinite Scroll Trigger Sentinel */}
      {hasMore && (
        <div ref={loaderRef} style={{ padding: '24px 0', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', fontSize: '0.85rem', fontWeight: 600 }}>
              <Loader2 className="spinner" size={20} />
              <span>Loading more realtime videos...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
