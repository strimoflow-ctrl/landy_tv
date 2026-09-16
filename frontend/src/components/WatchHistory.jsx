import React, { useState, useEffect } from 'react';
import { getWatchHistory, clearWatchHistory } from '../utils/storage';
import VideoCard from './VideoCard';
import { Trash2, Clock } from 'lucide-react';

export default function WatchHistory({ onSelectVideo }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    setHistory(getWatchHistory());
  }, []);

  const handleClear = () => {
    if (window.confirm('Clear your entire watch history?')) {
      clearWatchHistory();
      setHistory([]);
    }
  };

  if (history.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
        <Clock size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
        <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '6px' }}>No Watch History</h3>
        <p style={{ fontSize: '0.9rem' }}>Videos you watch will appear here automatically.</p>
      </div>
    );
  }

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const WEEK = 7 * DAY;
  const MONTH = 30 * DAY;

  const today = history.filter(v => (now - (v.watchedAt || 0)) < DAY);
  const thisWeek = history.filter(v => {
    const diff = now - (v.watchedAt || 0);
    return diff >= DAY && diff < WEEK;
  });
  const older = history.filter(v => (now - (v.watchedAt || 0)) >= WEEK);

  const renderGroup = (title, list) => {
    if (list.length === 0) return null;
    return (
      <div key={title} style={{ marginBottom: '20px' }}>
        <h3 className="history-group-title">{title}</h3>
        <div className="video-grid">
          {list.map((video, idx) => (
            <VideoCard 
              key={`${video.url}-${idx}`} 
              video={video} 
              onSelectVideo={onSelectVideo} 
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{ paddingBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 0' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Watch History</h2>
        <button 
          className="action-btn"
          style={{ padding: '6px 12px', fontSize: '0.75rem', flex: 'none', gap: '4px' }}
          onClick={handleClear}
        >
          <Trash2 size={14} />
          <span>Clear</span>
        </button>
      </div>

      {renderGroup('Today', today)}
      {renderGroup('Last 7 Days', thisWeek)}
      {renderGroup('Older', older)}
    </div>
  );
}
