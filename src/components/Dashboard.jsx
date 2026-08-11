export default function Dashboard({
  isPlaying,
  isApiReady,
  volume,
  busSpeed,
  hornFlash,
  track,
  playerHostRef,
  onTogglePlay,
  onNext,
  onPrev,
  onHorn,
  onVolume,
}) {
  const needle = Math.min(90, Math.max(8, ((busSpeed - 40) / 50) * 80 + 8));

  return (
    <section className="dash-bar">
      {/* Hidden audio host */}
      <div className="yt-audio-slot" aria-hidden="true">
        <div ref={playerHostRef} className="yt-audio-mount" />
      </div>

      <div className="dash-inner">
        <div className="dash-gauge">
          <div className="speedo">
            <div
              className="speedo-needle"
              style={{ transform: `translateX(-50%) rotate(${needle - 90}deg)` }}
            />
            <span className="speedo-value">{busSpeed}</span>
          </div>
          <span className="dash-caption">km/h</span>
        </div>

        <div className="dash-radio">
          <div className="reel-row">
            <div className={`reel ${isPlaying ? 'reel-spin' : ''}`} />
            <div className={`reel ${isPlaying ? 'reel-spin reverse' : ''}`} />
          </div>
          <div className="dash-now">
            <p className="dash-now-label">
              {isPlaying ? '● Highway FM' : '○ Engine idle'}
              {!isApiReady ? ' · linking…' : ''}
            </p>
            <p className="dash-now-title">{track?.title}</p>
            <p className="dash-now-artist">{track?.artist}</p>
          </div>
          <div className={`vu-row ${isPlaying ? 'live' : ''}`}>
            {Array.from({ length: 12 }).map((_, i) => (
              <span key={i} style={{ animationDelay: `${i * 0.06}s` }} />
            ))}
          </div>
        </div>

        <div className="dash-controls">
          <button
            type="button"
            className={`horn-btn ${hornFlash ? 'hot' : ''}`}
            onClick={onHorn}
          >
            Horn
          </button>

          <label className="vol-wrap">
            <span>Vol</span>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => onVolume(Number(e.target.value))}
            />
          </label>

          <div className="transport">
            <button type="button" disabled={!isApiReady} onClick={onPrev}>
              Prev
            </button>
            <button
              type="button"
              className="primary"
              disabled={!isApiReady}
              onClick={onTogglePlay}
            >
              {isPlaying ? 'Pause' : 'Start'}
            </button>
            <button type="button" disabled={!isApiReady} onClick={onNext}>
              Next
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
