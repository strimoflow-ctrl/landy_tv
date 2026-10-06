import React, { useState } from 'react';
import { Zap, Gift, Play, Sparkles, Award, ShieldCheck, Flame, CheckCircle2, Clock } from 'lucide-react';
import { showRewardedAd } from '../utils/monetag';

export default function EarnTimeView({ 
  watchTimeSeconds, 
  setWatchTimeSeconds, 
  adPacksProgress = {}, 
  setAdPacksProgress,
  userId
}) {
  const [adLoading, setAdLoading] = useState(false);
  const [celebration, setCelebration] = useState(null);

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
    setTimeout(() => setCelebration(null), 3500);
  };

  // 1. Quick 1 Ad = +1 Min (60s)
  const handleQuickWatch = async () => {
    if (adLoading) return;
    setAdLoading(true);

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

        showCelebrationToast('⚡ Quick Boost Added!', '+1 Minute (60s) added to your watch time!');
      } else {
        alert(res?.error || 'Ad was not completed. Please watch till the end to earn time.');
      }
    } catch (err) {
      console.error('Ad Error:', err);
    } finally {
      setAdLoading(false);
    }
  };

  // 2. Watch Ad for Pack Progress
  const handlePackWatch = async (packId, targetCount, rewardMinutes) => {
    if (adLoading) return;
    setAdLoading(true);

    try {
      const res = await showRewardedAd();
      if (res && res.success) {
        const currentCount = (adPacksProgress[packId] || 0) + 1;
        const rewardSeconds = rewardMinutes * 60;

        if (currentCount >= targetCount) {
          // Claim reward!
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

          showCelebrationToast('🎉 Pack Completed & Claimed!', `+${rewardMinutes} Minutes added to your balance!`);
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

          showCelebrationToast(`🎯 Progress: ${currentCount}/${targetCount}`, `Watch ${targetCount - currentCount} more ad(s) to unlock +${rewardMinutes} Min!`);
        }
      } else {
        alert(res?.error || 'Ad was closed early. Complete the ad to count progress.');
      }
    } catch (err) {
      console.error('Ad Error:', err);
    } finally {
      setAdLoading(false);
    }
  };

  const packs = [
    {
      id: 'pack_5',
      name: 'Starter Pack',
      ads: 5,
      minutes: 5,
      badge: '5 Min Pass',
      badgeColor: 'rgba(56, 189, 248, 0.2)',
      badgeTextColor: '#38bdf8',
      icon: Award
    },
    {
      id: 'pack_10',
      name: 'Silver Value Pack',
      ads: 10,
      minutes: 12,
      badge: '🔥 +2 MIN BONUS',
      badgeColor: 'rgba(239, 68, 68, 0.2)',
      badgeTextColor: '#ef4444',
      icon: Flame
    },
    {
      id: 'pack_20',
      name: 'Gold Marathon Pack',
      ads: 20,
      minutes: 25,
      badge: '💎 +5 MIN BONUS',
      badgeColor: 'rgba(168, 85, 247, 0.2)',
      badgeTextColor: '#c084fc',
      icon: Sparkles
    },
    {
      id: 'pack_50',
      name: 'Ultra Cinema VIP Pass',
      ads: 50,
      minutes: 120,
      badge: '👑 2 HOURS STREAMING',
      badgeColor: 'rgba(234, 179, 8, 0.2)',
      badgeTextColor: '#eab308',
      icon: Gift,
      featured: true
    }
  ];

  return (
    <div style={{ padding: '16px', maxWidth: '800px', margin: '0 auto' }}>
      {/* Top Header Card */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.18), rgba(6, 182, 212, 0.12))',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '24px',
        padding: '24px',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 12px 35px rgba(0, 0, 0, 0.4)',
        marginBottom: '22px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Your Watch Time Balance
            </span>
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '2.2rem',
              fontWeight: 800,
              color: '#ffffff',
              margin: '4px 0 6px',
              textShadow: '0 0 20px rgba(239, 68, 68, 0.4)'
            }}>
              {formatTime(watchTimeSeconds || 0)}
            </h1>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Watch stream videos continuously. Refill anytime by watching short ads!
            </p>
          </div>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #ef4444, #f43f5e)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            boxShadow: '0 0 25px rgba(239, 68, 68, 0.5)'
          }}>
            ⚡
          </div>
        </div>
      </div>

      {/* Quick Boost Action */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '20px',
        padding: '18px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px',
        marginBottom: '24px',
        boxShadow: '0 8px 25px rgba(0,0,0,0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '14px',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#10b981'
          }}>
            <Zap size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>Instant Quick Boost</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Watch 1 Ad ➔ Get +1 Minute (60s)</p>
          </div>
        </div>

        <button
          onClick={handleQuickWatch}
          disabled={adLoading}
          style={{
            background: 'linear-gradient(135deg, #10b981, #059669)',
            border: 'none',
            color: '#ffffff',
            padding: '10px 18px',
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 4px 15px rgba(16, 185, 129, 0.35)',
            opacity: adLoading ? 0.6 : 1
          }}
        >
          <Play size={14} fill="#fff" />
          <span>{adLoading ? 'Loading Ad...' : 'Watch (+1m)'}</span>
        </button>
      </div>

      {/* Task & Ad Packs Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
        <Sparkles size={16} color="#ef4444" />
        <h2 style={{ fontSize: '16px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
          Watch Time Packs & Bonus Rewards
        </h2>
      </div>

      {/* Packs Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
        {packs.map((pack) => {
          const Icon = pack.icon;
          const currentCount = adPacksProgress[pack.id] || 0;
          const percentage = Math.min(100, Math.round((currentCount / pack.ads) * 100));
          const isReady = currentCount >= pack.ads;

          return (
            <div
              key={pack.id}
              style={{
                background: pack.featured 
                  ? 'linear-gradient(145deg, rgba(234, 179, 8, 0.08), rgba(18, 21, 31, 0.8))'
                  : 'rgba(18, 21, 31, 0.65)',
                border: pack.featured 
                  ? '1px solid rgba(234, 179, 8, 0.35)' 
                  : '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '20px',
                padding: '20px',
                backdropFilter: 'blur(16px)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                boxShadow: pack.featured ? '0 10px 30px rgba(234, 179, 8, 0.12)' : 'none'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '12px',
                    background: pack.badgeColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: pack.badgeTextColor
                  }}>
                    <Icon size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{pack.name}</h3>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Reward: {pack.minutes} Minutes</span>
                  </div>
                </div>

                <span style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: '20px',
                  background: pack.badgeColor,
                  color: pack.badgeTextColor,
                  border: `1px solid ${pack.badgeColor}`
                }}>
                  {pack.badge}
                </span>
              </div>

              {/* Progress Bar & Counter */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Progress</span>
                  <span style={{ fontWeight: 800, color: '#fff' }}>{currentCount} / {pack.ads} Ads</span>
                </div>
                <div style={{
                  width: '100%',
                  height: '8px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${percentage}%`,
                    height: '100%',
                    background: pack.featured 
                      ? 'linear-gradient(90deg, #eab308, #f59e0b)'
                      : 'linear-gradient(90deg, #ef4444, #06b6d4)',
                    borderRadius: '10px',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => handlePackWatch(pack.id, pack.ads, pack.minutes)}
                disabled={adLoading}
                style={{
                  background: isReady
                    ? 'linear-gradient(135deg, #10b981, #059669)'
                    : 'rgba(255, 255, 255, 0.08)',
                  border: isReady ? 'none' : '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#fff',
                  padding: '10px',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  marginTop: 'auto',
                  boxShadow: isReady ? '0 4px 15px rgba(16, 185, 129, 0.4)' : 'none',
                  opacity: adLoading ? 0.6 : 1
                }}
              >
                {isReady ? (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Claim +{pack.minutes} Min Free!</span>
                  </>
                ) : (
                  <>
                    <Play size={14} fill="#fff" />
                    <span>Watch Ad ({currentCount}/{pack.ads})</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Celebration Modal / Toast */}
      {celebration && (
        <div style={{
          position: 'fixed',
          bottom: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.95), rgba(5, 150, 105, 0.95))',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          borderRadius: '20px',
          padding: '14px 22px',
          color: '#fff',
          boxShadow: '0 12px 35px rgba(0,0,0,0.7)',
          zIndex: 99999,
          textAlign: 'center',
          animation: 'tapPop 0.3s ease-out'
        }}>
          <h4 style={{ fontSize: '14px', fontWeight: 800 }}>{celebration.title}</h4>
          <p style={{ fontSize: '12px', opacity: 0.9, marginTop: '2px' }}>{celebration.rewardText}</p>
        </div>
      )}
    </div>
  );
}
