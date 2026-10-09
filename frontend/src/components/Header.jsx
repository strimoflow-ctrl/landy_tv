import React from 'react';
import { Search, X } from 'lucide-react';

export default function Header({ showSearch, setShowSearch, searchQuery, setSearchQuery, onOpenTutorial }) {
  return (
    <>
      <header className="app-header glass">
        <div className="header-brand">
          <img src="/logo.jpg" alt="Landy TV" className="header-logo" />
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span className="header-title">Landy TV</span>
            <span className="header-badge">HD</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onOpenTutorial && (
            <button 
              className="action-btn"
              style={{ width: '38px', height: '38px', borderRadius: '50%', padding: 0, flex: 'none', background: 'rgba(0, 242, 254, 0.12)', border: '1px solid rgba(0, 242, 254, 0.3)' }}
              onClick={onOpenTutorial}
              aria-label="Voice Guide"
              title="Voice Tutorial"
            >
              🎧
            </button>
          )}

          <button 
            className="action-btn"
            style={{ width: '38px', height: '38px', borderRadius: '50%', padding: 0, flex: 'none' }}
            onClick={() => setShowSearch(!showSearch)}
            aria-label="Toggle Search"
          >
            {showSearch ? <X size={18} /> : <Search size={18} />}
          </button>
        </div>
      </header>

      {showSearch && (
        <div className="search-container">
          <div className="search-box">
            <Search size={18} color="var(--text-dim)" />
            <input
              type="text"
              className="search-input"
              placeholder="Search loaded videos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <X 
                size={16} 
                style={{ cursor: 'pointer', color: 'var(--text-dim)' }} 
                onClick={() => setSearchQuery('')} 
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
