import React, { useState } from 'react';
import { 
  Zap, 
  Play, 
  Sparkles, 
  Award, 
  ShieldCheck, 
  Flame, 
  Clock, 
  Crown, 
  Film, 
  AlertCircle,
  Loader2
} from 'lucide-react';
import { showRewardedAd } from '../utils/monetag';

export default function EarnTimeView({ 
  watchTimeSeconds = 0, 
  setWatchTimeSeconds, 
  adPacksProgress = {}, 
  setAdPacksProgress,
  userId
}) {
  const [adLoading, setAdLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [celebration, setCelebration] = useState(null);
  const [errorToast, setErrorToast] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [referralCount, setReferralCount] = useState(0);

  const botUsername = 'landytv_bot';
  const referralLink = `https://t.me/${botUsername}?start=ref_${userId}`;

  useEffect(() => {
    if (userId && userId !== 'guest_user') {
      fetch(`/api/user/data?userId=${userId}`)
        .then(r => r.json())
        .then(d => {
          if (d?.data?.referralCount !== undefined) {
            setReferralCount(d.data.referralCount);
          }
        }).catch(() => {});
    }
  }, [userId]);

  const handleShareReferral = () => {
    const text = encodeURIComponent('🔥 Dekho HD Videos Landy TV par bilkul Free! Join karke 5 Minute Free Watch Time pao 🍿👇');
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${text}`;
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }
  };

  const handleCopyReferral = () => {
    navigator.clipboard?.writeText(referralLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Format seconds to mm:ss or hr:min
  const formatTime = (secs) => {
    if (secs <= 0) return '00:00 Min';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `${h}h ${m}m ${s}s`;
    }
    return `${m}:${s < 10 ? '0' : ''}${s} Min`;
  };

  const showCelebrationToast = (title, rewardText) => {
    setCelebration({ title, rewardText });
    setTimeout(() => setCelebration(null), 4000);
  };

  const showError = (msg) => {
    setErrorToast(msg);
    setTimeout(() => setErrorToast(null), 4500);
  };

  // 1. Quick 1 Ad = +1 Min (60s)
  const handleQuickWatch = async () => {
    if (adLoading) return;
    setAdLoading(true);
    setLoadingMessage('Loading Monetag Rewarded Video...');

    try {
      const res = await showRewardedAd();
      if (res && res.success) {
        const addedSeconds = 60;
        const newBalance = (watchTimeSeconds || 0) + addedSeconds;
        setWatchTimeSeconds(newBalance);

        // Sync with backend
        if (userId && userId !== 'guest_user') {
          fetch('/api/user/watch-time', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, deltaSeconds: addedSeconds })
          }).catch(e => console.warn('Watch time sync error:', e));
        }

        showCelebrationToast('⚡ Lightning Boost Activated!', '+1 Minute (60s) added to balance!');
      } else {
        showError(res?.error || 'Ad was closed early. Please watch full ad to claim time.');
      }
    } catch (err) {
      console.error('Ad Error:', err);
      showError('Failed to load ad. Please retry.');
    } finally {
      setAdLoading(false);
      setLoadingMessage('');
    }
  };

  // 2. Watch Ad for Pack Progress
  const handlePackWatch = async (packId, targetCount, rewardMinutes, packTitle) => {
    if (adLoading) return;
    setAdLoading(true);
    setLoadingMessage(`Preparing ${packTitle} Ad...`);

    try {
      const res = await showRewardedAd();
      if (res && res.success) {
        const currentCount = (adPacksProgress[packId] || 0) + 1;
        const rewardSeconds = rewardMinutes * 60;

        if (currentCount >= targetCount) {
          // Full Pack Completed & Claimed!
          const newBalance = (watchTimeSeconds || 0) + rewardSeconds;
          setWatchTimeSeconds(newBalance);
          setAdPacksProgress(prev => ({ ...prev, [packId]: 0 }));

          if (userId && userId !== 'guest_user') {
            fetch('/api/user/claim-ad-reward', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId,
                packId,
                increment: 1,
                targetCount,
                rewardSeconds
              })
            }).catch(e => console.warn('Reward sync error:', e));
          }

          showCelebrationToast(`🎉 ${packTitle} Unlocked!`, `+${rewardMinutes} Minutes credited to balance!`);
        } else {
          // Increment progress count
          setAdPacksProgress(prev => ({ ...prev, [packId]: currentCount }));

          if (userId && userId !== 'guest_user') {
            fetch('/api/user/claim-ad-reward', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId,
                packId,
                increment: 1,
                targetCount,
                rewardSeconds
              })
            }).catch(e => console.warn('Progress sync error:', e));
          }

          showCelebrationToast(
            `🎯 Step ${currentCount}/${targetCount} Completed!`,
            `Watch ${targetCount - currentCount} more ad(s) to unlock +${rewardMinutes} Min!`
          );
        }
      } else {
        showError(res?.error || 'Ad was not completed. Please watch until the end.');
      }
    } catch (err) {
      console.error('Ad Error:', err);
      showError('Ad playback failed. Please try again.');
    } finally {
      setAdLoading(false);
      setLoadingMessage('');
    }
  };

  // Battery percentage for balance gauge
  const batteryPct = Math.min(100, Math.round((watchTimeSeconds / 3600) * 100));
  const approxVideos = Math.max(1, Math.floor(watchTimeSeconds / 60));

  const PACKS = [
    {
      id: 'pack_5',
      title: 'Starter Pass',
      target: 5,
      rewardMinutes: 5,
      badge: '5 Min Pass',
      badgeClass: 'badge-cyan',
      icon: <Sparkles size={20} color="#06b6d4" />,
      colorClass: 'pack-cyan'
    },
    {
      id: 'pack_10',
      title: 'Silver Power Pack',
      target: 10,
      rewardMinutes: 12,
      badge: '+2 MIN BONUS',
      badgeClass: 'badge-orange',
      icon: <Flame size={20} color="#f97316" />,
      colorClass: 'pack-orange'
    },
    {
      id: 'pack_20',
      title: 'Diamond Turbo Pack',
      target: 20,
      rewardMinutes: 25,
      badge: '+5 MIN BONUS',
      badgeClass: 'badge-purple',
      icon: <Award size={20} color="#a855f7" />,
      colorClass: 'pack-purple'
    },
    {
      id: 'pack_50',
      title: 'Master VIP Pass',
      target: 50,
      rewardMinutes: 120,
      badge: '+70 MIN MEGA BONUS',
      badgeClass: 'badge-rose',
      icon: <Crown size={20} color="#fbbf24" />,
      colorClass: 'pack-rose'
    }
  ];

  return (
    <div className="earn-time-container">

      {/* 1. HOLOGRAPHIC WATCH TIME BALANCE CARD */}
      <div className="earn-hero-card">
        <div className="earn-hero-header">
          <div>
            <div className="earn-pill-badge">
              <span className="earn-pill-dot"></span>
              Live Watch Time Balance
            </div>
            
            <div className="earn-balance-value">
              {formatTime(watchTimeSeconds)}
            </div>

            <p className="earn-balance-desc">
              Stream all uncut videos seamlessly. Refill instantly anytime!
            </p>
          </div>

          <div className="earn-energy-orb">
            <Zap size={26} color="#ffffff" fill="#ffffff" />
          </div>
        </div>

        {/* Battery Power Gauge */}
        <div className="earn-battery-hud">
          <div className="earn-hud-stats">
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#e2e8f0' }}>
              <Clock size={14} color="#06b6d4" />
              Power Level: {batteryPct}%
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#fcd34d' }}>
              <Film size={14} />
              ~{approxVideos} Videos Streamable
            </span>
          </div>

          <div className="earn-energy-bar-wrap">
            <div 
              className="earn-energy-bar-fill" 
              style={{ width: `${Math.max(5, batteryPct)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. VIRAL INVITE & EARN REFERRAL CARD */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(0, 242, 254, 0.12))',
        border: '1px solid rgba(16, 185, 129, 0.35)',
        borderRadius: '20px',
        padding: '18px 20px',
        marginBottom: '16px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '24px' }}>🚀</span>
            <div>
              <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                Invite & Earn Watch Time
              </h3>
              <p style={{ fontSize: '0.74rem', color: '#a7f3d0', margin: 0 }}>
                Har friend ke join karne par <b>+5 Min Free</b> payein!
              </p>
            </div>
          </div>
          <span style={{
            background: 'rgba(16, 185, 129, 0.2)',
            color: '#10b981',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            padding: '3px 9px',
            borderRadius: '12px',
            fontSize: '0.7rem',
            fontWeight: 800
          }}>
            +5m / Friend
          </span>
        </div>

        {/* Referral Link Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(0, 0, 0, 0.45)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          padding: '8px 12px',
          marginBottom: '12px'
        }}>
          <span style={{
            fontSize: '0.75rem',
            color: '#e2e8f0',
            fontFamily: 'monospace',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {referralLink}
          </span>
          <button
            type="button"
            onClick={handleCopyReferral}
            style={{
              background: copiedLink ? '#10b981' : 'rgba(255, 255, 255, 0.12)',
              border: 'none',
              color: '#ffffff',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
              flex: 'none'
            }}
          >
            {copiedLink ? '✓ Copied!' : 'Copy'}
          </button>
        </div>

        {/* Share Button & Stats */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={handleShareReferral}
            style={{
              flex: 1,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              color: '#ffffff',
              padding: '11px 16px',
              borderRadius: '12px',
              fontSize: '0.86rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
            }}
          >
            <span>📲 Share to Telegram</span>
          </button>

          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '6px 12px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Friends</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#10b981' }}>{referralCount}</span>
          </div>
        </div>
      </div>

      {/* 3. INSTANT LIGHTNING QUICK BOOST (1 AD = 1 MINUTE) */}
      <div className="earn-quick-card">
        <div className="earn-quick-left">
          <div className="earn-quick-icon">
            <Zap size={22} color="#ffffff" fill="#ffffff" />
          </div>
          <div className="earn-quick-content">
            <div className="earn-quick-title-row">
              <h3 className="earn-quick-title">Quick Boost</h3>
              <span className="earn-quick-tag">+1m free</span>
            </div>
            <p className="earn-quick-subtitle">
              Watch 1 ad <strong style={{ color: '#34d399' }}>→ Get +60s Time</strong>
            </p>
          </div>
        </div>

        <button
          onClick={handleQuickWatch}
          disabled={adLoading}
          className="earn-quick-btn"
        >
          {adLoading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Play size={13} fill="#ffffff" />
          )}
          <span>Watch (+1m)</span>
        </button>
      </div>

      {/* 3. TIERED WATCH TIME PACKS SECTION */}
      <div className="earn-packs-section">
        <div className="earn-packs-header">
          <h2 className="earn-section-title">
            <Sparkles size={15} color="#ff2a5f" />
            Watch Time Reward Packs
          </h2>
          <span className="earn-section-desc">
            Complete ad packs to unlock large bonus watch time 🔥
          </span>
        </div>

        <div className="earn-packs-list">
          {PACKS.map((pack) => {
            const currentProgress = adPacksProgress[pack.id] || 0;
            const isCompleted = currentProgress >= pack.target;
            const progressPct = Math.min(100, Math.round((currentProgress / pack.target) * 100));

            return (
              <div 
                key={pack.id}
                className={`earn-pack-card ${pack.colorClass}`}
              >
                {/* Header */}
                <div className="earn-pack-top">
                  <div className="earn-pack-info">
                    <div className="earn-pack-avatar">
                      {pack.icon}
                    </div>
                    <div className="earn-pack-text">
                      <h4 className="earn-pack-title">{pack.title}</h4>
                      <p className="earn-pack-reward">
                        Reward: <strong>+{pack.rewardMinutes} Min</strong> ({pack.rewardMinutes * 60}s)
                      </p>
                    </div>
                  </div>

                  <span className={`earn-pack-badge ${pack.badgeClass}`}>
                    {pack.badge}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="earn-pack-progress-row">
                  <span style={{ color: '#94a3b8' }}>Progress</span>
                  <span style={{ color: '#ffffff', fontWeight: 800 }}>
                    {currentProgress} / {pack.target} Ads
                  </span>
                </div>

                <div className="earn-energy-bar-wrap">
                  <div 
                    className="earn-energy-bar-fill" 
                    style={{ width: `${Math.max(4, progressPct)}%` }}
                  />
                </div>

                {/* Action Button */}
                <button
                  onClick={() => handlePackWatch(pack.id, pack.target, pack.rewardMinutes, pack.title)}
                  disabled={adLoading}
                  className={`earn-pack-btn ${isCompleted ? 'ready-claim' : ''}`}
                >
                  {adLoading ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Play size={13} fill="#ffffff" />
                  )}
                  <span>
                    {isCompleted
                      ? `🎉 Claim +${pack.rewardMinutes} Min Now!`
                      : `Watch Ad (${currentProgress}/${pack.target})`}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. LOADING OVERLAY */}
      {adLoading && (
        <div className="earn-loader-overlay">
          <div className="earn-loader-box">
            <div className="earn-loader-spinner"></div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>Opening Rewarded Ad...</h3>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '4px' }}>
                {loadingMessage || 'Please watch full ad to verify and credit watch time.'}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: 700, color: '#fbbf24', background: 'rgba(251, 191, 36, 0.1)', padding: '6px 12px', borderRadius: '10px', border: '1px solid rgba(251, 191, 36, 0.2)' }}>
              <ShieldCheck size={16} />
              <span>Monetag Verified Rewarded Stream</span>
            </div>
          </div>
        </div>
      )}

      {/* 5. CELEBRATION TOAST */}
      {celebration && (
        <div className="earn-toast-celebration">
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
            ⚡
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontWeight: 800, fontSize: '0.85rem' }}>{celebration.title}</h4>
            <p style={{ fontSize: '0.75rem', opacity: 0.9 }}>{celebration.rewardText}</p>
          </div>
        </div>
      )}

      {/* 6. ERROR TOAST */}
      {errorToast && (
        <div className="earn-toast-error">
          <AlertCircle size={22} color="#ffffff" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <h4 style={{ fontWeight: 800, fontSize: '0.85rem' }}>Ad Notice</h4>
            <p style={{ fontSize: '0.75rem', opacity: 0.9 }}>{errorToast}</p>
          </div>
        </div>
      )}

    </div>
  );
}
