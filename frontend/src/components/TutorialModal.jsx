import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Volume2, 
  VolumeX, 
  Play, 
  Pause, 
  Zap, 
  Sparkles, 
  CheckCircle, 
  HelpCircle,
  Gift
} from 'lucide-react';

export default function TutorialModal({ isOpen, onClose, onWatchAd, adLoading }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [audioLoaded, setAudioLoaded] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsPlaying(false);
      return;
    }

    // When modal opens, auto-play the voice tutorial guide
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch(() => {
            // Browser autoplay restrictions may require explicit user click
            setIsPlaying(false);
          });
      }
    }
  }, [isOpen]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(5, 7, 13, 0.85)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      zIndex: 250,
      animation: 'fadeIn 0.25s ease-out'
    }}>
      {/* Hidden Audio Element */}
      <audio 
        ref={audioRef} 
        src="/audio/tutorial_guide.mp3" 
        preload="auto"
        onEnded={() => setIsPlaying(false)}
        onLoadedData={() => setAudioLoaded(true)}
      />

      <div style={{
        background: 'linear-gradient(165deg, rgba(16, 21, 35, 0.98), rgba(10, 14, 25, 0.98))',
        border: '1px solid rgba(0, 242, 254, 0.3)',
        borderRadius: '24px',
        maxWidth: '420px',
        width: '100%',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(0, 242, 254, 0.15)',
        padding: '24px',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            color: '#94a3b8',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <X size={18} />
        </button>

        {/* Header with audio wave indicator */}
        <div style={{ textAlign: 'center', marginBottom: '18px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '18px',
            background: 'linear-gradient(135deg, #ff2a5f, #00f2fe)',
            margin: '0 auto 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '26px',
            boxShadow: '0 8px 25px rgba(0, 242, 254, 0.35)'
          }}>
            🎧
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.3px', marginBottom: '4px' }}>
            Watch Time Kaise Lein?
          </h2>
          <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
            Sunie aur dekhiye — Free Watch Time pane ka aasan tareeqa!
          </p>
        </div>

        {/* Audio Player Controller Bar */}
        <div style={{
          background: 'rgba(0, 242, 254, 0.07)',
          border: '1px solid rgba(0, 242, 254, 0.2)',
          borderRadius: '16px',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={togglePlay}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #00f2fe, #38bdf8)',
                border: 'none',
                color: '#06080e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0, 242, 254, 0.4)'
              }}
            >
              {isPlaying ? <Pause size={18} fill="#06080e" /> : <Play size={18} fill="#06080e" style={{ marginLeft: '2px' }} />}
            </button>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff' }}>
                {isPlaying ? 'Speaking Voice Guide...' : 'Voice Guide (Audio)'}
              </div>
              <div style={{ fontSize: '0.72rem', color: isPlaying ? '#00f2fe' : '#94a3b8' }}>
                {isPlaying ? '🔊 Playing in Hindi' : 'Click Play button to listen'}
              </div>
            </div>
          </div>

          <button
            onClick={toggleMute}
            style={{
              background: 'transparent',
              border: 'none',
              color: isMuted ? '#ff2a5f' : '#94a3b8',
              cursor: 'pointer',
              padding: '6px'
            }}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>

        {/* 3 Simple Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '22px' }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '14px',
            padding: '12px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <div style={{
              background: 'rgba(0, 242, 254, 0.15)',
              color: '#00f2fe',
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '0.85rem',
              flexShrink: 0
            }}>1</div>
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff' }}>
                "Watch Quick Ad" par click karein
              </div>
              <div style={{ fontSize: '0.76rem', color: '#94a3b8', marginTop: '2px' }}>
                Video player ya Earn Time store me button dabayein.
              </div>
            </div>
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '14px',
            padding: '12px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <div style={{
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '0.85rem',
              flexShrink: 0
            }}>2</div>
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff' }}>
                5 se 15 second ka chhota ad dekhein
              </div>
              <div style={{ fontSize: '0.76rem', color: '#94a3b8', marginTop: '2px' }}>
                Ad khatam hote hi cross (X) dabakar wapis aayein.
              </div>
            </div>
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '14px',
            padding: '12px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <div style={{
              background: 'rgba(255, 42, 95, 0.15)',
              color: '#ff2a5f',
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '0.85rem',
              flexShrink: 0
            }}>3</div>
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff' }}>
                Free Watch Time turant add!
              </div>
              <div style={{ fontSize: '0.76rem', color: '#94a3b8', marginTop: '2px' }}>
                Aapka video automatic chalne lagega bina ruke.
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {onWatchAd && (
            <button
              onClick={() => {
                if (audioRef.current) audioRef.current.pause();
                onWatchAd();
              }}
              disabled={adLoading}
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                border: 'none',
                color: '#ffffff',
                padding: '14px',
                borderRadius: '16px',
                fontWeight: 800,
                fontSize: '0.92rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 6px 20px rgba(16, 185, 129, 0.4)',
                opacity: adLoading ? 0.6 : 1
              }}
            >
              <Zap size={18} fill="#fff" />
              <span>{adLoading ? 'Loading Ad...' : 'Watch Quick Ad (+1 Min)'}</span>
            </button>
          )}

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#94a3b8',
              padding: '12px',
              borderRadius: '14px',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            Samajh Gaya / Band Karein
          </button>
        </div>
      </div>
    </div>
  );
}
