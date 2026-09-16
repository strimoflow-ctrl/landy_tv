import React from 'react';
import { Play, Eye, Clock } from 'lucide-react';

export default function VideoCard({ video, onSelectVideo }) {
  return (
    <div className="video-card" onClick={() => onSelectVideo(video)}>
      <div className="thumbnail-wrapper">
        <img 
          src={video.thumbnail || '/logo.jpg'} 
          alt={video.title} 
          className="video-thumb" 
          loading="lazy" 
          onError={(e) => { e.target.src = '/logo.jpg'; }}
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
