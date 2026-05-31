import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Crown,
  DoorOpen,
  ExternalLink,
  Info,
  LogIn,
  LogOut,
  MessageCircle,
  Moon,
  MoreVertical,
  Music2,
  Pencil,
  Play,
  Plus,
  QrCode,
  Search,
  Share2,
  SlidersHorizontal,
  Sun,
  SkipForward,
  Trash2,
  UserRound,
  Volume2,
  UsersRound,
  Wand2,
  Palette,
  X
} from "lucide-react";
import QRCode from "qrcode";
import {
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch
} from "firebase/firestore";
import { auth, db, firebaseReady } from "./services/firebase";
import "./styles.css";

const ROOM_WORDS = [
  "able",
  "acid",
  "apex",
  "arch",
  "aura",
  "bass",
  "beam",
  "beat",
  "bloom",
  "bolt",
  "brio",
  "club",
  "cord",
  "dash",
  "drum",
  "echo",
  "flux",
  "funk",
  "glow",
  "groove",
  "halo",
  "hype",
  "jazz",
  "kick",
  "lava",
  "loop",
  "lyric",
  "mint",
  "mood",
  "neon",
  "nova",
  "opus",
  "peak",
  "ping",
  "plug",
  "pulse",
  "riff",
  "rise",
  "room",
  "ruby",
  "snap",
  "solo",
  "song",
  "spin",
  "star",
  "sync",
  "tone",
  "vibe",
  "wave",
  "wire"
].filter((word) => word.length === 4);

const EMOJIS = ["🔥", "💃", "🕺", "❤️", "😮", "🚀"];
const DEFAULT_COOLDOWN_MS = 3 * 60 * 1000;
const DEFAULT_CROSSFADE_SECONDS = 5;
const DEFAULT_TRACK_NOTICE_SECONDS = 3;
const DEFAULT_JOIN_NOTICE_SECONDS = 3;
const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const APP_VERSION = "2026.05.31.02";
const APP_ICON_URL = `${import.meta.env.BASE_URL}partybeats-icon.png`;

const COLOR_THEMES = [
  { id: "sunset", name: "Sunset", note: "Warm pink, gold, and teal" },
  { id: "ocean", name: "Ocean", note: "Deep blue with aqua highlights" },
  { id: "neon", name: "Neon", note: "Purple club lights" },
  { id: "forest", name: "Forest", note: "Green and gold" },
  { id: "candy", name: "Candy", note: "Bright pink and violet" },
  { id: "fire", name: "Fire", note: "Red, orange, and yellow" },
  { id: "ice", name: "Ice", note: "Cool blue and silver" },
  { id: "royal", name: "Royal", note: "Indigo and gold" },
  { id: "mono", name: "Mono", note: "Clean black and white" },
  { id: "lime", name: "Lime", note: "Electric green and charcoal" }
];

const PROFANITY_PATTERNS = [
  /\bass+hole\b/,
  /\bbastard\b/,
  /\bb[i1!|]+tch\b/,
  /\bbull\s*sh[i1!|]+t\b/,
  /\bc+u+n+t+\b/,
  /\bd[i1!|]+ck\b/,
  /\bf+a+c*k+\b/,
  /\bf+u+c*k+\b/,
  /\bf+u+k+\b/,
  /\bf+c+k+\b/,
  /\bf+u+c*k+(er|ing)?\b/,
  /\bmoth(er|a)f+u+c*k+(er)?\b/,
  /\bp[i1!|]+ss\b/,
  /\bsh[i1!|]+t+\b/,
  /\bslut\b/,
  /\bwhore\b/
];

function randomRoomId() {
  const word = ROOM_WORDS[Math.floor(Math.random() * ROOM_WORDS.length)];
  const number = Math.floor(100 + Math.random() * 900);
  return `${word}${number}`.toUpperCase();
}

function normalizeRoomId(value) {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

function normalizeMusicText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\b(official|music|video|audio|lyrics?|lyric|hd|hq|remaster(ed)?|live|visualizer|feat|ft)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function compactMusicText(value) {
  return normalizeMusicText(value).replace(/\s+/g, "");
}

function isSameMusicText(a, b) {
  const left = compactMusicText(a);
  const right = compactMusicText(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

function musicTokens(value) {
  return normalizeMusicText(value)
    .split(" ")
    .filter((token) => token.length > 2 && !["the", "and", "with", "from", "song", "songs", "like", "radio", "mix"].includes(token));
}

function musicTokenOverlap(a, b) {
  const left = new Set(musicTokens(a));
  const right = new Set(musicTokens(b));
  if (!left.size || !right.size) return 0;
  let shared = 0;
  left.forEach((token) => {
    if (right.has(token)) shared += 1;
  });
  return shared / Math.min(left.size, right.size);
}

function isSameSongCandidate(candidate, reference) {
  if (!candidate || !reference) return false;
  const candidateText = [candidate.channelTitle, candidate.title].filter(Boolean).join(" ");
  const referenceArtist = reference.artist || "";
  const referenceTitle = reference.title || "";
  const candidateTitle = candidate.title || "";

  return (
    isSameMusicText(candidate.channelTitle, referenceArtist)
    || isSameMusicText(candidateTitle, referenceTitle)
    || hasSharedSongPhrase(candidateTitle, referenceTitle)
    || hasSharedSongPhrase(candidateText, [referenceArtist, referenceTitle].filter(Boolean).join(" "))
    || musicTokenOverlap(candidateTitle, referenceTitle) >= 0.72
    || musicTokenOverlap(candidateText, [referenceArtist, referenceTitle].filter(Boolean).join(" ")) >= 0.82
  );
}

function songPhraseSet(value) {
  const tokens = musicTokens(value);
  const phrases = new Set();
  for (let size = 2; size <= Math.min(5, tokens.length); size += 1) {
    for (let index = 0; index <= tokens.length - size; index += 1) {
      phrases.add(tokens.slice(index, index + size).join(" "));
    }
  }
  return phrases;
}

function hasSharedSongPhrase(a, b) {
  const left = songPhraseSet(a);
  const right = songPhraseSet(b);
  if (!left.size || !right.size) return false;
  for (const phrase of left) {
    if (right.has(phrase)) return true;
  }
  return false;
}

function candidateHasLowDiversityTitle(candidate) {
  return /\b(cover|karaoke|instrumental|tribute|reaction|tutorial|lesson|loop|sped up|slowed|nightcore|playlist|full album|nonstop|1 hour|one hour)\b/i.test(candidate.title || "");
}

function analyticsPersonKey(uid, name) {
  return uid || `name:${name || "Guest"}`;
}

function emptyAnalyticsPerson(uid, name, isCurrentMember = false) {
  return {
    uid,
    name: name || "Guest",
    isCurrentMember,
    songsAdded: 0,
    reactionsGiven: 0,
    reactionsReceived: 0,
    commentsMade: 0,
    commentsReceived: 0
  };
}

function nicknameFor(user, fallback = "Guest") {
  return user?.displayName || user?.email?.split("@")[0] || fallback;
}

function nicknameStorageKey(user) {
  return user?.uid ? `partybeats-nickname:${user.uid}` : "";
}

function savedNicknameFor(user) {
  const key = nicknameStorageKey(user);
  if (!key) return "";
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function hasProfanity(value) {
  const normalized = value
    .toLowerCase()
    .replace(/[@]/g, "a")
    .replace(/[$]/g, "s")
    .replace(/[0]/g, "o")
    .replace(/[3]/g, "e")
    .replace(/[4]/g, "a")
    .replace(/[5]/g, "s")
    .replace(/[7]/g, "t");
  const compact = normalized.replace(/[^a-z0-9]+/g, "");
  return PROFANITY_PATTERNS.some((pattern) => pattern.test(normalized) || pattern.test(compact));
}

function authErrorMessage(error) {
  if (error?.code === "auth/unauthorized-domain") {
    return "Add this localhost URL to Firebase Authentication authorized domains.";
  }
  if (error?.code === "auth/operation-not-allowed") {
    return "Enable this sign-in provider in Firebase Authentication.";
  }
  if (error?.code === "auth/popup-closed-by-user") {
    return "Google sign-in was closed before it finished.";
  }
  return error?.message || "Sign-in failed. Check Firebase Authentication setup.";
}

function youtubeWatchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function youtubeThumb(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function youtubeSearchUrl(queryText) {
  return `https://music.youtube.com/search?q=${encodeURIComponent(queryText)}`;
}

function youtubeOembedUrl(videoId) {
  return `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(youtubeWatchUrl(videoId))}`;
}

function extractYouTubeVideoId(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) return "";
  try {
    const url = new URL(rawValue);
    if (url.hostname.includes("youtu.be")) {
      return url.pathname.replace("/", "").slice(0, 11);
    }
    if (url.hostname.includes("youtube.com") || url.hostname.includes("music.youtube.com")) {
      if (url.pathname === "/watch") return (url.searchParams.get("v") || "").slice(0, 11);
      if (url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/embed/")) {
        return (url.pathname.split("/")[2] || "").slice(0, 11);
      }
    }
  } catch {
    const match = rawValue.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([a-zA-Z0-9_-]{11})/);
    return match?.[1] || "";
  }
  return "";
}

function nextQueuedSong(songs, currentId) {
  if (!songs.length) return null;
  if (!currentId) return songs[0];
  const currentIndex = songs.findIndex((song) => song.id === currentId);
  if (currentIndex < 0) return null;
  return songs[currentIndex + 1] || null;
}

function adminMapFor(room) {
  return {
    ...(room?.adminUid ? { [room.adminUid]: true } : {}),
    ...(room?.adminUids || {})
  };
}

function savedTheme() {
  try {
    return localStorage.getItem("partybeats-theme") || "light";
  } catch {
    return "light";
  }
}

function savedColorTheme() {
  try {
    const saved = localStorage.getItem("partybeats-color-theme") || "sunset";
    return COLOR_THEMES.some((item) => item.id === saved) ? saved : "sunset";
  } catch {
    return "sunset";
  }
}

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [nickname, setNickname] = useState("");
  const [roomId, setRoomId] = useState("");
  const [activeRoomId, setActiveRoomId] = useState("");
  const [room, setRoom] = useState(null);
  const [songs, setSongs] = useState([]);
  const [members, setMembers] = useState([]);
  const [toast, setToast] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [youtubeLink, setYoutubeLink] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [colorThemeOpen, setColorThemeOpen] = useState(false);
  const [nicknameOpen, setNicknameOpen] = useState(false);
  const [emojiSongId, setEmojiSongId] = useState("");
  const [messageSongId, setMessageSongId] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [restoreRoomId, setRestoreRoomId] = useState("");
  const [renameMemberId, setRenameMemberId] = useState("");
  const [renameDraft, setRenameDraft] = useState("");
  const [nowPlayingNotice, setNowPlayingNotice] = useState(null);
  const [joinNotice, setJoinNotice] = useState(null);
  const [playbackProgress, setPlaybackProgress] = useState({ songId: null, currentSeconds: 0, durationSeconds: 0, remainingSeconds: 0 });
  const [effectivePlaybackSettings, setEffectivePlaybackSettings] = useState({
    songId: null,
    crossfadeEnabled: true,
    crossfadeSeconds: DEFAULT_CROSSFADE_SECONDS
  });
  const [theme, setTheme] = useState(savedTheme);
  const [colorTheme, setColorTheme] = useState(savedColorTheme);
  const previousNowPlayingId = useRef(undefined);
  const previousMemberIds = useRef(undefined);
  const previousSongCount = useRef(undefined);
  const suppressNextTrackClick = useRef("");
  const isDarkTheme = theme === "dark";

  useEffect(() => {
    if (!firebaseReady) {
      setAuthLoading(false);
      return undefined;
    }
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthLoading(false);
      setNickname(savedNicknameFor(nextUser) || nicknameFor(nextUser, ""));
    }, (error) => {
      setToast(authErrorMessage(error));
      setAuthLoading(false);
    });

    getRedirectResult(auth)
      .then((result) => {
        if (!active) return;
        if (result?.user) {
          setUser(result.user);
          setAuthLoading(false);
          setNickname(savedNicknameFor(result.user) || nicknameFor(result.user, ""));
        }
      })
      .catch((error) => {
        if (!active) return;
        setToast(authErrorMessage(error));
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("partybeats-theme", theme);
    } catch {
      // Theme persistence is a convenience; the toggle still works without storage.
    }
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem("partybeats-color-theme", colorTheme);
    } catch {
      // Color theme persistence is a convenience; the picker still works without storage.
    }
    document.documentElement.dataset.colorTheme = colorTheme;
  }, [colorTheme]);

  useEffect(() => {
    const cleanName = nickname.trim();
    const key = nicknameStorageKey(user);
    if (!key || !cleanName) return;
    try {
      localStorage.setItem(key, cleanName);
    } catch {
      // Nickname persistence is best-effort.
    }
  }, [user?.uid, nickname]);

  useEffect(() => {
    if (!firebaseReady || !activeRoomId) {
      setRoom(null);
      setSongs([]);
      setMembers([]);
      return undefined;
    }

    const roomRef = doc(db, "rooms", activeRoomId);
    const songsRef = query(collection(db, "rooms", activeRoomId, "songs"), orderBy("position", "asc"));
    const membersRef = query(collection(db, "rooms", activeRoomId, "members"), orderBy("joinedAt", "asc"));

    const handleRoomAccessLost = () => {
      setToast("You were removed from this room.");
      clearRoomState();
    };

    const unsubRoom = onSnapshot(roomRef, (snap) => {
      const nextRoom = snap.exists() ? { id: snap.id, ...snap.data() } : null;
      if (nextRoom?.closed) {
        setToast("Room closed because the last admin left.");
        clearRoomState();
        return;
      }
      setRoom(nextRoom);
    }, handleRoomAccessLost);
    const unsubSongs = onSnapshot(songsRef, (snap) => {
      setSongs(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
    }, handleRoomAccessLost);
    const unsubMembers = onSnapshot(membersRef, (snap) => {
      const nextMembers = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
      if (user?.uid && !nextMembers.some((member) => member.id === user.uid)) {
        handleRoomAccessLost();
        return;
      }
      setMembers(nextMembers);
    }, handleRoomAccessLost);
    return () => {
      unsubRoom();
      unsubSongs();
      unsubMembers();
    };
  }, [activeRoomId, user?.uid]);

  useEffect(() => {
    if (!activeRoomId) {
      setQrDataUrl("");
      return;
    }
    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${activeRoomId}`;
    QRCode.toDataURL(shareUrl, { margin: 1, width: 180 }).then(setQrDataUrl).catch(() => setQrDataUrl(""));
  }, [activeRoomId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room");
    if (roomParam) {
      const normalized = normalizeRoomId(roomParam);
      setRoomId(normalized);
      setRestoreRoomId(normalized);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user || !restoreRoomId || activeRoomId === restoreRoomId) return;
    joinRoomById(restoreRoomId, { silent: true })
      .then(() => setRestoreRoomId(""))
      .catch(() => undefined);
  }, [authLoading, user, restoreRoomId, activeRoomId]);

  const roomAdminUids = adminMapFor(room);
  const isRoomAdminId = (uid) => Boolean(uid && roomAdminUids[uid]);
  const isAdmin = Boolean(user && isRoomAdminId(user.uid));
  const activeDjUid = room?.activeDjUid || room?.adminUid || "";
  const activeDjName = room?.activeDjName || room?.adminName || "Room admin";
  const isActiveDj = Boolean(user && activeDjUid === user.uid);
  const cooldownEnabled = room?.cooldownEnabled !== false;
  const cooldownMinutes = Math.min(
    30,
    Math.max(1, Number(room?.cooldownMinutes) || Math.round((Number(room?.cooldownMs) || DEFAULT_COOLDOWN_MS) / 60000))
  );
  const cooldownMs = cooldownMinutes * 60 * 1000;
  const crossfadeEnabled = room?.crossfadeEnabled !== false;
  const crossfadeSeconds = Math.min(30, Math.max(1, Number(room?.crossfadeSeconds) || DEFAULT_CROSSFADE_SECONDS));
  const roomVolume = Math.min(100, Math.max(0, room?.volume == null ? 100 : Number(room.volume) || 0));
  const trackNoticeEnabled = room?.trackNoticeEnabled !== false;
  const trackNoticeSeconds = Math.min(30, Math.max(1, Number(room?.trackNoticeSeconds) || DEFAULT_TRACK_NOTICE_SECONDS));
  const joinNoticeEnabled = room?.joinNoticeEnabled !== false;
  const memberRecord = members.find((member) => member.id === user?.uid);
  const cooldownUntil = cooldownEnabled && memberRecord?.lastAddedAt?.toMillis ? memberRecord.lastAddedAt.toMillis() + cooldownMs : 0;
  const cooldownRemaining = Math.max(0, cooldownUntil - Date.now());
  const canAddSong = isAdmin || cooldownRemaining === 0;
  const nowPlayingSong = songs.find((song) => song.id === room?.nowPlayingId) || null;
  const playbackStartedAtMs = room?.playbackStartedAt?.toMillis ? room.playbackStartedAt.toMillis() : 0;
  const resumeSeconds = nowPlayingSong && playbackStartedAtMs
    ? Math.max(0, Math.floor((Date.now() - playbackStartedAtMs) / 1000))
    : 0;
  const resumeKey = activeRoomId && nowPlayingSong?.id ? `partybeats-resume:${activeRoomId}:${nowPlayingSong.id}` : "";
  const activeNickname = nickname.trim() || nicknameFor(user, "Guest");
  const canControlRoomVolume = Boolean(user?.isAnonymous && activeNickname.toLowerCase() === "billybeats");
  const canControlRoomSettings = isAdmin || canControlRoomVolume;
  const memberById = (uid) => members.find((member) => member.id === uid);
  const analytics = buildAnalytics();

  useEffect(() => {
    setPlaybackProgress({ songId: nowPlayingSong?.id || null, currentSeconds: 0, durationSeconds: 0, remainingSeconds: 0 });
  }, [nowPlayingSong?.id]);

  useEffect(() => {
    if (!activeRoomId) {
      previousSongCount.current = undefined;
      return;
    }

    const previousCount = previousSongCount.current;
    previousSongCount.current = songs.length;

    if (
      previousCount === undefined
      || !isActiveDj
      || !activeRoomId
      || room?.nowPlayingId
      || songs.length <= previousCount
    ) {
      return;
    }

    const newlyAddedSong = songs[previousCount] || songs[songs.length - 1];
    if (!newlyAddedSong?.id) return;

    updateDoc(doc(db, "rooms", activeRoomId), {
      nowPlayingId: newlyAddedSong.id,
      playbackStartedAt: serverTimestamp()
    }).catch(() => undefined);
  }, [isActiveDj, activeRoomId, room?.nowPlayingId, songs]);

  useEffect(() => {
    if (!isActiveDj || !activeRoomId || !nowPlayingSong || playbackStartedAtMs) return;
    updateDoc(doc(db, "rooms", activeRoomId), { playbackStartedAt: serverTimestamp() }).catch(() => undefined);
  }, [isActiveDj, activeRoomId, nowPlayingSong?.id, playbackStartedAtMs]);

  useEffect(() => {
    setEffectivePlaybackSettings((current) => {
      const songId = nowPlayingSong?.id || null;
      if (current.songId === songId) return current;
      return {
        songId,
        crossfadeEnabled,
        crossfadeSeconds
      };
    });
  }, [nowPlayingSong?.id, crossfadeEnabled, crossfadeSeconds]);

  useEffect(() => {
    const currentPlayingId = room?.nowPlayingId || null;
    if (!activeRoomId || !currentPlayingId) {
      previousNowPlayingId.current = currentPlayingId;
      setNowPlayingNotice(null);
      return undefined;
    }
    if (previousNowPlayingId.current === undefined) {
      previousNowPlayingId.current = currentPlayingId;
      return undefined;
    }
    if (previousNowPlayingId.current === currentPlayingId) {
      return undefined;
    }

    previousNowPlayingId.current = currentPlayingId;
    if (!nowPlayingSong) {
      setNowPlayingNotice(null);
      return undefined;
    }
    if (!trackNoticeEnabled) {
      setNowPlayingNotice(null);
      return undefined;
    }
    const uploader = memberById(nowPlayingSong.addedByUid);
    setNowPlayingNotice({
      id: nowPlayingSong.id,
      title: nowPlayingSong.title || "Untitled",
      artist: nowPlayingSong.artist || "YouTube",
      addedBy: uploader?.name || nowPlayingSong.addedByName || "Guest"
    });
    const timer = window.setTimeout(() => setNowPlayingNotice(null), trackNoticeSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [activeRoomId, room?.nowPlayingId, nowPlayingSong?.id, trackNoticeEnabled, trackNoticeSeconds]);

  useEffect(() => {
    if (!activeRoomId) {
      previousMemberIds.current = undefined;
      setJoinNotice(null);
      return undefined;
    }

    const currentIds = new Set(members.map((member) => member.id));
    if (previousMemberIds.current === undefined && members.length === 0) {
      return undefined;
    }
    if (previousMemberIds.current === undefined) {
      previousMemberIds.current = currentIds;
      return undefined;
    }

    const addedMember = members.find((member) => !previousMemberIds.current.has(member.id));
    previousMemberIds.current = currentIds;
    if (!joinNoticeEnabled || !addedMember) return undefined;

    setJoinNotice({
      id: `${addedMember.id}-${Date.now()}`,
      name: addedMember.name || "Someone"
    });
    const timer = window.setTimeout(() => setJoinNotice(null), DEFAULT_JOIN_NOTICE_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, [activeRoomId, members, joinNoticeEnabled]);

  function buildAnalytics() {
    const people = new Map();
    const ensurePerson = (uid, name, isCurrentMember = false) => {
      const key = analyticsPersonKey(uid, name);
      if (!people.has(key)) {
        people.set(key, emptyAnalyticsPerson(uid, name, isCurrentMember));
      }
      const person = people.get(key);
      if (name && person.name === "Guest") person.name = name;
      person.isCurrentMember = person.isCurrentMember || isCurrentMember;
      return person;
    };

    members.forEach((member) => ensurePerson(member.id, member.name, true));

    const artistCounts = new Map();
    const titleWords = new Map();
    let reactionTotal = 0;
    let commentTotal = 0;

    songs.forEach((song) => {
      ensurePerson(song.addedByUid, song.addedByName).songsAdded += 1;
      const artist = song.artist || "YouTube";
      artistCounts.set(artist, (artistCounts.get(artist) || 0) + 1);
      normalizeMusicText(song.title || "").split(" ").forEach((word) => {
        if (word.length > 3 && !["official", "video", "audio", "music"].includes(word)) {
          titleWords.set(word, (titleWords.get(word) || 0) + 1);
        }
      });

      const reactions = Object.entries(song.emojiByUser || {});
      reactionTotal += reactions.length;
      ensurePerson(song.addedByUid, song.addedByName).reactionsReceived += reactions.length;
      reactions.forEach(([uid]) => {
        const reactor = memberById(uid);
        ensurePerson(uid, reactor?.name || "Guest").reactionsGiven += 1;
      });

      const messages = song.messages || [];
      commentTotal += messages.length;
      ensurePerson(song.addedByUid, song.addedByName).commentsReceived += messages.length;
      messages.forEach((message) => {
        ensurePerson(message.uid, message.name, members.some((member) => member.id === message.uid)).commentsMade += 1;
      });
    });

    const peopleList = [...people.values()].sort((a, b) => b.songsAdded - a.songsAdded || b.reactionsGiven - a.reactionsGiven || a.name.localeCompare(b.name));
    const topArtists = [...artistCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topTitleWords = [...titleWords.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const topContributor = peopleList.find((person) => person.songsAdded > 0) || null;
    const topReactedSong = [...songs]
      .filter((song) => Object.keys(song.emojiByUser || {}).length > 0)
      .sort((a, b) => Object.keys(b.emojiByUser || {}).length - Object.keys(a.emojiByUser || {}).length)[0] || null;

    return {
      people: peopleList,
      currentMemberCount: members.length,
      participantCount: peopleList.length,
      songCount: songs.length,
      reactionTotal,
      commentTotal,
      topArtists,
      topTitleWords,
      topContributor,
      topReactedSong
    };
  }

  async function signInGoogle() {
    if (!firebaseReady) {
      setToast("Add your Firebase config first.");
      return;
    }
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      const result = await signInWithPopup(auth, provider);
      if (result?.user) {
        setUser(result.user);
        setNickname(savedNicknameFor(result.user) || nicknameFor(result.user, ""));
      }
    } catch (error) {
      if (["auth/popup-blocked", "auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(error.code)) {
        await signInWithRedirect(auth, provider);
        return;
      }
      setToast(authErrorMessage(error));
    }
  }

  async function ensureSignedInWithNickname(options = {}) {
    if (user) return user;
    if (!firebaseReady) {
      if (!options.silent) setToast("Add your Firebase config first.");
      return null;
    }
    const cleanName = nickname.trim();
    if (cleanName.length < 2) {
      if (!options.silent) setToast("Choose a nickname with at least 2 characters.");
      return null;
    }
    try {
      const credential = await signInAnonymously(auth);
      await updateProfile(credential.user, { displayName: cleanName });
      try {
        localStorage.setItem(nicknameStorageKey(credential.user), cleanName);
      } catch {
        // Nickname persistence is best-effort.
      }
      setUser(credential.user);
      setNickname(cleanName);
      return credential.user;
    } catch (error) {
      if (!options.silent) setToast(authErrorMessage(error));
      return null;
    }
  }

  async function createRoom() {
    if (!user || user.isAnonymous) {
      setToast("Sign in with Google to create a room.");
      return;
    }

    let nextId = "";
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = randomRoomId();
      const existing = await getDoc(doc(db, "rooms", candidate));
      if (!existing.exists()) {
        nextId = candidate;
        break;
      }
    }
    if (!nextId) {
      setToast("Could not find a free room ID. Try again.");
      return;
    }

    await setDoc(doc(db, "rooms", nextId), {
      roomId: nextId,
      adminUid: user.uid,
      adminUids: { [user.uid]: true },
      adminName: activeNickname,
      activeDjUid: user.uid,
      activeDjName: activeNickname,
      createdAt: serverTimestamp(),
      closed: false,
      cooldownEnabled: true,
      cooldownMinutes: 3,
      cooldownMs: DEFAULT_COOLDOWN_MS,
      crossfadeEnabled: true,
      crossfadeSeconds: DEFAULT_CROSSFADE_SECONDS,
      volume: 100,
      trackNoticeEnabled: true,
      trackNoticeSeconds: DEFAULT_TRACK_NOTICE_SECONDS,
      joinNoticeEnabled: true,
      nowPlayingId: null,
      playbackStartedAt: null
    });
    await joinRoomById(nextId, { user });
  }

  async function joinRoomById(rawId = roomId, options = {}) {
    const joiningUser = options.user || await ensureSignedInWithNickname(options);
    if (!joiningUser) {
      return;
    }
    const nextRoomId = normalizeRoomId(rawId);
    if (!/^[A-Z]{4}\d{3}$/.test(nextRoomId)) {
      if (!options.silent) setToast("Room IDs look like VIBE123.");
      return;
    }

    const roomSnap = await getDoc(doc(db, "rooms", nextRoomId));
    if (!roomSnap.exists()) {
      if (!options.silent) setToast("That room does not exist yet.");
      return;
    }
    if (roomSnap.data().closed) {
      if (!options.silent) setToast("That room has been closed.");
      return;
    }

    await setDoc(
      doc(db, "rooms", nextRoomId, "members", joiningUser.uid),
      {
        uid: joiningUser.uid,
        name: activeNickname,
        isAnonymous: joiningUser.isAnonymous,
        joinedAt: serverTimestamp()
      },
      { merge: true }
    );
    setActiveRoomId(nextRoomId);
    setRoomId(nextRoomId);
    window.history.replaceState({}, "", `${window.location.pathname}?room=${nextRoomId}`);
  }

  async function addSong(event, selectedVideo = null) {
    event?.preventDefault();
    if (!user || !activeRoomId) return false;

    const videoId = selectedVideo?.videoId;
    if (!videoId) {
      setToast("Choose a YouTube search result.");
      return false;
    }
    if (!canAddSong) {
      setToast(`Non-admins have a ${cooldownMinutes} minute song cooldown.`);
      return false;
    }

    const title = selectedVideo?.title || "YouTube track";
    const thumbnail = selectedVideo?.thumbnail || youtubeThumb(videoId);
    const nextPosition = songs.reduce((max, song) => Math.max(max, Number(song.position) || 0), 0) + 1;
    const songRef = doc(collection(db, "rooms", activeRoomId, "songs"));
    const batch = writeBatch(db);
    batch.set(songRef, {
      title,
      artist: selectedVideo?.channelTitle || "YouTube",
      link: youtubeWatchUrl(videoId),
      provider: "youtube",
      videoId,
      thumbnail,
      addedByUid: user.uid,
      addedByName: activeNickname,
      addedByIsAnonymous: user.isAnonymous,
      position: nextPosition,
      emojiByUser: {},
      messages: [],
      createdAt: serverTimestamp()
    });
    if (!isAdmin) {
      batch.set(doc(db, "rooms", activeRoomId, "members", user.uid), { lastAddedAt: serverTimestamp() }, { merge: true });
    }
    if (isActiveDj && !room?.nowPlayingId) {
      batch.update(doc(db, "rooms", activeRoomId), {
        nowPlayingId: songRef.id,
        playbackStartedAt: serverTimestamp()
      });
    }
    try {
      await batch.commit();
    } catch (error) {
      setToast(error.message || "Could not add that song.");
      return false;
    }
    setSearchResults([]);
    return true;
  }

  async function searchYouTube(event) {
    event.preventDefault();
    const queryText = searchQuery.trim();
    if (!queryText) return;
    if (!YOUTUBE_API_KEY) {
      setToast("Add VITE_YOUTUBE_API_KEY to .env.local to search YouTube in the app.");
      return;
    }

    setSearching(true);
    try {
      const params = new URLSearchParams({
        part: "snippet",
        type: "video",
        maxResults: "8",
        videoCategoryId: "10",
        q: queryText,
        key: YOUTUBE_API_KEY
      });
      const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || "YouTube search failed.");
      }
      setSearchResults(
        (data.items || []).map((item) => ({
          videoId: item.id.videoId,
          title: item.snippet.title,
          channelTitle: item.snippet.channelTitle,
          thumbnail: item.snippet.thumbnails?.medium?.url || youtubeThumb(item.id.videoId)
        }))
      );
      setSearchQuery("");
    } catch (error) {
      setToast(error.message || "YouTube search failed.");
    } finally {
      setSearching(false);
    }
  }

  async function addYouTubeLink(event) {
    event.preventDefault();
    const videoId = extractYouTubeVideoId(youtubeLink);
    if (!videoId) {
      setToast("Paste a valid YouTube video link.");
      return;
    }
    setLinkLoading(true);
    try {
      const response = await fetch(youtubeOembedUrl(videoId));
      const data = response.ok ? await response.json() : {};
      const added = await addSong(null, {
        videoId,
        title: data.title || "YouTube track",
        channelTitle: data.author_name || "YouTube",
        thumbnail: data.thumbnail_url || youtubeThumb(videoId)
      });
      if (added) setYoutubeLink("");
    } catch (error) {
      setToast(error.message || "Could not add that YouTube link.");
    } finally {
      setLinkLoading(false);
    }
  }

  async function removeSong(songId) {
    if (!isAdmin) return;
    await deleteDoc(doc(db, "rooms", activeRoomId, "songs", songId));
  }

  async function clearPlaylist() {
    if (!isAdmin || !activeRoomId || !songs.length) return;
    const confirmed = window.confirm("Clear the entire playlist for this room?");
    if (!confirmed) return;

    const batch = writeBatch(db);
    songs.forEach((song) => {
      batch.delete(doc(db, "rooms", activeRoomId, "songs", song.id));
    });
    batch.update(doc(db, "rooms", activeRoomId), {
      nowPlayingId: null,
      playbackStartedAt: null
    });
    await batch.commit();
    setNowPlayingNotice(null);
    setToast("Playlist cleared.");
  }

  async function moveSong(song, direction) {
    if (!isAdmin) return;
    const currentIndex = songs.findIndex((item) => item.id === song.id);
    const swapWith = songs[currentIndex + direction];
    if (!swapWith) return;
    await Promise.all([
      updateDoc(doc(db, "rooms", activeRoomId, "songs", song.id), { position: swapWith.position }),
      updateDoc(doc(db, "rooms", activeRoomId, "songs", swapWith.id), { position: song.position })
    ]);
  }

  async function setNowPlaying(songId) {
    if (!isActiveDj) {
      setToast("Only the Active DJ can control playback.");
      return;
    }
    await updateDoc(doc(db, "rooms", activeRoomId), {
      nowPlayingId: songId,
      playbackStartedAt: songId ? serverTimestamp() : null
    });
  }

  async function takeOverDj() {
    if (!isAdmin || !activeRoomId || !user) return;
    await updateDoc(doc(db, "rooms", activeRoomId), {
      activeDjUid: user.uid,
      activeDjName: activeNickname,
      activeDjAt: serverTimestamp()
    });
    setToast("You are now the Active DJ.");
  }

  async function promoteMember(member) {
    if (!isAdmin || !member || member.isAnonymous) return;
    await updateDoc(doc(db, "rooms", activeRoomId), {
      [`adminUids.${user.uid}`]: true,
      [`adminUids.${member.id}`]: true
    });
    setToast(`${member.name || "Member"} is now an admin.`);
  }

  async function demoteMember(member) {
    if (!isAdmin || !member || member.id === user.uid || !isRoomAdminId(member.id)) return;
    const activeAdminIds = Object.keys(roomAdminUids).filter((uid) => members.some((item) => item.id === uid));
    if (activeAdminIds.length <= 1) {
      setToast("A room needs at least one admin.");
      return;
    }

    const roomUpdate = {
      [`adminUids.${user.uid}`]: true,
      [`adminUids.${member.id}`]: deleteField()
    };
    if (room?.adminUid === member.id) {
      roomUpdate.adminUid = user.uid;
      roomUpdate.adminName = activeNickname;
    }

    await updateDoc(doc(db, "rooms", activeRoomId), roomUpdate);
    setToast(`${member.name || "Member"} is no longer an admin.`);
  }

  async function removeMember(member) {
    if (!isAdmin || !member) return;
    if (member.id === user.uid) {
      await leaveRoom();
      return;
    }

    const batch = writeBatch(db);
    const roomUpdate = {};
    if (isRoomAdminId(member.id)) {
      roomUpdate[`adminUids.${user.uid}`] = true;
      roomUpdate[`adminUids.${member.id}`] = deleteField();
      if (room?.adminUid === member.id) {
        roomUpdate.adminUid = user.uid;
        roomUpdate.adminName = activeNickname;
      }
    }
    if (room?.activeDjUid === member.id) {
      roomUpdate.activeDjUid = user.uid;
      roomUpdate.activeDjName = activeNickname;
    }
    if (Object.keys(roomUpdate).length > 0) {
      batch.update(doc(db, "rooms", activeRoomId), roomUpdate);
    }
    batch.delete(doc(db, "rooms", activeRoomId, "members", member.id));
    await batch.commit();
    setToast(`${member.name || "Member"} was removed from the room.`);
  }

  async function renameMember(member) {
    const nextName = renameDraft.trim().slice(0, 30);
    if (!isAdmin || !member || !nextName) return;
    if (hasProfanity(nextName)) {
      setToast("Nickname blocked for profanity.");
      return;
    }
    await updateDoc(doc(db, "rooms", activeRoomId, "members", member.id), {
      name: nextName
    });
    if (room?.activeDjUid === member.id) {
      await updateDoc(doc(db, "rooms", activeRoomId), { activeDjName: nextName });
    }
    if (member.id === user.uid) {
      setNickname(nextName);
    }
    setRenameMemberId("");
    setRenameDraft("");
    setToast(`${member.name || "Member"} is now ${nextName}.`);
  }

  async function saveOwnNickname(event) {
    event.preventDefault();
    const nextName = nickname.trim().slice(0, 30);
    if (!user || !activeRoomId || !nextName) return;
    if (hasProfanity(nextName)) {
      setToast("Nickname blocked for profanity.");
      return;
    }
    await updateDoc(doc(db, "rooms", activeRoomId, "members", user.uid), {
      name: nextName
    });
    if (room?.activeDjUid === user.uid) {
      await updateDoc(doc(db, "rooms", activeRoomId), { activeDjName: nextName });
    }
    try {
      localStorage.setItem(nicknameStorageKey(user), nextName);
    } catch {
      // Nickname persistence is best-effort.
    }
    setNickname(nextName);
    setNicknameOpen(false);
    setToast("Nickname updated.");
  }

  async function playNextSong() {
    if (!isActiveDj || !activeRoomId) {
      setToast("Only the Active DJ can control playback.");
      return;
    }
    const currentSongId = room?.nowPlayingId || nowPlayingSong?.id || null;
    if (!currentSongId) {
      await updateDoc(doc(db, "rooms", activeRoomId), {
        nowPlayingId: null,
        playbackStartedAt: null
      });
      return;
    }
    const nextSong = nextQueuedSong(songs, currentSongId);
    if (nextSong) {
      await updateDoc(doc(db, "rooms", activeRoomId), {
        nowPlayingId: nextSong.id,
        playbackStartedAt: serverTimestamp()
      });
      return;
    }

    await updateDoc(doc(db, "rooms", activeRoomId), {
      nowPlayingId: null,
      playbackStartedAt: null
    });
  }

  async function reactToSong(song, emoji) {
    if (!user || !activeRoomId) return;
    const songRef = doc(db, "rooms", activeRoomId, "songs", song.id);
    const path = `emojiByUser.${user.uid}`;
    if (song.emojiByUser?.[user.uid] === emoji) {
      await updateDoc(songRef, { [path]: deleteField() });
      return;
    }
    await updateDoc(songRef, { [path]: emoji });
  }

  async function sendSongMessage(song) {
    const text = messageDraft.trim().slice(0, 90);
    if (!user || !activeRoomId || !text) return;
    if (hasProfanity(text)) {
      setToast("Message blocked for profanity.");
      return;
    }
    const senderName = activeNickname.slice(0, 30);
    const nextMessages = [
      ...(song.messages || []),
      {
        uid: user.uid,
        name: senderName,
        isAnonymous: user.isAnonymous,
        text,
        at: Date.now()
      }
    ].slice(-4);
    await updateDoc(doc(db, "rooms", activeRoomId, "songs", song.id), {
      messages: nextMessages
    });
    setMessageDraft("");
    setMessageSongId("");
    setEmojiSongId("");
  }

  function clearRoomState() {
    setActiveRoomId("");
    setRoom(null);
    setSongs([]);
    setMembers([]);
    setMenuOpen(false);
    setAboutOpen(false);
    setAnalyticsOpen(false);
    setPeopleOpen(false);
    setSettingsOpen(false);
    setNicknameOpen(false);
    setEmojiSongId("");
    setMessageSongId("");
    setMessageDraft("");
    setRenameMemberId("");
    setRenameDraft("");
    setNowPlayingNotice(null);
    setJoinNotice(null);
    previousMemberIds.current = undefined;
    setEffectivePlaybackSettings({
      songId: null,
      crossfadeEnabled: true,
      crossfadeSeconds: DEFAULT_CROSSFADE_SECONDS
    });
    setRestoreRoomId("");
    window.history.replaceState({}, "", window.location.pathname);
  }

  async function updateCooldownEnabled(enabled) {
    if (!canControlRoomSettings || !activeRoomId) return;
    await updateDoc(doc(db, "rooms", activeRoomId), { cooldownEnabled: enabled });
  }

  async function updateCooldownMinutes(minutes) {
    if (!canControlRoomSettings || !activeRoomId) return;
    const cleanMinutes = Math.min(30, Math.max(1, Number(minutes) || 1));
    await updateDoc(doc(db, "rooms", activeRoomId), {
      cooldownMinutes: cleanMinutes,
      cooldownMs: cleanMinutes * 60 * 1000
    });
  }

  async function updateCrossfadeEnabled(enabled) {
    if (!canControlRoomSettings || !activeRoomId) return;
    await updateDoc(doc(db, "rooms", activeRoomId), { crossfadeEnabled: enabled });
  }

  async function updateCrossfadeSeconds(seconds) {
    if (!canControlRoomSettings || !activeRoomId) return;
    const cleanSeconds = Math.min(30, Math.max(1, Number(seconds) || DEFAULT_CROSSFADE_SECONDS));
    await updateDoc(doc(db, "rooms", activeRoomId), { crossfadeSeconds: cleanSeconds });
  }

  async function updateTrackNoticeEnabled(enabled) {
    if (!canControlRoomSettings || !activeRoomId) return;
    await updateDoc(doc(db, "rooms", activeRoomId), { trackNoticeEnabled: enabled });
  }

  async function updateTrackNoticeSeconds(seconds) {
    if (!canControlRoomSettings || !activeRoomId) return;
    const cleanSeconds = Math.min(30, Math.max(1, Number(seconds) || DEFAULT_TRACK_NOTICE_SECONDS));
    await updateDoc(doc(db, "rooms", activeRoomId), { trackNoticeSeconds: cleanSeconds });
  }

  async function updateJoinNoticeEnabled(enabled) {
    if (!canControlRoomSettings || !activeRoomId) return;
    await updateDoc(doc(db, "rooms", activeRoomId), { joinNoticeEnabled: enabled });
  }

  async function updateRoomVolume(value) {
    if (!canControlRoomVolume || !activeRoomId) return;
    const cleanVolume = Math.min(100, Math.max(0, Number(value) || 0));
    await updateDoc(doc(db, "rooms", activeRoomId), { volume: cleanVolume });
  }

  async function leaveRoom() {
    const leavingRoomId = activeRoomId;
    const leavingUser = user;

    if (leavingRoomId && leavingUser) {
      const batch = writeBatch(db);
      let roomDeleted = false;
      if (isAdmin) {
        const remainingAdmins = members.filter((member) => member.id !== leavingUser.uid && isRoomAdminId(member.id));
        if (remainingAdmins.length === 0) {
          songs.forEach((song) => {
            batch.delete(doc(db, "rooms", leavingRoomId, "songs", song.id));
          });
          members.forEach((member) => {
            batch.delete(doc(db, "rooms", leavingRoomId, "members", member.id));
          });
          batch.delete(doc(db, "rooms", leavingRoomId));
          roomDeleted = true;
        } else {
          batch.update(doc(db, "rooms", leavingRoomId), {
            [`adminUids.${leavingUser.uid}`]: deleteField(),
            adminUid: remainingAdmins[0].id,
            adminName: remainingAdmins[0].name || "Google user",
            ...(room?.activeDjUid === leavingUser.uid
              ? {
                  activeDjUid: remainingAdmins[0].id,
                  activeDjName: remainingAdmins[0].name || "Google user"
                }
              : {})
          });
        }
      }
      if (!roomDeleted) {
        batch.delete(doc(db, "rooms", leavingRoomId, "members", leavingUser.uid));
      }
      await batch.commit();
    }

    clearRoomState();
  }

  async function handleSignOut() {
    await leaveRoom();
    await signOut(auth);
  }

  async function shareRoom() {
    if (!activeRoomId) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${activeRoomId}`;
    const shareData = {
      title: "Join my ROCK BeatsParty room",
      text: `Join ROCK BeatsParty room ${activeRoomId}`,
      url: shareUrl
    };
    setMenuOpen(false);
    if (navigator.share) {
      await navigator.share(shareData).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(`${shareData.text}\n${shareUrl}`);
    setToast("Room link copied.");
  }

  async function exportPlaylist() {
    setMenuOpen(false);
    if (!songs.length) {
      setToast("There are no songs to share yet.");
      return;
    }
    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${activeRoomId}`;
    const lines = [
      "ROCK BeatsParty Playlist",
      `Room: ${activeRoomId}`,
      `Exported: ${new Date().toLocaleString()}`,
      "",
      ...songs.flatMap((song, index) => {
        return [
          `${index + 1}. ${song.artist || "YouTube"} - ${song.title || "Untitled"}`,
          song.link ? `   Link: ${song.link}` : "",
          ""
        ].filter(Boolean);
      })
    ];
    const playlistText = lines.join("\n");
    const shareData = {
      title: `ROCK BeatsParty ${activeRoomId} playlist`,
      text: playlistText,
      url: shareUrl
    };

    if (navigator.share) {
      await navigator.share(shareData).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(`${playlistText}\n\nJoin: ${shareUrl}`);
    setToast("Playlist copied.");
  }

  async function shareAnalytics() {
    const lines = [
      "ROCK BeatsParty Analytics",
      `Room: ${activeRoomId}`,
      `Generated: ${new Date().toLocaleString()}`,
      "",
      `Current people: ${analytics.currentMemberCount}`,
      `People represented: ${analytics.participantCount}`,
      `Songs: ${analytics.songCount}`,
      `Reactions: ${analytics.reactionTotal}`,
      `Comments: ${analytics.commentTotal}`,
      "",
      "People",
      ...analytics.people.map((person) => {
        const status = person.isCurrentMember ? "in room" : "previous";
        return `${person.name} (${status}): ${person.songsAdded} songs, ${person.reactionsGiven} reactions, ${person.commentsMade} comments`;
      }),
      "",
      "Top artists/channels",
      ...(analytics.topArtists.length ? analytics.topArtists.map(([artist, count]) => `${artist}: ${count}`) : ["None yet"]),
      "",
      "Common title words",
      ...(analytics.topTitleWords.length ? analytics.topTitleWords.map(([word, count]) => `${word}: ${count}`) : ["None yet"])
    ];
    const text = lines.join("\n");
    if (navigator.share) {
      await navigator.share({ title: `ROCK BeatsParty ${activeRoomId} analytics`, text }).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(text);
    setToast("Analytics copied.");
  }

  if (!firebaseReady) {
    return <SetupMissing />;
  }

  if (!activeRoomId || !room) {
    return (
      <main className="app-shell landing-shell">
        <section className="landing-hero">
          <div className="brand-mark">
            <AppIcon />
            <span>ROCK BeatsParty</span>
          </div>
          <div className="landing-copy">
            <h1>ROCK BeatsParty</h1>
            <p>Start a room, pass around the code, and let everyone build the music queue from their phone.</p>
            <span className="landing-version">Version {APP_VERSION}</span>
          </div>

          <div className="auth-panel">
            {authLoading ? (
              <div className="muted">Checking session...</div>
            ) : user ? (
              <SignedIn user={user} nickname={nickname} setNickname={setNickname} onSignOut={handleSignOut} />
            ) : (
              <SignedOut
                nickname={nickname}
                setNickname={setNickname}
                onGoogle={signInGoogle}
              />
            )}
          </div>

          <div className="room-card">
            <h2>Start or Join</h2>
            <p className="muted">Sign in with Google to create a room. Guests can join with a nickname and room code.</p>
            <div className="room-actions">
              <button className="primary-action" onClick={createRoom} disabled={authLoading || !user || user.isAnonymous}>
                <Wand2 aria-hidden="true" />
                Create Room
              </button>
              <div className="join-row">
                <input
                  value={roomId}
                  onChange={(event) => setRoomId(normalizeRoomId(event.target.value))}
                  placeholder="VIBE123"
                  maxLength={7}
                />
                <button onClick={() => joinRoomById()} disabled={authLoading}>
                  <DoorOpen aria-hidden="true" />
                  Join
                </button>
              </div>
            </div>
          </div>
        </section>

        {toast && (
          <button className="toast" onClick={() => setToast("")}>
            {toast}
          </button>
        )}
      </main>
    );
  }

  return (
    <main className={`app-shell room-app ${isDarkTheme ? "dark-mode" : "light-mode"} color-theme-${colorTheme}`}>
      <header className="app-topbar">
        <div className="topbar-brand">
          <div className="brand-dot">
            <AppIcon />
          </div>
          <div>
            <strong>ROCK BeatsParty</strong>
            <span>{activeRoomId}</span>
          </div>
        </div>

        <div className="topbar-actions">
          <button
            className="icon-button theme-toggle"
            onClick={() => setTheme(isDarkTheme ? "light" : "dark")}
            title={isDarkTheme ? "Light mode" : "Dark mode"}
            type="button"
          >
            {isDarkTheme ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
          </button>
          <button
            className="icon-button"
            onClick={() => setPeopleOpen(true)}
            title="People in room"
            type="button"
          >
            <UsersRound aria-hidden="true" />
          </button>
          <div className="session-chip">
            <span>{user.isAnonymous ? "Guest" : "Google"}</span>
            <strong>
              {!user.isAnonymous && <GoogleBadge />}
              {activeNickname}
            </strong>
          </div>
          <button
            className="icon-button"
            onClick={() => setNicknameOpen(true)}
            title="Edit nickname"
            type="button"
          >
            <Pencil aria-hidden="true" />
          </button>
          <div className="menu-wrap">
            <button className="icon-button" onClick={() => setMenuOpen((open) => !open)} title="Menu">
              <MoreVertical aria-hidden="true" />
            </button>
            {menuOpen && (
              <div className="overflow-menu">
                <button onClick={() => { setAboutOpen(true); setMenuOpen(false); }}>
                  <Info aria-hidden="true" />
                  About
                </button>
                <button onClick={() => { setAnalyticsOpen(true); setMenuOpen(false); }}>
                  <BarChart3 aria-hidden="true" />
                  Analytics
                </button>
                <button onClick={() => { setSettingsOpen(true); setMenuOpen(false); }}>
                  <SlidersHorizontal aria-hidden="true" />
                  Settings
                </button>
                <button onClick={() => { setColorThemeOpen(true); setMenuOpen(false); }}>
                  <Palette aria-hidden="true" />
                  Color themes
                </button>
                <button onClick={shareRoom}>
                  <Share2 aria-hidden="true" />
                  Share
                </button>
                <button onClick={exportPlaylist}>
                  <Share2 aria-hidden="true" />
                  Share Playlist
                </button>
                <button onClick={leaveRoom}>
                  <DoorOpen aria-hidden="true" />
                  Leave Room
                </button>
                <button onClick={handleSignOut}>
                  <LogOut aria-hidden="true" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <section className="sticky-now-playing">
        <div className="sticky-now-playing-copy">
          <span>Now playing</span>
          <strong>{nowPlayingSong?.title || "Nothing playing yet"}</strong>
          <p>{nowPlayingSong ? nowPlayingSong.artist || "YouTube" : "Waiting for the first track"}</p>
        </div>
        <div className="sticky-now-playing-time">
          <span>Remaining</span>
          <strong>{nowPlayingSong && playbackProgress.durationSeconds ? formatDuration(playbackProgress.remainingSeconds) : "--:--"}</strong>
        </div>
      </section>

      <section className="now-playing-card">
        <div>
          <span>{isActiveDj ? "Active DJ player" : "Now playing"}</span>
          <h1>{nowPlayingSong?.title || "Nothing playing yet"}</h1>
          <p>
            {nowPlayingSong
              ? `${nowPlayingSong.artist || "YouTube"} · added by ${nowPlayingSong.addedByName || "Guest"}`
              : "The Active DJ starts playback from the phone connected to the speaker."}
          </p>
          <p className="dj-note">
            Playing from {activeDjName}
            {isAdmin && !isActiveDj ? " · You can take over if the speaker moves to your phone." : ""}
          </p>
        </div>
        {isActiveDj ? (
          <>
            <YouTubePlayer
              song={nowPlayingSong}
              onEnded={playNextSong}
              onCrossfade={playNextSong}
              crossfadeEnabled={effectivePlaybackSettings.crossfadeEnabled}
              crossfadeSeconds={effectivePlaybackSettings.crossfadeSeconds}
              resumeSeconds={resumeSeconds}
              resumeKey={resumeKey}
              playbackStartedAtMs={playbackStartedAtMs}
              volume={roomVolume}
              onProgress={(progress) => setPlaybackProgress({ songId: nowPlayingSong?.id || null, ...progress })}
            />
            <div className="player-actions">
              <button className="mini-action" onClick={playNextSong} disabled={!songs.length}>
                <SkipForward aria-hidden="true" />
                Next
              </button>
              {nowPlayingSong?.link && (
                <a className="mini-link" href={nowPlayingSong.link} target="_blank" rel="noreferrer">
                  <ExternalLink aria-hidden="true" />
                  YouTube
                </a>
              )}
            </div>
          </>
        ) : isAdmin ? (
          <div className="player-actions">
            <button className="mini-action" onClick={takeOverDj} type="button">
              <Crown aria-hidden="true" />
              Take Over DJ
            </button>
          </div>
        ) : null}
        {canControlRoomVolume && (
          <div className="room-volume-control">
            <label htmlFor="room-volume">
              <span>
                <Volume2 aria-hidden="true" />
                Room volume
              </span>
              <strong>{roomVolume}</strong>
            </label>
            <input
              id="room-volume"
              type="range"
              min="0"
              max="100"
              value={roomVolume}
              onChange={(event) => updateRoomVolume(event.target.value)}
            />
          </div>
        )}
      </section>

      <section className="add-panel">
        <form className="youtube-search" onSubmit={searchYouTube}>
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={YOUTUBE_API_KEY ? "Search YouTube in app" : "Add VITE_YOUTUBE_API_KEY"}
          />
          <button className="primary-action" disabled={!YOUTUBE_API_KEY || searching} type="submit">
            <Search aria-hidden="true" />
            {searching ? "..." : "Search"}
          </button>
        </form>

        <div className="external-search-panel">
          <div>
            <strong>Search YouTube Music</strong>
            <span>Find a song, then paste the YouTube or YouTube Music link here.</span>
          </div>
          <div className="external-search-actions">
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Song or artist"
            />
            <a
              className="primary-action"
              href={youtubeSearchUrl(searchQuery || "music")}
              onClick={() => window.setTimeout(() => setSearchQuery(""), 0)}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink aria-hidden="true" />
              Search
            </a>
          </div>
        </div>

        {searchResults.length > 0 && (
          <div className="search-results">
            {searchResults.map((result) => (
              <article className="search-result" key={result.videoId}>
                <img src={result.thumbnail} alt="" />
                <div>
                  <strong>{result.title}</strong>
                  <span>{result.channelTitle}</span>
                </div>
                <button className="mini-action" onClick={() => addSong(null, result)} disabled={!canAddSong} type="button">
                  <Plus aria-hidden="true" />
                  Add
                </button>
              </article>
            ))}
          </div>
        )}

        <form className="youtube-link-form" onSubmit={addYouTubeLink}>
          <input
            value={youtubeLink}
            onChange={(event) => setYoutubeLink(event.target.value)}
            placeholder="Paste YouTube or YouTube Music link"
          />
          <button className="mini-action" disabled={!youtubeLink.trim() || linkLoading || !canAddSong} type="submit">
            <Plus aria-hidden="true" />
            {linkLoading ? "..." : "Add Link"}
          </button>
        </form>

        <p className="cooldown-note">
          {isAdmin
            ? `Admin controls are enabled. Cooldown is ${cooldownEnabled ? `${cooldownMinutes} min` : "off"}.`
            : !cooldownEnabled
              ? "Cooldown is off."
              : canAddSong
                ? "You can add a song now."
                : `Next add in ${Math.ceil(cooldownRemaining / 1000)}s.`}
        </p>
      </section>

      <section className="queue-panel">
        <div className="queue-header">
          <div>
            <h2>Playlist</h2>
            <p className="muted">Hold a track to react.</p>
          </div>
          <div className="queue-tools">
            {isAdmin && (
              <button className="mini-action danger-action" onClick={clearPlaylist} disabled={!songs.length} type="button">
                <Trash2 aria-hidden="true" />
                Clear
              </button>
            )}
            <strong>{songs.length}</strong>
          </div>
        </div>

        <div className="song-list">
          {songs.length === 0 ? (
            <div className="empty-state">
              <Music2 aria-hidden="true" />
              <strong>No songs yet</strong>
              <span>Drop the first track and set the tone.</span>
            </div>
          ) : (
            songs.map((song, index) => {
              const uploader = memberById(song.addedByUid);
              const uploaderIsGoogle = song.addedByIsAnonymous === false || uploader?.isAnonymous === false;
              const emojiCounts = EMOJIS.map((emoji) => ({
                emoji,
                count: Object.values(song.emojiByUser || {}).filter((value) => value === emoji).length
              })).filter((item) => item.count > 0);
              return (
                <article
                  className={[
                    "song-row",
                    song.id === room.nowPlayingId ? "is-playing" : "",
                    emojiSongId === song.id ? "is-reacting" : ""
                  ].filter(Boolean).join(" ")}
                  key={song.id}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    suppressNextTrackClick.current = song.id;
                    setMessageSongId("");
                    setEmojiSongId(song.id);
                  }}
                  onPointerDown={(event) => {
                    const timer = window.setTimeout(() => {
                      suppressNextTrackClick.current = song.id;
                      setMessageSongId("");
                      setEmojiSongId(song.id);
                    }, 520);
                    event.currentTarget.dataset.pressTimer = String(timer);
                  }}
                  onPointerUp={(event) => window.clearTimeout(Number(event.currentTarget.dataset.pressTimer))}
                  onPointerLeave={(event) => window.clearTimeout(Number(event.currentTarget.dataset.pressTimer))}
                >
                  <button
                    className="song-main"
                    onClick={(event) => {
                      if (suppressNextTrackClick.current === song.id) {
                        event.preventDefault();
                        suppressNextTrackClick.current = "";
                        return;
                      }
                      if (isActiveDj) setNowPlaying(song.id);
                    }}
                    type="button"
                  >
                    <span className="song-index">{index + 1}</span>
                    <span className="track-line">
                      <b>{song.artist || "YouTube"}</b>
                      <strong>{song.title}</strong>
                    </span>
                    <span className="uploaded-by">
                      Uploaded by {uploaderIsGoogle && <GoogleBadge />}{uploader?.name || song.addedByName || "Guest"}
                    </span>
                  </button>

                  <div className="reaction-strip">
                    {emojiCounts.length > 0 && (
                      <span className="emoji-summary">
                        {emojiCounts.map(({ emoji, count }) => `${emoji}${count}`).join(" ")}
                      </span>
                    )}
                    {(song.messages || []).slice(-2).map((item, messageIndex) => (
                      <span className="song-message" key={`${item.uid || "guest"}-${item.at || messageIndex}`}>
                        <b>{item.isAnonymous === false && <GoogleBadge />}{item.name || "Guest"}:</b> {item.text}
                      </span>
                    ))}
                  </div>

                  {isAdmin && (
                    <div className="admin-actions" onPointerDown={(event) => event.stopPropagation()}>
                      <button className="icon-button" onClick={() => moveSong(song, -1)} title="Move up" disabled={index === 0}>
                        <ArrowUp aria-hidden="true" />
                      </button>
                      <button className="icon-button" onClick={() => moveSong(song, 1)} title="Move down" disabled={index === songs.length - 1}>
                        <ArrowDown aria-hidden="true" />
                      </button>
                      {isActiveDj && (
                        <button className="icon-button" onClick={() => setNowPlaying(song.id)} title="Play">
                          <Play aria-hidden="true" />
                        </button>
                      )}
                      <button className="icon-button danger" onClick={() => removeSong(song.id)} title="Remove song">
                        <Trash2 aria-hidden="true" />
                      </button>
                    </div>
                  )}

                  {emojiSongId === song.id && (
                    <div className="emoji-popover" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
                      {EMOJIS.map((emoji) => (
                        <button
                          className={song.emojiByUser?.[user.uid] === emoji ? "selected" : ""}
                          key={emoji}
                          onClick={() => {
                            reactToSong(song, emoji);
                            setEmojiSongId("");
                          }}
                          type="button"
                        >
                          {emoji}
                        </button>
                      ))}
                      <button
                        className={messageSongId === song.id ? "selected" : ""}
                        onClick={() => setMessageSongId(song.id)}
                        type="button"
                        title="Send message"
                      >
                        <MessageCircle aria-hidden="true" />
                      </button>
                      {messageSongId === song.id && (
                        <form className="reaction-message" onSubmit={(event) => { event.preventDefault(); sendSongMessage(song); }}>
                          <input
                            value={messageDraft}
                            onChange={(event) => setMessageDraft(event.target.value.slice(0, 90))}
                            placeholder="90 character message"
                            maxLength={90}
                          />
                          <button className="mini-action" type="submit" disabled={!messageDraft.trim()}>
                            Send
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </section>

      {emojiSongId && (
        <button
          className="emoji-dismiss-layer"
          aria-label="Close reactions"
          onClick={() => {
            setEmojiSongId("");
            setMessageSongId("");
            setMessageDraft("");
          }}
          type="button"
        />
      )}

      {aboutOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="about-modal">
            <div className="modal-header">
              <h2>About</h2>
              <button className="icon-button" onClick={() => setAboutOpen(false)} title="Close">
                <X aria-hidden="true" />
              </button>
            </div>
            <div className="about-grid">
              <div>
                <span>Room ID</span>
                <strong>{activeRoomId}</strong>
              </div>
              <div>
                <span>People</span>
                <strong>{members.length}</strong>
              </div>
              <div>
                <span>Version</span>
                <strong>{APP_VERSION}</strong>
              </div>
            </div>
            {qrDataUrl && (
              <div className="qr-block">
                <img src={qrDataUrl} alt={`Join ${activeRoomId}`} />
                <span>
                  <QrCode aria-hidden="true" />
                  Scan to join
                </span>
              </div>
            )}
          </section>
        </div>
      )}

      {peopleOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="about-modal people-modal">
            <div className="modal-header">
              <h2>People</h2>
              <button className="icon-button" onClick={() => setPeopleOpen(false)} title="Close">
                <X aria-hidden="true" />
              </button>
            </div>
            <section className="people-panel visible-people">
              {members.map((member) => {
                const memberIsAdmin = isRoomAdminId(member.id);
                const isCurrentUser = member.id === user.uid;
                return (
                  <div className="member-row" key={member.id}>
                    <UserRound aria-hidden="true" />
                    <div>
                      <strong>{member.isAnonymous === false && <GoogleBadge />}{member.name}{isCurrentUser ? " (You)" : ""}</strong>
                      <span>
                        {member.isAnonymous ? "Guest" : "Google"}
                        {memberIsAdmin ? " · Admin" : ""}
                      </span>
                    </div>
                    {memberIsAdmin && <Crown aria-label="Admin" />}
                  </div>
                );
              })}
            </section>
          </section>
        </div>
      )}

      {analyticsOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="about-modal analytics-modal">
            <div className="modal-header">
              <h2>Analytics</h2>
              <button className="icon-button" onClick={() => setAnalyticsOpen(false)} title="Close" type="button">
                <X aria-hidden="true" />
              </button>
            </div>
            <div className="analytics-grid">
              <div>
                <span>Current</span>
                <strong>{analytics.currentMemberCount}</strong>
              </div>
              <div>
                <span>People</span>
                <strong>{analytics.participantCount}</strong>
              </div>
              <div>
                <span>Songs</span>
                <strong>{analytics.songCount}</strong>
              </div>
              <div>
                <span>Reactions</span>
                <strong>{analytics.reactionTotal}</strong>
              </div>
              <div>
                <span>Comments</span>
                <strong>{analytics.commentTotal}</strong>
              </div>
              <div>
                <span>Top DJ</span>
                <strong>{analytics.topContributor?.name || "None"}</strong>
              </div>
            </div>
            <section className="analytics-section">
              <h3>People</h3>
              {analytics.people.length ? analytics.people.map((person) => (
                <div className="analytics-person" key={analyticsPersonKey(person.uid, person.name)}>
                  <div>
                    <strong>{person.name}</strong>
                    <span>{person.isCurrentMember ? "In room" : "Previously active"}</span>
                  </div>
                  <span>{person.songsAdded} songs</span>
                  <span>{person.reactionsGiven} reacts</span>
                  <span>{person.commentsMade} comments</span>
                </div>
              )) : <p className="muted">No activity yet.</p>}
            </section>
            <section className="analytics-section">
              <h3>Top Artists</h3>
              <div className="analytics-tags">
                {analytics.topArtists.length ? analytics.topArtists.map(([artist, count]) => (
                  <span key={artist}>{artist} · {count}</span>
                )) : <span>None yet</span>}
              </div>
            </section>
            <section className="analytics-section">
              <h3>Song Vibes</h3>
              <div className="analytics-tags">
                {analytics.topTitleWords.length ? analytics.topTitleWords.map(([word, count]) => (
                  <span key={word}>{word} · {count}</span>
                )) : <span>None yet</span>}
              </div>
            </section>
            {analytics.topReactedSong && (
              <section className="analytics-section">
                <h3>Most Reacted</h3>
                <p className="muted">{analytics.topReactedSong.artist || "YouTube"} · {analytics.topReactedSong.title}</p>
              </section>
            )}
            <button className="primary-action" onClick={shareAnalytics} type="button">
              <Share2 aria-hidden="true" />
              Share Analytics
            </button>
          </section>
        </div>
      )}


      {colorThemeOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="about-modal color-theme-modal">
            <div className="modal-header">
              <h2>Color themes</h2>
              <button className="icon-button" onClick={() => setColorThemeOpen(false)} title="Close">
                <X aria-hidden="true" />
              </button>
            </div>
            <p className="muted">Choose the app color style for this phone.</p>
            <div className="color-theme-grid">
              {COLOR_THEMES.map((item) => (
                <button
                  className={colorTheme === item.id ? "color-theme-option is-selected" : "color-theme-option"}
                  data-theme-choice={item.id}
                  key={item.id}
                  onClick={() => setColorTheme(item.id)}
                  type="button"
                >
                  <span className="theme-swatch" aria-hidden="true" />
                  <strong>{item.name}</strong>
                  <small>{item.note}</small>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {settingsOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="about-modal settings-modal">
            <div className="modal-header">
              <h2>Settings</h2>
              <button className="icon-button" onClick={() => setSettingsOpen(false)} title="Close">
                <X aria-hidden="true" />
              </button>
            </div>
            <div className="setting-row">
              <div>
                <strong>Cooldown</strong>
                <span>{cooldownEnabled ? `${cooldownMinutes} minutes between guest adds` : "Guests can add songs anytime"}</span>
              </div>
              <button
                className={cooldownEnabled ? "toggle-button is-on" : "toggle-button"}
                onClick={() => updateCooldownEnabled(!cooldownEnabled)}
                disabled={!canControlRoomSettings}
                type="button"
              >
                {cooldownEnabled ? "On" : "Off"}
              </button>
            </div>
            <div className="cooldown-controls">
              <button className="icon-button" onClick={() => updateCooldownMinutes(cooldownMinutes - 1)} disabled={!canControlRoomSettings || !cooldownEnabled || cooldownMinutes <= 1}>
                -
              </button>
              <input
                type="range"
                min="1"
                max="30"
                value={cooldownMinutes}
                onChange={(event) => updateCooldownMinutes(event.target.value)}
                disabled={!canControlRoomSettings || !cooldownEnabled}
              />
              <button className="icon-button" onClick={() => updateCooldownMinutes(cooldownMinutes + 1)} disabled={!canControlRoomSettings || !cooldownEnabled || cooldownMinutes >= 30}>
                +
              </button>
            </div>
            <div className="setting-row">
              <div>
                <strong>Crossfade</strong>
                <span>{crossfadeEnabled ? `Start next song ${crossfadeSeconds} seconds early` : "Next song starts after the current one ends"}</span>
              </div>
              <button
                className={crossfadeEnabled ? "toggle-button is-on" : "toggle-button"}
                onClick={() => updateCrossfadeEnabled(!crossfadeEnabled)}
                disabled={!canControlRoomSettings}
                type="button"
              >
                {crossfadeEnabled ? "On" : "Off"}
              </button>
            </div>
            <div className="cooldown-controls">
              <button className="icon-button" onClick={() => updateCrossfadeSeconds(crossfadeSeconds - 1)} disabled={!canControlRoomSettings || !crossfadeEnabled || crossfadeSeconds <= 1}>
                -
              </button>
              <input
                type="range"
                min="1"
                max="30"
                value={crossfadeSeconds}
                onChange={(event) => updateCrossfadeSeconds(event.target.value)}
                disabled={!canControlRoomSettings || !crossfadeEnabled}
              />
              <button className="icon-button" onClick={() => updateCrossfadeSeconds(crossfadeSeconds + 1)} disabled={!canControlRoomSettings || !crossfadeEnabled || crossfadeSeconds >= 30}>
                +
              </button>
            </div>
            <div className="setting-row">
              <div>
                <strong>Track notifications</strong>
                <span>{trackNoticeEnabled ? `Show now-playing bubble for ${trackNoticeSeconds} seconds` : "Now-playing bubble is off"}</span>
              </div>
              <button
                className={trackNoticeEnabled ? "toggle-button is-on" : "toggle-button"}
                onClick={() => updateTrackNoticeEnabled(!trackNoticeEnabled)}
                disabled={!canControlRoomSettings}
                type="button"
              >
                {trackNoticeEnabled ? "On" : "Off"}
              </button>
            </div>
            <div className="cooldown-controls">
              <button className="icon-button" onClick={() => updateTrackNoticeSeconds(trackNoticeSeconds - 1)} disabled={!canControlRoomSettings || !trackNoticeEnabled || trackNoticeSeconds <= 1}>
                -
              </button>
              <input
                type="range"
                min="1"
                max="30"
                value={trackNoticeSeconds}
                onChange={(event) => updateTrackNoticeSeconds(event.target.value)}
                disabled={!canControlRoomSettings || !trackNoticeEnabled}
              />
              <button className="icon-button" onClick={() => updateTrackNoticeSeconds(trackNoticeSeconds + 1)} disabled={!canControlRoomSettings || !trackNoticeEnabled || trackNoticeSeconds >= 30}>
                +
              </button>
            </div>
            <div className="setting-row">
              <div>
                <strong>Join notifications</strong>
                <span>{joinNoticeEnabled ? "Show when someone joins the party" : "Join bubbles are off"}</span>
              </div>
              <button
                className={joinNoticeEnabled ? "toggle-button is-on" : "toggle-button"}
                onClick={() => updateJoinNoticeEnabled(!joinNoticeEnabled)}
                disabled={!canControlRoomSettings}
                type="button"
              >
                {joinNoticeEnabled ? "On" : "Off"}
              </button>
            </div>
            {isAdmin && (
              <section className="people-panel settings-people">
                <h2>People</h2>
                {members.map((member) => {
                  const memberIsAdmin = isRoomAdminId(member.id);
                  const isCurrentUser = member.id === user.uid;
                  const isRenaming = renameMemberId === member.id;
                  return (
                    <div className="member-row" key={member.id}>
                      <UserRound aria-hidden="true" />
                      <div>
                        {isRenaming ? (
                          <form className="rename-member-form" onSubmit={(event) => { event.preventDefault(); renameMember(member); }}>
                            <input
                              value={renameDraft}
                              onChange={(event) => setRenameDraft(event.target.value.slice(0, 30))}
                              placeholder="Nickname"
                              maxLength={30}
                              autoFocus
                            />
                            <button className="mini-action" type="submit" disabled={!renameDraft.trim()}>
                              Save
                            </button>
                            <button
                              className="icon-button"
                              onClick={() => {
                                setRenameMemberId("");
                                setRenameDraft("");
                              }}
                              title="Cancel rename"
                              type="button"
                            >
                              <X aria-hidden="true" />
                            </button>
                          </form>
                        ) : (
                          <>
                            <strong>{member.isAnonymous === false && <GoogleBadge />}{member.name}{isCurrentUser ? " (You)" : ""}</strong>
                            <span>
                              {member.isAnonymous ? "Guest" : "Google"}
                              {memberIsAdmin ? " · Admin" : ""}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="member-actions">
                        {!isRenaming && (
                          <button
                            className="icon-button"
                            onClick={() => {
                              setRenameMemberId(member.id);
                              setRenameDraft(member.name || "");
                            }}
                            title="Rename nickname"
                            type="button"
                          >
                            <Pencil aria-hidden="true" />
                          </button>
                        )}
                        {memberIsAdmin ? (
                          <>
                            <Crown aria-label="Admin" />
                            {!isCurrentUser && (
                              <button className="icon-button" onClick={() => demoteMember(member)} title="Remove admin" type="button">
                                <Crown aria-hidden="true" />
                              </button>
                            )}
                          </>
                        ) : (
                          <button className="icon-button" onClick={() => promoteMember(member)} disabled={member.isAnonymous} title="Make admin" type="button">
                            <Crown aria-hidden="true" />
                          </button>
                        )}
                        {!isCurrentUser && (
                          <button className="icon-button danger" onClick={() => removeMember(member)} title="Remove from room">
                            <Trash2 aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </section>
            )}
            {!canControlRoomSettings && <p className="muted">Only admins can change room settings.</p>}
          </section>
        </div>
      )}

      {nicknameOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="about-modal nickname-modal">
            <div className="modal-header">
              <h2>Nickname</h2>
              <button className="icon-button" onClick={() => setNicknameOpen(false)} title="Close" type="button">
                <X aria-hidden="true" />
              </button>
            </div>
            <form className="nickname-edit-form" onSubmit={saveOwnNickname}>
              <input
                value={nickname}
                onChange={(event) => setNickname(event.target.value.slice(0, 30))}
                placeholder="Party nickname"
                maxLength={30}
                autoFocus
              />
              <button className="primary-action" type="submit" disabled={!nickname.trim()}>
                Save
              </button>
            </form>
          </section>
        </div>
      )}

      {(joinNotice || nowPlayingNotice) && (
        <div className="notice-stack">
          {joinNotice && (
            <div className="notice-bubble join-bubble" role="status" aria-live="polite">
              <div>
                <span>Party Guest</span>
                <strong>{joinNotice.name} has joined the party</strong>
              </div>
              <button className="mini-action" onClick={() => setJoinNotice(null)} type="button">
                OK
              </button>
            </div>
          )}
          {nowPlayingNotice && (
            <div className="notice-bubble now-playing-bubble" role="status" aria-live="polite">
              <div>
                <span>Now Playing</span>
                <strong>{nowPlayingNotice.artist} · {nowPlayingNotice.title}</strong>
                <p>Added by {nowPlayingNotice.addedBy}</p>
              </div>
              <button className="mini-action" onClick={() => setNowPlayingNotice(null)} type="button">
                OK
              </button>
            </div>
          )}
        </div>
      )}

      {toast && (
        <button className="toast" onClick={() => setToast("")}>
          {toast}
        </button>
      )}
    </main>
  );
}

function YouTubePlayer({
  song,
  onEnded,
  onCrossfade,
  onProgress,
  crossfadeEnabled,
  crossfadeSeconds,
  resumeSeconds = 0,
  resumeKey = "",
  playbackStartedAtMs = 0,
  volume = 100
}) {
  const containerId = useRef(`yt-player-${Math.random().toString(36).slice(2)}`);
  const playerRef = useRef(null);
  const playerTimerRef = useRef(null);
  const endedRef = useRef(onEnded);
  const crossfadeRef = useRef(onCrossfade);
  const progressRef = useRef(onProgress);
  const crossfadeTriggeredRef = useRef(false);
  const playbackOptionsRef = useRef({
    crossfadeEnabled,
    crossfadeSeconds,
    resumeSeconds,
    resumeKey,
    playbackStartedAtMs,
    volume
  });
  playbackOptionsRef.current = {
    crossfadeEnabled,
    crossfadeSeconds,
    resumeSeconds,
    resumeKey,
    playbackStartedAtMs,
    volume
  };

  useEffect(() => {
    endedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    crossfadeRef.current = onCrossfade;
  }, [onCrossfade]);

  useEffect(() => {
    progressRef.current = onProgress;
  }, [onProgress]);

  useEffect(() => {
    playerRef.current?.setVolume?.(volume);
  }, [volume]);

  useEffect(() => {
    let cancelled = false;

    async function loadPlayer() {
      if (!song?.videoId) return;
      await loadYouTubeIframeApi();
      if (cancelled) return;

      if (playerRef.current?.destroy) {
        playerRef.current.destroy();
      }
      if (playerTimerRef.current) {
        window.clearInterval(playerTimerRef.current);
      }
      crossfadeTriggeredRef.current = false;

      playerRef.current = new window.YT.Player(containerId.current, {
        videoId: song.videoId,
        playerVars: {
          autoplay: 1,
          controls: 1,
          rel: 0
        },
        events: {
          onReady: (event) => {
            event.target.setVolume?.(playbackOptionsRef.current.volume);
            const options = playbackOptionsRef.current;
            const savedResumeSeconds = readSavedResumeSeconds(options.resumeKey, options.playbackStartedAtMs);
            const nextResumeSeconds = Math.max(options.resumeSeconds, savedResumeSeconds);
            if (nextResumeSeconds > 2 && event.target.seekTo) {
              const duration = event.target.getDuration?.() || 0;
              const seekTo = duration > 0 ? Math.min(nextResumeSeconds, Math.max(0, duration - 2)) : nextResumeSeconds;
              event.target.seekTo(seekTo, true);
            }
            const duration = event.target.getDuration?.() || 0;
            const current = event.target.getCurrentTime?.() || 0;
            progressRef.current?.({
              currentSeconds: current,
              durationSeconds: duration,
              remainingSeconds: duration ? Math.max(0, duration - current) : 0
            });
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              event.target.setVolume?.(playbackOptionsRef.current.volume);
              if (playerTimerRef.current) {
                window.clearInterval(playerTimerRef.current);
              }
              playerTimerRef.current = window.setInterval(() => {
                if (!event.target.getCurrentTime) {
                  return;
                }
                const current = event.target.getCurrentTime();
                const options = playbackOptionsRef.current;
                saveResumeSeconds(options.resumeKey, options.playbackStartedAtMs, current);
                const duration = event.target.getDuration?.() || 0;
                const remaining = duration ? Math.max(0, duration - current) : 0;
                progressRef.current?.({
                  currentSeconds: current,
                  durationSeconds: duration,
                  remainingSeconds: remaining
                });
                if (!options.crossfadeEnabled || !options.crossfadeSeconds || !event.target.getDuration) {
                  return;
                }
                if (
                  options.crossfadeEnabled
                  && options.crossfadeSeconds
                  && duration
                  && remaining <= options.crossfadeSeconds
                  && !crossfadeTriggeredRef.current
                ) {
                  crossfadeTriggeredRef.current = true;
                  crossfadeRef.current?.();
                }
              }, 400);
            }
            if (event.data === window.YT.PlayerState.PAUSED && playerTimerRef.current) {
              window.clearInterval(playerTimerRef.current);
            }
            if (event.data === window.YT.PlayerState.ENDED) {
              if (playerTimerRef.current) {
                window.clearInterval(playerTimerRef.current);
              }
              progressRef.current?.({
                currentSeconds: 0,
                durationSeconds: 0,
                remainingSeconds: 0
              });
              endedRef.current?.();
            }
          }
        }
      });
    }

    loadPlayer();

    return () => {
      cancelled = true;
      if (playerTimerRef.current) {
        window.clearInterval(playerTimerRef.current);
      }
    };
  }, [song?.videoId]);

  if (!song?.videoId) {
    return (
      <div className="player-empty">
        <Music2 aria-hidden="true" />
      </div>
    );
  }

  return <div className="youtube-frame" id={containerId.current} />;
}

function formatDuration(seconds) {
  const totalSeconds = Math.max(0, Math.ceil(Number(seconds) || 0));
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function readSavedResumeSeconds(resumeKey, playbackStartedAtMs) {
  if (!resumeKey) return 0;
  try {
    const saved = JSON.parse(localStorage.getItem(resumeKey) || "{}");
    if (!saved?.seconds) return 0;
    if (playbackStartedAtMs && saved.playbackStartedAtMs && saved.playbackStartedAtMs !== playbackStartedAtMs) {
      return 0;
    }
    return Math.max(0, Number(saved.seconds) || 0);
  } catch {
    return 0;
  }
}

function saveResumeSeconds(resumeKey, playbackStartedAtMs, seconds) {
  if (!resumeKey || !Number.isFinite(seconds)) return;
  try {
    localStorage.setItem(resumeKey, JSON.stringify({
      playbackStartedAtMs,
      seconds: Math.max(0, seconds),
      savedAt: Date.now()
    }));
  } catch {
    // Local resume is best-effort; playback should continue without storage.
  }
}

function loadYouTubeIframeApi() {
  if (window.YT?.Player) return Promise.resolve();
  if (window.partyBeatsYouTubeApiPromise) return window.partyBeatsYouTubeApiPromise;

  window.partyBeatsYouTubeApiPromise = new Promise((resolve) => {
    const existing = document.querySelector("script[src='https://www.youtube.com/iframe_api']");
    window.onYouTubeIframeAPIReady = () => resolve();
    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    }
  });

  return window.partyBeatsYouTubeApiPromise;
}

function SignedOut({ nickname, setNickname, onGoogle }) {
  return (
    <div className="signed-out">
      <button className="primary-action" onClick={onGoogle}>
        <LogIn aria-hidden="true" />
        Continue with Google
      </button>
      <div className="nickname-row">
        <input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="Nickname" />
      </div>
    </div>
  );
}

function SignedIn({ user, nickname, setNickname, onSignOut }) {
  return (
    <div className="signed-in">
      <div>
        <span>{user.isAnonymous ? "Guest" : "Google"}</span>
        <strong>
          {!user.isAnonymous && <GoogleBadge />}
          {nickname || nicknameFor(user)}
        </strong>
      </div>
      {!user.isAnonymous && (
        <input
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          placeholder="Party nickname"
          maxLength={30}
        />
      )}
      <button className="icon-button" onClick={onSignOut} title="Sign out">
        <LogOut aria-hidden="true" />
      </button>
    </div>
  );
}

function GoogleBadge() {
  return (
    <span className="google-badge" aria-label="Google user" title="Google user">
      G
    </span>
  );
}

function AppIcon() {
  return <img className="app-icon" src={APP_ICON_URL} alt="" aria-hidden="true" />;
}

function SetupMissing() {
  return (
    <main className="setup-missing">
      <AppIcon />
      <h1>ROCK BeatsParty needs Firebase config</h1>
      <p>Copy .env.example to .env.local and fill in the values from your Firebase web app.</p>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
