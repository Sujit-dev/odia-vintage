export default function Header({ currentRoute, isLive, busSpeed }) {
  return (
    <header className="scene-header">
      <div>
        <p className="scene-eyebrow">Odisha night highway · seat 12</p>
        <h1 className="scene-brand">OSRTC NIGHT COACH</h1>
        <p className="scene-route">{currentRoute}</p>
      </div>
      <div className="scene-status">
        <span className={`live-pill ${isLive ? 'on' : ''}`}>
          {isLive ? '● LIVE FM' : '○ IDLE'}
        </span>
        <span className="speed-chip">{busSpeed} km/h</span>
      </div>
    </header>
  );
}
