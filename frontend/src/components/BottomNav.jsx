import React from 'react';
import { Home, Clock, Zap, Bookmark, User } from 'lucide-react';

export default function BottomNav({ activeNav, onSelectNav }) {
  return (
    <nav className="bottom-nav">
      <div
        className={`nav-item ${activeNav === 'home' ? 'active' : ''}`}
        onClick={() => onSelectNav('home')}
      >
        <Home size={20} />
        <span>Home</span>
      </div>

      <div
        className={`nav-item ${activeNav === 'recent' ? 'active' : ''}`}
        onClick={() => onSelectNav('recent')}
      >
        <Clock size={20} />
        <span>Recent</span>
      </div>

      {/* Center Big Glowing FAB Button */}
      <div
        className={`nav-item-center ${activeNav === 'earn_time' ? 'active' : ''}`}
        onClick={() => onSelectNav('earn_time')}
      >
        <div className="center-fab-glow">
          <Zap size={22} className="fab-icon" />
        </div>
        <span className="fab-label">Get Time</span>
      </div>

      <div
        className={`nav-item ${activeNav === 'saved' ? 'active' : ''}`}
        onClick={() => onSelectNav('saved')}
      >
        <Bookmark size={20} />
        <span>Saved</span>
      </div>

      <div
        className={`nav-item ${activeNav === 'profile' ? 'active' : ''}`}
        onClick={() => onSelectNav('profile')}
      >
        <User size={20} />
        <span>Profile</span>
      </div>
    </nav>
  );
}

