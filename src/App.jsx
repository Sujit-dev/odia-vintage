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

export default function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isApiReady, setIsApiReady] = useState(false);
  const [volume, setVolume] = useState(80);
  const [busSpeed, setBusSpeed] = useState(62);
  const [hornFlash, setHornFlash] = useState(false);
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
  const volumeRef = useRef(80);

  const syncTrack = useCallback(() => {
    if (!playerRef.current || !readyRef.current) return;
    setTrack(readTrack(playerRef.current));
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
            setTimeout(syncTrack, 500);
            syncTimerRef.current = window.setInterval(syncTrack, 2000);
          },
          onStateChange: (event) => {
            const state = window.YT.PlayerState;
            if (event.data === state.PLAYING) {
              setIsPlaying(true);
              event.target.unMute();
              event.target.setVolume(volumeRef.current);
              syncTrack();
            } else if (event.data === state.PAUSED) {
              setIsPlaying(false);
            } else if (event.data === state.ENDED || event.data === state.CUED) {
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
      playerHost?.replaceChildren();
    };
  }, [syncTrack]);

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
            index: 0,
          });
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
    if (playerRef.current && readyRef.current) {
      playerRef.current.setVolume(value);
      if (value === 0) playerRef.current.mute();
      else playerRef.current.unMute();
    }
  };

  const triggerHorn = () => {
    setHornFlash(true);
    setBusSpeed(40);
    window.setTimeout(() => {
      setHornFlash(false);
      setBusSpeed(65);
    }, 2200);
  };

  return (
    <main className={`app ${isPlaying ? 'is-playing' : ''}`}>
      <div className="yt-audio-slot" aria-hidden="true"><div ref={playerHostRef} /></div>

      <header className="topbar">
        <a className="brand" href="#top" aria-label="Odia Night Coach home">
          <span className="brand-mark">ON</span>
          <span><strong>ODIA NIGHT COACH</strong><small>HIGHWAY PLAYLIST</small></span>
        </a>
        <div className="top-route"><span className="signal" /> LIVE FROM NH-16</div>
        <button className="menu-button" type="button" aria-label="Playlist menu">•••</button>
      </header>

      <section className="hero" id="top">
        <div className="route-board" aria-label="Current route">
          <span>OD 02</span><b>{track.route}</b><span>NIGHT</span>
        </div>

        <div className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">PLAYLIST 001 · OVERNIGHT SERVICE</p>
            <h1>For the roads<br />that <em>never sleep.</em></h1>
            <p className="lede">Odia classics, late-night melodies and highway favourites—made for the long ride home.</p>
            <div className="trip-meta">
              <div><span>DEPARTURE</span><strong>10:30 PM</strong></div>
              <div><span>ARRIVAL</span><strong>05:45 AM</strong></div>
              <div><span>SEAT</span><strong>12 · WINDOW</strong></div>
            </div>
          </div>

          <div className="player-wrap">
            <div className="moon" />
            <div className="player-card">
              <div className="card-top"><span>NOW PLAYING</span><span>{String(track.index + 1).padStart(2, '0')} / ∞</span></div>
              <div className="window-art" aria-hidden="true">
                <span className="night-moon" />
                <span className="hill hill-one" /><span className="hill hill-two" />
                <span className="road-line" />
                <span className="bus-light light-one" /><span className="bus-light light-two" />
              </div>
              <div className="track-info">
                <div className={`album-stamp ${isPlaying ? 'spin' : ''}`}><span>ଓଡ଼ିଆ</span></div>
                <div><h2>{track.title}</h2><p>{track.artist}</p></div>
              </div>
              <div className="progress"><span style={{ width: isPlaying ? '62%' : '18%' }} /></div>
              <div className="transport">
                <button type="button" onClick={handlePrev} disabled={!isApiReady} aria-label="Previous track">↶</button>
                <button className="play" type="button" onClick={togglePlay} disabled={!isApiReady} aria-label={isPlaying ? 'Pause' : 'Play'}>
                  {!isApiReady ? '…' : isPlaying ? 'Ⅱ' : '▶'}
                </button>
                <button type="button" onClick={handleNext} disabled={!isApiReady} aria-label="Next track">↷</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="console" aria-label="Coach controls">
        <div className="journey">
          <span className="city active">BHUBANESWAR<small>22:30</small></span>
          <span className="route-line"><i style={{ left: `${Math.min(92, Math.max(8, busSpeed))}%` }} /></span>
          <span className="city">BERHAMPUR<small>05:45</small></span>
        </div>
        <div className="console-actions">
          <button className={`horn ${hornFlash ? 'active' : ''}`} type="button" onClick={triggerHorn}>HORN <span>✦</span></button>
          <label className="volume"><span>VOLUME</span><input aria-label="Volume" type="range" min="0" max="100" value={volume} onChange={(e) => handleVolume(Number(e.target.value))} /><b>{volume}</b></label>
          <div className="speed"><span>SPEED</span><strong>{busSpeed}</strong><small>KM/H</small></div>
        </div>
      </section>

      <footer><span>CURATED FOR ODISHA AFTER DARK</span><span>KEEP YOUR EARPHONES IN · ENJOY THE RIDE</span></footer>
    </main>
  );
}
