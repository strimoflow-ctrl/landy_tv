import React, { useState } from 'react';
import { 
  Zap, 
  Gift, 
  Play, 
  Sparkles, 
  Award, 
  ShieldCheck, 
  Flame, 
  CheckCircle2, 
  Clock, 
  Crown, 
  Film, 
  ChevronRight,
  AlertCircle,
  Loader2,
  TrendingUp
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

  const showCelebrationToast = (title, rewardText, bonus = '') => {
    setCelebration({ title, rewardText, bonus });
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
        showError(res?.error || 'Ad was closed early. Please watch the full ad to earn time.');
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

          showCelebrationToast(`🎉 ${packTitle} Unlocked!`, `+${rewardMinutes} Minutes credited!`, 'BONUS REWARD CLAIMED');
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

  // Battery percentage for balance gauge (max 1 hour / 3600s as 100%)
  const batteryPct = Math.min(100, Math.round((watchTimeSeconds / 3600) * 100));
  const approxVideos = Math.max(1, Math.floor(watchTimeSeconds / 60));

  const PACKS = [
    {
      id: 'pack_5',
      title: 'Starter Pass',
      target: 5,
      rewardMinutes: 5,
      badge: '5 Min Pass',
      badgeColor: 'from-blue-500 to-cyan-500',
      icon: <Sparkles className="w-5 h-5 text-cyan-400" />,
      tag: '1 Ad = 1 Min',
      gradient: 'from-cyan-950/40 via-slate-900/60 to-slate-950/80',
      borderColor: 'border-cyan-500/30 hover:border-cyan-400/60'
    },
    {
      id: 'pack_10',
      title: 'Silver Power Pack',
      target: 10,
      rewardMinutes: 12,
      badge: '+2 MIN BONUS',
      badgeColor: 'from-orange-500 to-amber-500',
      icon: <Flame className="w-5 h-5 text-orange-400" />,
      tag: '🔥 POPULAR VALUE',
      gradient: 'from-orange-950/40 via-slate-900/60 to-slate-950/80',
      borderColor: 'border-orange-500/30 hover:border-orange-400/60'
    },
    {
      id: 'pack_20',
      title: 'Diamond Turbo Pack',
      target: 20,
      rewardMinutes: 25,
      badge: '+5 MIN BONUS',
      badgeColor: 'from-purple-500 to-pink-500',
      icon: <Award className="w-5 h-5 text-purple-400" />,
      tag: '💎 ULTRA DISCOUNT',
      gradient: 'from-purple-950/40 via-slate-900/60 to-slate-950/80',
      borderColor: 'border-purple-500/30 hover:border-purple-400/60'
    },
    {
      id: 'pack_50',
      title: 'Master VIP Pass',
      target: 50,
      rewardMinutes: 120,
      badge: '+70 MIN MEGA BONUS',
      badgeColor: 'from-rose-500 to-red-600',
      icon: <Crown className="w-5 h-5 text-yellow-400" />,
      tag: '👑 2 HOURS UNLIMITED',
      gradient: 'from-rose-950/50 via-slate-900/60 to-slate-950/80',
      borderColor: 'border-rose-500/40 hover:border-rose-400/80'
    }
  ];

  return (
    <div className="pb-28 px-4 pt-3 max-w-md mx-auto space-y-4 select-none animate-fadeIn">

      {/* ========================================================= */}
      {/* 1. HOLOGRAPHIC WATCH TIME BALANCE CARD */}
      {/* ========================================================= */}
      <div className="relative overflow-hidden rounded-3xl p-5 border border-white/10 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-slate-950/95 shadow-2xl backdrop-blur-xl">
        
        {/* Ambient Neon Glow Backdrops */}
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-red-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-red-500/15 text-red-400 border border-red-500/30 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
                Live Watch Time Balance
              </span>
            </div>
            
            <div className="flex items-baseline gap-2 mt-2">
              <h1 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-300 font-['Outfit']">
                {formatTime(watchTimeSeconds)}
              </h1>
            </div>

            <p className="text-[12px] text-slate-400 font-medium mt-1">
              Stream all uncut videos seamlessly. Refill instantly anytime!
            </p>
          </div>

          {/* Glowing Animated Energy Orb */}
          <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-red-600 to-orange-500 shadow-lg shadow-red-500/30 border border-white/20">
            <Zap className="w-7 h-7 text-white fill-white animate-pulse" />
          </div>
        </div>

        {/* Battery Power Gauge & Stats Bar */}
        <div className="relative z-10 mt-4 pt-3 border-t border-white/10">
          <div className="flex justify-between items-center text-[11px] font-bold text-slate-400 mb-1.5">
            <span className="flex items-center gap-1 text-slate-300">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              Power Level: {batteryPct}%
            </span>
            <span className="flex items-center gap-1 text-amber-300">
              <Film className="w-3.5 h-3.5" />
              ~{approxVideos} Videos Streamable
            </span>
          </div>

          {/* Smooth Gradient Energy Bar */}
          <div className="w-full h-2 rounded-full bg-slate-800/80 overflow-hidden p-0.5 border border-white/5">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-400 transition-all duration-700 shadow-sm"
              style={{ width: `${Math.max(5, batteryPct)}%` }}
            />
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. INSTANT LIGHTNING QUICK BOOST (1 AD = 1 MINUTE) */}
      {/* ========================================================= */}
      <div className="relative overflow-hidden rounded-2xl p-4 border border-emerald-500/40 bg-gradient-to-r from-emerald-950/40 via-slate-900/80 to-slate-900/90 shadow-xl backdrop-blur-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25 border border-emerald-400/30">
              <Zap className="w-6 h-6 text-white fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[14px] font-extrabold text-white">Instant Quick Boost</h3>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  +1 Min Free
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Watch 1 short ad <span className="text-emerald-400 font-bold">→ Get +60s Watch Time</span>
              </p>
            </div>
          </div>

          <button
            onClick={handleQuickWatch}
            disabled={adLoading}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-[12px] font-extrabold shadow-lg shadow-emerald-500/30 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
          >
            {adLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-white" />
            )}
            <span>Watch (+1m)</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. TIERED WATCH TIME PACKS SECTION */}
      {/* ========================================================= */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-red-500" />
            <h2 className="text-[14px] font-extrabold text-white uppercase tracking-wider font-['Outfit']">
              Watch Time Packs & Bonus Rewards
            </h2>
          </div>
          <span className="text-[11px] font-bold text-slate-400">
            Higher Pack = Bigger Bonus 🔥
          </span>
        </div>

        {/* Dynamic Pack Cards */}
        {PACKS.map((pack) => {
          const currentProgress = adPacksProgress[pack.id] || 0;
          const isCompleted = currentProgress >= pack.target;
          const progressPct = Math.min(100, Math.round((currentProgress / pack.target) * 100));

          return (
            <div 
              key={pack.id}
              className={`relative overflow-hidden rounded-2xl p-4 border transition-all duration-300 bg-gradient-to-br ${pack.gradient} ${pack.borderColor} shadow-lg backdrop-blur-md`}
            >
              {/* Header: Title, Icon & Reward Badge */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-white/10 flex items-center justify-center shadow-inner">
                    {pack.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-[14px] font-extrabold text-white font-['Outfit']">
                        {pack.title}
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium">
                      Total Reward: <strong className="text-white">+{pack.rewardMinutes} Minutes</strong> ({pack.rewardMinutes * 60}s)
                    </p>
                  </div>
                </div>

                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide uppercase bg-gradient-to-r ${pack.badgeColor} text-white shadow-sm`}>
                  {pack.badge}
                </span>
              </div>

              {/* Progress Track & Count */}
              <div className="space-y-1.5 mb-3.5">
                <div className="flex justify-between items-center text-[11px] font-bold">
                  <span className="text-slate-400">Progress</span>
                  <span className="text-white font-extrabold">
                    {currentProgress} / {pack.target} Ads
                  </span>
                </div>

                {/* Segmented Progress Bar */}
                <div className="w-full h-2 rounded-full bg-slate-950/80 p-0.5 border border-white/10 overflow-hidden">
                  <div 
                    className="h-full rounded-full bg-gradient-to-r from-red-500 via-pink-500 to-cyan-400 transition-all duration-500 shadow-sm"
                    style={{ width: `${Math.max(4, progressPct)}%` }}
                  />
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => handlePackWatch(pack.id, pack.target, pack.rewardMinutes, pack.title)}
                disabled={adLoading}
                className="w-full py-2.5 px-4 rounded-xl font-extrabold text-[12px] flex items-center justify-center gap-2 bg-slate-800/90 hover:bg-slate-700/90 text-white border border-white/10 shadow-md active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {adLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-white text-white" />
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

      {/* ========================================================= */}
      {/* 4. LOADING OVERLAY MODAL */}
      {/* ========================================================= */}
      {adLoading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-white/20 p-6 rounded-3xl max-w-xs w-full text-center shadow-2xl space-y-4">
            <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-red-500/20 animate-ping" />
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-red-600 to-pink-500 flex items-center justify-center shadow-lg shadow-red-500/40">
                <Play className="w-7 h-7 text-white fill-white animate-pulse" />
              </div>
            </div>

            <div>
              <h3 className="text-base font-extrabold text-white">Opening Rewarded Ad...</h3>
              <p className="text-[12px] text-slate-400 mt-1">
                {loadingMessage || 'Please watch full ad to verify and credit watch time.'}
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-[11px] font-bold text-amber-400 bg-amber-500/10 py-1.5 px-3 rounded-xl border border-amber-500/20">
              <ShieldCheck className="w-4 h-4" />
              <span>Monetag Verified Rewarded Stream</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. CELEBRATION TOAST */}
      {/* ========================================================= */}
      {celebration && (
        <div className="fixed bottom-20 left-4 right-4 z-[99] animate-bounce">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-4 rounded-2xl shadow-2xl border border-emerald-400/40 text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl shadow-inner">
              ⚡
            </div>
            <div className="flex-1">
              <h4 className="font-extrabold text-sm">{celebration.title}</h4>
              <p className="text-xs text-emerald-100 font-medium">{celebration.rewardText}</p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. ERROR / NOTICE TOAST */}
      {/* ========================================================= */}
      {errorToast && (
        <div className="fixed bottom-20 left-4 right-4 z-[99] animate-fadeIn">
          <div className="bg-gradient-to-r from-red-600 to-rose-700 p-4 rounded-2xl shadow-2xl border border-red-400/40 text-white flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-white shrink-0" />
            <div className="flex-1">
              <h4 className="font-extrabold text-sm">Ad Incomplete</h4>
              <p className="text-xs text-rose-100 font-medium">{errorToast}</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
