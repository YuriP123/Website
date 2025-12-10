'use client';

import { useState, useRef, useEffect } from 'react';
import Bios from '@/components/Bios';
import PasswordScreen from '@/components/PasswordScreen';
import Navbar from '@/components/Navbar';
import Window from '@/components/Window';
import Desktop from '@/components/Desktop';
import MusicPlayer from '@/components/MusicPlayer';
import FolderContent from '@/components/FolderContent';
import FileViewer from '@/components/FileViewer';
import { fileSystem, findItemById } from '@/utils/fileSystem';

export default function Home() {
  const [screen, setScreen] = useState('BIOS'); // BIOS, PASSWORD, DESKTOP
  const [openWindows, setOpenWindows] = useState([]); // Array of IDs
  const [playingSong, setPlayingSong] = useState(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [showHiddenFiles, setShowHiddenFiles] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const videoRef = useRef(null);
  const musicPlayerPauseRef = useRef(null);
  const isMusicPlayingRef = useRef(false);

  // Track if video should be visible (when a song with video is playing)
  const currentSongItem = playingSong ? findItemById(fileSystem, playingSong) : null;
  const shouldShowVideo = currentSongItem?.videoSrc ? true : false;
  const videoSource = currentSongItem?.videoSrc || null;
  const isCondensed = isMobile && !!playingSong;
  
  // Keep previous video source during transitions to prevent unmounting
  const [displayVideoSource, setDisplayVideoSource] = useState(null);

  // Track window positions - centralized or default to item config
  const [windowPositions, setWindowPositions] = useState({});

  const updateWindowPosition = (windowId, position) => {
    setWindowPositions(prev => ({
      ...prev,
      [windowId]: position
    }));
  };

  const openWindow = (id, type) => {
    // Handling special Logic for music files if needed
    if (type === 'music') {
      // Assume ID is song name for now based on fileSystem structure
      playSong(id);
      return;
    }

    if (!openWindows.includes(id)) {
      setOpenWindows([...openWindows, id]);

      // Set initial position if not set
      if (!windowPositions[id]) {
        const item = findItemById(fileSystem, id);
        // Stagger positions slightly
        const offset = openWindows.length * 20;
        setWindowPositions(prev => ({
          ...prev,
          [id]: { x: 100 + offset, y: 50 + offset }
        }));
      }
    }
  };

  const closeWindow = (id) => {
    setOpenWindows(openWindows.filter(w => w !== id));
  };

  const bringToFront = (id) => {
    setOpenWindows(prev => {
      // If already at the end (top), do nothing
      if (prev[prev.length - 1] === id) return prev;

      // Remove and append to end
      return [...prev.filter(w => w !== id), id];
    });
  };

  // Track mobile viewport
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const playSong = (songName) => {
    const songItem = findItemById(fileSystem, songName);
    
    // Set video source directly - no fade animations
    if (songItem?.videoSrc) {
          setPlayingSong(songName);
          setDisplayVideoSource(songItem.videoSrc);
    } else {
      // No video for this song
        setPlayingSong(songName);
        setDisplayVideoSource(null);
    }
  };

  // Get all music songs from MUSIC folder
  const getMusicSongs = () => {
    const musicFolder = findItemById(fileSystem, 'MUSIC');
    return musicFolder?.children?.filter(item => item.type === 'music') || [];
  };

  // Navigate to next song
  const handleNextSong = () => {
    const songs = getMusicSongs();
    if (songs.length === 0) return;
    
    // Pause current song immediately before switching
    if (musicPlayerPauseRef.current) {
      musicPlayerPauseRef.current();
    }
    setIsMusicPlaying(false);
    
    const currentIndex = songs.findIndex(song => song.id === playingSong);
    const nextIndex = currentIndex < songs.length - 1 ? currentIndex + 1 : 0;
    playSong(songs[nextIndex].id);
  };

  // Navigate to previous song
  const handlePrevSong = () => {
    const songs = getMusicSongs();
    if (songs.length === 0) return;
    
    // Pause current song immediately before switching
    if (musicPlayerPauseRef.current) {
      musicPlayerPauseRef.current();
    }
    setIsMusicPlaying(false);
    
    const currentIndex = songs.findIndex(song => song.id === playingSong);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : songs.length - 1;
    playSong(songs[prevIndex].id);
  };

  const closeMusicPlayer = () => {
    setIsMusicPlaying(false);
        setPlayingSong(null);
    setDisplayVideoSource(null);
    
    // Pause and reset video if it exists
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        }
  };

  // Ensure video loads when source changes via React props
  useEffect(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const currentSrc = displayVideoSource || videoSource;
      
    // Wait for React to update the src attribute, then load
    if (currentSrc) {
      // Use a small timeout to ensure React has updated the src
      const timeoutId = setTimeout(() => {
        if (videoRef.current && videoRef.current.src) {
          videoRef.current.load();
          
          // If music is already playing, try to play video after load
          if (isMusicPlayingRef.current) {
            setTimeout(() => {
              const v = videoRef.current;
              if (v && v.src && v.readyState >= 2) {
                v.play().then(() => {
                  console.log('Video auto-played after load');
                }).catch((err) => {
                  console.log('Video auto-play failed:', err.name);
                });
              }
            }, 200);
    }
        }
      }, 50);
      return () => clearTimeout(timeoutId);
    } else {
      // Clear video when no source
      video.pause();
      video.currentTime = 0;
    }
  }, [displayVideoSource, videoSource]);

  const handlePlayingChange = (isPlaying, songId) => {
    const songItem = songId ? findItemById(fileSystem, songId) : null;
    
    // Track playing state for songs with video backgrounds
    // Always update isMusicPlaying based on isPlaying state if song has video
    if (songItem?.videoSrc) {
      isMusicPlayingRef.current = isPlaying;
      setIsMusicPlaying(isPlaying);
      
      // If music just started playing, immediately try to play video
      // This is called in response to user interaction, so autoplay should work
      if (isPlaying) {
        // Use requestAnimationFrame to ensure this happens in the next frame
        // This keeps it in the user interaction context
        requestAnimationFrame(() => {
          const video = videoRef.current;
          if (!video) return;
          
          const tryPlay = () => {
            if (!video.src) {
              console.log('Video src not set yet');
              return;
            }
            
            console.log('Attempting to play video, readyState:', video.readyState);
            video.play().then(() => {
              console.log('✅ Video started playing successfully!');
            }).catch((error) => {
              console.log('❌ Video play failed:', error.name, error.message);
              
              // If not ready, wait for ready events
              if (video.readyState < 3) {
                console.log('Video not ready, waiting for canplay...');
                const playWhenReady = () => {
                  if (isMusicPlayingRef.current && video.src) {
                    video.play().then(() => {
                      console.log('✅ Video played after ready event');
                    }).catch((err) => {
                      console.log('❌ Video play failed on ready:', err.name);
                    });
                  }
                };
                video.addEventListener('canplay', playWhenReady, { once: true });
                video.addEventListener('canplaythrough', playWhenReady, { once: true });
              }
            });
          };
          
          // Try immediately
          tryPlay();
          
          // Also try after delays
          setTimeout(tryPlay, 100);
          setTimeout(tryPlay, 300);
          setTimeout(tryPlay, 600);
        });
      } else {
        // Pause video when music pauses
        if (videoRef.current) {
          videoRef.current.pause();
          console.log('Video paused');
        }
      }
    } else {
      isMusicPlayingRef.current = false;
      setIsMusicPlaying(false);
    }
  };

  // Sync video playback with music playing state - ensures video plays/pauses with music
  useEffect(() => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    const hasVideoSource = displayVideoSource || videoSource;
    
    // If no video source, ensure video is paused
    if (!hasVideoSource) {
      video.pause();
      return;
    }

    // Sync video with music playing state
    if (isMusicPlaying) {
      // Function to attempt playing the video - try aggressively
      const attemptPlay = () => {
        const currentVideo = videoRef.current;
        if (!currentVideo || !currentVideo.src) {
          console.log('Video play attempt: no video or src');
          return;
        }
        
        // Try to play regardless of readyState - browser will handle it
        currentVideo.play().then(() => {
          console.log('Video play successful in sync effect');
        }).catch((error) => {
          console.log('Video play error in sync effect:', error.name, error.message);
        });
      };
      
      // Try to play immediately
      attemptPlay();
      
      // Set up listeners for when video becomes ready
      const handleCanPlay = () => {
        if (isMusicPlayingRef.current && videoRef.current && videoRef.current.src) {
          videoRef.current.play().then(() => {
            console.log('Video played via canplay listener');
          }).catch((error) => {
            console.log('Video play failed via canplay:', error.name);
          });
        }
      };
      
      const handleLoadedData = () => {
        if (isMusicPlayingRef.current && videoRef.current && videoRef.current.src) {
          videoRef.current.play().then(() => {
            console.log('Video played via loadeddata listener');
          }).catch((error) => {
            console.log('Video play failed via loadeddata:', error.name);
          });
        }
      };
      
      const handleLoadedMetadata = () => {
        if (isMusicPlayingRef.current && videoRef.current && videoRef.current.src) {
          videoRef.current.play().then(() => {
            console.log('Video played via loadedmetadata listener');
          }).catch((error) => {
            console.log('Video play failed via loadedmetadata:', error.name);
          });
        }
      };
      
      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('loadeddata', handleLoadedData);
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      
      // Also try multiple times as fallback
      const timeout1 = setTimeout(attemptPlay, 100);
      const timeout2 = setTimeout(attemptPlay, 300);
      const timeout3 = setTimeout(attemptPlay, 500);
      
      // Cleanup
      return () => {
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('loadeddata', handleLoadedData);
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        clearTimeout(timeout1);
        clearTimeout(timeout2);
        clearTimeout(timeout3);
      };
    } else {
      // Pause when music is not playing
      if (video.src) {
      video.pause();
      }
    }
  }, [isMusicPlaying, displayVideoSource, videoSource]);

  return (
    <>
      {/* Background Video - always mounted to prevent ref issues */}
      <video
        ref={videoRef}
        className="background-video"
        style={{ display: (displayVideoSource || videoSource) ? 'block' : 'none' }}
        loop
        muted
        playsInline
        autoPlay
        preload="auto"
        src={displayVideoSource || videoSource || undefined}
        onLoadedData={() => {
          // When video loads, try to play if music is playing
          const video = videoRef.current;
          if (!video || !video.src) return;
          
          // Use ref to check current playing state
          if (isMusicPlayingRef.current) {
            video.play().then(() => {
              console.log('Video played on loadeddata');
            }).catch((error) => {
              console.log('Video play failed on loadeddata:', error.name);
            });
          } else {
            video.pause();
          }
        }}
        onCanPlay={() => {
          // When video can play, try to play if music is playing
          const video = videoRef.current;
          if (!video || !video.src) return;
          
          // Use ref to check current playing state
          if (isMusicPlayingRef.current) {
            video.play().then(() => {
              console.log('Video played on canplay');
            }).catch((error) => {
              console.log('Video play failed on canplay:', error.name);
            });
          } else {
            video.pause();
          }
        }}
        onEnded={(e) => {
          // Ensure video restarts if music player is still open and playing
          if (isMusicPlaying && (displayVideoSource || videoSource)) {
            e.target.currentTime = 0;
            e.target.play().catch(() => {});
          }
        }}
      />
      <main className={`module ${isCondensed ? 'module-condensed' : ''}`}>
        {screen === 'BIOS' && (
          <Bios onComplete={() => setScreen('PASSWORD')} />
        )}

        {screen === 'PASSWORD' && (
          <>
            <PasswordScreen onUnlock={() => setScreen('DESKTOP')} />
            <Navbar />
          </>
        )}

        {screen === 'DESKTOP' && (
          <>
            <Navbar 
              showHiddenFiles={showHiddenFiles}
              onShowHiddenFiles={() => setShowHiddenFiles(!showHiddenFiles)} 
            />
            <Desktop onOpenWindow={openWindow} showHiddenFiles={showHiddenFiles} />

            {/* Dynamic Window Rendering */}
            {openWindows.map(id => {
              // Handle hidden file separately
              if (id === 'HIDDEN_GIF') {
                const hiddenFile = {
                  id: 'HIDDEN_GIF',
                  title: 'gundam.gif',
                  type: 'gif',
                  windowSize: { w: 500, h: 400 },
                };
                return (
                  <Window
                    key={id}
                    title={hiddenFile.title}
                    onClose={() => closeWindow(id)}
                    style={{
                      position: 'absolute',
                      width: hiddenFile.windowSize.w,
                      height: hiddenFile.windowSize.h
                    }}
                    position={windowPositions[id] || { x: 50, y: 50 }}
                    onPositionChange={(pos) => updateWindowPosition(id, pos)}
                    onFocus={() => bringToFront(id)}
                  >
                    <FileViewer item={hiddenFile} />
                  </Window>
                );
              }

              const item = findItemById(fileSystem, id);
              if (!item) return null;

              return (
                <Window
                  key={id}
                  title={item.title}
                  onClose={() => closeWindow(id)}
                  style={{
                    position: 'absolute',
                    width: item.windowSize?.w || 500,
                    height: item.windowSize?.h || 400
                  }}
                  position={windowPositions[id] || { x: 50, y: 50 }}
                  onPositionChange={(pos) => updateWindowPosition(id, pos)}
                  onFocus={() => bringToFront(id)}
                  className={item.className || ''}
                >
                  {item.type === 'folder' ? (
                    <FolderContent items={item.children} onOpen={openWindow} />
                  ) : (
                    <FileViewer item={item} />
                  )}
                </Window>
              );
            })}

            {playingSong && (
              <MusicPlayer
                songName={findItemById(fileSystem, playingSong)?.title || playingSong}
                songId={playingSong}
                src={findItemById(fileSystem, playingSong)?.src}
                onClose={closeMusicPlayer}
                onPlayingChange={handlePlayingChange}
                condensed={isCondensed}
                position={
                  isCondensed
                    ? { x: 0, y: 0 }
                    : (windowPositions.MUSIC_PLAYER || { x: 300, y: 100 })
                }
                onPositionChange={
                  isCondensed
                    ? undefined
                    : (pos) => updateWindowPosition('MUSIC_PLAYER', pos)
                }
                onFocus={() => bringToFront('MUSIC_PLAYER')}
                onNextSong={handleNextSong}
                onPrevSong={handlePrevSong}
                onPauseRef={musicPlayerPauseRef}
              />
            )}
          </>
        )}
      </main>
    </>
  );
}
