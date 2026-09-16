import React, { useState, useEffect } from 'react';
import { getSavedVideos } from '../utils/storage';
import VideoCard from './VideoCard';
import { Bookmark } from 'lucide-react';

export default function SavedVideos({ onSelectVideo }) {
  const [savedList, setSavedList] = useState([]);

  useEffect(() => {
    setSavedList(getSavedVideos());
  }, []);

  if (savedList.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
        <Bookmark size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
        <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '6px' }}>No Saved Videos</h3>
        <p style={{ fontSize: '0.9rem' }}>Tap the "Save" button on any video to add it to your collection.</p>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: '20px' }}>
      <div style={{ padding: '16px 16px 4px' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Saved Videos</h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
          {savedList.length} {savedList.length === 1 ? 'video' : 'videos'} bookmarked
        </p>
      </div>

      <div className="video-grid">
        {savedList.map((video, idx) => (
          <VideoCard 
            key={`${video.url}-${idx}`} 
            video={video} 
            onSelectVideo={onSelectVideo} 
          />
        ))}
      </div>
    </div>
  );
}
