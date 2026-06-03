import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Crown,
  DoorOpen,
  ExternalLink,
  Info,
  LogOut,
  MessageCircle,
  Moon,
  MoreVertical,
  Music2,
  Pencil,
  Play,
  Plus,
  QrCode,
  RotateCcw,
  Search,
  Share2,
  SlidersHorizontal,
  Square,
  Sun,
  SkipForward,
  Trash2,
  UserRound,
  UsersRound,
  Wand2,
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
const NON_ADMIN_MAX_SONG_SECONDS = 10 * 60;
const ROOM_INACTIVITY_MS = 48 * 60 * 60 * 1000;
const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const APP_VERSION = "2026.06.03.07";
const PLAYBACK_COMMAND_WINDOW_MS = 8000;
const APP_ICON_URL = `${import.meta.env.BASE_URL}partybeats-icon.png`;
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

function nicknameFor(user, fallback = "Guest") {
  return user?.displayName || user?.email?.split("@")[0] || fallback;
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

function roomJoinErrorMessage(error) {
  if (error?.code === "permission-denied") {
    return "Could not join this room. Check that Firestore rules are published and the room is open.";
  }
  if (error?.code === "not-found") {
    return "That room does not exist yet.";
  }
  if (error?.code === "unavailable") {
    return "Could not reach Firestore. Check your connection and try again.";
  }
  return error?.message || "Could not join the room. Try again.";
}

function roomListenerErrorMessage(error) {
  if (error?.code === "permission-denied") {
    return "Room access denied. Check Firestore rules or rejoin the room.";
  }
  return error?.message || "Room connection was lost.";
}

function youtubeWatchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function youtubeMusicSearchUrl(queryText) {
  const query = queryText.trim();
  return query
    ? `https://music.youtube.com/search?q=${encodeURIComponent(query)}`
    : "https://music.youtube.com/";
}

function cleanArtistName(value) {
  return decodeHtmlEntities(value || "")
    .replace(/\s*-\s*topic\b/gi, "")
    .replace(/\btopic\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function lyricsSearchUrl(song) {
  const track = playlistTrackDisplay(song);
  const artist = cleanArtistName(track.artist || song?.artist || "");
  const query = [
    artist,
    track.title || decodeHtmlEntities(song?.title || ""),
    "lyrics"
  ].filter(Boolean).join(" ");
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function youtubeThumb(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function extractYouTubeVideoId(value) {
  const rawValue = value.trim();
  if (!rawValue) return "";

  try {
    const url = new URL(rawValue);
    const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
    if (host === "youtu.be") {
      return url.pathname.split("/").filter(Boolean)[0] || "";
    }
    if (host === "youtube.com" || host === "music.youtube.com" || host === "youtube-nocookie.com") {
      const watchId = url.searchParams.get("v");
      if (watchId) return watchId;
      const parts = url.pathname.split("/").filter(Boolean);
      const idIndex = parts.findIndex((part) => ["shorts", "embed", "live"].includes(part));
      if (idIndex >= 0) return parts[idIndex + 1] || "";
    }
  } catch {
    const match = rawValue.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([A-Za-z0-9_-]{11})/);
    return match?.[1] || "";
  }

  return "";
}

function cleanYouTubeVideoId(videoId) {
  const match = String(videoId || "").match(/^[A-Za-z0-9_-]{11}$/);
  return match ? match[0] : "";
}

function decodeHtmlEntities(value) {
  const text = String(value || "");
  if (!/[&][#a-z0-9]+;/i.test(text)) return text;
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: "\""
  };
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    const key = entity.toLowerCase();
    if (key[0] === "#") {
      const isHex = key[1] === "x";
      const code = Number.parseInt(key.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return named[key] || match;
  });
}

function playlistTrackDisplay(song) {
  const rawTitle = decodeHtmlEntities(song?.title || "Untitled")
    .replace(/\s*\[[^\]]*\]\s*/g, " ")
    .replace(/\s*\([^)]*(official|video|audio|lyrics?|visualizer|hd|hq)[^)]*\)\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const separator = rawTitle.match(/\s[-–—]\s/);
  const fallbackArtist = cleanArtistName(song?.artist || "");
  if (!separator) return { artist: fallbackArtist, title: rawTitle };
  const artist = cleanArtistName(rawTitle.slice(0, separator.index));
  const title = rawTitle.slice(separator.index + separator[0].length).trim();
  return {
    artist: artist || fallbackArtist,
    title: title || rawTitle
  };
}

function parseIsoDurationSeconds(value) {
  const match = String(value || "").match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return (hours * 3600) + (minutes * 60) + seconds;
}

function formatDuration(seconds) {
  const totalSeconds = Number(seconds);
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = Math.floor(totalSeconds % 60);
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function formatDateTime(value) {
  if (!value) return "Never";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "Unknown";
  }
}

function nextQueuedSong(songs, currentId) {
  if (!songs.length || !currentId) return null;
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
    return localStorage.getItem("partybeats-theme") || "dark";
  } catch {
    return "dark";
  }
}

function roomExpiresAtDate() {
  return new Date(Date.now() + ROOM_INACTIVITY_MS);
}

function roomActivityUpdate() {
  return {
    lastActivityAt: serverTimestamp(),
    expiresAt: roomExpiresAtDate()
  };
}

function isRoomExpired(roomData) {
  const expiresAtMs = roomData?.expiresAt?.toMillis?.() || 0;
  return Boolean(expiresAtMs && expiresAtMs <= Date.now());
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
  const [searchMode, setSearchMode] = useState("internal");
  const [searchQuery, setSearchQuery] = useState("");
  const [youtubeLink, setYoutubeLink] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [addingSongKey, setAddingSongKey] = useState("");
  const [recentlyAddedSongId, setRecentlyAddedSongId] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [roomPanelOpen, setRoomPanelOpen] = useState(false);
  const [roomPanelTab, setRoomPanelTab] = useState("room");
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [externalTutorialOpen, setExternalTutorialOpen] = useState(false);
  const [selectedSongId, setSelectedSongId] = useState("");
  const [emojiSongId, setEmojiSongId] = useState("");
  const [messageSongId, setMessageSongId] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [restoreRoomId, setRestoreRoomId] = useState("");
  const [renameMemberId, setRenameMemberId] = useState("");
  const [renameDraft, setRenameDraft] = useState("");
  const [selfRenameOpen, setSelfRenameOpen] = useState(false);
  const [selfRenameDraft, setSelfRenameDraft] = useState("");
  const [nowPlayingNotice, setNowPlayingNotice] = useState(null);
  const [joinNotice, setJoinNotice] = useState(null);
  const [noticeBaselineReady, setNoticeBaselineReady] = useState(false);
  const [effectivePlaybackSettings, setEffectivePlaybackSettings] = useState({
    songId: null,
    crossfadeEnabled: false,
    crossfadeSeconds: DEFAULT_CROSSFADE_SECONDS
  });
  const [theme, setTheme] = useState(savedTheme);
  const songListRef = useRef(null);
  const playerCardRef = useRef(null);
  const lastPopoverActionRef = useRef({ key: "", at: 0 });
  const previousNowPlayingId = useRef(undefined);
  const previousMemberIds = useRef(undefined);
  const noticeRoomId = useRef("");
  const lastPlayedSongId = useRef("");
  const [playerFullscreen, setPlayerFullscreen] = useState(false);
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
      setNickname(nicknameFor(nextUser, ""));
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
          setNickname(nicknameFor(result.user, ""));
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
    const handleFullscreenChange = () => {
      setPlayerFullscreen(document.fullscreenElement === playerCardRef.current);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

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

    const handleRoomAccessLost = (error) => {
      setToast(error ? roomListenerErrorMessage(error) : "You were removed from this room.");
      clearRoomState();
    };

    const unsubRoom = onSnapshot(roomRef, (snap) => {
      const nextRoom = snap.exists() ? { id: snap.id, ...snap.data() } : null;
      if (nextRoom?.closed) {
        setToast("Room closed because the last admin left.");
        clearRoomState();
        return;
      }
      if (isRoomExpired(nextRoom)) {
        setToast("Room expired after 48 hours of inactivity.");
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
    const expiresAtMs = room?.expiresAt?.toMillis?.() || 0;
    if (!activeRoomId || !expiresAtMs) return undefined;
    const delay = expiresAtMs - Date.now();
    if (delay <= 0) {
      setToast("Room expired after 48 hours of inactivity.");
      clearRoomState();
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setToast("Room expired after 48 hours of inactivity.");
      clearRoomState();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [activeRoomId, room?.expiresAt]);

  useEffect(() => {
    if (!activeRoomId || !user?.uid) return;
    const selfMember = members.find((member) => member.id === user.uid);
    const roomNickname = (selfMember?.name || "").trim();
    if (roomNickname && roomNickname !== nickname) {
      setNickname(roomNickname);
    }
  }, [activeRoomId, members, user?.uid, nickname]);

  useEffect(() => {
    noticeRoomId.current = activeRoomId;
    previousNowPlayingId.current = undefined;
    previousMemberIds.current = undefined;
    setNowPlayingNotice(null);
    setJoinNotice(null);
    setNoticeBaselineReady(false);
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
  const cooldownEnabled = room?.cooldownEnabled === true;
  const cooldownMinutes = Math.min(
    30,
    Math.max(1, Number(room?.cooldownMinutes) || Math.round((Number(room?.cooldownMs) || DEFAULT_COOLDOWN_MS) / 60000))
  );
  const cooldownMs = cooldownMinutes * 60 * 1000;
  const crossfadeEnabled = room?.crossfadeEnabled === true;
  const crossfadeSeconds = Math.min(30, Math.max(1, Number(room?.crossfadeSeconds) || DEFAULT_CROSSFADE_SECONDS));
  const trackNoticeEnabled = room?.trackNoticeEnabled !== false;
  const trackNoticeSeconds = Math.min(30, Math.max(1, Number(room?.trackNoticeSeconds) || DEFAULT_TRACK_NOTICE_SECONDS));
  const joinNoticeEnabled = room?.joinNoticeEnabled !== false;
  const memberRecord = members.find((member) => member.id === user?.uid);
  const cooldownUntil = cooldownEnabled && memberRecord?.lastAddedAt?.toMillis ? memberRecord.lastAddedAt.toMillis() + cooldownMs : 0;
  const cooldownRemaining = Math.max(0, cooldownUntil - Date.now());
  const nowPlayingSong = songs.find((song) => song.id === room?.nowPlayingId) || null;
  const nowPlayingDisplay = nowPlayingSong ? playlistTrackDisplay(nowPlayingSong) : null;
  const roomNeedsFirstTrack = songs.length === 0 && !room?.nowPlayingId;
  const canAddSong = isAdmin || roomNeedsFirstTrack || cooldownRemaining === 0;
  const nowPlayingIndex = songs.findIndex((song) => song.id === room?.nowPlayingId);
  const replaySong = nowPlayingIndex > 0
    ? songs[nowPlayingIndex - 1]
    : songs.find((song) => song.id === lastPlayedSongId.current) || null;
  const playbackState = {
    songId: room?.playbackSongId || room?.nowPlayingId || null,
    seconds: Math.max(0, Number(room?.playbackSeconds) || 0),
    state: room?.playbackState || "playing",
    updatedAt: room?.playbackUpdatedAt?.toMillis?.() || 0,
    command: room?.playbackCommand || "",
    commandId: room?.playbackCommandId || "",
    commandAt: room?.playbackCommandAt?.toMillis?.() || 0
  };
  const livePlaybackSeconds = playbackState.state === "playing" && playbackState.updatedAt
    ? playbackState.seconds + Math.max(0, (Date.now() - playbackState.updatedAt) / 1000)
    : playbackState.seconds;
  const playbackPositionLabel = formatDuration(livePlaybackSeconds);
  const playbackStatusText = !nowPlayingSong
    ? "Stopped. Add or select a track to start the room."
    : playbackState.state === "paused"
      ? `Paused at ${playbackPositionLabel || "0:00"}. Tap play on the Active DJ player to resume.`
      : playbackState.state === "stopped"
        ? "Stopped. The next track starts when the Active DJ chooses one."
        : `Playing${playbackPositionLabel ? ` near ${playbackPositionLabel}` : ""}.`;
  const lastAddedLabel = memberRecord?.lastAddedAt?.toMillis
    ? formatDateTime(memberRecord.lastAddedAt.toMillis())
    : "No add yet";
  const activeNickname = nickname.trim() || nicknameFor(user, "Guest");
  const memberById = (uid) => members.find((member) => member.id === uid);
  const activeDjStatus = isActiveDj ? "This device is the Active DJ" : `Active DJ: ${activeDjName}`;
  const totalReactions = songs.reduce((total, song) => total + Object.keys(song.emojiByUser || {}).length, 0);
  const totalMessages = songs.reduce((total, song) => total + (song.messages || []).length, 0);
  const googleMemberCount = members.filter((member) => member.isAnonymous === false).length;
  const guestMemberCount = Math.max(0, members.length - googleMemberCount);
  const analyticsPeople = members
    .map((member) => {
      const added = songs.filter((song) => song.addedByUid === member.id).length;
      const reactions = songs.reduce((total, song) => total + (song.emojiByUser?.[member.id] ? 1 : 0), 0);
      const messages = songs.reduce(
        (total, song) => total + (song.messages || []).filter((message) => message.uid === member.id).length,
        0
      );
      return { ...member, added, reactions, messages, total: added + reactions + messages };
    })
    .sort((a, b) => b.total - a.total || b.added - a.added || (a.name || "").localeCompare(b.name || ""));
  const mostReactedSongs = songs
    .map((song) => ({
      ...song,
      display: playlistTrackDisplay(song),
      reactionCount: Object.keys(song.emojiByUser || {}).length,
      messageCount: (song.messages || []).length
    }))
    .filter((song) => song.reactionCount > 0 || song.messageCount > 0)
    .sort((a, b) => (b.reactionCount + b.messageCount) - (a.reactionCount + a.messageCount))
    .slice(0, 5);

  async function touchRoomActivity(roomOverride = activeRoomId) {
    if (!roomOverride || !user) return;
    await updateDoc(doc(db, "rooms", roomOverride), roomActivityUpdate()).catch(() => undefined);
  }

  useEffect(() => {
    setEffectivePlaybackSettings((current) => {
      const songId = nowPlayingSong?.id || null;
      if (songId) {
        lastPlayedSongId.current = songId;
      }
      if (current.songId === songId) return current;
      return {
        songId,
        crossfadeEnabled,
        crossfadeSeconds
      };
    });
  }, [nowPlayingSong?.id, crossfadeEnabled, crossfadeSeconds]);

  useEffect(() => {
    if (!activeRoomId || noticeBaselineReady || !room || members.length === 0) return;
    if (room.id !== activeRoomId) return;
    if (room.nowPlayingId && !songs.some((song) => song.id === room.nowPlayingId)) return;

    previousMemberIds.current = new Set(members.map((member) => member.id));
    previousNowPlayingId.current = room.nowPlayingId || null;
    setJoinNotice(null);
    setNowPlayingNotice(null);
    setNoticeBaselineReady(true);
  }, [activeRoomId, noticeBaselineReady, room?.id, room?.nowPlayingId, members, songs]);

  useEffect(() => {
    if (!activeRoomId) {
      previousNowPlayingId.current = undefined;
      setNowPlayingNotice(null);
      return undefined;
    }
    if (!noticeBaselineReady) return undefined;
    if (room?.nowPlayingId && !nowPlayingSong?.id) {
      return undefined;
    }
    if (!nowPlayingSong?.id) {
      previousNowPlayingId.current = null;
      setNowPlayingNotice(null);
      return undefined;
    }
    if (previousNowPlayingId.current === undefined) {
      previousNowPlayingId.current = nowPlayingSong.id;
      return undefined;
    }
    if (previousNowPlayingId.current === nowPlayingSong.id) {
      return undefined;
    }

    previousNowPlayingId.current = nowPlayingSong.id;
    if (!trackNoticeEnabled) {
      setNowPlayingNotice(null);
      return undefined;
    }
    const uploader = memberById(nowPlayingSong.addedByUid);
    setNowPlayingNotice({
      id: nowPlayingSong.id,
      title: decodeHtmlEntities(nowPlayingSong.title || "Untitled"),
      artist: decodeHtmlEntities(nowPlayingSong.artist || "YouTube"),
      addedBy: uploader?.name || nowPlayingSong.addedByName || "Guest"
    });
    const timer = window.setTimeout(() => setNowPlayingNotice(null), trackNoticeSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [activeRoomId, noticeBaselineReady, nowPlayingSong?.id]);

  useEffect(() => {
    if (!room?.nowPlayingId || !songListRef.current) return;
    const row = songListRef.current.querySelector(`[data-song-id="${room.nowPlayingId}"]`);
    row?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [room?.nowPlayingId]);

  useEffect(() => {
    if (!activeRoomId) {
      previousMemberIds.current = undefined;
      setJoinNotice(null);
      return undefined;
    }
    if (!noticeBaselineReady) return undefined;

    const currentIds = new Set(members.map((member) => member.id));
    if (previousMemberIds.current === undefined) {
      if (members.length === 0) return undefined;
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
  }, [activeRoomId, noticeBaselineReady, members, joinNoticeEnabled]);

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
        setNickname(nicknameFor(result.user, ""));
      }
    } catch (error) {
      if (["auth/popup-blocked", "auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(error.code)) {
        await signInWithRedirect(auth, provider);
        return;
      }
      setToast(authErrorMessage(error));
    }
  }

  async function signInNickname() {
    if (!firebaseReady) {
      setToast("Add your Firebase config first.");
      return;
    }
    const cleanName = nickname.trim();
    if (cleanName.length < 2) {
      setToast("Choose a nickname with at least 2 characters.");
      return;
    }
    try {
      const credential = await signInAnonymously(auth);
      await updateProfile(credential.user, { displayName: cleanName });
      setUser(credential.user);
      setNickname(cleanName);
    } catch (error) {
      setToast(authErrorMessage(error));
    }
  }

  async function ensureUserForJoin() {
    if (user) return user;
    if (!firebaseReady) {
      setToast("Add your Firebase config first.");
      return null;
    }
    const cleanName = nickname.trim();
    if (cleanName.length < 2) {
      setToast("Choose a nickname with at least 2 characters.");
      return null;
    }
    try {
      const credential = await signInAnonymously(auth);
      await updateProfile(credential.user, { displayName: cleanName });
      setUser(credential.user);
      setNickname(cleanName);
      return credential.user;
    } catch (error) {
      setToast(authErrorMessage(error));
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
      ...roomActivityUpdate(),
      closed: false,
      cooldownEnabled: false,
      cooldownMinutes: 3,
      cooldownMs: DEFAULT_COOLDOWN_MS,
      crossfadeEnabled: false,
      crossfadeSeconds: DEFAULT_CROSSFADE_SECONDS,
      trackNoticeEnabled: true,
      trackNoticeSeconds: DEFAULT_TRACK_NOTICE_SECONDS,
      joinNoticeEnabled: true,
      nowPlayingId: null
    });
    await joinRoomById(nextId);
  }

  async function joinRoomById(rawId = roomId, options = {}) {
    const nextRoomId = normalizeRoomId(rawId);
    if (!/^[A-Z]{4}\d{3}$/.test(nextRoomId)) {
      if (!options.silent) setToast("Room IDs look like VIBE123.");
      return;
    }
    const joiningUser = user || await ensureUserForJoin();
    if (!joiningUser) {
      return;
    }

    try {
      const roomSnap = await getDoc(doc(db, "rooms", nextRoomId));
      if (!roomSnap.exists()) {
        if (!options.silent) setToast("That room does not exist yet.");
        return;
      }
      if (roomSnap.data().closed) {
        if (!options.silent) setToast("That room has been closed.");
        return;
      }
      if (isRoomExpired(roomSnap.data())) {
        if (!options.silent) setToast("That room expired after 48 hours of inactivity.");
        return;
      }

      const memberRef = doc(db, "rooms", nextRoomId, "members", joiningUser.uid);
      let memberSnap = null;
      try {
        memberSnap = await getDoc(memberRef);
      } catch (error) {
        if (error?.code !== "permission-denied") throw error;
      }
      const savedMemberName = memberSnap?.exists() ? (memberSnap.data().name || "").trim() : "";
      const roomNickname = (savedMemberName || activeNickname).slice(0, 30);
      await setDoc(
        memberRef,
        {
          uid: joiningUser.uid,
          isAnonymous: joiningUser.isAnonymous,
          ...(memberSnap?.exists() ? {} : { name: roomNickname }),
          ...(memberSnap?.exists() ? {} : { joinedAt: serverTimestamp() })
        },
        { merge: true }
      );
      await updateDoc(doc(db, "rooms", nextRoomId), roomActivityUpdate()).catch(() => undefined);
      setNickname(roomNickname);
      setActiveRoomId(nextRoomId);
      setRoomId(nextRoomId);
      window.history.replaceState({}, "", `${window.location.pathname}?room=${nextRoomId}`);
    } catch (error) {
      if (!options.silent) setToast(roomJoinErrorMessage(error));
    }
  }

  async function addSong(event, selectedVideo = null) {
    event?.preventDefault();
    if (!user || !activeRoomId) return;

    const videoId = selectedVideo?.videoId;
    const addKey = `${activeRoomId}:${videoId || "none"}`;
    if (!videoId) {
      setToast("Choose a YouTube search result.");
      return;
    }
    if (addingSongKey === addKey) return;
    if (!canAddSong) {
      setToast(cooldownRemaining > 0
        ? `Cooldown active: ${Math.ceil(cooldownRemaining / 1000)}s left.`
        : "Song cooldown is on.");
      return;
    }

    setAddingSongKey(addKey);
    let durationSeconds = Number(selectedVideo?.durationSeconds) || null;
    if (!durationSeconds && YOUTUBE_API_KEY) {
      durationSeconds = await fetchYouTubeDurationSeconds(videoId);
    }
    if (!isAdmin && !durationSeconds) {
      setToast("Could not verify song length. Ask an admin to add this track.");
      setAddingSongKey("");
      return;
    }
    if (!isAdmin && durationSeconds > NON_ADMIN_MAX_SONG_SECONDS) {
      setToast("Only admins can add songs longer than 10 minutes.");
      setAddingSongKey("");
      return;
    }

    const title = decodeHtmlEntities(selectedVideo?.title || "YouTube track");
    const channelTitle = decodeHtmlEntities(selectedVideo?.channelTitle || "YouTube");
    const thumbnail = selectedVideo?.thumbnail || youtubeThumb(videoId);
    const nextPosition = songs.reduce((max, song) => Math.max(max, Number(song.position) || 0), 0) + 1;
    const songRef = doc(collection(db, "rooms", activeRoomId, "songs"));
    const batch = writeBatch(db);
    batch.set(songRef, {
      title,
      artist: channelTitle,
      link: youtubeWatchUrl(videoId),
      provider: "youtube",
      videoId,
      thumbnail,
      durationSeconds: durationSeconds || null,
      addedByUid: user.uid,
      addedByName: activeNickname,
      addedByIsAnonymous: user.isAnonymous,
      position: nextPosition,
      emojiByUser: {},
      messages: [],
      createdAt: serverTimestamp()
    });
    if (!nowPlayingSong) {
      const roomUpdate = { nowPlayingId: songRef.id };
      if (isActiveDj) {
        roomUpdate.playbackSongId = songRef.id;
        roomUpdate.playbackSeconds = 0;
        roomUpdate.playbackState = "playing";
        roomUpdate.playbackUpdatedAt = serverTimestamp();
        roomUpdate.playbackUpdatedBy = user.uid;
      }
      batch.update(doc(db, "rooms", activeRoomId), roomUpdate);
    }
    batch.set(doc(db, "rooms", activeRoomId, "members", user.uid), { lastAddedAt: serverTimestamp() }, { merge: true });
    try {
      await batch.commit();
      await touchRoomActivity();
    } catch (error) {
      setToast(error.code === "permission-denied"
        ? "Could not add that song. Check cooldown, song length, or room permissions."
        : "Could not add that song. Try again.");
      setAddingSongKey("");
      return;
    }
    setRecentlyAddedSongId(songRef.id);
    window.setTimeout(() => {
      setRecentlyAddedSongId((current) => current === songRef.id ? "" : current);
    }, 2600);
    setToast(!nowPlayingSong ? `Now playing: ${title}` : `Added to queue: ${title}`);
    setAddingSongKey("");
    setSearchResults([]);
    setYoutubeLink("");
    setAddSheetOpen(false);
  }

  async function fetchYouTubeDurationSeconds(videoId) {
    if (!YOUTUBE_API_KEY || !videoId) return null;
    try {
      const params = new URLSearchParams({
        part: "contentDetails",
        id: videoId,
        key: YOUTUBE_API_KEY
      });
      const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "YouTube duration lookup failed.");
      return parseIsoDurationSeconds(data.items?.[0]?.contentDetails?.duration);
    } catch {
      return null;
    }
  }

  async function fetchYouTubeDurations(videoIds) {
    const cleanIds = [...new Set((videoIds || []).map(cleanYouTubeVideoId).filter(Boolean))];
    if (!YOUTUBE_API_KEY || cleanIds.length === 0) return {};
    try {
      const params = new URLSearchParams({
        part: "contentDetails",
        id: cleanIds.join(","),
        key: YOUTUBE_API_KEY
      });
      const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "YouTube duration lookup failed.");
      return (data.items || []).reduce((durations, item) => {
        durations[item.id] = parseIsoDurationSeconds(item.contentDetails?.duration);
        return durations;
      }, {});
    } catch {
      return {};
    }
  }

  async function fetchYouTubeLinkDetails(videoId) {
    try {
      const url = youtubeWatchUrl(videoId);
      const response = await fetch(`https://www.youtube.com/oembed?${new URLSearchParams({ url, format: "json" }).toString()}`);
      if (!response.ok) throw new Error("YouTube details unavailable.");
      const data = await response.json();
      return {
        videoId,
        title: decodeHtmlEntities(data.title || "YouTube track"),
        channelTitle: decodeHtmlEntities(data.author_name || "YouTube"),
        thumbnail: data.thumbnail_url || youtubeThumb(videoId)
      };
    } catch {
      return {
        videoId,
        title: "YouTube track",
        channelTitle: "YouTube",
        thumbnail: youtubeThumb(videoId)
      };
    }
  }

  async function addSongFromLink(event) {
    event.preventDefault();
    const videoId = cleanYouTubeVideoId(extractYouTubeVideoId(youtubeLink));
    if (!videoId) {
      setToast("Paste a valid YouTube or YouTube Music song link.");
      return;
    }
    const selectedVideo = await fetchYouTubeLinkDetails(videoId);
    await addSong(null, selectedVideo);
  }

  function openExternalYouTubeMusicSearch() {
    window.open(youtubeMusicSearchUrl(searchQuery), "_blank", "noopener,noreferrer");
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
      const nextResults = (data.items || []).map((item) => ({
        videoId: item.id.videoId,
        title: decodeHtmlEntities(item.snippet.title),
        channelTitle: decodeHtmlEntities(item.snippet.channelTitle),
        thumbnail: item.snippet.thumbnails?.medium?.url || youtubeThumb(item.id.videoId),
        durationSeconds: null
      }));
      const durations = await fetchYouTubeDurations(nextResults.map((result) => result.videoId));
      const playableResults = nextResults
        .map((result) => ({
          ...result,
          durationSeconds: durations[result.videoId] || null
        }))
        .filter((result) => Number(result.durationSeconds) > 0 && Number(result.durationSeconds) <= NON_ADMIN_MAX_SONG_SECONDS);
      setSearchResults(playableResults);
    } catch (error) {
      setToast(error.message || "YouTube search failed.");
    } finally {
      setSearching(false);
    }
  }

  async function removeSong(songId) {
    if (!isAdmin) return;
    await deleteDoc(doc(db, "rooms", activeRoomId, "songs", songId));
    await touchRoomActivity();
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
      playbackSongId: null,
      playbackSeconds: 0,
      playbackState: "stopped",
      playbackUpdatedAt: serverTimestamp(),
      playbackUpdatedBy: user.uid,
      ...roomActivityUpdate()
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
    await touchRoomActivity();
  }

  async function setNowPlaying(songId) {
    if (!isActiveDj) {
      setToast("Only the Active DJ can control playback.");
      return;
    }
    await updateDoc(doc(db, "rooms", activeRoomId), {
      nowPlayingId: songId,
      playbackSongId: songId,
      playbackSeconds: 0,
      playbackState: "playing",
      playbackUpdatedAt: serverTimestamp(),
      playbackUpdatedBy: user.uid,
      ...roomActivityUpdate()
    });
  }

  async function syncPlaybackState({ songId, seconds, state }) {
    if (!isActiveDj || !activeRoomId || !user || !songId || songId !== room?.nowPlayingId) return;
    await updateDoc(doc(db, "rooms", activeRoomId), {
      playbackSongId: songId,
      playbackSeconds: Math.max(0, Math.floor(Number(seconds) || 0)),
      playbackState: state,
      playbackUpdatedAt: serverTimestamp(),
      playbackUpdatedBy: user.uid
    }).catch(() => undefined);
  }

  async function togglePlayerFullscreen() {
    if (!playerCardRef.current) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      await playerCardRef.current.requestFullscreen();
    } catch {
      setToast("Fullscreen was blocked by the browser. Try the video fullscreen button.");
    }
  }

  async function takeOverDj() {
    if (!isAdmin || !activeRoomId || !user) return;
    await updateDoc(doc(db, "rooms", activeRoomId), {
      activeDjUid: user.uid,
      activeDjName: activeNickname,
      activeDjAt: serverTimestamp(),
      ...roomActivityUpdate()
    });
    setToast("You are now the Active DJ.");
  }

  async function promoteMember(member) {
    if (!isAdmin || !member || member.isAnonymous) return;
    await updateDoc(doc(db, "rooms", activeRoomId), {
      [`adminUids.${user.uid}`]: true,
      [`adminUids.${member.id}`]: true,
      ...roomActivityUpdate()
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

    await updateDoc(doc(db, "rooms", activeRoomId), { ...roomUpdate, ...roomActivityUpdate() });
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
      batch.update(doc(db, "rooms", activeRoomId), { ...roomUpdate, ...roomActivityUpdate() });
    }
    batch.delete(doc(db, "rooms", activeRoomId, "members", member.id));
    await batch.commit();
    await touchRoomActivity();
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
      await updateDoc(doc(db, "rooms", activeRoomId), { activeDjName: nextName, ...roomActivityUpdate() });
    }
    if (member.id === user.uid) {
      setNickname(nextName);
    }
    setRenameMemberId("");
    setRenameDraft("");
    setSelfRenameOpen(false);
    setSelfRenameDraft("");
    setToast(`${member.name || "Member"} is now ${nextName}.`);
    await touchRoomActivity();
  }

  function openSelfRename() {
    setSelfRenameDraft(activeNickname);
    setSelfRenameOpen(true);
  }

  async function saveSelfRename(event) {
    event.preventDefault();
    const nextName = selfRenameDraft.trim().slice(0, 30);
    if (!user || !activeRoomId || !nextName) return;
    if (hasProfanity(nextName)) {
      setToast("Nickname blocked for profanity.");
      return;
    }

    const roomUpdate = {};
    if (room?.adminUid === user.uid) {
      roomUpdate.adminName = nextName;
    }
    if (room?.activeDjUid === user.uid) {
      roomUpdate.activeDjName = nextName;
    }

    const batch = writeBatch(db);
    batch.update(doc(db, "rooms", activeRoomId, "members", user.uid), { name: nextName });
    if (Object.keys(roomUpdate).length > 0) {
      batch.update(doc(db, "rooms", activeRoomId), { ...roomUpdate, ...roomActivityUpdate() });
    }
    await batch.commit();
    setNickname(nextName);
    setSelfRenameOpen(false);
    setSelfRenameDraft("");
    setToast("Nickname updated.");
    await touchRoomActivity();
  }

  async function playNextSong() {
    if (!isActiveDj || !activeRoomId) {
      setToast("Only the Active DJ can control playback.");
      return;
    }
    const nextSong = nextQueuedSong(songs, room?.nowPlayingId);
    if (nextSong) {
      await updateDoc(doc(db, "rooms", activeRoomId), {
        nowPlayingId: nextSong.id,
        playbackSongId: nextSong.id,
        playbackSeconds: 0,
        playbackState: "playing",
        playbackUpdatedAt: serverTimestamp(),
        playbackUpdatedBy: user.uid,
        ...roomActivityUpdate()
      });
      return;
    }

    await updateDoc(doc(db, "rooms", activeRoomId), {
      nowPlayingId: null,
      playbackSongId: null,
      playbackSeconds: 0,
      playbackState: "stopped",
      playbackUpdatedAt: serverTimestamp(),
      playbackUpdatedBy: user.uid,
      ...roomActivityUpdate()
    });
  }

  async function stopPlayback() {
    if (!isActiveDj || !activeRoomId) {
      setToast("Only the Active DJ can control playback.");
      return;
    }
    if (room?.nowPlayingId) {
      lastPlayedSongId.current = room.nowPlayingId;
    }
    await updateDoc(doc(db, "rooms", activeRoomId), {
      nowPlayingId: null,
      playbackSongId: null,
      playbackSeconds: 0,
      playbackState: "stopped",
      playbackUpdatedAt: serverTimestamp(),
      playbackUpdatedBy: user.uid,
      ...roomActivityUpdate()
    });
    setToast("Playback stopped.");
  }

  async function restartTrack() {
    if (!isActiveDj || !activeRoomId || !room?.nowPlayingId) {
      setToast("Choose a track to restart.");
      return;
    }
    await updateDoc(doc(db, "rooms", activeRoomId), {
      playbackSongId: room.nowPlayingId,
      playbackSeconds: 0,
      playbackState: "playing",
      playbackUpdatedAt: serverTimestamp(),
      playbackCommand: "restart",
      playbackCommandId: `${user.uid}-${Date.now()}`,
      playbackCommandAt: serverTimestamp(),
      playbackUpdatedBy: user.uid,
      ...roomActivityUpdate()
    });
    setToast("Track restarted.");
  }

  async function replayLastSong() {
    if (!isActiveDj || !activeRoomId || !replaySong?.id) {
      setToast("No previous track to replay.");
      return;
    }
    await updateDoc(doc(db, "rooms", activeRoomId), {
      nowPlayingId: replaySong.id,
      playbackSongId: replaySong.id,
      playbackSeconds: 0,
      playbackState: "playing",
      playbackUpdatedAt: serverTimestamp(),
      playbackUpdatedBy: user.uid,
      ...roomActivityUpdate()
    });
    setToast(`Replaying: ${decodeHtmlEntities(replaySong.title || "track")}`);
  }

  async function reactToSong(song, emoji) {
    if (!user || !activeRoomId) return;
    const songRef = doc(db, "rooms", activeRoomId, "songs", song.id);
    const path = `emojiByUser.${user.uid}`;
    try {
      if (song.emojiByUser?.[user.uid] === emoji) {
        await updateDoc(songRef, { [path]: deleteField() });
        await touchRoomActivity();
        return;
      }
      await updateDoc(songRef, { [path]: emoji });
      await touchRoomActivity();
    } catch {
      setToast("Could not save that reaction. Try again.");
    }
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
    try {
      await updateDoc(doc(db, "rooms", activeRoomId, "songs", song.id), {
        messages: nextMessages
      });
      await touchRoomActivity();
      setMessageDraft("");
      setMessageSongId("");
      setEmojiSongId("");
    } catch {
      setToast("Could not send that message. Try again.");
    }
  }

  function runPopoverAction(key, action) {
    const now = Date.now();
    if (lastPopoverActionRef.current.key === key && now - lastPopoverActionRef.current.at < 700) return;
    lastPopoverActionRef.current = { key, at: now };
    action();
  }

  function popoverPressProps(key, action) {
    return {
      onPointerDown: (event) => {
        event.preventDefault();
        event.stopPropagation();
      },
      onPointerUp: (event) => {
        event.preventDefault();
        event.stopPropagation();
        runPopoverAction(key, action);
      },
      onClick: (event) => {
        event.preventDefault();
        event.stopPropagation();
        runPopoverAction(key, action);
      }
    };
  }

  function clearRoomState() {
    setActiveRoomId("");
    setRoom(null);
    setSongs([]);
    setMembers([]);
    setMenuOpen(false);
    setRoomPanelOpen(false);
    setRoomPanelTab("room");
    setAddSheetOpen(false);
    setAddingSongKey("");
    setRecentlyAddedSongId("");
    setSelectedSongId("");
    setEmojiSongId("");
    setMessageSongId("");
    setMessageDraft("");
    setRenameMemberId("");
    setRenameDraft("");
    setSelfRenameOpen(false);
    setSelfRenameDraft("");
    setNowPlayingNotice(null);
    setJoinNotice(null);
    previousMemberIds.current = undefined;
    previousNowPlayingId.current = undefined;
    noticeRoomId.current = "";
    setNoticeBaselineReady(false);
    setEffectivePlaybackSettings({
      songId: null,
      crossfadeEnabled: false,
      crossfadeSeconds: DEFAULT_CROSSFADE_SECONDS
    });
    setRestoreRoomId("");
    window.history.replaceState({}, "", window.location.pathname);
  }

  async function updateCooldownEnabled(enabled) {
    if (!isAdmin || !activeRoomId) return;
    await updateDoc(doc(db, "rooms", activeRoomId), { cooldownEnabled: enabled, ...roomActivityUpdate() });
  }

  async function updateCrossfadeEnabled(enabled) {
    if (!isAdmin || !activeRoomId) return;
    await updateDoc(doc(db, "rooms", activeRoomId), { crossfadeEnabled: enabled, ...roomActivityUpdate() });
  }

  async function updateTrackNoticeEnabled(enabled) {
    if (!isAdmin || !activeRoomId) return;
    await updateDoc(doc(db, "rooms", activeRoomId), { trackNoticeEnabled: enabled, ...roomActivityUpdate() });
  }

  async function updateJoinNoticeEnabled(enabled) {
    if (!isAdmin || !activeRoomId) return;
    await updateDoc(doc(db, "rooms", activeRoomId), { joinNoticeEnabled: enabled, ...roomActivityUpdate() });
  }

  async function leaveRoom() {
    const leavingRoomId = activeRoomId;
    const leavingUser = user;

    if (leavingRoomId && leavingUser) {
      const batch = writeBatch(db);
      if (isAdmin) {
        const remainingAdmins = members.filter((member) => member.id !== leavingUser.uid && isRoomAdminId(member.id));
        if (remainingAdmins.length === 0) {
          batch.update(doc(db, "rooms", leavingRoomId), {
            closed: true,
            closedAt: serverTimestamp(),
            closedByUid: leavingUser.uid,
            [`adminUids.${leavingUser.uid}`]: deleteField()
          });
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
              : {}),
            ...roomActivityUpdate()
          });
        }
      }
      batch.delete(doc(db, "rooms", leavingRoomId, "members", leavingUser.uid));
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
      title: "BP PartyBeats",
      text: `Join my BP PartyBeats room ${activeRoomId}\nRoom ID: ${activeRoomId}`,
      url: shareUrl
    };
    setMenuOpen(false);
    if (navigator.share) {
      await navigator.share(shareData).catch(() => undefined);
      return;
    }
    try {
      await navigator.clipboard?.writeText(`${shareData.text}\n${shareUrl}`);
      setToast("Room invite copied.");
    } catch {
      setToast(`Room ${activeRoomId}: ${shareUrl}`);
    }
  }

  async function shareApp() {
    const appUrl = `${window.location.origin}${window.location.pathname}`;
    const shareData = {
      title: "BP PartyBeats",
      text: "BP PartyBeats lets everyone at the party add songs to a shared room queue.",
      url: appUrl
    };
    setMenuOpen(false);
    if (navigator.share) {
      await navigator.share(shareData).catch(() => undefined);
      return;
    }
    try {
      await navigator.clipboard?.writeText(`${shareData.text}\n${appUrl}`);
      setToast("App link copied.");
    } catch {
      setToast(appUrl);
    }
  }

  async function copyRoomId() {
    if (!activeRoomId) return;
    await navigator.clipboard?.writeText(activeRoomId);
    setToast("Room ID copied.");
  }

  async function exportPlaylist() {
    setMenuOpen(false);
    if (!songs.length) {
      setToast("There are no songs to share yet.");
      return;
    }
    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${activeRoomId}`;
    const lines = [
      "BP PartyBeats Playlist",
      `Room: ${activeRoomId}`,
      `Exported: ${new Date().toLocaleString()}`,
      "",
      ...songs.flatMap((song, index) => {
        const exportedTrack = playlistTrackDisplay(song);
        const exportedArtist = exportedTrack.artist || decodeHtmlEntities(song.artist || "YouTube");
        return [
          `${index + 1}. ${exportedArtist} - ${exportedTrack.title || "Untitled"}`,
          song.link ? `   Link: ${song.link}` : "",
          ""
        ].filter(Boolean);
      })
    ];
    const playlistText = lines.join("\n");
    const shareData = {
      title: `BP PartyBeats ${activeRoomId} playlist`,
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

  if (!firebaseReady) {
    return <SetupMissing />;
  }

  if (!activeRoomId || !room) {
    return (
      <main className="app-shell landing-shell">
        <section className="landing-hero">
          <div className="brand-mark">
            <AppIcon />
            <span>BP PartyBeats</span>
          </div>
          <div className="landing-copy">
            <h1>BP PartyBeats</h1>
            <p>Start a room, pass around the code, and let everyone build the music queue from their phone.</p>
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
            <p className="muted">Google users can create rooms. Guests can join with a nickname.</p>
            <div className="room-actions">
              <button className="primary-action" onClick={createRoom} disabled={!user || user.isAnonymous}>
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
                <button onClick={() => joinRoomById()} disabled={!user && nickname.trim().length < 2}>
                  <DoorOpen aria-hidden="true" />
                  Join
                </button>
              </div>
            </div>
          </div>
          <p className="landing-version">Version {APP_VERSION}</p>
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
    <main className={`app-shell room-app ${isDarkTheme ? "dark-mode" : "light-mode"}`}>
      <header className="app-topbar">
        <div className="topbar-brand">
          <div className="brand-dot">
            <AppIcon />
          </div>
          <div>
            <strong>BP PartyBeats</strong>
            <span>{activeRoomId}</span>
            <span className="topbar-room-meta">{members.length} people · {activeDjStatus}</span>
            <small className="topbar-version">{APP_VERSION}</small>
          </div>
        </div>

        <div className="topbar-actions">
          <button
            className="icon-button qr-toggle"
            onClick={() => {
              setRoomPanelTab("room");
              setRoomPanelOpen(true);
            }}
            title="Show room QR"
            type="button"
          >
            <QrCode aria-hidden="true" />
          </button>
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
            onClick={() => {
              setRoomPanelTab("people");
              setRoomPanelOpen(true);
            }}
            title="People in room"
            type="button"
          >
            <UsersRound aria-hidden="true" />
          </button>
          <button
            className="icon-button"
            onClick={openSelfRename}
            title="Change nickname"
            type="button"
          >
            <Pencil aria-hidden="true" />
          </button>
          <div className="session-chip">
            <span>{user.isAnonymous ? "Guest" : "Google"}</span>
            <strong>
              {!user.isAnonymous && <GoogleBadge />}
              {activeNickname}
            </strong>
          </div>
          <div className="menu-wrap">
            <button className="icon-button" onClick={() => setMenuOpen((open) => !open)} title="Menu">
              <MoreVertical aria-hidden="true" />
            </button>
            {menuOpen && (
              <div className="overflow-menu">
                <button onClick={() => { setRoomPanelTab("room"); setRoomPanelOpen(true); setMenuOpen(false); }}>
                  <Info aria-hidden="true" />
                  Room
                </button>
                <button onClick={() => { setRoomPanelTab("settings"); setRoomPanelOpen(true); setMenuOpen(false); }}>
                  <SlidersHorizontal aria-hidden="true" />
                  Settings
                </button>
                <button onClick={() => { setRoomPanelTab("analytics"); setRoomPanelOpen(true); setMenuOpen(false); }}>
                  <Activity aria-hidden="true" />
                  Analytics
                </button>
                {isAdmin && (
                  <button onClick={() => { setRoomPanelTab("diagnostics"); setRoomPanelOpen(true); setMenuOpen(false); }}>
                    <Activity aria-hidden="true" />
                    Diagnostics
                  </button>
                )}
                <button onClick={shareApp}>
                  <Share2 aria-hidden="true" />
                  Share
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

      <section
        ref={playerCardRef}
        className={[
          playerFullscreen ? "now-playing-card is-fullscreen-player" : "now-playing-card",
          nowPlayingSong ? "has-track" : "is-idle"
        ].join(" ")}
      >
        {nowPlayingSong && (
          <a className="lyrics-corner-button" href={lyricsSearchUrl(nowPlayingSong)} target="_blank" rel="noreferrer">
            <Search aria-hidden="true" />
            Lyrics
          </a>
        )}
        <div className="now-playing-copy">
          <span>{isActiveDj ? "Active DJ player" : "Now playing"}</span>
          <h1>{nowPlayingSong ? nowPlayingDisplay?.title || "Untitled" : "Nothing playing yet"}</h1>
          <p className="track-credit">
            {nowPlayingSong
              ? `${nowPlayingDisplay?.artist || decodeHtmlEntities(nowPlayingSong.artist || "YouTube")} · added by ${nowPlayingSong.addedByName || "Guest"}`
              : "The Active DJ starts playback from the phone connected to the speaker."}
          </p>
          <p className={`playback-status ${playbackState.state}`}>
            {playbackStatusText}
          </p>
          <p className="dj-note">
            Playing from {activeDjName}
            {isAdmin && !isActiveDj ? " · You can take over if the speaker moves to your phone." : ""}
          </p>
          {!nowPlayingSong && (
            <button className="mini-action player-empty-action" onClick={() => setAddSheetOpen(true)} type="button">
              <Plus aria-hidden="true" />
              Add First Track
            </button>
          )}
        </div>
        {isActiveDj ? (
          <>
            <YouTubePlayer
              song={nowPlayingSong}
              onEnded={playNextSong}
              onCrossfade={playNextSong}
              crossfadeEnabled={effectivePlaybackSettings.crossfadeEnabled}
              crossfadeSeconds={effectivePlaybackSettings.crossfadeSeconds}
              playbackState={playbackState}
              onPlaybackUpdate={syncPlaybackState}
            />
            <div className="player-actions dj-control-deck" aria-label="Active DJ controls">
              <button
                className="mini-action player-fullscreen-toggle"
                onClick={togglePlayerFullscreen}
                type="button"
              >
                {playerFullscreen ? <X aria-hidden="true" /> : <ExternalLink aria-hidden="true" />}
                {playerFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              </button>
              <button className="mini-action stop-action" onClick={stopPlayback} disabled={!nowPlayingSong} type="button">
                <Square aria-hidden="true" />
                Stop
              </button>
              <button className="mini-action" onClick={restartTrack} disabled={!nowPlayingSong} type="button">
                <RotateCcw aria-hidden="true" />
                Restart
              </button>
              <button className="mini-action" onClick={replayLastSong} disabled={!replaySong} type="button">
                <RotateCcw aria-hidden="true" />
                Replay Last
              </button>
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
          <div className="player-actions dj-control-deck">
            <button className="mini-action" onClick={takeOverDj} type="button">
              <Crown aria-hidden="true" />
              Take Over DJ
            </button>
          </div>
        ) : null}
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

        <div className="song-list" ref={songListRef}>
          {songs.length === 0 ? (
            <div className="empty-state">
              <Music2 aria-hidden="true" />
              <strong>Add the first track</strong>
              <span>{roomNeedsFirstTrack ? "Anyone in the room can start the party." : "Drop a track and set the tone."}</span>
              <button className="primary-action" onClick={() => setAddSheetOpen(true)} type="button">
                <Plus aria-hidden="true" />
                Add Song
              </button>
            </div>
          ) : (
            songs.map((song, index) => {
              const queueIndex = songs.findIndex((item) => item.id === song.id);
              const trackDisplay = playlistTrackDisplay(song);
              const isCurrentSong = song.id === room.nowPlayingId;
              const isPlayedSong = nowPlayingIndex >= 0 && index < nowPlayingIndex;
              const isUpNextSong = nowPlayingIndex >= 0 && index === nowPlayingIndex + 1;
              const isRecentlyAddedSong = recentlyAddedSongId === song.id;
              const isSelectedSong = selectedSongId === song.id;
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
                    isCurrentSong ? "is-playing" : "",
                    isPlayedSong ? "is-played" : "",
                    isUpNextSong ? "is-up-next" : "",
                    isRecentlyAddedSong ? "is-recently-added" : "",
                    isSelectedSong ? "is-selected" : "",
                    emojiSongId === song.id ? "is-reacting" : ""
                  ].filter(Boolean).join(" ")}
                  data-song-id={song.id}
                  key={song.id}
                  onClick={() => setSelectedSongId((current) => current === song.id ? "" : song.id)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setMessageSongId("");
                    setEmojiSongId(song.id);
                  }}
                  onPointerDown={(event) => {
                    const timer = window.setTimeout(() => {
                      setMessageSongId("");
                      setEmojiSongId(song.id);
                    }, 520);
                    event.currentTarget.dataset.pressTimer = String(timer);
                  }}
                  onPointerUp={(event) => window.clearTimeout(Number(event.currentTarget.dataset.pressTimer))}
                  onPointerLeave={(event) => window.clearTimeout(Number(event.currentTarget.dataset.pressTimer))}
                >
                  <button className="song-main" type="button">
                    <span className="song-index">{index + 1}</span>
                    <span className="track-line">
                      {isCurrentSong && <em>Now</em>}
                      {isUpNextSong && <em>Up next</em>}
                      {isPlayedSong && <em>Played</em>}
                      {isRecentlyAddedSong && <em>Added</em>}
                      {trackDisplay.artist && <b>{trackDisplay.artist}</b>}
                      <strong>{trackDisplay.title}</strong>
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

                  {isAdmin && isSelectedSong && (
                    <div className="admin-actions" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
                      <button className="icon-button" onClick={() => moveSong(song, -1)} title="Move up" disabled={queueIndex <= 0}>
                        <ArrowUp aria-hidden="true" />
                      </button>
                      <button className="icon-button" onClick={() => moveSong(song, 1)} title="Move down" disabled={queueIndex < 0 || queueIndex === songs.length - 1}>
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
                    <div
                      className="emoji-popover"
                      onClick={(event) => event.stopPropagation()}
                      onPointerDown={(event) => event.stopPropagation()}
                      onPointerUp={(event) => event.stopPropagation()}
                    >
                      {EMOJIS.map((emoji) => (
                        <button
                          className={song.emojiByUser?.[user.uid] === emoji ? "selected" : ""}
                          key={emoji}
                          {...popoverPressProps(`${song.id}:emoji:${emoji}`, () => {
                            reactToSong(song, emoji);
                            setEmojiSongId("");
                          })}
                          type="button"
                        >
                          {emoji}
                        </button>
                      ))}
                      <button
                        className={messageSongId === song.id ? "selected" : ""}
                        {...popoverPressProps(`${song.id}:message`, () => setMessageSongId(song.id))}
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

      <button className="add-song-fab" onClick={() => setAddSheetOpen(true)} type="button">
        <Plus aria-hidden="true" />
        Add Song
      </button>

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

      {selfRenameOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="about-modal">
            <div className="modal-header">
              <h2>Nickname</h2>
              <button
                className="icon-button"
                onClick={() => {
                  setSelfRenameOpen(false);
                  setSelfRenameDraft("");
                }}
                title="Close"
                type="button"
              >
                <X aria-hidden="true" />
              </button>
            </div>
            <form className="nickname-edit-form" onSubmit={saveSelfRename}>
              <input
                value={selfRenameDraft}
                onChange={(event) => setSelfRenameDraft(event.target.value.slice(0, 30))}
                placeholder="Nickname"
                maxLength={30}
                autoFocus
              />
              <button className="primary-action" type="submit" disabled={!selfRenameDraft.trim()}>
                Save
              </button>
            </form>
          </section>
        </div>
      )}

      {addSheetOpen && (
        <div className="modal-backdrop add-sheet-backdrop" role="dialog" aria-modal="true">
          <section className="add-panel add-sheet">
            <div className="modal-header">
              <div>
                <h2>Add Song</h2>
                <p className="muted">
                  {isAdmin
                    ? `Admin adds are unlimited. Cooldown is ${cooldownEnabled ? `${cooldownMinutes} min` : "off"}.`
                    : roomNeedsFirstTrack
                      ? "Anyone can add the first track."
                    : !cooldownEnabled
                      ? "Cooldown is off."
                      : canAddSong
                        ? "You can add a song now."
                        : `Next add in ${Math.ceil(cooldownRemaining / 1000)}s.`}
                </p>
              </div>
              <button className="icon-button" onClick={() => setAddSheetOpen(false)} title="Close" type="button">
                <X aria-hidden="true" />
              </button>
            </div>

            <div className="search-tabs" role="tablist" aria-label="Song search mode">
              <button
                className={searchMode === "internal" ? "is-active" : ""}
                onClick={() => setSearchMode("internal")}
                type="button"
                role="tab"
                aria-selected={searchMode === "internal"}
              >
                Internal Search
              </button>
              <button
                className={searchMode === "external" ? "is-active" : ""}
                onClick={() => setSearchMode("external")}
                type="button"
                role="tab"
                aria-selected={searchMode === "external"}
              >
                External Search
              </button>
            </div>

            {searchMode === "internal" ? (
              <>
                <form className="youtube-search" onSubmit={searchYouTube}>
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={YOUTUBE_API_KEY ? "Search YouTube" : "Add VITE_YOUTUBE_API_KEY"}
                  />
                  <button className="primary-action" disabled={!YOUTUBE_API_KEY || searching}>
                    <Search aria-hidden="true" />
                    {searching ? "..." : "Search"}
                  </button>
                </form>

                {searchResults.length > 0 && (
                  <div className="search-results">
                    {searchResults.map((result) => {
                      const durationLabel = formatDuration(result.durationSeconds);
                      const resultAddKey = `${activeRoomId}:${result.videoId}`;
                      const isAddingThisSong = addingSongKey === resultAddKey;
                      return (
                        <article className="search-result" key={result.videoId}>
                          <img src={result.thumbnail} alt="" />
                          <div>
                            <strong>{result.title}</strong>
                            <span>{result.channelTitle}</span>
                            <span className="result-meta">
                              {durationLabel || "Length verifies on add"}
                            </span>
                          </div>
                          <button className="mini-action" onClick={() => addSong(null, result)} disabled={!canAddSong || Boolean(addingSongKey)}>
                            <Plus aria-hidden="true" />
                            {isAddingThisSong ? "Adding" : "Add"}
                          </button>
                        </article>
                      );
                    })}
                  </div>
                )}
                {!searching && searchResults.length === 0 && (
                  <div className="empty-state compact-empty">
                    <Search aria-hidden="true" />
                    <strong>Find the next crowd favorite</strong>
                    <span>Search results stay under 10 minutes and show duration before adding.</span>
                  </div>
                )}
              </>
            ) : (
              <div className="external-search-panel">
                <div>
                  <strong>Search outside the app</strong>
                  <span>Open YouTube Music, copy a song link, then paste it here. This avoids YouTube search quota.</span>
                </div>
                <div className="external-search-actions">
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search YouTube Music"
                  />
                  <button className="mini-action" onClick={openExternalYouTubeMusicSearch} type="button">
                    <ExternalLink aria-hidden="true" />
                    Open
                  </button>
                </div>
                <button className="external-tutorial-button" onClick={() => setExternalTutorialOpen(true)} type="button">
                  <Info aria-hidden="true" />
                  How do I add a song?
                </button>
                <form className="youtube-link-form" onSubmit={addSongFromLink}>
                  <input
                    value={youtubeLink}
                    onChange={(event) => setYoutubeLink(event.target.value)}
                    placeholder="Paste YouTube or YouTube Music link"
                  />
                  <button className="primary-action" disabled={!canAddSong || !youtubeLink.trim() || Boolean(addingSongKey)}>
                    <Plus aria-hidden="true" />
                    {addingSongKey ? "Adding..." : "Add Link"}
                  </button>
                </form>
              </div>
            )}
          </section>
        </div>
      )}

      {externalTutorialOpen && (
        <ExternalSearchTutorial onClose={() => setExternalTutorialOpen(false)} />
      )}

      {roomPanelOpen && (
        <div className="modal-backdrop room-panel-backdrop" role="dialog" aria-modal="true">
          <section className="about-modal room-panel">
            <div className="modal-header">
              <div>
                <h2>Room</h2>
                <p className="muted">{activeRoomId} · {members.length} people</p>
              </div>
              <button className="icon-button" onClick={() => setRoomPanelOpen(false)} title="Close" type="button">
                <X aria-hidden="true" />
              </button>
            </div>

            <div className="panel-tabs" role="tablist" aria-label="Room options">
              <button
                className={roomPanelTab === "room" ? "is-active" : ""}
                onClick={() => setRoomPanelTab("room")}
                type="button"
                role="tab"
                aria-selected={roomPanelTab === "room"}
              >
                Room
              </button>
              <button
                className={roomPanelTab === "people" ? "is-active" : ""}
                onClick={() => setRoomPanelTab("people")}
                type="button"
                role="tab"
                aria-selected={roomPanelTab === "people"}
              >
                People
              </button>
              <button
                className={roomPanelTab === "settings" ? "is-active" : ""}
                onClick={() => setRoomPanelTab("settings")}
                type="button"
                role="tab"
                aria-selected={roomPanelTab === "settings"}
              >
                Settings
              </button>
              <button
                className={roomPanelTab === "analytics" ? "is-active" : ""}
                onClick={() => setRoomPanelTab("analytics")}
                type="button"
                role="tab"
                aria-selected={roomPanelTab === "analytics"}
              >
                Analytics
              </button>
              {isAdmin && (
                <button
                  className={roomPanelTab === "diagnostics" ? "is-active" : ""}
                  onClick={() => setRoomPanelTab("diagnostics")}
                  type="button"
                  role="tab"
                  aria-selected={roomPanelTab === "diagnostics"}
                >
                  Diagnostics
                </button>
              )}
            </div>

            {roomPanelTab === "room" && (
              <div className="room-panel-page">
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
                    <span>Active DJ</span>
                    <strong>{activeDjName}</strong>
                  </div>
                  <div>
                    <span>Version</span>
                    <strong>{APP_VERSION}</strong>
                  </div>
                </div>
                {qrDataUrl && (
                  <div className="qr-block room-qr">
                    <img src={qrDataUrl} alt={`Join ${activeRoomId}`} />
                    <span>
                      <QrCode aria-hidden="true" />
                      Scan to join
                    </span>
                  </div>
                )}
                <div className="room-panel-actions">
                  <button className="mini-action" onClick={copyRoomId} type="button">
                    <Info aria-hidden="true" />
                    Copy ID
                  </button>
                  <button className="mini-action" onClick={shareRoom} type="button">
                    <Share2 aria-hidden="true" />
                    Share Room
                  </button>
                  <button className="mini-action" onClick={exportPlaylist} type="button">
                    <Share2 aria-hidden="true" />
                    Share Playlist
                  </button>
                </div>
              </div>
            )}

            {roomPanelTab === "people" && (
              <section className="people-panel visible-people">
                {members.map((member) => {
                  const memberIsAdmin = isRoomAdminId(member.id);
                  const isCurrentUser = member.id === user.uid;
                  const isRenaming = renameMemberId === member.id;
                  return (
                    <div className={isAdmin ? "member-row manageable" : "member-row"} key={member.id}>
                      <UserRound aria-hidden="true" />
                      <div>
                        {isAdmin && isRenaming ? (
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
                      {isAdmin ? (
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
                                <button className="mini-action" onClick={() => demoteMember(member)} type="button">
                                  Demote
                                </button>
                              )}
                            </>
                          ) : (
                            <button className="mini-action" onClick={() => promoteMember(member)} disabled={member.isAnonymous} type="button">
                              Make Admin
                            </button>
                          )}
                          {!isCurrentUser && (
                            <button className="icon-button danger" onClick={() => removeMember(member)} title="Remove from room" type="button">
                              <Trash2 aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      ) : (
                        memberIsAdmin && <Crown aria-label="Admin" />
                      )}
                    </div>
                  );
                })}
              </section>
            )}

            {roomPanelTab === "settings" && (
              <div className="room-panel-page">
                <div className="setting-row">
                  <div>
                    <strong>Cooldown</strong>
                    <span>{cooldownEnabled ? "Guests wait between song adds" : "Guests can add songs anytime"}</span>
                  </div>
                  <button
                    className={cooldownEnabled ? "toggle-button is-on" : "toggle-button"}
                    onClick={() => updateCooldownEnabled(!cooldownEnabled)}
                    disabled={!isAdmin}
                    type="button"
                  >
                    {cooldownEnabled ? "On" : "Off"}
                  </button>
                </div>
                <div className="setting-row">
                  <div>
                    <strong>Crossfade</strong>
                    <span>{crossfadeEnabled ? "Start the next song early" : "Next song starts after the current one ends"}</span>
                  </div>
                  <button
                    className={crossfadeEnabled ? "toggle-button is-on" : "toggle-button"}
                    onClick={() => updateCrossfadeEnabled(!crossfadeEnabled)}
                    disabled={!isAdmin}
                    type="button"
                  >
                    {crossfadeEnabled ? "On" : "Off"}
                  </button>
                </div>
                <div className="setting-row">
                  <div>
                    <strong>Track notifications</strong>
                    <span>{trackNoticeEnabled ? "Show now-playing bubble" : "Now-playing bubble is off"}</span>
                  </div>
                  <button
                    className={trackNoticeEnabled ? "toggle-button is-on" : "toggle-button"}
                    onClick={() => updateTrackNoticeEnabled(!trackNoticeEnabled)}
                    disabled={!isAdmin}
                    type="button"
                  >
                    {trackNoticeEnabled ? "On" : "Off"}
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
                    disabled={!isAdmin}
                    type="button"
                  >
                    {joinNoticeEnabled ? "On" : "Off"}
                  </button>
                </div>
                {!isAdmin && <p className="muted">Only admins can change room settings.</p>}
              </div>
            )}

            {roomPanelTab === "analytics" && (
              <div className="room-panel-page analytics-page">
                <div className="analytics-grid">
                  <div>
                    <span>Songs</span>
                    <strong>{songs.length}</strong>
                  </div>
                  <div>
                    <span>Reactions</span>
                    <strong>{totalReactions}</strong>
                  </div>
                  <div>
                    <span>Messages</span>
                    <strong>{totalMessages}</strong>
                  </div>
                  <div>
                    <span>People</span>
                    <strong>{members.length}</strong>
                  </div>
                  <div>
                    <span>Google</span>
                    <strong>{googleMemberCount}</strong>
                  </div>
                  <div>
                    <span>Guests</span>
                    <strong>{guestMemberCount}</strong>
                  </div>
                </div>

                <section className="analytics-section">
                  <h3>People</h3>
                  {analyticsPeople.length > 0 ? (
                    analyticsPeople.map((member) => (
                      <div className="analytics-person" key={member.id}>
                        <div>
                          <strong>{member.isAnonymous === false && <GoogleBadge />}{member.name || "Guest"}</strong>
                          <span>{member.isAnonymous ? "Guest" : "Google"}</span>
                        </div>
                        <span>{member.added} adds</span>
                        <span>{member.reactions} reacts</span>
                        <span>{member.messages} msgs</span>
                      </div>
                    ))
                  ) : (
                    <p className="muted">No people in the room yet.</p>
                  )}
                </section>

                <section className="analytics-section">
                  <h3>Top Tracks</h3>
                  {mostReactedSongs.length > 0 ? (
                    mostReactedSongs.map((song) => (
                      <div className="analytics-person" key={song.id}>
                        <div>
                          <strong>{song.display.artist ? `${song.display.artist} ` : ""}{song.display.title}</strong>
                          <span>Added by {song.addedByName || "Guest"}</span>
                        </div>
                        <span>{song.reactionCount} reacts</span>
                        <span>{song.messageCount} msgs</span>
                        <span>{formatDuration(song.durationSeconds)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="muted">No reactions or messages yet.</p>
                  )}
                </section>

                <div className="analytics-tags">
                  <span>{cooldownEnabled ? "Cooldown on" : "Cooldown off"}</span>
                  <span>{crossfadeEnabled ? "Crossfade on" : "Crossfade off"}</span>
                  <span>{trackNoticeEnabled ? "Track notices on" : "Track notices off"}</span>
                </div>
              </div>
            )}

            {isAdmin && roomPanelTab === "diagnostics" && (
              <div className="room-panel-page diagnostics-page">
                <div className="diagnostics-grid">
                  <div>
                    <span>Auth</span>
                    <strong>{user.isAnonymous ? "Guest" : "Google"}</strong>
                    <small>{user.uid}</small>
                  </div>
                  <div>
                    <span>Room</span>
                    <strong>{activeRoomId}</strong>
                    <small>{room?.closed ? "Closed" : "Open"}</small>
                  </div>
                  <div>
                    <span>Active DJ</span>
                    <strong>{activeDjName}</strong>
                    <small>{activeDjUid || "None"}</small>
                  </div>
                  <div>
                    <span>Playback</span>
                    <strong>{playbackState.state}</strong>
                    <small>{playbackPositionLabel || "0:00"} · {formatDateTime(playbackState.updatedAt)}</small>
                  </div>
                  <div>
                    <span>Now Playing ID</span>
                    <strong>{room?.nowPlayingId || "None"}</strong>
                    <small>{nowPlayingSong?.videoId || "No video loaded"}</small>
                  </div>
                  <div>
                    <span>Queue</span>
                    <strong>{songs.length} songs</strong>
                    <small>{members.length} people in room</small>
                  </div>
                  <div>
                    <span>Add Status</span>
                    <strong>{canAddSong ? "Can add" : `Cooldown ${Math.ceil(cooldownRemaining / 1000)}s`}</strong>
                    <small>Last add: {lastAddedLabel}</small>
                  </div>
                  <div>
                    <span>Settings</span>
                    <strong>
                      {cooldownEnabled ? "Cooldown on" : "Cooldown off"}
                    </strong>
                    <small>
                      Crossfade {crossfadeEnabled ? "on" : "off"} · Notices {trackNoticeEnabled ? "on" : "off"}
                    </small>
                  </div>
                  <div>
                    <span>Build</span>
                    <strong>{APP_VERSION}</strong>
                    <small>{window.location.origin}</small>
                  </div>
                </div>
                <p className="muted">
                  Use this during phone testing to confirm auth, room, Active DJ, playback, and cooldown state.
                </p>
              </div>
            )}
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

function YouTubePlayer({ song, onEnded, onCrossfade, crossfadeEnabled, crossfadeSeconds, playbackState, onPlaybackUpdate }) {
  const containerId = useRef(`yt-player-${Math.random().toString(36).slice(2)}`);
  const playerRef = useRef(null);
  const playerTimerRef = useRef(null);
  const endedRef = useRef(onEnded);
  const crossfadeRef = useRef(onCrossfade);
  const playbackRef = useRef(playbackState);
  const playbackUpdateRef = useRef(onPlaybackUpdate);
  const crossfadeEnabledRef = useRef(crossfadeEnabled);
  const crossfadeSecondsRef = useRef(crossfadeSeconds);
  const crossfadeTriggeredRef = useRef(false);
  const currentVideoIdRef = useRef("");
  const currentSongIdRef = useRef("");
  const pendingVideoIdRef = useRef("");
  const pauseAfterLoadRef = useRef(false);
  const lastPlaybackReportRef = useRef(0);
  const lastAppliedPlaybackCommandRef = useRef(0);
  const playerReadyRef = useRef(false);

  useEffect(() => {
    endedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    crossfadeRef.current = onCrossfade;
  }, [onCrossfade]);

  useEffect(() => {
    playbackRef.current = playbackState;
    playbackUpdateRef.current = onPlaybackUpdate;
  }, [playbackState, onPlaybackUpdate]);

  useEffect(() => {
    const player = playerRef.current;
    if (!song?.id || !playerReadyRef.current || !player || playbackState?.songId !== song.id) return;
    if (playbackState.command !== "restart" || !playbackState.commandId) return;
    if (lastAppliedPlaybackCommandRef.current === playbackState.commandId) return;
    if (!playbackState.commandAt || Date.now() - playbackState.commandAt > PLAYBACK_COMMAND_WINDOW_MS) return;

    lastAppliedPlaybackCommandRef.current = playbackState.commandId;
    crossfadeTriggeredRef.current = false;
    lastPlaybackReportRef.current = 0;
    player.seekTo?.(0, true);
    player.playVideo?.();
  }, [song?.id, playbackState?.songId, playbackState?.command, playbackState?.commandId, playbackState?.commandAt]);

  useEffect(() => {
    crossfadeEnabledRef.current = crossfadeEnabled;
    crossfadeSecondsRef.current = crossfadeSeconds;
  }, [crossfadeEnabled, crossfadeSeconds]);

  useEffect(() => {
    let cancelled = false;

    function stopPlaybackTimer() {
      if (playerTimerRef.current) {
        window.clearInterval(playerTimerRef.current);
        playerTimerRef.current = null;
      }
    }

    function resumeSeconds() {
      const saved = playbackRef.current || {};
      if (!song?.id || saved.songId !== song.id) return 0;
      const baseSeconds = Math.max(0, Number(saved.seconds) || 0);
      if (saved.state !== "playing" || !saved.updatedAt) return baseSeconds;
      return baseSeconds + Math.max(0, (Date.now() - saved.updatedAt) / 1000);
    }

    function reportPlayback(player, state, force = false) {
      if (!song?.id || !player?.getCurrentTime) return;
      const now = Date.now();
      if (!force && now - lastPlaybackReportRef.current < 5000) return;
      lastPlaybackReportRef.current = now;
      playbackUpdateRef.current?.({
        songId: song.id,
        seconds: player.getCurrentTime(),
        state
      });
    }

    function startPlaybackTimer(player) {
      stopPlaybackTimer();
      playerTimerRef.current = window.setInterval(() => {
        if (!player.getDuration || !player.getCurrentTime) {
          return;
        }
        reportPlayback(player, "playing");
        const enabled = crossfadeEnabledRef.current;
        const seconds = crossfadeSecondsRef.current;
        if (!enabled || !seconds) return;
        const duration = player.getDuration();
        const current = player.getCurrentTime();
        const remaining = duration - current;
        if (enabled && seconds && duration && remaining <= seconds && !crossfadeTriggeredRef.current) {
          crossfadeTriggeredRef.current = true;
          crossfadeRef.current?.();
        }
      }, 400);
    }

    function loadVideo(player, videoId) {
      if (!videoId || (currentVideoIdRef.current === videoId && currentSongIdRef.current === song?.id)) return;
      pendingVideoIdRef.current = videoId;
      if (!playerReadyRef.current) return;
      currentVideoIdRef.current = videoId;
      currentSongIdRef.current = song?.id || "";
      crossfadeTriggeredRef.current = false;
      lastPlaybackReportRef.current = 0;
      pauseAfterLoadRef.current = playbackRef.current?.songId === song?.id && playbackRef.current?.state === "paused";
      if (player.loadVideoById) {
        player.loadVideoById({
          videoId,
          startSeconds: resumeSeconds()
        });
      }
    }

    async function loadPlayer() {
      const videoId = song?.videoId || "";
      pendingVideoIdRef.current = videoId;
      if (!videoId) {
        currentVideoIdRef.current = "";
        currentSongIdRef.current = "";
        pendingVideoIdRef.current = "";
        crossfadeTriggeredRef.current = false;
        stopPlaybackTimer();
        playerRef.current?.stopVideo?.();
        playerRef.current?.destroy?.();
        playerRef.current = null;
        playerReadyRef.current = false;
        return;
      }

      await loadYouTubeIframeApi();
      if (cancelled) return;

      if (playerRef.current) {
        loadVideo(playerRef.current, videoId);
        return;
      }

      playerRef.current = new window.YT.Player(containerId.current, {
        playerVars: {
          autoplay: 1,
          controls: 1,
          enablejsapi: 1,
          playsinline: 1,
          rel: 0,
          origin: window.location.origin
        },
        events: {
          onReady: (event) => {
            playerReadyRef.current = true;
            loadVideo(event.target, pendingVideoIdRef.current);
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              if (pauseAfterLoadRef.current) {
                pauseAfterLoadRef.current = false;
                event.target.pauseVideo?.();
                reportPlayback(event.target, "paused", true);
                return;
              }
              reportPlayback(event.target, "playing", true);
              startPlaybackTimer(event.target);
            }
            if (event.data === window.YT.PlayerState.PAUSED) {
              stopPlaybackTimer();
              reportPlayback(event.target, "paused", true);
            }
            if (event.data === window.YT.PlayerState.ENDED) {
              stopPlaybackTimer();
              endedRef.current?.();
            }
          }
        }
      });
    }

    loadPlayer();

    return () => {
      cancelled = true;
      stopPlaybackTimer();
    };
  }, [song?.id, song?.videoId]);

  useEffect(() => {
    return () => {
      if (playerTimerRef.current) {
        window.clearInterval(playerTimerRef.current);
      }
      playerRef.current?.destroy?.();
      playerRef.current = null;
      playerReadyRef.current = false;
    };
  }, []);

  return (
    <div className={song?.videoId ? "player-frame" : "player-frame is-empty"}>
      <div className="youtube-frame" id={containerId.current} />
      {!song?.videoId && (
        <div className="player-empty">
          <Music2 aria-hidden="true" />
        </div>
      )}
    </div>
  );
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


function ExternalSearchTutorial({ onClose }) {
  return (
    <div className="tutorial-backdrop" role="dialog" aria-modal="true" aria-labelledby="external-search-tutorial-title">
      <section className="tutorial-card">
        <div className="modal-header">
          <div>
            <h2 id="external-search-tutorial-title">Add Songs Using External Search</h2>
            <p className="muted">Search YouTube Music, copy the song link, then paste it back into PartyBeats.</p>
          </div>
          <button className="icon-button" onClick={onClose} title="Close" type="button">
            <X aria-hidden="true" />
          </button>
        </div>

        <div className="tutorial-phone" aria-hidden="true">
          <div className="tutorial-screen-label">PartyBeats</div>
          <div className="tutorial-step step-1">1. Search for a song</div>
          <div className="tutorial-step step-2">2. Tap Open</div>
          <div className="tutorial-step step-3">3. Tap 3 Dot Menu beside song</div>
          <div className="tutorial-step step-4">4. Tap Share</div>
          <div className="tutorial-step step-5">5. Tap Copy Link</div>
          <div className="tutorial-step step-6">6. Paste Link, then tap Add Link</div>
        </div>

        <button className="primary-action tutorial-done" onClick={onClose} type="button">
          Got it
        </button>
      </section>
    </div>
  );
}

function SignedOut({ nickname, setNickname, onGoogle }) {
  return (
    <div className="signed-out">
      <button className="google-action" onClick={onGoogle}>
        <span className="google-mark" aria-hidden="true">G</span>
        Continue with Google
      </button>
      <input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="Nickname" maxLength={30} />
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
      <h1>BP PartyBeats needs Firebase config</h1>
      <p>Copy .env.example to .env.local and fill in the values from your Firebase web app.</p>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
