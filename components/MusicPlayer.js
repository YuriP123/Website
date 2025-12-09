'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Window from './Window';

export default function MusicPlayer({ 
  songName, 
  songId, 
  src, 
  onClose, 
  onPlayingChange, 
  position, 
  onPositionChange, 
  controlsEnabled = true,
  onNextSong,
  onPrevSong,
  onPauseRef
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const audioRef = useRef(null);
  const buttonDebounceRef = useRef(false);

  const effectiveSongId = songId || songName;
  // Construct audio path from src or songName
  const currentAudioPath = src || (songName ? `/media/${songName.toLowerCase().replace(/\s+/g, '')}.mp3` : '');

  // Helper: Resume audio context if suspended
  const resumeAudioContext = useCallback(() => {
    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume();
    }
  }, []);

  // Helper: Format time display
  const formatTime = useCallback((seconds) => {
    if (!seconds || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Initialize Web Audio API for visualizer
  useEffect(() => {
    if (!audioRef.current) return;

    // Only initialize once - createMediaElementSource can only be called once per audio element
    if (audioContextRef.current && sourceRef.current) {
      // Connection already exists, just ensure context is resumed
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      return;
    }

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContext();
      const analyser = audioCtx.createAnalyser();
      
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;

      const source = audioCtx.createMediaElementSource(audioRef.current);
      source.connect(analyser);
      analyser.connect(audioCtx.destination);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;
      sourceRef.current = source;
    } catch (error) {
      console.warn("Web Audio API setup failed:", error);
    }
  }, [audioRef.current]); // Re-run when audio element is available

  // Ensure audio context stays active when song changes
  useEffect(() => {
    if (audioContextRef.current) {
      // Resume context if suspended
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(console.error);
      }
      // Ensure analyser is still connected
      if (analyserRef.current && audioRef.current) {
        // The connection should persist, but ensure it's active
        try {
          // Force a read to ensure analyser is working
          const testArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(testArray);
        } catch (e) {
          console.warn("Analyser connection issue:", e);
        }
      }
    }
  }, [songName, currentAudioPath]); // Resume when song changes

  // Audio visualizer drawing loop
  useEffect(() => {
    if (!canvasRef.current) return;

    let animationId;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const draw = () => {
      // Check if analyser is available (might not be ready when song changes)
      if (!analyserRef.current) {
        // Clear canvas if no analyser
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        animationId = requestAnimationFrame(draw);
        return;
      }

      const width = canvas.width;
      const height = canvas.height;
      const analyser = analyserRef.current;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      try {
        analyser.getByteFrequencyData(dataArray);
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#000000';

        const effectiveBufferLength = Math.floor(bufferLength * 0.7);
        const barWidth = width / effectiveBufferLength;

        for (let i = 0; i < effectiveBufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * height;
          ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
        }
      } catch (error) {
        // Handle any errors gracefully
        console.warn("Visualizer error:", error);
      }

      animationId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationId);
  }, []); // Keep running regardless of song changes

  // Handle audio source updates
  useEffect(() => {
    if (!currentAudioPath || !audioRef.current) return;

    const audio = audioRef.current;
    const expectedPath = currentAudioPath;
    const currentSrc = audio.src || '';
    const fullExpectedUrl = `${window.location.origin}${expectedPath}`;

    // Check if source needs updating
    const needsUpdate = currentSrc !== expectedPath && 
                        currentSrc !== fullExpectedUrl && 
                        !currentSrc.endsWith(expectedPath);

    if (needsUpdate) {
      audio.pause();
      audio.currentTime = 0;
      audio.src = '';
      
      requestAnimationFrame(() => {
        if (audioRef.current && expectedPath) {
          audioRef.current.src = expectedPath;
          audioRef.current.load();
        }
      });
    } else if (audio.readyState === 0 || audio.networkState === 0) {
      audio.load();
    }
  }, [currentAudioPath, songName]);

  // Set up audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      onPlayingChange?.(false, effectiveSongId);
    };

    const handleError = () => {
      console.warn(`Audio source not found: ${currentAudioPath}`);
      setIsPlaying(false);
      onPlayingChange?.(false, effectiveSongId);
    };

    const handleCanPlayThrough = () => {
      // Auto-play after delay to allow video to load
      setTimeout(() => {
        resumeAudioContext();
        audio.play()
          .then(() => setIsPlaying(true))
          .catch((error) => {
            console.log('Autoplay prevented by browser:', error);
          });
      }, 800);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplaythrough', handleCanPlayThrough);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplaythrough', handleCanPlayThrough);
    };
  }, [currentAudioPath, effectiveSongId, onPlayingChange, resumeAudioContext]);

  // Notify parent of playing state changes
  useEffect(() => {
    onPlayingChange?.(isPlaying, effectiveSongId);
  }, [isPlaying, effectiveSongId, onPlayingChange]);

  // Expose pause function to parent
  useEffect(() => {
    if (onPauseRef) {
      onPauseRef.current = () => {
        if (audioRef.current) {
          audioRef.current.pause();
          setIsPlaying(false);
          onPlayingChange?.(false, effectiveSongId);
        }
      };
    }
    return () => {
      if (onPauseRef) {
        onPauseRef.current = null;
      }
    };
  }, [onPauseRef, onPlayingChange, effectiveSongId]);


  // Toggle play/pause (no debouncing - allow spamming)
  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;

    resumeAudioContext();

    const newPlayingState = !isPlaying;
    
    if (newPlayingState) {
      audioRef.current.play().catch(console.error);
    } else {
      audioRef.current.pause();
    }
    
    setIsPlaying(newPlayingState);
    onPlayingChange?.(newPlayingState, effectiveSongId);
  }, [isPlaying, onPlayingChange, effectiveSongId, resumeAudioContext]);

  // Handle window close
  const handleClose = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = '';
    }
    setIsPlaying(false);
    onPlayingChange?.(false, effectiveSongId || null);
    onClose();
  }, [onClose, onPlayingChange, effectiveSongId]);

  // Navigate to next song with debouncing (prevent spam to avoid messing up video animations)
  const handleNext = useCallback(() => {
    if (buttonDebounceRef.current || !onNextSong) return;
    
    buttonDebounceRef.current = true;
    onNextSong();
    
    // Debounce for duration of black overlay transition (1.5s fade + buffer)
    setTimeout(() => {
      buttonDebounceRef.current = false;
    }, 2000);
  }, [onNextSong]);

  // Navigate to previous song with debouncing (prevent spam to avoid messing up video animations)
  const handlePrev = useCallback(() => {
    if (buttonDebounceRef.current || !onPrevSong) return;
    
    buttonDebounceRef.current = true;
    onPrevSong();
    
    // Debounce for duration of black overlay transition (1.5s fade + buffer)
    setTimeout(() => {
      buttonDebounceRef.current = false;
    }, 2000);
  }, [onPrevSong]);

  return (
    <Window
      title="Music Player"
      onClose={handleClose}
      style={{
        position: 'absolute',
        width: 400,
        height: 280,
        minHeight: 280
      }}
      position={position}
      onPositionChange={onPositionChange}
    >
      <div className="music-player">
        {currentAudioPath && (
          <audio
            ref={audioRef}
            src={currentAudioPath}
            type="audio/mpeg"
            crossOrigin="anonymous"
            preload="auto"
          />
        )}

        {/* Audio Visualizer */}
        <div className="audio-visualizer" style={{ background: '#fff', border: '1px solid black', padding: 0 }}>
          <canvas
            ref={canvasRef}
            width={380}
            height={40}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        </div>

        <div className="divider"></div>

        {/* Playback Time */}
        <div className="playback-time">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        {/* Song Info */}
        <div className="song-info">
          <div className="song-title">
            {songName.replace(/-/g, ' ').toUpperCase()}
          </div>
          <div className="song-artist">@uri.sound</div>
        </div>

        {/* Controls */}
        <div className="player-controls">
          <button 
            className="control-btn prev-btn" 
            aria-label="Previous"
            onClick={handlePrev}
            disabled={buttonDebounceRef.current}
            style={{ opacity: buttonDebounceRef.current ? 0.5 : 1, cursor: buttonDebounceRef.current ? 'not-allowed' : 'pointer' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 2 L2 8 L8 14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
              <path d="M14 2 L8 8 L14 14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          </button>

          <button 
            className="control-btn play-pause-btn" 
            onClick={togglePlay} 
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="4" y="2" width="3" height="12" fill="currentColor" />
                <rect x="9" y="2" width="3" height="12" fill="currentColor" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 2 L14 8 L4 14 Z" fill="currentColor" />
              </svg>
            )}
          </button>

          <button 
            className="control-btn next-btn" 
            aria-label="Next"
            onClick={handleNext}
            disabled={buttonDebounceRef.current}
            style={{ opacity: buttonDebounceRef.current ? 0.5 : 1, cursor: buttonDebounceRef.current ? 'not-allowed' : 'pointer' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 2 L8 8 L2 14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
              <path d="M8 2 L14 8 L8 14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
    </Window>
  );
}
