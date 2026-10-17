import React from 'react';
import { Play, Eye, Clock } from 'lucide-react';

export default function VideoCard({ video, onSelectVideo, index = 0 }) {
  const [loaded, setLoaded] = React.useState(false);
  const isEager = index < 6;

  const handleImageError = (e) => {
    // If direct CDN was blocked or failed, retry once via server proxy
    if (!e.target.dataset.retried && video.thumbnail && video.thumbnail.startsWith('http')) {
      e.target.dataset.retried = 'true';
      e.target.src = `/api/proxy-thumbnail?url=${encodeURIComponent(video.thumbnail)}`;
    } else {
      e.target.src = '/logo.jpg';
      setLoaded(true);
    }
  };

  return (
    <div className="video-card" onClick={() => onSelectVideo(video)}>
      <div className={`thumbnail-wrapper ${!loaded ? 'skeleton' : ''}`}>
        <img 
          src={video.thumbnail || '/logo.jpg'} 
          alt={video.title} 
          className={`video-thumb ${loaded ? 'loaded' : 'loading'}`}
          loading={isEager ? "eager" : "lazy"}
          fetchPriority={index < 4 ? "high" : "auto"}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={handleImageError}
        />
        {video.duration && (
          <div className="duration-chip">
            {video.duration}
          </div>
        )}
        <div className="play-btn-overlay">
          <div className="play-icon-glow">
            <Play size={20} fill="#ffffff" style={{ marginLeft: '3px' }} />
          </div>
        </div>
      </div>

      <div className="video-info-box">
        <h3 className="video-title" title={video.title}>{video.title}</h3>
        <div className="video-meta-row">
          <div className="views-chip">
            <Eye size={13} />
            <span>{video.views || '12K'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
