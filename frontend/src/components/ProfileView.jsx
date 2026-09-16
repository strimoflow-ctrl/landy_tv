import React, { useState, useEffect } from 'react';
import { Send, MessageSquare, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';

export default function ProfileView() {
  const [tgUser, setTgUser] = useState(null);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg?.initDataUnsafe?.user) {
      setTgUser(tg.initDataUnsafe.user);
    }
  }, []);

  const openTelegramLink = (url) => {
    const tg = window.Telegram?.WebApp;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const handleClearCache = () => {
    if (window.confirm('Clear all local app cache and bookmarks?')) {
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    }
  };

  const name = tgUser ? `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim() : 'Guest User';
  const username = tgUser?.username ? `@${tgUser.username}` : '@telegram_user';
  const photo = tgUser?.photo_url;
  const initial = (name[0] || 'U').toUpperCase();

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Profile Card */}
      <div className="profile-card glass">
        {photo ? (
          <img src={photo} alt={name} className="profile-avatar" />
        ) : (
          <div className="profile-avatar-fallback">{initial}</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{name}</h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{username}</span>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.7rem',
            padding: '3px 8px',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(138, 43, 226, 0.2)',
            color: '#c084fc',
            border: '1px solid rgba(138, 43, 226, 0.4)',
            fontWeight: 700,
            width: 'fit-content',
            marginTop: '4px'
          }}>
            <Sparkles size={12} />
            <span>VIP MEMBER</span>
          </div>
        </div>
      </div>

      {/* Telegram Community Channels */}
      <div>
        <h3 className="history-group-title" style={{ margin: '0 0 10px 0' }}>Official Channels</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button 
            className="action-btn"
            style={{ justifyContent: 'flex-start', padding: '14px 16px', borderRadius: 'var(--radius-md)' }}
            onClick={() => openTelegramLink('https://t.me/landy_tv')}
          >
            <Send size={18} color="#0088cc" />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1 }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Join Main Channel</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Latest updates & exclusive releases</span>
            </div>
          </button>

          <button 
            className="action-btn"
            style={{ justifyContent: 'flex-start', padding: '14px 16px', borderRadius: 'var(--radius-md)' }}
            onClick={() => openTelegramLink('https://t.me/fufa_jiii')}
          >
            <MessageSquare size={18} color="var(--accent)" />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1 }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Contact Support / Admin</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Feedback, questions & reports</span>
            </div>
          </button>
        </div>
      </div>

      {/* Settings & Maintenance */}
      <div>
        <h3 className="history-group-title" style={{ margin: '0 0 10px 0' }}>Preferences</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button 
            className="action-btn"
            style={{ justifyContent: 'flex-start', padding: '14px 16px', borderRadius: 'var(--radius-md)' }}
            onClick={handleClearCache}
          >
            <Trash2 size={18} color="var(--accent)" />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1 }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Clear App Cache</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Reset offline bookmarks and history</span>
            </div>
          </button>
        </div>
      </div>

      <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.75rem', marginTop: '10px' }}>
        <p>Landy TV TMA v2.0 • Ultra-Fast React Edition</p>
        <p style={{ marginTop: '2px' }}>Protected by Telegram WebApp Sandbox</p>
      </div>
    </div>
  );
}
