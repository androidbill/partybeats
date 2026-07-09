// PartyBeats — shared constants
// Data model is unchanged from v1, so existing rooms keep working.

export const APP_VERSION = "2026.07.08.01";
export const ROOM_ID_PATTERN = /^[A-Z]{4}\d{3}$/;
export const LAST_ACTIVE_ROOM_KEY = "partybeats-last-active-room";
export const THEME_KEY = "partybeats-theme";
export const DEVICE_ID_KEY = "partybeats-device-id";

export const DEFAULT_COOLDOWN_MINUTES = 3;
export const NON_ADMIN_MAX_SONG_SECONDS = 10 * 60;
export const PLAYBACK_COMMAND_WINDOW_MS = 8000;
export const PLAYBACK_SYNC_INTERVAL_MS = 10000;

export const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
export const APP_ICON_URL = `${import.meta.env.BASE_URL}partybeats-icon.png`;

export const ROOM_WORDS = [
  "ABLE","ACID","APEX","ARCH","AURA","BASS","BEAM","BEAT","BOLT","BRIO",
  "CLUB","CORD","DASH","DRUM","ECHO","FLUX","FUNK","GLOW","HALO","JAZZ",
  "KICK","LAVA","LOOP","MINT","MOOD","NEON","NOVA","OPUS","PEAK","PING",
  "PLUG","RIFF","RISE","ROOM","RUBY","SNAP","SOLO","SONG","SPIN","STAR",
  "SYNC","TONE","VIBE","WAVE","WIRE"
];

export const EMOJIS = [
  "🔥","❤️","😍","😮","😂","🙌","👏","💃","🕺","🤘",
  "🎸","🥁","🎤","🎶","🚀","⚡","💯","⭐","👑","🍻",
  "🥳","😎","🤯","😭","🤣","🥰","🤩","🫶","💪","🙏",
  "💥","✨","🌟","🎉","🎊","🎧","🪩","🏆","💎","💜",
  "🐐","🦋","🌊","🌈","🌙","🍕","🌮","💀","🤖","😈"
];

// Avatar art lives in /public/avatars — same asset paths as v1.
export const AVATAR_OPTIONS = [
  { id: "premium-neon-dj", name: "Neon DJ", image: `${import.meta.env.BASE_URL}avatars/premium-neon-dj.png`, colors: ["#00e5ff", "#ff2ebd"] },
  { id: "premium-disco-smile", name: "Disco Smile", image: `${import.meta.env.BASE_URL}avatars/premium-disco-smile.png`, colors: ["#ff5edb", "#6ee7ff"] },
  { id: "premium-cassette-kid", name: "Cassette Kid", image: `${import.meta.env.BASE_URL}avatars/premium-cassette-kid.png`, colors: ["#ff4f9f", "#22d3ee"] },
  { id: "premium-lightning", name: "Lightning", image: `${import.meta.env.BASE_URL}avatars/premium-lightning.png`, colors: ["#ffe45c", "#ff2ebd"] },
  { id: "premium-vinyl-vibe", name: "Vinyl Vibe", image: `${import.meta.env.BASE_URL}avatars/premium-vinyl-vibe.png`, colors: ["#111827", "#38f8c6"] },
  { id: "premium-mic-drop", name: "Mic Drop", image: `${import.meta.env.BASE_URL}avatars/premium-mic-drop.png`, colors: ["#fb7185", "#7c3aed"] },
  { id: "premium-shades-on", name: "Shades On", image: `${import.meta.env.BASE_URL}avatars/premium-shades-on.png`, colors: ["#0ea5e9", "#ec4899"] },
  { id: "premium-alien-dj", name: "Alien DJ", image: `${import.meta.env.BASE_URL}avatars/premium-alien-dj.png`, colors: ["#84cc16", "#06b6d4"] },
  { id: "premium-superstar", name: "Superstar", image: `${import.meta.env.BASE_URL}avatars/premium-superstar.png`, colors: ["#facc15", "#f43f5e"] },
  { id: "premium-bass-speaker", name: "Bass Speaker", image: `${import.meta.env.BASE_URL}avatars/premium-bass-speaker.png`, colors: ["#6366f1", "#14b8a6"] },
  { id: "premium-fire-vibe", name: "Fire Vibe", image: `${import.meta.env.BASE_URL}avatars/premium-fire-vibe.png`, colors: ["#ef4444", "#f59e0b"] },
  { id: "premium-robot-beat", name: "Robot Beat", image: `${import.meta.env.BASE_URL}avatars/premium-robot-beat.png`, colors: ["#64748b", "#22d3ee"] },
  { id: "neon-dj", name: "Neon DJ", icon: "🎧", colors: ["#00e5ff", "#ff2ebd"] },
  { id: "disco-smile", name: "Disco Smile", icon: "🙂", colors: ["#ffd84d", "#ff4fd8"] },
  { id: "cassette", name: "Cassette Kid", icon: "📼", colors: ["#8b5cf6", "#22d3ee"] },
  { id: "lightning", name: "Lightning", icon: "⚡", colors: ["#ffe45c", "#2563eb"] },
  { id: "vinyl", name: "Vinyl Vibe", icon: "💿", colors: ["#111827", "#38f8c6"] },
  { id: "mic-drop", name: "Mic Drop", icon: "🎤", colors: ["#fb7185", "#7c3aed"] },
  { id: "shades", name: "Shades On", icon: "😎", colors: ["#f97316", "#ec4899"] },
  { id: "alien-dj", name: "Alien DJ", icon: "👽", colors: ["#84cc16", "#06b6d4"] },
  { id: "superstar", name: "Superstar", icon: "⭐", colors: ["#facc15", "#f43f5e"] },
  { id: "speaker", name: "Bass Speaker", icon: "🔊", colors: ["#6366f1", "#14b8a6"] },
  { id: "fire", name: "Fire Vibe", icon: "🔥", colors: ["#ef4444", "#f59e0b"] },
  { id: "robot", name: "Robot Beat", icon: "🤖", colors: ["#64748b", "#22d3ee"] }
];

// Curated theme set. Each is a full variable override in styles.css.
export const COLOR_THEMES = [
  { id: "marquee", name: "Velvet Marquee", note: "Aubergine, gold + ultraviolet" },
  { id: "neon", name: "Neon Rave", note: "Mint, magenta + ink" },
  { id: "sunset", name: "Sunset Funk", note: "Coral, gold + dusk violet" },
  { id: "midnight", name: "Midnight Club", note: "Deep blue + electric cyan" },
  { id: "ocean", name: "Ocean Drive", note: "Azure + sea-glass teal" },
  { id: "candy", name: "Candy Pop", note: "Bubblegum pink + grape" },
  { id: "goldrush", name: "Gold Rush", note: "Amber, brass + black" },
  { id: "mono", name: "Monochrome", note: "Ink, slate + silver" }
];

export const PROFANITY_PATTERNS = [
  /\bass+hole\b/, /\bbastard\b/, /\bb[i1!|]+tch\b/, /\bbull\s*sh[i1!|]+t\b/,
  /\bc+u+n+t+\b/, /\bd[i1!|]+ck\b/, /\bf+[au]+c*k+(er|ing)?\b/, /\bf+u+k+\b/,
  /\bf+c+k+\b/, /\bmoth(er|a)f+u+c*k+(er)?\b/, /\bp[i1!|]+ss\b/,
  /\bsh[i1!|]+t+\b/, /\bslut\b/, /\bwhore\b/
];

export const ROOM_DEFAULTS = {
  closed: false,
  cooldownEnabled: false,
  cooldownMinutes: DEFAULT_COOLDOWN_MINUTES,
  cooldownMs: DEFAULT_COOLDOWN_MINUTES * 60 * 1000,
  crossfadeEnabled: false,
  crossfadeSeconds: 5,
  trackNoticeEnabled: true,
  trackNoticeSeconds: 3,
  joinNoticeEnabled: true,
  toastEnabled: false,
  internalSearchEnabled: true,
  floatingReactionsEnabled: true,
  roomShoutsEnabled: true,
  visualizerEnabled: false,
  partyMotionEnabled: true,
  tagline: "",
  roomVolume: 80,
  nowPlayingId: null
};
