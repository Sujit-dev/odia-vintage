import { useCallback, useEffect, useRef, useState } from "react";
import { HIGHWAY_ROUTES, STATIONS } from "./data/radio";

function readTrack(player) {
  try {
    const data = player.getVideoData?.() || {};
    const index = player.getPlaylistIndex?.() ?? 0;
    return {
      id: data.video_id || "",
      title: data.title || "Preparing station…",
      artist: data.author || "",
      route: HIGHWAY_ROUTES[Math.abs(index) % HIGHWAY_ROUTES.length],
      index: Math.max(0, index),
    };
  } catch {
    return {
      id: "",
      title: "Preparing station…",
      artist: "",
      route: HIGHWAY_ROUTES[0],
      index: 0,
    };
  }
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  return `${mins}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

export default function App() {
  const activeStation =
    STATIONS.find(
      (station) =>
        station.path === window.location.pathname.replace(/\/$/, "") ||
        (station.path === "/" && window.location.pathname === "/"),
    ) || STATIONS[0];
  const savedPlayback = (() => {
    try {
      return JSON.parse(
        localStorage.getItem(`odia-vintage-playback-${activeStation.id}`) ||
          "null",
      );
    } catch {
      return null;
    }
  })();
  const savedPlaylist =
    activeStation.playlists.find(
      (playlist) => playlist.id === savedPlayback?.playlistId,
    ) || activeStation.playlists[0];
  const [isPlaying, setIsPlaying] = useState(false);
  const [isApiReady, setIsApiReady] = useState(false);
  const [volume, setVolume] = useState(
    () => Number(localStorage.getItem("coach-volume")) || 80,
  );
  const [, setBusSpeed] = useState(62);
  const [, setHornFlash] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wallClock, setWallClock] = useState(() => new Date());
  const [isMuted, setIsMuted] = useState(false);
  const [playerMessage, setPlayerMessage] = useState("Preparing station…");
  const [activeListeners, setActiveListeners] = useState(null);
  const [peakListenersToday, setPeakListenersToday] = useState(null);
  const [presenceUnavailable, setPresenceUnavailable] = useState(false);
  const [showTrackCard, setShowTrackCard] = useState(false);
  const [showKeyboardHint, setShowKeyboardHint] = useState(
    () => localStorage.getItem("odia-vintage-key-help") !== "seen",
  );
  const [track, setTrack] = useState({
    id: "",
    title: activeStation.label,
    artist: "Preparing station…",
    route: HIGHWAY_ROUTES[0],
    index: 0,
  });

  const playerRef = useRef(null);
  const readyRef = useRef(false);
  const playerHostRef = useRef(null);
  const syncTimerRef = useRef(null);
  const trackCardTimerRef = useRef(null);
  const lastTrackCardIdRef = useRef("");
  const volumeRef = useRef(volume);
  const ambienceRef = useRef(null);
  const randomStartRef = useRef(0);
  const stationRef = useRef({
    ...activeStation,
    playlistId: savedPlaylist.id,
    seedVideoId: savedPlaylist.seedVideoId,
  });
  const resumeRef = useRef({
    index: Math.max(0, Number(savedPlayback?.index) || 0),
    time: Math.max(0, Number(savedPlayback?.time) || 0),
  });
  const errorCountRef = useRef(0);
  const stationGenerationRef = useRef(0);
  const playbackAllowedRef = useRef(false);
  const stationPlaylistReadyRef = useRef(false);
  const isPlayingRef = useRef(false);
  const togglePlayRef = useRef(null);

  const startAmbience = useCallback(() => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (ambienceRef.current || !AudioContextClass) return;
    const context = new AudioContextClass();
    const engine = context.createOscillator();
    const tremor = context.createOscillator();
    const tremorGain = context.createGain();
    const master = context.createGain();
    engine.type = "sine";
    engine.frequency.value = 42;
    tremor.type = "sine";
    tremor.frequency.value = 1.7;
    tremorGain.gain.value = 1.8;
    master.gain.value = 0.012;
    tremor.connect(tremorGain).connect(engine.frequency);
    engine.connect(master).connect(context.destination);
    engine.start();
    tremor.start();
    ambienceRef.current = { context, engine, tremor };
  }, []);

  const stopAmbience = useCallback(() => {
    const ambience = ambienceRef.current;
    if (!ambience) return;
    ambience.engine.stop();
    ambience.tremor.stop();
    ambience.context.close();
    ambienceRef.current = null;
  }, []);

  const syncTrack = useCallback((showTitleCard = false) => {
    if (!playerRef.current || !readyRef.current) return;
    const nextTrack = readTrack(playerRef.current);
    setTrack(nextTrack);
    if (nextTrack.id) setPlayerMessage("");
    if (
      showTitleCard &&
      nextTrack.id &&
      nextTrack.id !== lastTrackCardIdRef.current
    ) {
      lastTrackCardIdRef.current = nextTrack.id;
      setShowTrackCard(true);
      window.clearTimeout(trackCardTimerRef.current);
      trackCardTimerRef.current = window.setTimeout(
        () => setShowTrackCard(false),
        3400,
      );
    }
    setCurrentTime(playerRef.current.getCurrentTime?.() || 0);
    setDuration(playerRef.current.getDuration?.() || 0);
    if (nextTrack.id) {
      localStorage.setItem(
        `odia-vintage-playback-${stationRef.current.id}`,
        JSON.stringify({
          playlistId: stationRef.current.playlistId,
          index: nextTrack.index,
          time: Math.floor(playerRef.current.getCurrentTime?.() || 0),
        }),
      );
    }
  }, []);

  const loadRandomStationPlaylist = useCallback(
    (playNow = true) => {
      const player = playerRef.current;
      const station = stationRef.current;
      if (!player || !station?.playlists?.length) return;
      const stationId = station.id;
      const generation = stationGenerationRef.current;
      const playlist =
        station.playlists[Math.floor(Math.random() * station.playlists.length)];
      if (!station.playlists.some((item) => item.id === playlist.id)) return;
      stationRef.current = {
        ...station,
        playlistId: playlist.id,
        seedVideoId: playlist.seedVideoId,
      };
      stationPlaylistReadyRef.current = true;
      playbackAllowedRef.current = playNow;
      try {
        player[playNow ? "loadPlaylist" : "cuePlaylist"]({
          listType: "playlist",
          list: playlist.id,
          index: 0,
        });
        player.setShuffle?.(true);
        window.setTimeout(() => {
          if (
            stationGenerationRef.current !== generation ||
            stationRef.current.id !== stationId ||
            stationRef.current.playlistId !== playlist.id
          )
            return;
          const songs = player.getPlaylist?.() || [];
          if (songs.length > 1)
            player.playVideoAt?.(Math.floor(Math.random() * songs.length));
          else if (playNow) player.playVideo?.();
          syncTrack();
        }, 700);
      } catch {
        if (playNow) player.loadVideoById?.(playlist.seedVideoId);
        else player.cueVideoById?.(playlist.seedVideoId);
      }
    },
    [syncTrack],
  );

  useEffect(() => {
    let cancelled = false;
    const playerHost = playerHostRef.current;

    const createPlayer = () => {
      if (cancelled || !playerHostRef.current || playerRef.current) return;

      const mount = document.createElement("div");
      mount.style.width = "100%";
      mount.style.height = "100%";
      playerHostRef.current.replaceChildren(mount);

      playerRef.current = new window.YT.Player(mount, {
        width: "100%",
        height: "100%",
        videoId: stationRef.current.seedVideoId,
        playerVars: {
          listType: "playlist",
          list: stationRef.current.playlistId,
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
            setPlayerMessage("Ready to play");
            event.target.unMute();
            event.target.setVolume(volumeRef.current);
            try {
              event.target.cuePlaylist({
                listType: "playlist",
                list: stationRef.current.playlistId,
                index: resumeRef.current.index,
              });
            } catch {
              event.target.cueVideoById(stationRef.current.seedVideoId);
            }
            window.setTimeout(() => {
              try {
                const playlist = event.target.getPlaylist?.() || [];
                if (playlist.length > 1) {
                  randomStartRef.current = Math.min(
                    resumeRef.current.index,
                    playlist.length - 1,
                  );
                  event.target.cuePlaylist({
                    listType: "playlist",
                    list: stationRef.current.playlistId,
                    index: randomStartRef.current,
                  });
                  event.target.setShuffle?.(true);
                }
                if (resumeRef.current.time > 0)
                  event.target.seekTo?.(resumeRef.current.time, true);
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
              if (!playbackAllowedRef.current) {
                event.target.pauseVideo?.();
                return;
              }
              setIsPlaying(true);
              isPlayingRef.current = true;
              setPlayerMessage("");
              errorCountRef.current = 0;
              startAmbience();
              event.target.unMute();
              event.target.setVolume(volumeRef.current);
              syncTrack(true);
            } else if (event.data === state.PAUSED) {
              isPlayingRef.current = false;
              setIsPlaying(false);
              stopAmbience();
            } else if (
              event.data === state.ENDED ||
              event.data === state.CUED
            ) {
              if (event.data === state.ENDED) {
                stopAmbience();
                loadRandomStationPlaylist(true);
              }
              syncTrack();
            }
          },
          onError: (event) => {
            const code = event?.data;
            if (code === 101 || code === 150 || code === 100 || code === 2) {
              setPlayerMessage("Trying another song…");
              errorCountRef.current += 1;
              window.setTimeout(() => {
                try {
                  if (errorCountRef.current >= 3) {
                    errorCountRef.current = 0;
                    loadRandomStationPlaylist(playbackAllowedRef.current);
                  } else playerRef.current?.nextVideo?.();
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
      if (
        !document.querySelector(
          'script[src="https://www.youtube.com/iframe_api"]',
        )
      ) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
      }
      const prev = window.onYouTubeIframeAPIReady;
      // The YouTube iframe API requires this global callback.
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        createPlayer();
      };
    }

    return () => {
      cancelled = true;
      readyRef.current = false;
      if (syncTimerRef.current) window.clearInterval(syncTimerRef.current);
      if (trackCardTimerRef.current)
        window.clearTimeout(trackCardTimerRef.current);
      try {
        playerRef.current?.destroy?.();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
      stopAmbience();
      playerHost?.replaceChildren();
    };
  }, [loadRandomStationPlaylist, startAmbience, stopAmbience, syncTrack]);

  useEffect(() => {
    const clockTimer = window.setInterval(() => setWallClock(new Date()), 1000);
    return () => window.clearInterval(clockTimer);
  }, []);

  useEffect(() => {
    const sessionId = crypto.randomUUID();
    let lastActivity = Date.now();
    let stopped = false;
    const markActive = () => {
      lastActivity = Date.now();
    };
    const sendPresence = async (active = true, beacon = false) => {
      const body = JSON.stringify({
        sessionId,
        stationId: activeStation.id,
        active,
      });
      if (beacon && navigator.sendBeacon)
        return navigator.sendBeacon(
          "/api/presence",
          new Blob([body], { type: "application/json" }),
        );
      try {
        const response = await fetch("/api/presence", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
          keepalive: !active,
        });
        if (!response.ok)
          throw new Error(`Presence request failed: ${response.status}`);
        const data = await response.json();
        if (!stopped && Number.isFinite(data.active)) {
          setActiveListeners(data.active);
          setPeakListenersToday(
            Number.isFinite(data.peakToday) ? data.peakToday : data.active,
          );
          setPresenceUnavailable(false);
        }
      } catch {
        if (!stopped) setPresenceUnavailable(true);
      }
      return undefined;
    };
    const heartbeat = () =>
      sendPresence(
        document.visibilityState === "visible" &&
          (isPlayingRef.current || Date.now() - lastActivity < 65000),
      );
    ["pointerdown", "keydown", "touchstart"].forEach((name) =>
      window.addEventListener(name, markActive, { passive: true }),
    );
    const visibility = () =>
      document.visibilityState === "visible"
        ? (markActive(), sendPresence(true))
        : sendPresence(false, true);
    document.addEventListener("visibilitychange", visibility);
    sendPresence(true);
    const timer = window.setInterval(heartbeat, 25000);
    const leave = () => sendPresence(false, true);
    window.addEventListener("pagehide", leave);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      ["pointerdown", "keydown", "touchstart"].forEach((name) =>
        window.removeEventListener(name, markActive),
      );
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, [activeStation.id]);

  useEffect(() => {
    let timer;
    const reveal = () => {
      setControlsVisible(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setControlsVisible(false), 3200);
    };
    reveal();
    window.addEventListener("pointermove", reveal, { passive: true });
    window.addEventListener("touchstart", reveal, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointermove", reveal);
      window.removeEventListener("touchstart", reveal);
    };
  }, []);

  useEffect(() => {
    const syncFullscreen = () =>
      setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () =>
      document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (["INPUT", "SELECT", "TEXTAREA"].includes(event.target.tagName))
        return;
      if (event.code === "Space") {
        event.preventDefault();
        togglePlayRef.current?.();
      } else if (event.key === "ArrowRight") playerRef.current?.nextVideo?.();
      else if (event.key === "ArrowLeft") playerRef.current?.previousVideo?.();
      else if (event.key.toLowerCase() === "f") {
        if (!document.fullscreenElement)
          document.documentElement.requestFullscreen?.();
        else document.exitFullscreen?.();
      } else if (
        event.key.toLowerCase() === "h" &&
        stationRef.current.id === "odia-bus"
      )
        document.querySelector(".cabin-horn")?.click();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
      playbackAllowedRef.current = false;
      isPlayingRef.current = false;
      player.pauseVideo();
      setIsPlaying(false);
    } else {
      playbackAllowedRef.current = true;
      if (!stationPlaylistReadyRef.current) {
        loadRandomStationPlaylist(true);
        player.unMute();
        player.setVolume(volumeRef.current);
        return;
      }
      try {
        if (
          typeof player.playVideoAt === "function" &&
          player.getPlaylist()?.length
        ) {
          player.playVideo();
        } else {
          player.loadPlaylist({
            listType: "playlist",
            list: stationRef.current.playlistId,
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
      isPlayingRef.current = true;
      setTimeout(syncTrack, 600);
    }
  };
  useEffect(() => {
    togglePlayRef.current = togglePlay;
  });

  const handleNext = () => {
    if (!readyRef.current || !playerRef.current) return;
    loadRandomStationPlaylist(true);
    setIsPlaying(true);
    setTimeout(syncTrack, 600);
  };

  const changeStation = (station) => {
    if (station.id === stationRef.current.id) return;
    playbackAllowedRef.current = false;
    playerRef.current?.pauseVideo?.();
    stopAmbience();
    try {
      playerRef.current?.destroy?.();
    } catch {
      /* navigation will discard the iframe */
    }
    window.location.assign(station.path);
  };

  const handlePrev = () => {
    if (!readyRef.current || !playerRef.current) return;
    playbackAllowedRef.current = true;
    playerRef.current.previousVideo();
    setIsPlaying(true);
    setTimeout(syncTrack, 600);
  };

  const handleVolume = (value) => {
    volumeRef.current = value;
    setVolume(value);
    localStorage.setItem("coach-volume", String(value));
    if (playerRef.current && readyRef.current) {
      playerRef.current.setVolume(value);
      if (value === 0) playerRef.current.mute();
      else playerRef.current.unMute();
    }
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (next) playerRef.current?.mute?.();
    else {
      playerRef.current?.unMute?.();
      playerRef.current?.setVolume?.(volumeRef.current);
    }
  };

  const triggerHorn = () => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      const context = new AudioContextClass();
      const master = context.createGain();
      const filter = context.createBiquadFilter();
      const now = context.currentTime;
      filter.type = "lowpass";
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
        horn.type = "sawtooth";
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

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement)
      await document.documentElement.requestFullscreen?.();
    else await document.exitFullscreen?.();
  };

  return (
    <main
      className={`app coach-radio station-${activeStation.id} ${isPlaying ? "is-playing" : ""} ${controlsVisible ? "controls-visible" : "controls-hidden"}`}
    >
      <div className="yt-audio-slot" aria-hidden="true">
        <div ref={playerHostRef} />
      </div>
      <div className="coach-shade" aria-hidden="true" />
      <div
        className={`active-presence ${presenceUnavailable ? "unavailable" : ""}`}
      >
        <i />
        {presenceUnavailable
          ? "Listener count unavailable"
          : activeListeners === null
          ? "Connecting…"
          : <>
              <span>{activeListeners} active {activeListeners === 1 ? "listener" : "listeners"}</span>
              <b>Today’s peak {peakListenersToday ?? activeListeners}</b>
            </>}
      </div>
      <header className={`floating-nav ${controlsVisible ? "visible" : ""}`}>
        <span className="route-id">ODIA VINTAGE</span>
        <time className="vintage-clock" dateTime={wallClock.toISOString()}>
          {wallClock.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })}
        </time>
        <nav aria-label="Player links">
          <a
            className="instagram-link"
            href="https://www.instagram.com/sujitptra_/"
            target="_blank"
            rel="noreferrer"
            aria-label="Sujit Patra on Instagram"
          >
            <i className="instagram-mark" aria-hidden="true" />
            @sujitptra_ ↗
          </a>
          <button type="button" onClick={toggleFullscreen}>
            {isFullscreen ? "Exit ×" : "Fullscreen ⛶"}
          </button>
        </nav>
      </header>

      <div
        className={`station-switcher ${controlsVisible ? "visible" : ""}`}
        role="group"
        aria-label="Choose an Odia Vintage station"
      >
        {STATIONS.map((station) => (
          <button
            className={station.id === activeStation.id ? "active" : ""}
            type="button"
            key={station.id}
            onClick={() => changeStation(station)}
            aria-pressed={station.id === activeStation.id}
            disabled={station.id === activeStation.id}
          >
            <small>{station.odiaLabel}</small>
            {station.label}
          </button>
        ))}
      </div>

      <aside
        className={`listening-note ${isPlaying ? "live" : ""}`}
        aria-label="Station mood"
      >
        <span className="note-eyebrow">
          <i />
          {isPlaying ? "ଏବେ ବାଜୁଛି · LISTENING" : "ସ୍ମୃତିର ସୁର · MOOD"}
        </span>
        <strong>{activeStation.moodOdia}</strong>
        <p>{isPlaying ? activeStation.mood : "Press play and stay a while"}</p>
        {isPlaying && (
          <div className="note-wave" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
        )}
      </aside>
      <div className="odia-alphabet-rail" aria-hidden="true">
        {["ଅ", "ଇ", "ଏ", "କ", "ଚ", "ଟ", "ତ", "ନ", "ବ", "ର", "ସ"].map(
          (letter) => (
            <span key={letter}>{letter}</span>
          ),
        )}
      </div>
      {showTrackCard && (
        <div className="track-title-card">
          <small>NOW PLAYING · {activeStation.label}</small>
          <strong title={track.title}>{track.title}</strong>
          {track.artist && track.artist !== "YouTube Live Mix" && (
            <span>{track.artist}</span>
          )}
        </div>
      )}
      {activeStation.id === "odia-bus" && (
        <button
          className={`cabin-horn ${controlsVisible ? "visible" : ""}`}
          type="button"
          onClick={triggerHorn}
          aria-label="Sound bus horn"
        >
          <i />
          HORN
        </button>
      )}

      <section className="floating-player player-v3" aria-label="Music player">
        <div className="song-area">
          <div className="player-kicker">
            <span className="station-chip">{activeStation.odiaLabel}</span>
            <span>TRACK {String(track.index + 1).padStart(2, "0")}</span>
            <i>{isPlaying ? "● NOW PLAYING" : "READY"}</i>
          </div>
          <div className="song-copy">
            <strong>{track.title}</strong>
            <span>{playerMessage || track.artist}</span>
          </div>
          <input
            className="seek"
            aria-label="Song position"
            type="range"
            min="0"
            max={Math.max(1, duration)}
            value={Math.min(currentTime, Math.max(1, duration))}
            onChange={(e) => handleSeek(e.target.value)}
          />
          <div className="time-row">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
        <div className="player-buttons">
          <button
            type="button"
            onClick={handlePrev}
            disabled={!isApiReady}
            aria-label="Previous track"
          >
            |‹
          </button>
          <button
            className="main-play"
            type="button"
            onClick={togglePlay}
            disabled={!isApiReady}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {!isApiReady ? "…" : isPlaying ? "Ⅱ" : "▶"}
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={!isApiReady}
            aria-label="Next track"
          >
            ›|
          </button>
        </div>
        <div className="player-volume">
          <label className="compact-volume" title={`Volume ${volume}`}>
            <span>VOL {volume}</span>
            <input
              aria-label="Volume"
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => handleVolume(Number(e.target.value))}
            />
          </label>
          <button className="mute-button" type="button" onClick={toggleMute}>
            {isMuted ? "Unmute" : "Mute"}
          </button>
        </div>
      </section>
      {showKeyboardHint && (
        <button
          className="keyboard-hint"
          type="button"
          onClick={() => {
            localStorage.setItem("odia-vintage-key-help", "seen");
            setShowKeyboardHint(false);
          }}
        >
          Space Play · ← → Songs · F Fullscreen · Got it
        </button>
      )}
    </main>
  );
}
