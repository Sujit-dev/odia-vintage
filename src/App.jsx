import { useCallback, useEffect, useRef, useState } from 'react';
import { HIGHWAY_ROUTES, RADIO } from './data/radio';

function readTrack(player) {
  try {
    const data = player.getVideoData?.() || {};
    const index = player.getPlaylistIndex?.() ?? 0;
    return {
      id: data.video_id || '',
      title: data.title || 'Tuning highway frequency…',
      artist: data.author || 'YouTube Live Mix',
      route: HIGHWAY_ROUTES[Math.abs(index) % HIGHWAY_ROUTES.length],
      index: Math.max(0, index),
    };
  } catch {
    return {
      id: '',
      title: 'Tuning highway frequency…',
      artist: 'YouTube Live Mix',
      route: HIGHWAY_ROUTES[0],
      index: 0,
    };
  }
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  return `${mins}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

function createRainSound(context) {
  const length = context.sampleRate * 2;
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = buffer;
  source.loop = true;
  filter.type = 'lowpass';
  filter.frequency.value = 1250;
  gain.gain.value = 0.018;
  source.connect(filter).connect(gain).connect(context.destination);
  source.start();
  return source;
}

export default function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isApiReady, setIsApiReady] = useState(false);
  const [volume, setVolume] = useState(() => Number(localStorage.getItem('coach-volume')) || 80);
  const [, setBusSpeed] = useState(62);
  const [, setHornFlash] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sleepMinutes, setSleepMinutes] = useState(0);
  const [sleepRemaining, setSleepRemaining] = useState(0);
  const [rainEnabled, setRainEnabled] = useState(() => localStorage.getItem('coach-rain') !== 'off');
  const [track, setTrack] = useState({
    id: '',
    title: 'OSRTC Highway FM',
    artist: 'Waiting for live mix…',
    route: HIGHWAY_ROUTES[0],
    index: 0,
  });

  const playerRef = useRef(null);
  const readyRef = useRef(false);
  const playerHostRef = useRef(null);
  const syncTimerRef = useRef(null);
  const volumeRef = useRef(volume);
  const ambienceRef = useRef(null);
  const randomStartRef = useRef(0);
  const rainEnabledRef = useRef(rainEnabled);
  const blockedRef = useRef(new Set([
    ...(RADIO.blockedVideoIds || []),
    ...JSON.parse(localStorage.getItem('coach-blocked-songs') || '[]'),
  ]));

  const startAmbience = useCallback(() => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (ambienceRef.current || !AudioContextClass) return;
    const context = new AudioContextClass();
    const engine = context.createOscillator();
    const tremor = context.createOscillator();
    const tremorGain = context.createGain();
    const master = context.createGain();
    engine.type = 'sine';
    engine.frequency.value = 42;
    tremor.type = 'sine';
    tremor.frequency.value = 1.7;
    tremorGain.gain.value = 1.8;
    master.gain.value = 0.012;
    tremor.connect(tremorGain).connect(engine.frequency);
    engine.connect(master).connect(context.destination);
    engine.start();
    tremor.start();
    const rain = rainEnabledRef.current ? createRainSound(context) : null;
    ambienceRef.current = { context, engine, tremor, rain };
  }, []);

  const stopAmbience = useCallback(() => {
    const ambience = ambienceRef.current;
    if (!ambience) return;
    ambience.engine.stop();
    ambience.tremor.stop();
    ambience.rain?.stop();
    ambience.context.close();
    ambienceRef.current = null;
  }, []);

  const syncTrack = useCallback(() => {
    if (!playerRef.current || !readyRef.current) return;
    const nextTrack = readTrack(playerRef.current);
    if (blockedRef.current.has(nextTrack.id)) {
      playerRef.current.nextVideo?.();
      return;
    }
    setTrack(nextTrack);
    setCurrentTime(playerRef.current.getCurrentTime?.() || 0);
    setDuration(playerRef.current.getDuration?.() || 0);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const playerHost = playerHostRef.current;

    const createPlayer = () => {
      if (cancelled || !playerHostRef.current || playerRef.current) return;

      const mount = document.createElement('div');
      mount.style.width = '100%';
      mount.style.height = '100%';
      playerHostRef.current.replaceChildren(mount);

      playerRef.current = new window.YT.Player(mount, {
        width: '100%',
        height: '100%',
        videoId: RADIO.seedVideoId,
        playerVars: {
          listType: 'playlist',
          list: RADIO.playlistId,
          autoplay: 0,
          controls: 0,
          rel: 0,
          playsinline: 1,
          modestbranding: 1,
          disablekb: 1,
        },
        events: {
          onReady: (event) => {
            if (cancelled) return;
            readyRef.current = true;
            setIsApiReady(true);
            event.target.unMute();
            event.target.setVolume(volumeRef.current);
            try {
              event.target.cuePlaylist({
                listType: 'playlist',
                list: RADIO.playlistId,
                index: 0,
              });
            } catch {
              event.target.cueVideoById(RADIO.seedVideoId);
            }
            window.setTimeout(() => {
              try {
                const playlist = event.target.getPlaylist?.() || [];
                if (playlist.length > 1) {
                  randomStartRef.current = Math.floor(Math.random() * playlist.length);
                  event.target.cuePlaylist({
                    listType: 'playlist',
                    list: RADIO.playlistId,
                    index: randomStartRef.current,
                  });
                  event.target.setShuffle?.(true);
                }
              } catch {
                /* keep the seeded track if shuffle is unavailable */
              }
              syncTrack();
            }, 800);
            syncTimerRef.current = window.setInterval(syncTrack, 2000);
          },
          onStateChange: (event) => {
            const state = window.YT.PlayerState;
            if (event.data === state.PLAYING) {
              setIsPlaying(true);
              startAmbience();
              event.target.unMute();
              event.target.setVolume(volumeRef.current);
              syncTrack();
            } else if (event.data === state.PAUSED) {
              setIsPlaying(false);
              stopAmbience();
            } else if (event.data === state.ENDED || event.data === state.CUED) {
              if (event.data === state.ENDED) stopAmbience();
              syncTrack();
            }
          },
          onError: (event) => {
            const code = event?.data;
            if (code === 101 || code === 150 || code === 100 || code === 2) {
              window.setTimeout(() => {
                try {
                  playerRef.current?.nextVideo?.();
                } catch {
                  /* ignore */
                }
              }, 400);
            }
          },
        },
      });
    };

    if (window.YT?.Player) {
      createPlayer();
    } else {
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        createPlayer();
      };
    }

    return () => {
      cancelled = true;
      readyRef.current = false;
      if (syncTimerRef.current) window.clearInterval(syncTimerRef.current);
      try {
        playerRef.current?.destroy?.();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
      stopAmbience();
      playerHost?.replaceChildren();
    };
  }, [startAmbience, stopAmbience, syncTrack]);

  useEffect(() => {
    let timer;
    const reveal = () => {
      setControlsVisible(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setControlsVisible(false), 3200);
    };
    reveal();
    window.addEventListener('pointermove', reveal, { passive: true });
    window.addEventListener('touchstart', reveal, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointermove', reveal);
      window.removeEventListener('touchstart', reveal);
    };
  }, []);

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  useEffect(() => {
    if (!sleepMinutes) return undefined;
    const deadline = Date.now() + sleepMinutes * 60 * 1000;
    const updateRemaining = () => {
      const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSleepRemaining(seconds);
      if (seconds === 0) {
        playerRef.current?.pauseVideo?.();
        stopAmbience();
        setSleepMinutes(0);
      }
    };
    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [sleepMinutes, stopAmbience]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)) return;
      if (event.code === 'Space') {
        event.preventDefault();
        if (playerRef.current) isPlaying ? playerRef.current.pauseVideo?.() : playerRef.current.playVideo?.();
      } else if (event.key === 'ArrowRight') playerRef.current?.nextVideo?.();
      else if (event.key === 'ArrowLeft') playerRef.current?.previousVideo?.();
      else if (event.key.toLowerCase() === 'f') {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
        else document.exitFullscreen?.();
      } else if (event.key.toLowerCase() === 'h') document.querySelector('.cabin-horn')?.click();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPlaying]);

  const handleSleepTimer = (minutes) => {
    setSleepMinutes(minutes);
    setSleepRemaining(minutes * 60);
  };

  useEffect(() => {
    if (!isPlaying) return undefined;
    const id = window.setInterval(() => {
      setBusSpeed((s) => {
        const next = s + (Math.random() * 4 - 2);
        return Math.min(78, Math.max(48, Math.round(next)));
      });
    }, 1800);
    return () => window.clearInterval(id);
  }, [isPlaying]);

  const togglePlay = () => {
    const player = playerRef.current;
    if (!readyRef.current || !player) return;

    if (isPlaying) {
      player.pauseVideo();
      setIsPlaying(false);
    } else {
      try {
        if (typeof player.playVideoAt === 'function' && player.getPlaylist()?.length) {
          player.playVideo();
        } else {
          player.loadPlaylist({
            listType: 'playlist',
            list: RADIO.playlistId,
            index: randomStartRef.current,
          });
          player.setShuffle?.(true);
        }
      } catch {
        player.playVideo();
      }
      player.unMute();
      player.setVolume(volumeRef.current);
      setIsPlaying(true);
      setTimeout(syncTrack, 600);
    }
  };

  const handleNext = () => {
    if (!readyRef.current || !playerRef.current) return;
    playerRef.current.nextVideo();
    setIsPlaying(true);
    setTimeout(syncTrack, 600);
  };

  const handlePrev = () => {
    if (!readyRef.current || !playerRef.current) return;
    playerRef.current.previousVideo();
    setIsPlaying(true);
    setTimeout(syncTrack, 600);
  };

  const handleVolume = (value) => {
    volumeRef.current = value;
    setVolume(value);
    localStorage.setItem('coach-volume', String(value));
    if (playerRef.current && readyRef.current) {
      playerRef.current.setVolume(value);
      if (value === 0) playerRef.current.mute();
      else playerRef.current.unMute();
    }
  };

  const triggerHorn = () => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      const context = new AudioContextClass();
      const master = context.createGain();
      const filter = context.createBiquadFilter();
      const now = context.currentTime;
      filter.type = 'lowpass';
      filter.frequency.value = 820;
      filter.Q.value = 2.2;
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(0.22, now + 0.035);
      master.gain.setValueAtTime(0.22, now + 0.48);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.78);
      filter.connect(master).connect(context.destination);
      [185, 233].forEach((frequency, index) => {
        const horn = context.createOscillator();
        const hornGain = context.createGain();
        horn.type = 'sawtooth';
        horn.frequency.setValueAtTime(frequency, now);
        horn.frequency.linearRampToValueAtTime(frequency - 4, now + 0.7);
        hornGain.gain.value = index === 0 ? 0.62 : 0.45;
        horn.connect(hornGain).connect(filter);
        horn.start(now);
        horn.stop(now + 0.8);
      });
      window.setTimeout(() => context.close(), 950);
    }
    setHornFlash(true);
    setBusSpeed(40);
    window.setTimeout(() => {
      setHornFlash(false);
      setBusSpeed(65);
    }, 2200);
  };

  const handleSeek = (value) => {
    const next = Number(value);
    setCurrentTime(next);
    playerRef.current?.seekTo?.(next, true);
  };

  const toggleRain = () => {
    const next = !rainEnabledRef.current;
    rainEnabledRef.current = next;
    setRainEnabled(next);
    localStorage.setItem('coach-rain', next ? 'on' : 'off');
    const ambience = ambienceRef.current;
    if (!ambience) return;
    if (next && !ambience.rain) ambience.rain = createRainSound(ambience.context);
    else if (!next && ambience.rain) {
      ambience.rain.stop();
      ambience.rain = null;
    }
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
    else await document.exitFullscreen?.();
  };

  return (
    <main className={`app coach-radio ${isPlaying ? 'is-playing' : ''} ${controlsVisible ? 'controls-visible' : 'controls-hidden'}`}>
      <div className="yt-audio-slot" aria-hidden="true"><div ref={playerHostRef} /></div>
      <div className="coach-shade" aria-hidden="true" />
      <header className={`floating-nav ${controlsVisible ? 'visible' : ''}`}>
        <span className="route-id">OD · NIGHT 01</span>
        <span className="listeners"><i /> {isPlaying ? 'ON THE ROAD' : 'READY TO DEPART'}</span>
        <nav aria-label="Playlist links"><a href={`https://www.youtube.com/playlist?list=${RADIO.playlistId}`} target="_blank" rel="noreferrer">YouTube ↗</a><button type="button" onClick={toggleFullscreen}>{isFullscreen ? 'Exit Fullscreen ×' : 'Fullscreen ⛶'}</button></nav>
      </header>

      <div className={`ride-motion ${rainEnabled ? 'rain-on' : ''}`} aria-hidden="true">
        <span className="windshield-motion">
          <i className="road-dash dash-left" />
          <i className="road-dash dash-right" />
          <i className="roadside-light lights-left" />
          <i className="roadside-light lights-right" />
        </span>
        <span className="passing-beam beam-one" />
        <span className="passing-beam beam-two" />
        <span className="glass-streaks" />
        <span className="rain-sheet rain-sheet-a" />
        <span className="rain-sheet rain-sheet-b" />
        <span className="road-glow" />
        <span className="lightning-flash" />
      </div>
      <p className="route-whisper"><small>ରାତ୍ରି ବସ୍ ସେବା</small>{HIGHWAY_ROUTES[0]}</p>
      <button className={`cabin-horn ${controlsVisible ? 'visible' : ''}`} type="button" onClick={triggerHorn} aria-label="Sound bus horn"><i />HORN</button>

      <section className="floating-player player-v3" aria-label="Music player">
        <div className="song-area">
          <div className="player-kicker"><span>{String(track.index + 1).padStart(2, '0')} · {isPlaying ? 'PLAYING NOW' : 'NIGHT RADIO'}</span><i>{isPlaying ? 'SIGNAL LIVE' : 'STANDBY'}</i></div>
          <div className="song-copy"><strong>{track.title}</strong><span>{track.artist}</span></div>
          <input className="seek" aria-label="Song position" type="range" min="0" max={Math.max(1, duration)} value={Math.min(currentTime, Math.max(1, duration))} onChange={(e) => handleSeek(e.target.value)} />
          <div className="time-row"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
        </div>
        <div className="player-buttons">
          <button type="button" onClick={handlePrev} disabled={!isApiReady} aria-label="Previous track">|‹</button>
          <button className="main-play" type="button" onClick={togglePlay} disabled={!isApiReady} aria-label={isPlaying ? 'Pause' : 'Play'}>{!isApiReady ? '…' : isPlaying ? 'Ⅱ' : '▶'}</button>
          <button type="button" onClick={handleNext} disabled={!isApiReady} aria-label="Next track">›|</button>
        </div>
        <div className="player-tools">
          <label className="compact-volume" title={`Volume ${volume}`}><span>VOL {volume}</span><input aria-label="Volume" type="range" min="0" max="100" value={volume} onChange={(e) => handleVolume(Number(e.target.value))} /></label>
          <label className="sleep-timer">
            <span>{sleepRemaining ? `SLEEP ${Math.ceil(sleepRemaining / 60)}M` : 'SLEEP'}</span>
            <select aria-label="Sleep timer" value={sleepMinutes} onChange={(e) => handleSleepTimer(Number(e.target.value))}>
              <option value="0">Off</option>
              <option value="15">15 min</option>
              <option value="30">30 min</option>
              <option value="45">45 min</option>
              <option value="60">60 min</option>
            </select>
          </label>
          <button className={`rain-toggle ${rainEnabled ? 'on' : ''}`} type="button" onClick={toggleRain}>RAIN {rainEnabled ? 'ON' : 'OFF'}</button>
        </div>
      </section>
    </main>
  );
}
