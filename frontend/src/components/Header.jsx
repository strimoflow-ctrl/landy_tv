import React from 'react';
import { Search, X } from 'lucide-react';

export default function Header({ showSearch, setShowSearch, searchQuery, setSearchQuery }) {
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

        <button 
          className="action-btn"
          style={{ width: '38px', height: '38px', borderRadius: '50%', padding: 0, flex: 'none' }}
          onClick={() => setShowSearch(!showSearch)}
          aria-label="Toggle Search"
        >
          {showSearch ? <X size={18} /> : <Search size={18} />}
        </button>
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
