/** Dynamic YouTube Mix. Videos that block embedding are automatically
 * skipped by the player error handler in App.jsx.
 */
export const RADIO = {
  seedVideoId: "EOuiPRsPg8E",
  playlistId: "PLAl6r73kHLXdNegg2CwaiXZrdULuXbQtd",
};

export const STATIONS = [
  {
    id: "vintage-odisha",
    path: "/",
    label: "Vintage Odisha",
    odiaLabel: "ପୁରୁଣା ଓଡ଼ିଶା",
    playlists: [
      {
        id: RADIO.playlistId,
        name: "Child hood Memories",
        seedVideoId: RADIO.seedVideoId,
      },
      {
        id: "PLZYZGbz-N9THXQUJYueOYH_hLo-_Ywg-_",
        name: "Child hood Memories",
        seedVideoId: "OhuzlWKJSX8",
      },
    ],
    whisper: "Songs from the fields of childhood",
    moodOdia: "ପିଲାଦିନର ଖେଳ ସ୍ମୃତି",
    mood: "Evenings we never wanted to end",
  },
  {
    id: "jagannath-bhajana",
    path: "/jagannath-bhajana",
    label: "Jagannath Bhajana",
    odiaLabel: "ଜଗନ୍ନାଥ ଭଜନ",
    playlists: [
      {
        id: "PLwogTpMw429EpF2h15nNVHS_lI3HXajo1",
        name: "Old Bhajans",
        seedVideoId: "oR2zlwCPL2k",
      },
      {
        id: "PLP3mTiRDfnMpWe6mlcgYiAz93pSUjwGzo",
        name: "Old Bhajans",
        seedVideoId: "b67-u90BGE",
      },
    ],
    whisper: "Old bhajans from the temple town",
    moodOdia: "ଭକ୍ତିରେ ଭରା ସନ୍ଧ୍ୟା",
    mood: "An evening held in devotion",
  },
  {
    id: "odia-bus",
    path: "/odia-bus",
    label: "Odia Bus",
    odiaLabel: "ଓଡ଼ିଆ ବସ୍",
    playlists: [
      {
        id: "PLfqExNsk9cwmibQ0YPlvx-Q71MTDeJ-H1",
        name: "Old Odia Songs",
        seedVideoId: "tmV3LN3OLSg",
      },
    ],
    whisper: "Old Odia songs for the long road home",
    moodOdia: "ବାଟ ସରେନି, ଗୀତ ଥମେନି",
    mood: "Songs for the road back home",
  },
];

/** Decorative Odisha night routes — rotated as the live mix advances */
export const HIGHWAY_ROUTES = [
  "Cuttack ➔ Berhampur via NH-16",
  "Bhubaneswar ➔ Sambalpur Express",
  "Puri ➔ Cuttack Coastal Night",
  "Rourkela ➔ Jharsuguda Local",
  "Balasore ➔ Baripada Midnight",
  "Angul ➔ Dhenkanal Bypass",
];
