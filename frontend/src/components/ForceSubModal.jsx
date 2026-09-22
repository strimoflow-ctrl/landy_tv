import React, { useState } from 'react';

export default function ForceSubModal({ unjoined = [], onVerifySuccess }) {
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [channels, setChannels] = useState(unjoined);

  const total = 4;
  const remaining = channels.length;

  const handleOpenChannel = (url) => {
    try {
      if (window.Telegram?.WebApp?.openTelegramLink) {
        window.Telegram.WebApp.openTelegramLink(url);
      } else {
        window.open(url, '_blank');
      }
    } catch (e) {
      window.open(url, '_blank');
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    setErrorMsg('');

    try {
      const tg = window.Telegram?.WebApp;
      const userId = tg?.initDataUnsafe?.user?.id;

      const res = await fetch(`/api/check-subscription?userId=${userId || ''}`);
      const data = await res.json();

      if (data.isSubscribed) {
        if (onVerifySuccess) onVerifySuccess();
      } else {
        setChannels(data.unjoined || []);
        setErrorMsg(`⚠️ You still need to join ${data.unjoined?.length || 'the'} channel(s) below!`);
      }
    } catch (err) {
      setErrorMsg('Verification failed. Please check internet connection.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      background: 'rgba(3, 4, 7, 0.94)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      color: '#fff',
      fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif"
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        background: 'linear-gradient(180deg, rgba(20, 24, 38, 0.95) 0%, rgba(10, 12, 20, 0.98) 100%)',
        border: '1px solid rgba(255, 0, 85, 0.35)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 30px rgba(255, 0, 85, 0.2)',
        borderRadius: '24px',
        padding: '28px 24px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Glow accent */}
        <div style={{
          position: 'absolute',
          top: '-40px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '180px',
          height: '180px',
          background: 'radial-gradient(circle, rgba(255, 0, 85, 0.4) 0%, transparent 70%)',
          filter: 'blur(30px)',
          pointerEvents: 'none'
        }} />

        {/* Lock Icon Badge */}
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #ff0844 0%, #ff4b2b 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
          boxShadow: '0 8px 24px rgba(255, 8, 68, 0.45)',
          fontSize: '28px'
        }}>
          🔒
        </div>

        {/* Title */}
        <h2 style={{
          fontSize: '1.4rem',
          fontWeight: 800,
          margin: '0 0 10px',
          background: 'linear-gradient(135deg, #fff 40%, #00f2fe 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Welcome to Landy TV! 💦
        </h2>

        {/* Subtitle */}
        <p style={{
          fontSize: '0.9rem',
          color: '#cbd5e1',
          lineHeight: 1.5,
          margin: '0 0 20px'
        }}>
          To access Landy TV and stream all premium uncut videos, you must join {remaining >= total ? 'all 4 official Telegram channels' : `the remaining ${remaining} official Telegram channel${remaining > 1 ? 's' : ''}`} below:
        </p>

        {/* Error Alert if any */}
        {errorMsg && (
          <div style={{
            background: 'rgba(255, 8, 68, 0.15)',
            border: '1px solid rgba(255, 8, 68, 0.4)',
            color: '#ff4d6d',
            fontSize: '0.82rem',
            fontWeight: 600,
            padding: '10px 14px',
            borderRadius: '12px',
            marginBottom: '16px'
          }}>
            {errorMsg}
          </div>
        )}

        {/* Dynamic Buttons for Unjoined Channels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          {channels.map((ch, idx) => (
            <button
              key={idx}
              onClick={() => handleOpenChannel(ch.url)}
              style={{
                width: '100%',
                padding: '13px 18px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '14px',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.92rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0, 242, 254, 0.15)';
                e.currentTarget.style.borderColor = '#00f2fe';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
              }}
            >
              <span>{ch.name}</span>
              <span style={{ color: '#00f2fe', fontSize: '1.1rem' }}>↗</span>
            </button>
          ))}
        </div>

        {/* Verify & Unlock Button */}
        <button
          onClick={handleVerify}
          disabled={verifying}
          style={{
            width: '100%',
            padding: '14px 20px',
            background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
            border: 'none',
            borderRadius: '14px',
            color: '#020817',
            fontWeight: 800,
            fontSize: '1rem',
            cursor: verifying ? 'not-allowed' : 'pointer',
            boxShadow: '0 0 20px rgba(0, 242, 254, 0.4)',
            transition: 'all 0.2s ease',
            opacity: verifying ? 0.7 : 1
          }}
        >
          {verifying ? '🔄 Verifying Subscription...' : '🔄 Verify & Unlock'}
        </button>
      </div>
    </div>
  );
}
