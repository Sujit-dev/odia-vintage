# Odia Vintage

An interactive Odia music player inspired by Odisha's memories, temple evenings, riverside landscapes, and old bus journeys. Music is streamed through the YouTube IFrame Player API and kept separate across three themed stations.

## Stations

- **Vintage Odisha** — nostalgic and romantic Odia songs
- **Jagannath Bhajana** — dedicated Jagannath devotional music
- **Odia Bus** — old Odia songs for the road

Every station can combine multiple YouTube playlists into one shuffled listening experience. Playlists never cross between stations, and changing stations does not automatically start playback.

## Features

- Responsive full-screen interface for desktop and mobile
- Multiple shuffled playlists per station
- Song title and artist display when YouTube metadata is available
- Play, pause, next, previous, seek, volume, and mute controls
- Spacebar and arrow-key shortcuts
- Per-station playback-position memory
- Automatic skipping of private, removed, or embedding-blocked videos
- Active-listener count with inactive-session cleanup
- Installable Progressive Web App
- Station-specific Odisha artwork and visual themes

## Local development

Requirements: Node.js 20 or newer and npm.

```bash
npm install
npm run dev
```

Open the local address printed by Vite.

Useful commands:

```bash
npm run lint
npm run build
npm run preview
```

## Managing playlists

Station configuration lives in `src/data/radio.js`. Add another object to a station's `playlists` array:

```js
{
  id: "YOUTUBE_PLAYLIST_ID",
  name: "Playlist label",
  seedVideoId: "EMBEDDABLE_VIDEO_ID",
}
```

Use only playlists appropriate for that station. In particular, Jagannath Bhajana should contain devotional songs only. The `seedVideoId` provides a reliable starting track while the playlist loads.

The built-in `tracks` queues enforce the station eras: Vintage Odisha and Odia Bus use old 1990s-style Odia songs, while Jagannath Bhajana uses devotional classics from the 1990s and 2000s. Once a listener starts playback, the YouTube player advances through the queue automatically, loops it, and skips failed or blocked videos.

To exclude a song from every station, add its YouTube video ID to `BLOCKED_VIDEO_IDS` in `src/data/radio.js`. Blocked songs are skipped automatically without being shown as the current track.

## Listener presence

The production build includes a small `/api/presence` endpoint backed by Cloudflare D1. Active sessions send a heartbeat while the page remains visible or music is playing. Inactive sessions stop counting after roughly 70 seconds, and stale database rows are removed after one day. The interface also shows the highest concurrent listener count reached during the current day, resetting at midnight in the `Asia/Kolkata` timezone.

The schema is stored in:

- `db/schema.ts`
- `.openai/drizzle/0000_active_presence.sql`

No API keys or secrets are required by the current application. `.openai/hosting.json` contains only the logical hosting project and database binding configuration.

## Production build

```bash
npm run build
```

The compiled site is written to `dist/`. The build also prepares the server-side presence endpoint and database migration required by Sites hosting.

## Notes

- Playback requires internet access and depends on YouTube availability.
- A video may be skipped when its owner disables embedding, removes it, or makes it private.
- Browser autoplay rules require the listener to press Play before audio begins.
- Music and artwork remain subject to their respective owners' rights and platform terms.
