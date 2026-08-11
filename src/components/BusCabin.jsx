import NightRoad from './NightRoad';
import Dashboard from './Dashboard';

export default function BusCabin({
  track,
  busSpeed,
  isPlaying,
  isApiReady,
  volume,
  hornFlash,
  playerHostRef,
  onTogglePlay,
  onNext,
  onPrev,
  onHorn,
  onVolume,
}) {
  return (
    <main className="bus-cabin-3d">
      <div className={`cabin-perspective ${isPlaying ? 'active' : ''}`}>
        <div className="windshield-frame-3d">
          <NightRoad isMoving={isPlaying} hornFlash={hornFlash} />

          <div className="vintage-rearview-mirror" />
          <div className="dashboard-cowling-3d">
            <div className="steering-column-3d" />
          </div>

          <div className="moonlight-wash" />
          <div className="glass-reflection-3d" />


          <div className="glass-meta-3d">
            <p className="glass-meta-label">Seat 12 · Window · Earphones in</p>
            <h2 className="glass-meta-title">{track.title}</h2>
            <p className="glass-meta-artist">{track.artist}</p>
          </div>
        </div>
      </div>

      <Dashboard
        isPlaying={isPlaying}
        isApiReady={isApiReady}
        volume={volume}
        busSpeed={busSpeed}
        hornFlash={hornFlash}
        track={track}
        playerHostRef={playerHostRef}
        onTogglePlay={onTogglePlay}
        onNext={onNext}
        onPrev={onPrev}
        onHorn={onHorn}
        onVolume={onVolume}
      />
    </main>
  );
}
