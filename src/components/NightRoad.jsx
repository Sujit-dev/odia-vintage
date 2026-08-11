export default function NightRoad({ isMoving, hornFlash }) {
  return (
    <div
      className={`night-road ${isMoving ? 'is-moving' : ''} ${hornFlash ? 'horn-flash' : ''}`}
      aria-hidden="true"
    >
      <div className="sky" />
      <div className="stars" />
      <div className="moon-glow" />
      <div className="moon" />
      <div className="cloud cloud-a" />
      <div className="cloud cloud-b" />
      <div className="field field-far" />
      <div className="field field-mid" />
      <div className="field field-near" />
      <div className="trees" />
      <div className="road">
        <div className="lane" />
        <div className="shoulder" />
      </div>
      <div className="headlights" />
      <div className="passing-lights" />
      <div className="window-vignette" />
    </div>
  );
}
