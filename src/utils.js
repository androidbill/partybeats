import {
  AVATAR_OPTIONS, DEVICE_ID_KEY, PROFANITY_PATTERNS, ROOM_WORDS,
  THEME_KEY, COLOR_THEMES, YOUTUBE_API_KEY
} from "./constants";

/* ---------- rooms ---------- */

export function randomRoomId() {
  const word = ROOM_WORDS[Math.floor(Math.random() * ROOM_WORDS.length)];
  return `${word}${Math.floor(100 + Math.random() * 900)}`;
}

export function normalizeRoomId(value) {
  return String(value || "").trim().replace(/\s+/g, "").toUpperCase();
}

/* ---------- people ---------- */

export function nicknameFor(user, fallback = "Guest") {
  return user?.displayName || user?.email?.split("@")[0] || fallback;
}

export function hasProfanity(value) {
  const text = String(value || "").toLowerCase();
  return PROFANITY_PATTERNS.some((pattern) => pattern.test(text));
}

export function avatarForId(avatarId) {
  return AVATAR_OPTIONS.find((a) => a.id === avatarId) || AVATAR_OPTIONS[0];
}

export function fallbackAvatarId(seed = "") {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_OPTIONS[hash % AVATAR_OPTIONS.length].id;
}

export function avatarIdForMember(member, fallbackSeed = "") {
  const id = member?.avatarId;
  return AVATAR_OPTIONS.some((a) => a.id === id) ? id : fallbackAvatarId(member?.uid || member?.id || fallbackSeed);
}

/* ---------- youtube ---------- */

export function youtubeWatchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function youtubeThumb(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

export function extractYouTubeVideoId(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^[\w-]{11}$/.test(text)) return text;
  try {
    const url = new URL(text.startsWith("http") ? text : `https://${text}`);
    const host = url.hostname.replace(/^www\./, "").replace(/^music\./, "").replace(/^m\./, "");
    if (host === "youtu.be") return cleanVideoId(url.pathname.slice(1));
    if (host.endsWith("youtube.com")) {
      if (url.searchParams.get("v")) return cleanVideoId(url.searchParams.get("v"));
      const match = url.pathname.match(/\/(embed|shorts|live)\/([\w-]{11})/);
      if (match) return cleanVideoId(match[2]);
    }
  } catch { /* not a URL */ }
  return "";
}

function cleanVideoId(videoId) {
  const match = String(videoId || "").match(/[\w-]{11}/);
  return match ? match[0] : "";
}

export function decodeHtmlEntities(value) {
  if (!value) return "";
  const el = document.createElement("textarea");
  el.innerHTML = value;
  return el.value;
}

export function parseIsoDurationSeconds(value) {
  const match = String(value || "").match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (Number(match[1]) || 0) * 3600 + (Number(match[2]) || 0) * 60 + (Number(match[3]) || 0);
}

export async function searchYouTube(queryText) {
  if (!YOUTUBE_API_KEY) throw new Error("no-key");
  const params = new URLSearchParams({
    part: "snippet", type: "video", videoEmbeddable: "true",
    maxResults: "12", q: queryText, key: YOUTUBE_API_KEY
  });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
  if (!response.ok) throw new Error("search-failed");
  const data = await response.json();
  const items = (data.items || []).filter((item) => item.id?.videoId);
  const ids = items.map((item) => item.id.videoId).join(",");
  let detailById = {};
  if (ids) {
    const detailParams = new URLSearchParams({ part: "contentDetails,status", id: ids, key: YOUTUBE_API_KEY });
    const detailResponse = await fetch(`https://www.googleapis.com/youtube/v3/videos?${detailParams}`);
    if (detailResponse.ok) {
      const detailData = await detailResponse.json();
      detailById = Object.fromEntries((detailData.items || []).map((item) => [item.id, item]));
    }
  }
  return items.map((item) => {
    const detail = detailById[item.id.videoId];
    return {
      videoId: item.id.videoId,
      title: decodeHtmlEntities(item.snippet?.title || "YouTube track"),
      channelTitle: decodeHtmlEntities(item.snippet?.channelTitle || "YouTube"),
      thumbnail: item.snippet?.thumbnails?.medium?.url || youtubeThumb(item.id.videoId),
      durationSeconds: detail ? parseIsoDurationSeconds(detail.contentDetails?.duration) : null,
      embeddable: detail ? detail.status?.embeddable !== false : true
    };
  });
}

export async function fetchVideoDetails(videoId) {
  if (!YOUTUBE_API_KEY || !videoId) return null;
  try {
    const params = new URLSearchParams({ part: "snippet,contentDetails,status", id: videoId, key: YOUTUBE_API_KEY });
    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`);
    const data = await response.json();
    const item = data.items?.[0];
    if (!item) return null;
    return {
      videoId,
      title: decodeHtmlEntities(item.snippet?.title || "YouTube track"),
      channelTitle: decodeHtmlEntities(item.snippet?.channelTitle || "YouTube"),
      thumbnail: item.snippet?.thumbnails?.medium?.url || youtubeThumb(videoId),
      durationSeconds: parseIsoDurationSeconds(item.contentDetails?.duration),
      embeddable: item.status?.embeddable !== false
    };
  } catch {
    return null;
  }
}

/* ---------- formatting ---------- */

export function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function formatCountdown(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

export function trackDisplay(song) {
  const rawTitle = decodeHtmlEntities(song?.title || "Untitled");
  const rawArtist = decodeHtmlEntities(song?.artist || "");
  // "Artist - Title" upload pattern → split for a cleaner card.
  const split = rawTitle.match(/^(.{2,60}?)\s+[-–—]\s+(.{2,})$/);
  if (split && /- Topic$|VEVO$/i.test(rawArtist) === false && rawArtist && rawTitle.toLowerCase().includes(rawArtist.toLowerCase()) === false) {
    return { title: split[2].trim(), artist: split[1].trim() };
  }
  return { title: rawTitle, artist: rawArtist.replace(/\s*-\s*Topic$/i, "") || "YouTube" };
}

/* ---------- queue ---------- */

export function nextQueuedSong(songs, currentId) {
  const list = [...songs].sort((a, b) => (a.position || 0) - (b.position || 0));
  const index = list.findIndex((song) => song.id === currentId);
  for (let i = index + 1; i < list.length; i += 1) {
    if (!list[i].unavailable) return list[i];
  }
  return null;
}

export function nextQueuePosition(songs, offset = 0) {
  const max = songs.reduce((acc, song) => Math.max(acc, Number(song.position) || 0), 0);
  return max + 1 + offset;
}

/* ---------- local settings ---------- */

export function savedTheme() {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return COLOR_THEMES.some((t) => t.id === value) ? value : COLOR_THEMES[0].id;
  } catch { return COLOR_THEMES[0].id; }
}

export function saveTheme(id) {
  try { localStorage.setItem(THEME_KEY, id); } catch { /* private mode */ }
}

export function savedDeviceId() {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const created = `device-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    localStorage.setItem(DEVICE_ID_KEY, created);
    return created;
  } catch {
    return `device-${Math.random().toString(36).slice(2, 12)}`;
  }
}

export function timestampMs(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  const parsed = Number(new Date(value));
  return Number.isFinite(parsed) ? parsed : 0;
}
