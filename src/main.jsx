import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Check,
  Crown,
  Download,
  DoorOpen,
  ExternalLink,
  History,
  Info,
  LogOut,
  MessageCircle,
  MoreVertical,
  Music2,
  Palette,
  Pause,
  Pencil,
  Play,
  Plus,
  QrCode,
  RotateCcw,
  Search,
  Share2,
  SlidersHorizontal,
  Smile,
  Volume2,
  SkipForward,
  Trash2,
  UserRound,
  Vote,
  Wand2,
  X
} from "lucide-react";
import QRCode from "qrcode";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut,
  updateProfile
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
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

const EMOJIS = [
  "🔥",
  "❤️",
  "😍",
  "😮",
  "😂",
  "🙌",
  "👏",
  "💃",
  "🕺",
  "🤘",
  "🎸",
  "🥁",
  "🎤",
  "🎶",
  "🚀",
  "⚡",
  "💯",
  "⭐",
  "👑",
  "🍻",
  "🥳",
  "😎",
  "🤯",
  "😭"
];
const COLOR_THEMES = [
  { id: "neon", name: "Neon Rave", note: "Mint, magenta + ultraviolet", base: "dark" },
  { id: "sunset", name: "Sunset Funk", note: "Coral, gold + tropic teal", base: "light" },
  { id: "aurora", name: "Aurora", note: "Polar teal + violet glow", base: "dark" },
  { id: "midnight", name: "Midnight Club", note: "Deep blue + electric cyan", base: "dark" },
  { id: "ocean", name: "Ocean Drive", note: "Azure + deep-sea blue", base: "light" },
  { id: "candy", name: "Candy Pop", note: "Bubblegum pink + grape", base: "light" },
  { id: "fire", name: "Firestarter", note: "Blaze orange + ember red", base: "light" },
  { id: "ice", name: "On Ice", note: "Frost blue + arctic white", base: "light" },
  { id: "royal", name: "Royal Velvet", note: "Violet + champagne gold", base: "dark" },
  { id: "forest", name: "Forest Rave", note: "Pine green + glow lime", base: "dark" },
  { id: "lime", name: "Limelight", note: "Lime + spring green", base: "light" },
  { id: "mono", name: "Monochrome", note: "Ink, slate + silver", base: "dark" }
];
const EMOJI_BURST_LIFETIME_MS = 1600;
const CONFETTI_LIFETIME_MS = 3200;
const DEFAULT_COOLDOWN_MS = 3 * 60 * 1000;
const DEFAULT_CROSSFADE_SECONDS = 5;
const DEFAULT_TRACK_NOTICE_SECONDS = 3;
const DEFAULT_JOIN_NOTICE_SECONDS = 3;
const NON_ADMIN_MAX_SONG_SECONDS = 10 * 60;
const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const APP_VERSION = "2026.06.29.12";
const DEFAULT_DESKTOP_PLAYER_SPLIT = 65;
const PLAYBACK_COMMAND_WINDOW_MS = 8000;
const EXTERNAL_SEARCH_MIN_AWAY_MS = 3500;
const LAST_ACTIVE_ROOM_KEY = "partybeats-last-active-room";
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

function roomCreateErrorMessage(error) {
  if (error?.code === "permission-denied") {
    return "Could not create the room. Confirm you are signed in with Google and the latest Firestore rules are published.";
  }
  if (error?.code === "unavailable") {
    return "Could not reach Firestore. Check your connection and try again.";
  }
  return error?.message || "Could not create the room. Try again.";
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

function youtubeSearchUrl(queryText) {
  const query = queryText.trim();
  return query
    ? `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
    : "https://www.youtube.com/";
}

function externalSearchUrl(provider, queryText) {
  return provider === "youtube" ? youtubeSearchUrl(queryText) : youtubeMusicSearchUrl(queryText);
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
  const rawValue = extractYouTubeShareUrl(value);
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

function extractYouTubePlaylistId(value) {
  const rawValue = extractYouTubeShareUrl(value);
  if (!rawValue) return "";

  try {
    const url = new URL(rawValue);
    const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
    if (host === "youtube.com" || host === "music.youtube.com" || host === "youtu.be") {
      return url.searchParams.get("list") || "";
    }
  } catch {
    return rawValue.match(/[?&]list=([A-Za-z0-9_-]+)/)?.[1] || "";
  }

  return "";
}

function shouldImportYouTubePlaylist(value) {
  const playlistId = extractYouTubePlaylistId(value);
  if (!playlistId) return false;
  const videoId = cleanYouTubeVideoId(extractYouTubeVideoId(value));
  if (!videoId) return true;

  try {
    const url = new URL(extractYouTubeShareUrl(value));
    const path = url.pathname.toLowerCase();
    return path.includes("/playlist");
  } catch {
    return false;
  }
}

function extractYouTubeShareUrl(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) return "";
  const urlMatch = rawValue.match(/https?:\/\/(?:www\.|m\.)?(?:music\.)?(?:youtube\.com|youtu\.be|youtube-nocookie\.com)\/[^\s"'<>]+/i);
  return (urlMatch?.[0] || rawValue).replace(/[)\].,;]+$/, "");
}

function extractSharedYouTubeLink(params) {
  const candidates = [
    params.get("url"),
    params.get("text"),
    params.get("title")
  ].filter(Boolean);
  return extractYouTubeShareUrl(candidates.join(" "));
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
  }, []);
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

function formatCountdown(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(Number(milliseconds) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
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
  return songs.slice(currentIndex + 1).find((song) => !song.unavailable) || null;
}

function nextQueuePosition(songs, offset = 0) {
  const highestPosition = songs.reduce((max, song) => Math.max(max, Number(song.position) || 0), 0);
  return Math.max(highestPosition + 1, Date.now()) + offset + (Math.random() / 1000);
}

function browserRegionCode() {
  try {
    return new Intl.Locale(navigator.language).region?.toUpperCase() || "";
  } catch {
    return String(navigator.language || "").split("-")[1]?.toUpperCase() || "";
  }
}

function videoAvailableInRegion(contentDetails, regionCode = browserRegionCode()) {
  if (!regionCode) return true;
  const restrictions = contentDetails?.regionRestriction;
  if (!restrictions) return true;
  if (Array.isArray(restrictions.allowed)) return restrictions.allowed.includes(regionCode);
  if (Array.isArray(restrictions.blocked)) return !restrictions.blocked.includes(regionCode);
  return true;
}

function adminMapFor(room) {
  return {
    ...(room?.adminUid ? { [room.adminUid]: true } : {}),
    ...(room?.adminUids || {})
  };
}

function savedColorTheme() {
  try {
    const saved = localStorage.getItem("partybeats-color-theme");
    const migratedDefault = localStorage.getItem("partybeats-color-theme-default-migrated");
    const migratedMidnightDefault = localStorage.getItem("partybeats-color-theme-midnight-default-migrated");
    if (!saved) return "midnight";
    if (saved === "sunset" && !migratedDefault) {
      localStorage.setItem("partybeats-color-theme-default-migrated", "true");
      localStorage.setItem("partybeats-color-theme-midnight-default-migrated", "true");
      return "midnight";
    }
    if (saved === "neon" && !migratedMidnightDefault) {
      localStorage.setItem("partybeats-color-theme-midnight-default-migrated", "true");
      return "midnight";
    }
    return COLOR_THEMES.some((option) => option.id === saved) ? saved : "midnight";
  } catch {
    return "midnight";
  }
}

function savedDesktopPlayerSplit() {
  try {
    const savedSplit = Number(localStorage.getItem("partybeats-desktop-player-split"));
    return savedSplit >= 45 && savedSplit <= 80 ? savedSplit : DEFAULT_DESKTOP_PLAYER_SPLIT;
  } catch {
    return DEFAULT_DESKTOP_PLAYER_SPLIT;
  }
}

function savedExternalSearchProvider() {
  try {
    const saved = localStorage.getItem("partybeats-external-search-provider");
    return saved === "youtube" ? "youtube" : "music";
  } catch {
    return "music";
  }
}

function savedPartyMotionOverride() {
  try {
    const saved = localStorage.getItem("partybeats-party-motion-override");
    if (saved === "on") return true;
    if (saved === "off") return false;
    return null;
  } catch {
    return null;
  }
}

function savedDeviceId() {
  try {
    const existing = localStorage.getItem("partybeats-device-id");
    if (existing) return existing;
    const nextId = `device-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
    localStorage.setItem("partybeats-device-id", nextId);
    return nextId;
  } catch {
    return `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function roomActivityUpdate() {
  return {
    lastActivityAt: serverTimestamp()
  };
}

function compareAppVersions(left, right) {
  const leftParts = String(left || "").split(".").map((part) => Number(part) || 0);
  const rightParts = String(right || "").split(".").map((part) => Number(part) || 0);
  const length = Math.max(leftParts.length, rightParts.length, 4);
  for (let index = 0; index < length; index += 1) {
    const delta = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

function newerAppVersion(left, right) {
  return compareAppVersions(left, right) >= 0 ? left : right;
}

function isImportantToast(message) {
  return /could not|cannot|can't|failed|blocked|unavailable|expired|closed|removed|permission|only the|choose a|sign in|allow popups|no previous|no available|does not exist/i.test(
    String(message || "")
  );
}

function resetWindowScroll() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

function selectExistingText(event) {
  const input = event.currentTarget;
  input.select();
  window.setTimeout(() => input.select(), 0);
}

function placeCursorAtTextEnd(event) {
  const input = event.currentTarget;
  const end = input.value.length;
  window.setTimeout(() => {
    try {
      input.setSelectionRange(end, end);
    } catch {
      input.selectionStart = end;
      input.selectionEnd = end;
    }
  }, 0);
}

function isFirefoxAndroid() {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent || "") && /Firefox/i.test(navigator.userAgent || "");
}

function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/i.test(navigator.userAgent || "")
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function PartyMotionCanvas({ className = "", embedded = false }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof window === "undefined") return undefined;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return undefined;

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    let frame = 0;
    let width = 1;
    let height = 1;
    let dpr = 1;
    const particles = Array.from({ length: embedded ? 48 : 72 }, (_, index) => ({
      seed: index * 91.7,
      x: Math.random(),
      y: Math.random(),
      radius: 1.6 + Math.random() * (embedded ? 3.2 : 4.6),
      speed: 0.16 + Math.random() * 0.64,
      drift: -0.48 + Math.random() * 0.96
    }));

    const themeColor = (name, fallback) => {
      const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const glow = (x, y, radius, color, alpha) => {
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `${color}${alpha}`);
      gradient.addColorStop(0.58, `${color}24`);
      gradient.addColorStop(1, `${color}00`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    };

    const render = (timestamp = 0) => {
      const t = timestamp / 1000;
      const energy = embedded ? 1.18 : 1;
      const accent = themeColor("--pb-accent", "#38bdf8");
      const accent2 = themeColor("--pb-accent-2", "#6366f1");
      const highlight = themeColor("--pb-highlight", "#7dd3fc");

      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "source-over";
      const wash = ctx.createLinearGradient(0, 0, width, height);
      wash.addColorStop(0, `${accent2}${embedded ? "30" : "24"}`);
      wash.addColorStop(0.5, "rgba(0,0,0,0)");
      wash.addColorStop(1, `${accent}${embedded ? "34" : "22"}`);
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, width, height);

      ctx.globalCompositeOperation = "screen";
      glow(width * (0.24 + Math.sin(t * 0.16) * 0.08), height * 0.28, Math.min(width, height) * (0.78 + energy * 0.12), accent2, "68");
      glow(width * (0.78 + Math.cos(t * 0.14) * 0.08), height * 0.74, Math.min(width, height) * (0.66 + energy * 0.1), accent, "5c");
      glow(width * 0.5, height * (0.56 + Math.sin(t * 0.18) * 0.08), Math.min(width, height) * 0.56, highlight, "38");

      ctx.globalAlpha = embedded ? 0.34 : 0.24;
      ctx.lineWidth = 1;
      const grid = embedded ? 56 : 78;
      const gridOffset = reducedMotion ? 0 : (t * 18 * energy) % grid;
      ctx.strokeStyle = accent;
      for (let x = -grid + gridOffset; x < width + grid; x += grid) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + height * 0.25, height);
        ctx.stroke();
      }
      ctx.strokeStyle = accent2;
      for (let y = -grid + gridOffset; y < height + grid; y += grid) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y - width * 0.18);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      particles.forEach((particle, index) => {
        const speed = reducedMotion ? 0.035 : particle.speed * energy;
        const y = height - (((t * speed * 90 + particle.seed) % (height + 80)) - 40);
        const x = width * particle.x + Math.sin(t * 0.82 + particle.seed) * 28 * particle.drift;
        const color = index % 3 === 0 ? highlight : index % 2 === 0 ? accent : accent2;
        ctx.fillStyle = `${color}${embedded ? "ba" : "9c"}`;
        ctx.beginPath();
        ctx.arc(x, y, particle.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      if (!reducedMotion) {
        const sweepCount = embedded ? 4 : 3;
        for (let index = 0; index < sweepCount; index += 1) {
          const progress = (t * (0.075 + index * 0.014) * energy + index * 0.29) % 1;
          const y = height * (0.16 + index * 0.18);
          const x = -width * 0.34 + progress * width * 1.62;
          const laser = ctx.createLinearGradient(x, y, x + width * 0.34, y + height * 0.08);
          laser.addColorStop(0, "rgba(255,255,255,0)");
          laser.addColorStop(0.5, index % 2 ? `${accent2}96` : `${highlight}a8`);
          laser.addColorStop(1, "rgba(255,255,255,0)");
          ctx.strokeStyle = laser;
          ctx.lineWidth = embedded ? 2 : 1.5;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + width * 0.38, y + height * 0.08);
          ctx.stroke();
        }
      }

      frame = window.requestAnimationFrame(render);
    };

    resize();
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    resizeObserver?.observe(canvas);
    window.addEventListener("resize", resize);
    frame = window.requestAnimationFrame(render);
    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [embedded]);

  return <canvas ref={canvasRef} className={["party-motion-canvas", className].filter(Boolean).join(" ")} aria-hidden="true" />;
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
  const [songMessages, setSongMessages] = useState([]);
  const [roomLoading, setRoomLoading] = useState(false);
  const [songsLoading, setSongsLoading] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [joiningRoom, setJoiningRoom] = useState(false);
  const [toast, setToast] = useState("");
  const [searchMode, setSearchMode] = useState("external");
  const [searchQuery, setSearchQuery] = useState("");
  const [externalSearchProvider, setExternalSearchProvider] = useState(savedExternalSearchProvider);
  const [youtubeLink, setYoutubeLink] = useState("");
  const [songDedication, setSongDedication] = useState("");
  const [mysteryAdd, setMysteryAdd] = useState(false);
  const [externalSearchStep, setExternalSearchStep] = useState("search");
  const [externalClipboardCandidate, setExternalClipboardCandidate] = useState(null);
  const [externalClipboardChecking, setExternalClipboardChecking] = useState(false);
  const [externalClipboardMessage, setExternalClipboardMessage] = useState("");
  const [clipboardPasteMode, setClipboardPasteMode] = useState(false);
  const [pendingSharedLink, setPendingSharedLink] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [addingSongKey, setAddingSongKey] = useState("");
  const [recentlyAddedSongId, setRecentlyAddedSongId] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [roomPanelOpen, setRoomPanelOpen] = useState(false);
  const [roomPanelTab, setRoomPanelTab] = useState("room");
  const [shareChoiceOpen, setShareChoiceOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [installHelpOpen, setInstallHelpOpen] = useState(false);
  const [roomQrOpen, setRoomQrOpen] = useState(false);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [externalTutorialOpen, setExternalTutorialOpen] = useState(false);
  const [selectedSongId, setSelectedSongId] = useState("");
  const [deleteRevealSongId, setDeleteRevealSongId] = useState("");
  const [emojiSongId, setEmojiSongId] = useState("");
  const [emojiPickerMode, setEmojiPickerMode] = useState("react");
  const [emojiBarPosition, setEmojiBarPosition] = useState(null);
  const [messageSongId, setMessageSongId] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [voteMenuSongId, setVoteMenuSongId] = useState("");
  const [installPrompt, setInstallPrompt] = useState(null);
  const [appInstalled, setAppInstalled] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
  }, [activeRoomId, user?.uid, room?.id, songs.length, members.length, roomLoading, songsLoading, membersLoading]);
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia?.("(max-width: 759px)")?.matches ?? false;
  });
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
  const [colorTheme, setColorTheme] = useState(savedColorTheme);
  const [partyMotionOverride, setPartyMotionOverride] = useState(savedPartyMotionOverride);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [emojiBursts, setEmojiBursts] = useState([]);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [floatingReactionEmoji, setFloatingReactionEmoji] = useState(EMOJIS[0]);
  const [floatingReactionChosen, setFloatingReactionChosen] = useState(false);
  const [roomShouts, setRoomShouts] = useState([]);
  const [roomShoutOpen, setRoomShoutOpen] = useState(false);
  const [roomShoutDraft, setRoomShoutDraft] = useState("");
  const [songReactionEmojiBySong, setSongReactionEmojiBySong] = useState({});
  const [votes, setVotes] = useState([]);
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);
  const [desktopPlayerSplit, setDesktopPlayerSplit] = useState(savedDesktopPlayerSplit);
  const [deviceId] = useState(savedDeviceId);
  const [playerChoicePrompt, setPlayerChoicePrompt] = useState(null);
  const [existingRoomPrompt, setExistingRoomPrompt] = useState(null);
  const [dismissedPlayerPromptKey, setDismissedPlayerPromptKey] = useState("");
  const [volumeControlOpen, setVolumeControlOpen] = useState(false);
  const [dismissedVersionPrompt, setDismissedVersionPrompt] = useState("");
  const [taglineDraft, setTaglineDraft] = useState("");
  const [cooldownNow, setCooldownNow] = useState(Date.now());
  const [playbackClock, setPlaybackClock] = useState(Date.now());
  const [playerCollapsed, setPlayerCollapsed] = useState(false);
  const roomAppRef = useRef(null);
  const queuePanelRef = useRef(null);
  const songListRef = useRef(null);
  const emojiBarRef = useRef(null);
  const roomShoutBackdropRef = useRef(null);
  const roomShoutTextareaRef = useRef(null);
  const clipboardPasteInputRef = useRef(null);
  const nicknameBackdropRef = useRef(null);
  const nicknameInputRef = useRef(null);
  const playerCardRef = useRef(null);
  const externalYouTubeTabRef = useRef(null);
  const externalClipboardCheckPendingRef = useRef(false);
  const externalSearchLeftAppRef = useRef(false);
  const externalSearchOpenedAtRef = useRef(0);
  const externalSearchLeftAtRef = useRef(0);
  const externalClipboardCheckTimerRef = useRef(null);
  const externalClipboardAutoAddInFlightRef = useRef(false);
  const externalClipboardAutoAddRetryRef = useRef(0);
  const pendingSharedLinkInFlightRef = useRef(false);
  const lastClipboardVideoIdRef = useRef("");
  const unavailableHandlingRef = useRef("");
  const creatingRoomRef = useRef(false);
  const joiningRoomRef = useRef(false);
  const floatingReactionPressTimerRef = useRef(0);
  const floatingReactionLongPressRef = useRef(false);
  const songSwipeStartRef = useRef(null);
  const songSwipeRevealedRef = useRef(false);
  const roomShoutSwipeStartRef = useRef(null);
  const previousNowPlayingId = useRef(undefined);
  const previousMemberIds = useRef(undefined);
  const noticeRoomId = useRef("");
  const lastPlayedSongId = useRef("");
  const reactionBaselineReadyRef = useRef(false);
  const reactionSeenIdsRef = useRef(new Set());
  const shoutBaselineReadyRef = useRef(false);
  const shoutSeenIdsRef = useRef(new Set());
  const applyingVoteIdsRef = useRef(new Set());
  const [playerFullscreen, setPlayerFullscreen] = useState(false);
  const selectedColorTheme = COLOR_THEMES.find((option) => option.id === colorTheme) || COLOR_THEMES[0];
  const baseTheme = selectedColorTheme.base || "dark";
  const isDarkTheme = baseTheme === "dark";
  const isIos = isIosDevice();
  const showFirefoxAndroidAuthNote = isFirefoxAndroid();

  function clearExternalClipboardCheckTimer() {
    if (!externalClipboardCheckTimerRef.current) return;
    window.clearTimeout(externalClipboardCheckTimerRef.current);
    externalClipboardCheckTimerRef.current = null;
  }

  function scheduleExternalClipboardAutoAdd(delayMs = 450) {
    if (!externalClipboardCheckPendingRef.current) return;
    clearExternalClipboardCheckTimer();
    externalClipboardCheckTimerRef.current = window.setTimeout(() => {
      externalClipboardCheckTimerRef.current = null;
      addSongFromClipboard({ automatic: true });
    }, delayMs);
  }

  function stopExternalClipboardAutoAdd() {
    clearExternalClipboardCheckTimer();
    externalClipboardCheckPendingRef.current = false;
    externalSearchLeftAppRef.current = false;
    externalSearchOpenedAtRef.current = 0;
    externalSearchLeftAtRef.current = 0;
    externalClipboardAutoAddRetryRef.current = 0;
  }

  useEffect(() => {
    const preventZoom = (event) => event.preventDefault();
    const preventModifiedWheelZoom = (event) => {
      if (event.ctrlKey || event.metaKey) event.preventDefault();
    };

    document.addEventListener("gesturestart", preventZoom, { passive: false });
    document.addEventListener("gesturechange", preventZoom, { passive: false });
    document.addEventListener("gestureend", preventZoom, { passive: false });
    window.addEventListener("wheel", preventModifiedWheelZoom, { passive: false });

    return () => {
      document.removeEventListener("gesturestart", preventZoom);
      document.removeEventListener("gesturechange", preventZoom);
      document.removeEventListener("gestureend", preventZoom);
      window.removeEventListener("wheel", preventModifiedWheelZoom);
    };
  }, []);

  useEffect(() => {
    function markExternalSearchLeftApp() {
      if (!externalClipboardCheckPendingRef.current) return;
      externalSearchLeftAppRef.current = true;
      if (!externalSearchLeftAtRef.current) externalSearchLeftAtRef.current = Date.now();
    }

    function handleExternalSearchReturn() {
      if (document.visibilityState === "hidden") {
        markExternalSearchLeftApp();
        return;
      }
      if (document.visibilityState !== "visible") return;
      try {
        const externalTab = externalYouTubeTabRef.current;
        if (externalTab && !externalTab.closed) externalTab.close();
      } catch {
        // Some browsers isolate YouTube's tab after navigation.
      }
      externalYouTubeTabRef.current = null;
      if (externalClipboardCheckPendingRef.current) {
        scheduleExternalClipboardAutoAdd(externalSearchLeftAppRef.current ? 500 : 900);
      }
    }

    window.addEventListener("focus", handleExternalSearchReturn);
    window.addEventListener("pagehide", markExternalSearchLeftApp);
    window.addEventListener("pageshow", handleExternalSearchReturn);
    document.addEventListener("visibilitychange", handleExternalSearchReturn);
    return () => {
      window.removeEventListener("focus", handleExternalSearchReturn);
      window.removeEventListener("pagehide", markExternalSearchLeftApp);
      window.removeEventListener("pageshow", handleExternalSearchReturn);
      document.removeEventListener("visibilitychange", handleExternalSearchReturn);
      clearExternalClipboardCheckTimer();
    };
  }, [activeRoomId, user?.uid, room?.id, songs.length, members.length, roomLoading, songsLoading, membersLoading]);

  useEffect(() => {
    if (!firebaseReady) {
      setAuthLoading(false);
      return undefined;
    }
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthLoading(false);
      setNickname(nicknameFor(nextUser, ""));
    }, (error) => {
      setToast(authErrorMessage(error));
      setAuthLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("partybeats-color-theme", colorTheme);
    } catch {
      // Color theme persistence is a convenience; the picker still works without storage.
    }
    document.documentElement.dataset.theme = baseTheme;
    document.documentElement.dataset.colorTheme = colorTheme;
  }, [baseTheme, colorTheme]);

  useEffect(() => {
    if (!confettiKey) return undefined;
    const timer = window.setTimeout(() => setConfettiKey(0), CONFETTI_LIFETIME_MS);
    return () => window.clearTimeout(timer);
  }, [confettiKey]);

  useEffect(() => {
    try {
      localStorage.setItem("partybeats-desktop-player-split", String(desktopPlayerSplit));
    } catch {
      // The divider still works if local storage is unavailable.
    }
  }, [desktopPlayerSplit]);

  useEffect(() => {
    try {
      localStorage.setItem("partybeats-external-search-provider", externalSearchProvider);
    } catch {
      // The external search choice still works if local storage is unavailable.
    }
  }, [externalSearchProvider]);

  function resizeDesktopPanels(event) {
    if (window.innerWidth < 980) return;
    const appRect = roomAppRef.current?.getBoundingClientRect();
    if (!appRect?.width) return;
    const nextSplit = Math.min(80, Math.max(45, ((event.clientX - appRect.left) / appRect.width) * 100));
    setDesktopPlayerSplit(Math.round(nextSplit * 10) / 10);
  }

  function startDesktopPanelResize(event) {
    if (window.innerWidth < 980) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    resizeDesktopPanels(event);
  }

  function adjustDesktopPanelSplit(event) {
    if (!["ArrowLeft", "ArrowRight", "Home"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "Home") {
      setDesktopPlayerSplit(DEFAULT_DESKTOP_PLAYER_SPLIT);
      return;
    }
    setDesktopPlayerSplit((current) => Math.min(80, Math.max(45, current + (event.key === "ArrowRight" ? 2 : -2))));
  }

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const handleAppInstalled = () => {
      setAppInstalled(true);
      setInstallPrompt(null);
      setToast("BP PartyBeats installed.");
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    const mobileQuery = window.matchMedia?.("(max-width: 759px)");
    if (!mobileQuery) return undefined;
    const updateMobileViewport = () => setIsMobileViewport(mobileQuery.matches);
    updateMobileViewport();
    mobileQuery.addEventListener?.("change", updateMobileViewport);
    return () => mobileQuery.removeEventListener?.("change", updateMobileViewport);
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setPlayerFullscreen(document.fullscreenElement === playerCardRef.current);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  useEffect(() => {
    if (!activeRoomId) return;
    resetWindowScroll();
    queuePanelRef.current?.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
    songListRef.current?.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
    const frame = window.requestAnimationFrame(resetWindowScroll);
    const shortTimer = window.setTimeout(resetWindowScroll, 80);
    const longTimer = window.setTimeout(resetWindowScroll, 350);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(shortTimer);
      window.clearTimeout(longTimer);
    };
  }, [activeRoomId]);

  useEffect(() => {
    if (!firebaseReady || !activeRoomId) {
      setRoom(null);
      setSongs([]);
      setMembers([]);
      setSongMessages([]);
      setVotes([]);
      setRoomLoading(false);
      setSongsLoading(false);
      setMembersLoading(false);
      return undefined;
    }
    if (!user) {
      setRoomLoading(true);
      setSongsLoading(true);
      setMembersLoading(true);
      return undefined;
    }

    let active = true;
    setRoomLoading(!room || room.id !== activeRoomId);
    setSongsLoading(true);
    setMembersLoading(true);

    const roomRef = doc(db, "rooms", activeRoomId);
    const songsRef = query(collection(db, "rooms", activeRoomId, "songs"), orderBy("position", "asc"));
    const membersRef = query(collection(db, "rooms", activeRoomId, "members"), orderBy("joinedAt", "asc"));
    const messagesRef = query(collection(db, "rooms", activeRoomId, "messages"), orderBy("createdAt", "asc"));
    const reactionsRef = query(collection(db, "rooms", activeRoomId, "reactions"), orderBy("createdAt", "asc"));
    const shoutsRef = query(collection(db, "rooms", activeRoomId, "shouts"), orderBy("createdAt", "asc"));
    const votesRef = query(collection(db, "rooms", activeRoomId, "votes"), orderBy("createdAt", "asc"));

    const handleRoomAccessLost = (error) => {
      setToast(error ? roomListenerErrorMessage(error) : "You were removed from this room.");
      clearRoomState();
    };

    const unsubRoom = onSnapshot(roomRef, (snap) => {
      if (!active) return;
      const nextRoom = snap.exists() ? { id: snap.id, ...snap.data() } : null;
      if (nextRoom?.closed) {
        setToast("Room closed because the last admin left.");
        clearRoomState();
        return;
      }
      setRoom(nextRoom);
      setRoomLoading(false);
    }, handleRoomAccessLost);

    const unsubSongs = onSnapshot(songsRef, (snap) => {
      if (!active) return;
      setSongs(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
      setSongsLoading(false);
    }, handleRoomAccessLost);
    const unsubMembers = onSnapshot(membersRef, (snap) => {
      if (!active) return;
      const nextMembers = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
      if (user?.uid && !nextMembers.some((member) => member.id === user.uid)) {
        handleRoomAccessLost();
        return;
      }
      setMembers(nextMembers);
      setMembersLoading(false);
    }, handleRoomAccessLost);
    const unsubMessages = onSnapshot(messagesRef, (snap) => {
      if (!active) return;
      setSongMessages(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
    }, handleRoomAccessLost);
    const unsubVotes = onSnapshot(votesRef, (snap) => {
      if (!active) return;
      setVotes(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
    }, handleRoomAccessLost);
    const unsubReactions = onSnapshot(reactionsRef, (snap) => {
      if (!active) return;
      if (!reactionBaselineReadyRef.current) {
        reactionSeenIdsRef.current = new Set(snap.docs.map((item) => item.id));
        reactionBaselineReadyRef.current = true;
        return;
      }
      snap.docs.forEach((item) => {
        if (reactionSeenIdsRef.current.has(item.id)) return;
        reactionSeenIdsRef.current.add(item.id);
        const data = item.data();
        if (!EMOJIS.includes(data.emoji)) return;
        spawnFloatingReaction(data.emoji);
      });
    }, handleRoomAccessLost);
    const unsubShouts = onSnapshot(shoutsRef, (snap) => {
      if (!active) return;
      if (!shoutBaselineReadyRef.current) {
        shoutSeenIdsRef.current = new Set(snap.docs.map((item) => item.id));
        shoutBaselineReadyRef.current = true;
        return;
      }
      snap.docs.forEach((item) => {
        if (shoutSeenIdsRef.current.has(item.id)) return;
        shoutSeenIdsRef.current.add(item.id);
        const data = item.data();
        if (!data.text || typeof data.text !== "string") return;
        spawnRoomShout({
          id: item.id,
          name: data.name || "Guest",
          text: data.text,
          isAnonymous: data.isAnonymous === true
        });
      });
    }, handleRoomAccessLost);
    return () => {
      active = false;
      unsubRoom();
      unsubSongs();
      unsubMembers();
      unsubMessages();
      unsubVotes();
      unsubReactions();
      unsubShouts();
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
    reactionBaselineReadyRef.current = false;
    reactionSeenIdsRef.current = new Set();
    shoutBaselineReadyRef.current = false;
    shoutSeenIdsRef.current = new Set();
    setNowPlayingNotice(null);
    setJoinNotice(null);
    setRoomShouts([]);
    setRoomShoutOpen(false);
    setNoticeBaselineReady(false);
  }, [activeRoomId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room");
    const sharedLink = extractSharedYouTubeLink(params);
    let rememberedRoomId = "";
    try {
      rememberedRoomId = normalizeRoomId(localStorage.getItem(LAST_ACTIVE_ROOM_KEY) || "");
    } catch {
      rememberedRoomId = "";
    }
    if (roomParam) {
      const normalized = normalizeRoomId(roomParam);
      setRoomId(normalized);
      setRestoreRoomId(normalized);
    } else if (sharedLink && /^[A-Z]{4}\d{3}$/.test(rememberedRoomId)) {
      setRoomId(rememberedRoomId);
      setActiveRoomId(rememberedRoomId);
      setRoom({ id: rememberedRoomId, roomId: rememberedRoomId, latestAppVersion: APP_VERSION, isRestoringShareTarget: true });
      setRoomLoading(true);
      setSongsLoading(true);
      setMembersLoading(true);
    }
    if (sharedLink) {
      setPendingSharedLink(sharedLink);
      setYoutubeLink(sharedLink);
      setExternalSearchStep("paste");
      setAddSheetOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!activeRoomId) return;
    try {
      localStorage.setItem(LAST_ACTIVE_ROOM_KEY, activeRoomId);
    } catch {
      // Local storage can be unavailable in private browsing.
    }
  }, [activeRoomId]);

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
  const activePlayerDeviceId = room?.activePlayerDeviceId || "";
  const isActiveDjAccount = Boolean(user && activeDjUid === user.uid);
  const isActiveDj = Boolean(isActiveDjAccount && (!activePlayerDeviceId || activePlayerDeviceId === deviceId));
  const isActiveDjPhone = Boolean(isActiveDj && isMobileViewport);
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
  const toastEnabled = room?.toastEnabled === true;
  const internalSearchEnabled = room?.internalSearchEnabled === true;
  const floatingReactionsEnabled = room?.floatingReactionsEnabled !== false;
  const roomShoutsEnabled = room?.roomShoutsEnabled !== false;
  const internalSearchAvailable = internalSearchEnabled || isActiveDjPhone;
  const visualizerEnabled = room?.visualizerEnabled === true;
  const roomPartyMotionEnabled = room?.partyMotionEnabled === true;
  const partyMotionEnabled = isAdmin ? roomPartyMotionEnabled : partyMotionOverride ?? roomPartyMotionEnabled;

  useEffect(() => {
    if (!internalSearchAvailable && searchMode === "internal") {
      setSearchMode("external");
    }
  }, [internalSearchAvailable, searchMode]);

  useEffect(() => {
    if (addSheetOpen && isActiveDjPhone && internalSearchAvailable) {
      setSearchMode("internal");
    }
  }, [addSheetOpen, internalSearchAvailable, isActiveDjPhone]);

  useEffect(() => {
    if (!addSheetOpen || !cooldownEnabled || isAdmin) return undefined;
    setCooldownNow(Date.now());
    const timer = window.setInterval(() => setCooldownNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [addSheetOpen, cooldownEnabled, isAdmin]);

  const memberRecord = members.find((member) => member.id === user?.uid);
  const cooldownUntil = cooldownEnabled && memberRecord?.lastAddedAt?.toMillis ? memberRecord.lastAddedAt.toMillis() + cooldownMs : 0;
  const cooldownRemaining = Math.max(0, cooldownUntil - cooldownNow);
  const cooldownCountdown = formatCountdown(cooldownRemaining);
  const nowPlayingSong = songs.find((song) => song.id === room?.nowPlayingId) || null;

  useEffect(() => {
    if (!activeRoomId || !nowPlayingSong) return undefined;
    setPlaybackClock(Date.now());
    const timer = window.setInterval(() => setPlaybackClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeRoomId, nowPlayingSong?.id]);

  const nowPlayingDisplay = nowPlayingSong ? playlistTrackDisplay(nowPlayingSong) : null;
  const reactionSong = songs.find((song) => song.id === emojiSongId) || null;
  const roomSyncing = roomLoading || songsLoading || membersLoading;
  const latestRoomVersion = room?.latestAppVersion || room?.appVersion || APP_VERSION;
  const appNeedsRefresh = Boolean(activeRoomId && room && compareAppVersions(APP_VERSION, latestRoomVersion) < 0);
  const nowPlayingSyncing = Boolean(room?.nowPlayingId && !nowPlayingSong && songsLoading);
  const roomNeedsFirstTrack = !songsLoading && songs.length === 0 && !room?.nowPlayingId;
  const canAddSong = isAdmin || roomNeedsFirstTrack || cooldownRemaining === 0;
  const nowPlayingIndex = songs.findIndex((song) => song.id === room?.nowPlayingId);
  const replaySong = nowPlayingIndex > 0
    ? [...songs.slice(0, nowPlayingIndex)].reverse().find((song) => !song.unavailable) || null
    : songs.find((song) => song.id === lastPlayedSongId.current && !song.unavailable) || null;
  const playbackState = {
    songId: room?.playbackSongId || room?.nowPlayingId || null,
    seconds: Math.max(0, Number(room?.playbackSeconds) || 0),
    state: room?.playbackState || "playing",
    updatedAt: room?.playbackUpdatedAt?.toMillis?.() || 0,
    command: room?.playbackCommand || "",
    commandId: room?.playbackCommandId || "",
    commandAt: room?.playbackCommandAt?.toMillis?.() || 0
  };
  const roomVolume = Math.min(100, Math.max(0, Number(room?.roomVolume ?? 80)));
  const roomTagline = String(room?.tagline || "").trim();
  const livePlaybackSeconds = playbackState.state === "playing" && playbackState.updatedAt
    ? playbackState.seconds + Math.max(0, (playbackClock - playbackState.updatedAt) / 1000)
    : playbackState.seconds;
  const nowPlayingDurationSeconds = Math.max(0, Number(nowPlayingSong?.durationSeconds) || 0);
  const displayPlaybackSeconds = nowPlayingDurationSeconds > 0
    ? Math.min(livePlaybackSeconds, nowPlayingDurationSeconds)
    : livePlaybackSeconds;
  const playbackTimeLabel = nowPlayingSong
    ? `${formatDuration(displayPlaybackSeconds) || "0:00"} / ${formatDuration(nowPlayingDurationSeconds) || "--:--"}`
    : "";
  const activeNickname = (memberRecord?.name || nickname).trim() || nicknameFor(user, "Guest");
  const memberById = (uid) => members.find((member) => member.id === uid);
  const activeDjStatus = isActiveDj
    ? "This device is the player"
    : isActiveDjAccount
      ? `Player on another device · ${activeDjName}`
      : `Player: ${activeDjName}`;

  useEffect(() => {
    if (!pendingSharedLink || !activeRoomId || !user || roomLoading || songsLoading) return undefined;
    const timer = window.setTimeout(() => {
      addIncomingSharedLink(pendingSharedLink);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [pendingSharedLink, activeRoomId, user?.uid, roomLoading, songsLoading]);

  useEffect(() => {
    if (!room || !user || !isAdmin || !isActiveDjAccount || !activePlayerDeviceId || activePlayerDeviceId === deviceId) {
      setPlayerChoicePrompt(null);
      return;
    }
    const promptKey = `${activeRoomId}:${activePlayerDeviceId}`;
    if (dismissedPlayerPromptKey === promptKey) {
      setPlayerChoicePrompt(null);
      return;
    }
    setPlayerChoicePrompt((current) => current?.key === promptKey ? current : {
      key: promptKey,
      roomId: activeRoomId,
      playerName: activeDjName
    });
  }, [activeRoomId, activeDjName, activePlayerDeviceId, deviceId, dismissedPlayerPromptKey, isActiveDjAccount, isAdmin, room, user]);
  const totalReactions = songs.reduce((total, song) => total + Object.keys(song.emojiByUser || {}).length, 0);
  const messagesForSong = (song) => [
    ...(song?.messages || []),
    ...songMessages.filter((message) => message.songId === song?.id)
  ];
  const totalMessages = songs.reduce((total, song) => total + messagesForSong(song).length, 0);
  const googleMemberCount = members.filter((member) => member.isAnonymous === false).length;
  const guestMemberCount = Math.max(0, members.length - googleMemberCount);
  const activeVotes = votes.filter((vote) => vote.status === "open" && songs.some((song) => song.id === vote.songId));
  const votePrompt = activeVotes.find((vote) => !vote.votesByUser?.[user?.uid]) || null;
  const voteThreshold = Math.max(1, Math.floor(members.length / 2) + 1);
  const voteActionLabel = (action) => {
    if (action === "playNext") return "Play Next";
    if (action === "removeSong") return "Remove Song";
    return "Vote";
  };
  const voteCounts = (vote) => {
    const values = Object.values(vote?.votesByUser || {});
    return {
      yes: values.filter((value) => value === "yes").length,
      no: values.filter((value) => value === "no").length,
      total: values.length
    };
  };
  const analyticsPeople = members
    .map((member) => {
      const added = songs.filter((song) => song.addedByUid === member.id).length;
      const reactions = songs.reduce((total, song) => total + (song.emojiByUser?.[member.id] ? 1 : 0), 0);
      const messages = songs.reduce((total, song) => (
        total + messagesForSong(song).filter((message) => message.uid === member.id).length
      ), 0);
      return { ...member, added, reactions, messages, total: added + reactions + messages };
    })
    .sort((a, b) => b.total - a.total || b.added - a.added || (a.name || "").localeCompare(b.name || ""));
  const mostReactedSongs = songs
    .map((song) => ({
      ...song,
      display: playlistTrackDisplay(song),
      reactionCount: Object.keys(song.emojiByUser || {}).length,
      messageCount: messagesForSong(song).length
    }))
    .filter((song) => song.reactionCount > 0 || song.messageCount > 0)
    .sort((a, b) => (b.reactionCount + b.messageCount) - (a.reactionCount + a.messageCount))
    .slice(0, 5);
  const crowdFavoriteSongId = mostReactedSongs[0]?.id || "";
  const mostMessagedSongId = [...songs]
    .map((song) => ({ id: song.id, count: messagesForSong(song).length }))
    .sort((a, b) => b.count - a.count)[0]?.count > 0
      ? [...songs].map((song) => ({ id: song.id, count: messagesForSong(song).length })).sort((a, b) => b.count - a.count)[0].id
      : "";
  const activeReactionStreak = members
    .map((member) => {
      let streak = 0;
      let best = 0;
      songs.forEach((song) => {
        if (song.emojiByUser?.[member.id]) {
          streak += 1;
          best = Math.max(best, streak);
        } else {
          streak = 0;
        }
      });
      return { ...member, streak: best };
    })
    .sort((a, b) => b.streak - a.streak)[0];

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
    setTaglineDraft(roomTagline);
  }, [roomTagline]);

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
    if (!noticeBaselineReady || songsLoading || !room?.nowPlayingId || !songListRef.current || !queuePanelRef.current) return;
    resetWindowScroll();
    const row = songListRef.current.querySelector(`[data-song-id="${room.nowPlayingId}"]`);
    if (!row) return;
    const panel = queuePanelRef.current;
    panel.scrollTo({
      top: Math.max(0, row.offsetTop - panel.offsetTop),
      left: 0,
      behavior: "smooth"
    });
  }, [noticeBaselineReady, songsLoading, room?.nowPlayingId]);

  useEffect(() => {
    if (!reactionSong || !songListRef.current || !emojiBarRef.current) {
      setEmojiBarPosition(null);
      return undefined;
    }

    let frame = 0;
    const updatePosition = () => {
      const row = songListRef.current?.querySelector(`[data-song-id="${reactionSong.id}"]`);
      const bar = emojiBarRef.current;
      if (!row || !bar) {
        setEmojiBarPosition(null);
        return;
      }

      const rowRect = row.getBoundingClientRect();
      const barRect = bar.getBoundingClientRect();
      const panelRect = queuePanelRef.current?.getBoundingClientRect();
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop || 0;
      const viewportLeft = viewport?.offsetLeft || 0;
      const viewportWidth = viewport?.width || window.innerWidth;
      const viewportHeight = viewport?.height || window.innerHeight;
      const safeTop = viewportTop + 12;
      const safeBottom = viewportTop + viewportHeight - 12;
      const rowSafeTop = Math.max(safeTop, (panelRect?.top || safeTop) + 12);
      const sheetWidth = Math.min(360, Math.max(260, viewportWidth - 24));
      const maxHeight = Math.max(120, viewportHeight - 24);
      const gap = 8;
      const isMessageMode = messageSongId === reactionSong.id;

      const sheetPosition = () => ({
        top: Math.round(Math.max(safeTop, safeBottom - Math.min(barRect.height, maxHeight))),
        left: Math.round(viewportLeft + viewportWidth / 2),
        width: Math.round(sheetWidth),
        maxHeight: Math.round(maxHeight),
        placement: "sheet"
      });

      if (isMessageMode) {
        const nextPosition = sheetPosition();
        setEmojiBarPosition((current) => (
          current?.top === nextPosition.top
          && current?.left === nextPosition.left
          && current?.width === nextPosition.width
          && current?.maxHeight === nextPosition.maxHeight
          && current?.placement === nextPosition.placement
            ? current
            : nextPosition
        ));
        return;
      }

      let placement = "";
      let top = rowRect.top - barRect.height - gap;
      if (top >= rowSafeTop) {
        placement = "above";
      } else {
        top = rowRect.bottom + gap;
        if (top + barRect.height <= safeBottom) {
          placement = "below";
        }
      }

      if (!placement) {
        const nextPosition = sheetPosition();
        setEmojiBarPosition((current) => (
          current?.top === nextPosition.top
          && current?.left === nextPosition.left
          && current?.width === nextPosition.width
          && current?.maxHeight === nextPosition.maxHeight
          && current?.placement === nextPosition.placement
            ? current
            : nextPosition
        ));
        return;
      }

      const halfWidth = sheetWidth / 2;
      const left = Math.min(
        viewportLeft + viewportWidth - halfWidth - 12,
        Math.max(viewportLeft + halfWidth + 12, rowRect.left + rowRect.width / 2)
      );
      const nextPosition = {
        top: Math.round(top),
        left: Math.round(left),
        width: Math.round(sheetWidth),
        maxHeight: Math.round(maxHeight),
        placement
      };
      setEmojiBarPosition((current) => (
        current?.top === nextPosition.top
        && current?.left === nextPosition.left
        && current?.width === nextPosition.width
        && current?.maxHeight === nextPosition.maxHeight
        && current?.placement === nextPosition.placement
          ? current
          : nextPosition
      ));
    };
    const scheduleUpdate = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(updatePosition);
    };

    scheduleUpdate();
    const delayedUpdate = window.setTimeout(scheduleUpdate, 180);
    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(scheduleUpdate);
    resizeObserver?.observe(emojiBarRef.current);

    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, true);
    window.visualViewport?.addEventListener("resize", scheduleUpdate);
    window.visualViewport?.addEventListener("scroll", scheduleUpdate);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(delayedUpdate);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate, true);
      window.visualViewport?.removeEventListener("resize", scheduleUpdate);
      window.visualViewport?.removeEventListener("scroll", scheduleUpdate);
    };
  }, [reactionSong?.id, messageSongId]);

  useEffect(() => {
    if (!selfRenameOpen || !nicknameBackdropRef.current) return undefined;
    const viewport = window.visualViewport;
    let frame = 0;
    const updateNicknameModal = () => {
      const backdrop = nicknameBackdropRef.current;
      if (!backdrop) return;
      backdrop.style.setProperty("--nickname-viewport-top", `${viewport?.offsetTop || 0}px`);
      backdrop.style.setProperty("--nickname-viewport-height", `${viewport?.height || window.innerHeight}px`);
    };
    const keepNicknameVisible = () => {
      updateNicknameModal();
      nicknameInputRef.current?.scrollIntoView?.({ block: "center", behavior: "auto" });
    };
    const scheduleUpdate = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(updateNicknameModal);
    };

    updateNicknameModal();
    nicknameInputRef.current?.focus({ preventScroll: true });
    const shortTimer = window.setTimeout(keepNicknameVisible, 120);
    const longTimer = window.setTimeout(keepNicknameVisible, 420);
    viewport?.addEventListener("resize", scheduleUpdate);
    viewport?.addEventListener("scroll", scheduleUpdate);
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(shortTimer);
      window.clearTimeout(longTimer);
      viewport?.removeEventListener("resize", scheduleUpdate);
      viewport?.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [selfRenameOpen]);

  useEffect(() => {
    if (!roomShoutOpen || !roomShoutBackdropRef.current) return undefined;
    const viewport = window.visualViewport;
    let frame = 0;
    const updateShoutModal = () => {
      const backdrop = roomShoutBackdropRef.current;
      if (!backdrop) return;
      backdrop.style.setProperty("--shout-viewport-top", `${viewport?.offsetTop || 0}px`);
      backdrop.style.setProperty("--shout-viewport-height", `${viewport?.height || window.innerHeight}px`);
    };
    const keepComposerVisible = () => {
      updateShoutModal();
      roomShoutTextareaRef.current?.scrollIntoView?.({ block: "center", behavior: "auto" });
    };
    const scheduleUpdate = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(updateShoutModal);
    };

    updateShoutModal();
    roomShoutTextareaRef.current?.focus({ preventScroll: true });
    const shortTimer = window.setTimeout(keepComposerVisible, 120);
    const longTimer = window.setTimeout(keepComposerVisible, 420);
    viewport?.addEventListener("resize", scheduleUpdate);
    viewport?.addEventListener("scroll", scheduleUpdate);
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(shortTimer);
      window.clearTimeout(longTimer);
      viewport?.removeEventListener("resize", scheduleUpdate);
      viewport?.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [roomShoutOpen]);

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
      return null;
    }
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      const result = await signInWithPopup(auth, provider);
      if (result?.user) {
        setUser(result.user);
        setNickname(nicknameFor(result.user, ""));
      }
      return result?.user || null;
    } catch (error) {
      if (error.code === "auth/popup-blocked") {
        setToast("Google sign-in popup was blocked. Allow popups for BP PartyBeats, then try again.");
        return null;
      }
      if (["auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(error.code)) {
        return null;
      }
      setToast(authErrorMessage(error));
      return null;
    }
  }

  async function rememberUserRoom(roomUser, nextRoomId) {
    if (!roomUser || roomUser.isAnonymous || !nextRoomId) return;
    await setDoc(
      doc(db, "users", roomUser.uid),
      {
        uid: roomUser.uid,
        activeRoomId: nextRoomId,
        activeRoomUpdatedAt: serverTimestamp()
      },
      { merge: true }
    ).catch(() => undefined);
  }

  async function clearRememberedUserRoom(roomUser, leavingRoomId) {
    if (!roomUser || roomUser.isAnonymous) return;
    const userRoomRef = doc(db, "users", roomUser.uid);
    try {
      const snap = await getDoc(userRoomRef);
      if (!snap.exists() || snap.data().activeRoomId !== leavingRoomId) return;
      await updateDoc(userRoomRef, {
        activeRoomId: deleteField(),
        activeRoomUpdatedAt: serverTimestamp()
      });
    } catch {
      // This pointer is a convenience. Room membership is the source of truth.
    }
  }

  async function findExistingGoogleRoom(roomUser) {
    if (!roomUser || roomUser.isAnonymous) return null;
    try {
      const userRoomSnap = await getDoc(doc(db, "users", roomUser.uid));
      const rememberedRoomId = normalizeRoomId(userRoomSnap.exists() ? userRoomSnap.data().activeRoomId || "" : "");
      if (!rememberedRoomId) return null;

      const rememberedRoomSnap = await getDoc(doc(db, "rooms", rememberedRoomId));
      if (!rememberedRoomSnap.exists() || rememberedRoomSnap.data().closed) {
        await clearRememberedUserRoom(roomUser, rememberedRoomId);
        return null;
      }

      return {
        roomId: rememberedRoomId,
        room: rememberedRoomSnap.data(),
        user: roomUser
      };
    } catch {
      return null;
    }
  }

  async function signInAndCreateRoom() {
    const googleUser = user && !user.isAnonymous ? user : await signInGoogle();
    if (!googleUser || googleUser.isAnonymous) return;
    const existingRoom = await findExistingGoogleRoom(googleUser);
    if (existingRoom) {
      setExistingRoomPrompt(existingRoom);
      return;
    }
    await createRoom(googleUser);
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

  async function createRoom(hostUser = user) {
    if (creatingRoomRef.current) return;
    if (!hostUser || hostUser.isAnonymous) {
      setToast("Sign in with Google to create a room.");
      return;
    }

    creatingRoomRef.current = true;
    setCreatingRoom(true);
    const hostName = (hostUser.uid === user?.uid ? activeNickname : nicknameFor(hostUser, "")).trim() || nicknameFor(hostUser, "Host");

    try {
      let nextId = "";
      let lastCreateError = null;
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const candidate = randomRoomId();
        try {
          await setDoc(doc(db, "rooms", candidate), {
            roomId: candidate,
            adminUid: hostUser.uid,
            adminUids: { [hostUser.uid]: true },
            adminName: hostName,
            activeDjUid: hostUser.uid,
            activeDjName: hostName,
            activePlayerDeviceId: deviceId,
            appVersion: APP_VERSION,
            latestAppVersion: APP_VERSION,
            latestAppVersionUpdatedAt: serverTimestamp(),
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
            toastEnabled: false,
            internalSearchEnabled: false,
            floatingReactionsEnabled: true,
            roomShoutsEnabled: true,
            visualizerEnabled: false,
            partyMotionEnabled: false,
            tagline: "",
            roomVolume: 80,
            nowPlayingId: null
          });
          nextId = candidate;
          break;
        } catch (error) {
          lastCreateError = error;
          if (error?.code !== "permission-denied") throw error;
        }
      }
      if (!nextId) {
        throw lastCreateError || new Error("Could not find a free room ID.");
      }
      await joinRoomById(nextId, { userOverride: hostUser, nicknameOverride: hostName });
    } catch (error) {
      setToast(roomCreateErrorMessage(error));
    } finally {
      creatingRoomRef.current = false;
      setCreatingRoom(false);
    }
  }

  async function joinRoomById(rawId = roomId, options = {}) {
    if (joiningRoomRef.current) return;
    const nextRoomId = normalizeRoomId(rawId);
    if (!/^[A-Z]{4}\d{3}$/.test(nextRoomId)) {
      if (!options.silent) setToast("Room IDs look like VIBE123.");
      return;
    }

    joiningRoomRef.current = true;
    setJoiningRoom(true);
    try {
      const joiningUser = options.userOverride || user || await ensureUserForJoin();
      if (!joiningUser) {
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
      const memberRef = doc(db, "rooms", nextRoomId, "members", joiningUser.uid);
      let memberSnap = null;
      try {
        memberSnap = await getDoc(memberRef);
      } catch (error) {
        if (error?.code !== "permission-denied") throw error;
      }
      const savedMemberName = memberSnap?.exists() ? (memberSnap.data().name || "").trim() : "";
      const roomNickname = (savedMemberName || options.nicknameOverride || activeNickname || nicknameFor(joiningUser, "Guest")).slice(0, 30);
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
      await rememberUserRoom(joiningUser, nextRoomId);
      const roomData = roomSnap.data();
      const latestAppVersion = newerAppVersion(roomData.latestAppVersion || roomData.appVersion || APP_VERSION, APP_VERSION);
      await updateDoc(doc(db, "rooms", nextRoomId), {
        latestAppVersion,
        latestAppVersionUpdatedAt: serverTimestamp(),
        ...roomActivityUpdate()
      }).catch(() => undefined);
      setNickname(roomNickname);
      setRoom({ id: nextRoomId, ...roomData, latestAppVersion });
      setRoomLoading(false);
      setSongsLoading(true);
      setMembersLoading(true);
      setMembers((current) => current.some((member) => member.id === joiningUser.uid)
        ? current
        : [{
            id: joiningUser.uid,
            uid: joiningUser.uid,
            name: roomNickname,
            isAnonymous: joiningUser.isAnonymous
          }]);
      setActiveRoomId(nextRoomId);
      setRoomId(nextRoomId);
      window.history.replaceState({}, "", `${window.location.pathname}?room=${nextRoomId}`);
      if (!options.silent) setConfettiKey(Date.now());
    } catch (error) {
      if (!options.silent) setToast(roomJoinErrorMessage(error));
    } finally {
      joiningRoomRef.current = false;
      setJoiningRoom(false);
    }
  }

  async function addSong(event, selectedVideo = null) {
    event?.preventDefault();
    if (!user || !activeRoomId) return false;

    const videoId = selectedVideo?.videoId;
    const addKey = `${activeRoomId}:${videoId || "none"}`;
    if (!videoId) {
      setToast("Choose a YouTube search result.");
      return false;
    }
    if (addingSongKey === addKey) return false;
    if (!canAddSong) {
      setToast(cooldownRemaining > 0
        ? `Cooldown active: ${Math.ceil(cooldownRemaining / 1000)}s left.`
        : "Song cooldown is on.");
      return false;
    }

    setAddingSongKey(addKey);
    if (!YOUTUBE_API_KEY) {
      setToast("Could not verify whether that song can play inside PartyBeats.");
      setAddingSongKey("");
      return false;
    }
    const playbackDetails = await fetchYouTubePlaybackDetails(videoId);
    if (!playbackDetails) {
      setToast("Could not verify whether that song can play inside PartyBeats, so it was not added.");
      setAddingSongKey("");
      return false;
    }
    if (!playbackDetails.embeddable) {
      setToast("That song cannot play inside PartyBeats, so it was not added.");
      setAddingSongKey("");
      return false;
    }
    const durationSeconds = playbackDetails.durationSeconds || Number(selectedVideo?.durationSeconds) || null;
    if (!isAdmin && !durationSeconds) {
      setToast("Could not verify song length. Ask an admin to add this track.");
      setAddingSongKey("");
      return false;
    }
    if (!isAdmin && durationSeconds > NON_ADMIN_MAX_SONG_SECONDS) {
      setToast("Only admins can add songs longer than 10 minutes.");
      setAddingSongKey("");
      return false;
    }

    const title = decodeHtmlEntities(selectedVideo?.title || "YouTube track");
    const channelTitle = decodeHtmlEntities(selectedVideo?.channelTitle || "YouTube");
    const thumbnail = selectedVideo?.thumbnail || youtubeThumb(videoId);
    const dedication = songDedication.trim().slice(0, 48);
    const nextPosition = nextQueuePosition(songs);
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
      dedication,
      mystery: mysteryAdd,
      emojiByUser: {},
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
      return false;
    }
    setRecentlyAddedSongId(songRef.id);
    window.setTimeout(() => {
      setRecentlyAddedSongId((current) => current === songRef.id ? "" : current);
    }, 2600);
    setToast(!nowPlayingSong ? `Now playing: ${title}` : `Added to queue: ${title}`);
    setAddingSongKey("");
    setSearchResults([]);
    setYoutubeLink("");
    setSongDedication("");
    setMysteryAdd(false);
    setAddSheetOpen(false);
    return true;
  }

  async function fetchYouTubePlaybackDetails(videoId) {
    if (!YOUTUBE_API_KEY || !videoId) return null;
    try {
      const params = new URLSearchParams({
        part: "contentDetails,status",
        id: videoId,
        key: YOUTUBE_API_KEY
      });
      const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "YouTube playback check failed.");
      const item = data.items?.[0];
      if (!item) return null;
      return {
        durationSeconds: parseIsoDurationSeconds(item.contentDetails?.duration),
        embeddable: item.status?.embeddable === true
          && item.status?.uploadStatus === "processed"
          && videoAvailableInRegion(item.contentDetails)
      };
    } catch {
      return null;
    }
  }

  async function fetchYouTubePlaybackDetailsBatch(videoIds) {
    const cleanIds = [...new Set((videoIds || []).map(cleanYouTubeVideoId).filter(Boolean))];
    if (!YOUTUBE_API_KEY || cleanIds.length === 0) return {};
    try {
      const params = new URLSearchParams({
        part: "contentDetails,status",
        id: cleanIds.join(","),
        key: YOUTUBE_API_KEY
      });
      const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "YouTube playback check failed.");
      return (data.items || []).reduce((details, item) => {
        details[item.id] = {
          durationSeconds: parseIsoDurationSeconds(item.contentDetails?.duration),
          embeddable: item.status?.embeddable === true
            && item.status?.uploadStatus === "processed"
            && videoAvailableInRegion(item.contentDetails)
        };
        return details;
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
    const playlistId = extractYouTubePlaylistId(youtubeLink);
    if (shouldImportYouTubePlaylist(youtubeLink)) {
      const imported = await importYouTubePlaylist(playlistId);
      if (imported) {
        await clearClipboardAfterExternalSearch();
        resetExternalClipboardPrompt();
        setExternalSearchStep("search");
      }
      return;
    }
    const videoId = cleanYouTubeVideoId(extractYouTubeVideoId(youtubeLink));
    if (!videoId) {
      setToast("Paste a valid YouTube song, album, or playlist link.");
      return;
    }
    const selectedVideo = await fetchYouTubeLinkDetails(videoId);
    const added = await addSong(null, selectedVideo);
    if (added) {
      await clearClipboardAfterExternalSearch();
      resetExternalClipboardPrompt();
      setExternalSearchStep("search");
    }
  }

  async function addIncomingSharedLink(sharedLink) {
    const shareUrl = extractYouTubeShareUrl(sharedLink);
    if (!shareUrl || pendingSharedLinkInFlightRef.current || addingSongKey) return false;
    if (!activeRoomId || !user) {
      setYoutubeLink(shareUrl);
      setExternalSearchStep("paste");
      setAddSheetOpen(true);
      return false;
    }

    pendingSharedLinkInFlightRef.current = true;
    setExternalClipboardChecking(true);
    setExternalClipboardMessage("Adding shared link...");
    setYoutubeLink(shareUrl);
    setExternalSearchStep("paste");
    setAddSheetOpen(true);
    try {
      const playlistId = extractYouTubePlaylistId(shareUrl);
      if (shouldImportYouTubePlaylist(shareUrl)) {
        setExternalClipboardMessage("Importing shared playlist...");
        const imported = await importYouTubePlaylist(playlistId);
        if (imported) {
          setPendingSharedLink("");
          resetExternalClipboardPrompt();
          setExternalSearchStep("search");
          window.history.replaceState({}, "", `${window.location.pathname}?room=${activeRoomId}`);
        } else {
          setExternalClipboardMessage("Could not import the shared playlist. Try Add Link below.");
        }
        return imported;
      }

      const videoId = cleanYouTubeVideoId(extractYouTubeVideoId(shareUrl));
      if (!videoId) {
        setExternalClipboardMessage("That share did not include a playable YouTube link. Paste the link below, then tap Add Link.");
        return false;
      }
      const selectedVideo = await fetchYouTubeLinkDetails(videoId);
      const added = await addSong(null, selectedVideo);
      if (added) {
        setPendingSharedLink("");
        resetExternalClipboardPrompt();
        setExternalSearchStep("search");
        window.history.replaceState({}, "", `${window.location.pathname}?room=${activeRoomId}`);
      } else {
        setExternalClipboardMessage("Could not add the shared song. Try Add Link below, or copy a different YouTube link.");
      }
      return added;
    } finally {
      pendingSharedLinkInFlightRef.current = false;
      setExternalClipboardChecking(false);
    }
  }

  async function addPastedSongLink(event) {
    const pastedText = event.clipboardData?.getData("text") || "";
    const shareUrl = extractYouTubeShareUrl(pastedText);
    if (!shareUrl) {
      setExternalClipboardMessage("That paste did not include a YouTube or YouTube Music link.");
      return;
    }
    event.preventDefault();
    setYoutubeLink(shareUrl);
    await addIncomingSharedLink(shareUrl);
  }

  async function addCopiedSongFromButton() {
    await addSongFromClipboard();
  }

  function resetExternalClipboardPrompt() {
    setExternalClipboardCandidate(null);
    setExternalClipboardMessage("");
    setExternalClipboardChecking(false);
    setClipboardPasteMode(false);
    lastClipboardVideoIdRef.current = "";
  }

  function requestClipboardPaste(message = "Tap the field below, paste the copied link, and PartyBeats will add it.") {
    setClipboardPasteMode(true);
    setExternalClipboardMessage(message);
    window.setTimeout(() => {
      clipboardPasteInputRef.current?.focus();
    }, 80);
  }

  async function clearClipboardAfterExternalSearch() {
    try {
      await navigator.clipboard?.writeText("");
    } catch {
      // Clipboard writes can be blocked by the browser or OS permissions.
    }
  }

  async function checkExternalSearchClipboard() {
    if (!navigator.clipboard?.readText) {
      setExternalClipboardMessage("Tap Check Clipboard or paste the copied YouTube link below.");
      return;
    }

    setExternalClipboardChecking(true);
    setExternalClipboardMessage("Checking clipboard...");
    try {
      const clipboardText = (await navigator.clipboard.readText()).trim();
      const shareUrl = extractYouTubeShareUrl(clipboardText);
      const playlistId = extractYouTubePlaylistId(shareUrl);
      if (shouldImportYouTubePlaylist(shareUrl)) {
        const playlistKey = `playlist:${playlistId}`;
        if (playlistKey === lastClipboardVideoIdRef.current) {
          setExternalClipboardMessage("");
          return;
        }
        lastClipboardVideoIdRef.current = playlistKey;
        setYoutubeLink(shareUrl);
        setExternalClipboardCandidate(null);
        setExternalClipboardMessage("Playlist link found. Tap Add from Clipboard to import it.");
        return;
      }
      const videoId = cleanYouTubeVideoId(extractYouTubeVideoId(shareUrl));
      if (!videoId) {
        setExternalClipboardCandidate(null);
        setExternalClipboardMessage("No YouTube link found. Tap Check Clipboard again or paste it below.");
        return;
      }
      if (videoId === lastClipboardVideoIdRef.current) {
        setExternalClipboardMessage("");
        return;
      }
      lastClipboardVideoIdRef.current = videoId;
      setYoutubeLink(shareUrl);
      const selectedVideo = await fetchYouTubeLinkDetails(videoId);
      setExternalClipboardCandidate({ ...selectedVideo, sourceLink: shareUrl });
      setExternalClipboardMessage("");
    } catch {
      setExternalClipboardCandidate(null);
      setExternalClipboardMessage("Tap Check Clipboard or paste the copied YouTube link below.");
    } finally {
      setExternalClipboardChecking(false);
    }
  }

  async function addSongFromClipboard(options = {}) {
    const automatic = Boolean(options?.automatic);
    if (automatic && externalClipboardAutoAddInFlightRef.current) return;
    const roomReadyForClipboardAdd = Boolean(activeRoomId && user && (room?.id === activeRoomId || songs.length > 0 || members.length > 0));
    if (automatic && !roomReadyForClipboardAdd) {
      if (externalClipboardAutoAddRetryRef.current < 5) {
        externalClipboardAutoAddRetryRef.current += 1;
        setExternalClipboardMessage("Waiting for the room, then adding your copied link...");
        scheduleExternalClipboardAutoAdd(850);
      } else {
        setExternalClipboardMessage("PartyBeats is still syncing. Tap Add from Clipboard when the room finishes loading.");
      }
      return;
    }
    if (!navigator.clipboard?.readText) {
      if (!automatic) requestClipboardPaste("Your browser needs the native Paste action. Paste the copied link below.");
      return;
    }

    if (automatic) externalClipboardAutoAddInFlightRef.current = true;
    setExternalClipboardChecking(true);
    setExternalClipboardMessage(automatic ? "Checking copied link..." : "Checking clipboard...");
    try {
      const clipboardText = (await navigator.clipboard.readText()).trim();
      const shareUrl = extractYouTubeShareUrl(clipboardText);
      const playlistId = extractYouTubePlaylistId(shareUrl);
      if (shouldImportYouTubePlaylist(shareUrl)) {
        const playlistKey = `playlist:${playlistId}`;
        if (automatic && playlistKey === lastClipboardVideoIdRef.current) return;
        setYoutubeLink(shareUrl);
        setExternalClipboardMessage("Importing playlist...");
        const imported = await importYouTubePlaylist(playlistId);
        if (imported) {
          lastClipboardVideoIdRef.current = playlistKey;
          stopExternalClipboardAutoAdd();
          await clearClipboardAfterExternalSearch();
          resetExternalClipboardPrompt();
          setExternalSearchStep("search");
        } else {
          if (automatic && externalClipboardAutoAddRetryRef.current < 2) {
            externalClipboardAutoAddRetryRef.current += 1;
            setExternalClipboardMessage("Trying the copied playlist again...");
            scheduleExternalClipboardAutoAdd(1100);
            return;
          }
          stopExternalClipboardAutoAdd();
          setExternalClipboardMessage("Playlist link found. Try again or paste a different link below.");
        }
        return;
      }
      const videoId = cleanYouTubeVideoId(extractYouTubeVideoId(shareUrl));
      if (!videoId) {
        setYoutubeLink(clipboardText);
        if (!automatic) {
          setExternalClipboardMessage("No playable YouTube song link was found. Paste the link below, then tap Add Link.");
        } else {
          setExternalClipboardMessage("No copied YouTube link found yet. If it does not auto-add, tap Add Copied Song.");
        }
        return;
      }
      if (automatic && videoId === lastClipboardVideoIdRef.current) return;
      setYoutubeLink(shareUrl);
      setExternalClipboardMessage("Adding song...");
      const selectedVideo = await fetchYouTubeLinkDetails(videoId);
      const added = await addSong(null, selectedVideo);
      if (added) {
        lastClipboardVideoIdRef.current = videoId;
        stopExternalClipboardAutoAdd();
        await clearClipboardAfterExternalSearch();
        resetExternalClipboardPrompt();
        setExternalSearchStep("search");
      } else {
        if (automatic && externalClipboardAutoAddRetryRef.current < 2) {
          externalClipboardAutoAddRetryRef.current += 1;
          setExternalClipboardMessage("Trying the copied song again...");
          scheduleExternalClipboardAutoAdd(1100);
          return;
        }
        stopExternalClipboardAutoAdd();
        setExternalClipboardMessage("Could not add this link. Try Add Link below, or copy a different YouTube song link.");
      }
    } catch {
      if (automatic) {
        stopExternalClipboardAutoAdd();
        requestClipboardPaste("Your browser blocked automatic clipboard access. Tap Add Copied Song, or paste the copied link below.");
      } else {
        requestClipboardPaste("Your browser needs the native Paste action. Paste the copied link below.");
      }
    } finally {
      setExternalClipboardChecking(false);
      externalClipboardAutoAddInFlightRef.current = false;
    }
  }

  async function addClipboardCandidate() {
    if (!externalClipboardCandidate) return;
    const added = await addSong(null, externalClipboardCandidate);
    if (added) {
      await clearClipboardAfterExternalSearch();
      resetExternalClipboardPrompt();
      setExternalSearchStep("search");
    }
  }

  async function cancelExternalPasteStep() {
    await clearClipboardAfterExternalSearch();
    clearExternalClipboardCheckTimer();
    externalClipboardCheckPendingRef.current = false;
    externalSearchLeftAppRef.current = false;
    externalSearchOpenedAtRef.current = 0;
    externalSearchLeftAtRef.current = 0;
    resetExternalClipboardPrompt();
    setYoutubeLink("");
    setExternalSearchStep("search");
  }

  async function importYouTubePlaylist(playlistId) {
    if (!isAdmin) {
      setToast("Only admins can add a full album or playlist.");
      return false;
    }
    if (!YOUTUBE_API_KEY) {
      setToast("Album imports require VITE_YOUTUBE_API_KEY.");
      return false;
    }

    setAddingSongKey(`${activeRoomId}:playlist:${playlistId}`);
    try {
      const playlistParams = new URLSearchParams({
        part: "snippet,contentDetails",
        playlistId,
        maxResults: "50",
        key: YOUTUBE_API_KEY
      });
      const playlistResponse = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?${playlistParams.toString()}`);
      const playlistData = await playlistResponse.json();
      if (!playlistResponse.ok) throw new Error(playlistData.error?.message || "Album lookup failed.");

      const playlistItems = (playlistData.items || [])
        .map((item) => ({
          videoId: cleanYouTubeVideoId(item.contentDetails?.videoId || item.snippet?.resourceId?.videoId),
          title: decodeHtmlEntities(item.snippet?.title || "YouTube track"),
          channelTitle: decodeHtmlEntities(item.snippet?.videoOwnerChannelTitle || item.snippet?.channelTitle || "YouTube"),
          thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url
        }))
        .filter((item) => item.videoId && item.title !== "Deleted video" && item.title !== "Private video");

      if (!playlistItems.length) {
        setToast("No available songs were found in that album or playlist.");
        setAddingSongKey("");
        return false;
      }

      const videoParams = new URLSearchParams({
        part: "snippet,contentDetails,status",
        id: playlistItems.map((item) => item.videoId).join(","),
        key: YOUTUBE_API_KEY
      });
      const videoResponse = await fetch(`https://www.googleapis.com/youtube/v3/videos?${videoParams.toString()}`);
      const videoData = await videoResponse.json();
      if (!videoResponse.ok) throw new Error(videoData.error?.message || "Album track lookup failed.");
      const detailsById = new Map((videoData.items || []).map((item) => [item.id, item]));
      const tracks = playlistItems.filter((item) => {
        const details = detailsById.get(item.videoId);
        return details?.status?.embeddable === true
          && details?.status?.uploadStatus === "processed"
          && Number(parseIsoDurationSeconds(details.contentDetails?.duration)) > 0
          && videoAvailableInRegion(details.contentDetails);
      });
      if (!tracks.length) throw new Error("No playable album tracks were found.");

      const batch = writeBatch(db);
      const startingPosition = nextQueuePosition(songs);
      const dedication = songDedication.trim().slice(0, 48);
      let firstSongRef = null;
      tracks.forEach((track, index) => {
        const details = detailsById.get(track.videoId);
        const songRef = doc(collection(db, "rooms", activeRoomId, "songs"));
        if (!firstSongRef) firstSongRef = songRef;
        batch.set(songRef, {
          title: decodeHtmlEntities(details.snippet?.title || track.title),
          artist: decodeHtmlEntities(details.snippet?.channelTitle || track.channelTitle),
          link: youtubeWatchUrl(track.videoId),
          provider: "youtube",
          videoId: track.videoId,
          thumbnail: details.snippet?.thumbnails?.medium?.url || track.thumbnail || youtubeThumb(track.videoId),
          durationSeconds: parseIsoDurationSeconds(details.contentDetails?.duration) || null,
          addedByUid: user.uid,
          addedByName: activeNickname,
          addedByIsAnonymous: user.isAnonymous,
          position: startingPosition + (index / 1000),
          dedication,
          mystery: mysteryAdd,
          emojiByUser: {},
          createdAt: serverTimestamp()
        });
      });

      if (!nowPlayingSong && firstSongRef) {
        const roomUpdate = { nowPlayingId: firstSongRef.id };
        if (isActiveDj) {
          roomUpdate.playbackSongId = firstSongRef.id;
          roomUpdate.playbackSeconds = 0;
          roomUpdate.playbackState = "playing";
          roomUpdate.playbackUpdatedAt = serverTimestamp();
          roomUpdate.playbackUpdatedBy = user.uid;
        }
        batch.update(doc(db, "rooms", activeRoomId), roomUpdate);
      }
      batch.set(doc(db, "rooms", activeRoomId, "members", user.uid), { lastAddedAt: serverTimestamp() }, { merge: true });
      await batch.commit();
      await touchRoomActivity();
      const skippedCount = playlistItems.length - tracks.length;
      setToast(`Added ${tracks.length} playable tracks${skippedCount ? ` and skipped ${skippedCount} unavailable tracks` : ""}.`);
      setYoutubeLink("");
      setSongDedication("");
      setMysteryAdd(false);
      setAddSheetOpen(false);
      return true;
    } catch (error) {
      setToast(error.message || "Could not import that album or playlist.");
      return false;
    } finally {
      setAddingSongKey("");
    }
  }

  function openExternalSearch() {
    const searchUrl = externalSearchUrl(externalSearchProvider, searchQuery);
    const providerName = externalSearchProvider === "youtube" ? "YouTube" : "YouTube Music";
    const isDesktop = window.matchMedia("(min-width: 760px)").matches;
    if (!isDesktop && isActiveDj && nowPlayingSong) {
      if (internalSearchAvailable) {
        setSearchMode("internal");
        setToast("Use Internal Search on the player phone so the music keeps playing.");
      } else {
        setToast("External search can stop the player phone. Search from another device to keep music playing.");
      }
      return;
    }
    clearExternalClipboardCheckTimer();
    resetExternalClipboardPrompt();
    setExternalSearchStep("paste");
    externalClipboardCheckPendingRef.current = true;
    externalSearchLeftAppRef.current = false;
    externalSearchOpenedAtRef.current = Date.now();
    externalSearchLeftAtRef.current = 0;
    if (!isDesktop) {
      window.open(searchUrl, "_blank", "noopener,noreferrer");
      return;
    }

    try {
      const previousTab = externalYouTubeTabRef.current;
      if (previousTab && !previousTab.closed) previousTab.close();
    } catch {
      // YouTube can isolate its tab after navigation, so open a fresh tracked tab.
    }
    externalYouTubeTabRef.current = null;

    const openedTab = window.open(searchUrl, "partybeats-youtube-music");
    if (!openedTab) {
      setToast(`${providerName} was blocked. Allow popups for BP PartyBeats, then try again.`);
      setExternalSearchStep("search");
      externalClipboardCheckPendingRef.current = false;
      externalSearchLeftAppRef.current = false;
      externalSearchOpenedAtRef.current = 0;
      externalSearchLeftAtRef.current = 0;
      return;
    }
    externalYouTubeTabRef.current = openedTab;
    externalSearchLeftAppRef.current = true;
    externalSearchLeftAtRef.current = Date.now();
    openedTab.focus();
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
        videoEmbeddable: "true",
        videoSyndicated: "true",
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
      const playbackDetails = await fetchYouTubePlaybackDetailsBatch(nextResults.map((result) => result.videoId));
      const playableResults = nextResults
        .map((result) => ({
          ...result,
          durationSeconds: playbackDetails[result.videoId]?.durationSeconds || null,
          embeddable: playbackDetails[result.videoId]?.embeddable === true
        }))
        .filter((result) => result.embeddable && Number(result.durationSeconds) > 0 && Number(result.durationSeconds) <= NON_ADMIN_MAX_SONG_SECONDS);
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

  async function removeOwnSong(song) {
    if (!user || !activeRoomId || !song?.id || song.addedByUid !== user.uid) return;
    try {
      await deleteDoc(doc(db, "rooms", activeRoomId, "songs", song.id));
      await touchRoomActivity();
      setToast("Removed your song.");
    } catch {
      setToast("Could not remove that song. Check room permissions.");
    }
  }

  async function startSongVote(song, action) {
    if (!user || !activeRoomId || !song?.id) return;
    if (action === "removeSong" && song.addedByUid === user.uid && !isAdmin) {
      await removeOwnSong(song);
      return;
    }
    const existingVote = activeVotes.find((vote) => vote.songId === song.id && vote.action === action);
    if (existingVote) {
      await castSongVote(existingVote, "yes");
      setToast(`You voted yes to ${voteActionLabel(action).toLowerCase()}.`);
      return;
    }
    const display = playlistTrackDisplay(song);
    try {
      await setDoc(doc(collection(db, "rooms", activeRoomId, "votes")), {
        songId: song.id,
        songTitle: display.title || song.title || "Untitled",
        songArtist: display.artist || song.artist || "",
        action,
        startedByUid: user.uid,
        startedByName: activeNickname.slice(0, 30) || "Guest",
        votesByUser: { [user.uid]: "yes" },
        status: "open",
        at: Date.now(),
        createdAt: serverTimestamp()
      });
      await touchRoomActivity();
      setSelectedSongId("");
      setToast(`Vote started: ${voteActionLabel(action)}.`);
    } catch {
      setToast("Could not start that vote. Try again.");
    }
  }

  async function castSongVote(vote, choice) {
    if (!user || !activeRoomId || !vote?.id || !["yes", "no"].includes(choice)) return;
    try {
      await updateDoc(doc(db, "rooms", activeRoomId, "votes", vote.id), {
        [`votesByUser.${user.uid}`]: choice
      });
      await touchRoomActivity();
    } catch {
      setToast("Could not save your vote. Try again.");
    }
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
    const batch = writeBatch(db);
    batch.update(doc(db, "rooms", activeRoomId, "songs", song.id), { position: swapWith.position });
    batch.update(doc(db, "rooms", activeRoomId, "songs", swapWith.id), { position: song.position });
    await batch.commit();
    await touchRoomActivity();
  }

  async function setNowPlaying(songId) {
    if (!isAdmin) {
      setToast("Only admins can control playback.");
      return;
    }
    await updateDoc(doc(db, "rooms", activeRoomId), {
      nowPlayingId: songId,
      playbackSongId: songId,
      playbackSeconds: 0,
      playbackState: "playing",
      playbackCommand: isActiveDj ? "" : "select",
      playbackCommandId: `${deviceId}-${Date.now()}`,
      playbackCommandAt: serverTimestamp(),
      playbackUpdatedAt: serverTimestamp(),
      playbackUpdatedBy: user.uid,
      ...roomActivityUpdate()
    });
  }

  useEffect(() => {
    if (!isAdmin || !activeRoomId || !user || members.length === 0) return;

    activeVotes.forEach((vote) => {
      const counts = voteCounts(vote);
      const shouldApprove = counts.yes >= voteThreshold;
      const shouldReject = !shouldApprove && (counts.no >= voteThreshold || counts.total >= members.length);
      if (!shouldApprove && !shouldReject) return;
      if (applyingVoteIdsRef.current.has(vote.id)) return;

      applyingVoteIdsRef.current.add(vote.id);
      (async () => {
        const voteRef = doc(db, "rooms", activeRoomId, "votes", vote.id);
        try {
          if (shouldReject) {
            await updateDoc(voteRef, {
              status: "rejected",
              appliedAt: serverTimestamp(),
              appliedBy: user.uid
            });
            return;
          }

          const targetSong = songs.find((song) => song.id === vote.songId);
          if (!targetSong) {
            await updateDoc(voteRef, {
              status: "rejected",
              appliedAt: serverTimestamp(),
              appliedBy: user.uid
            });
            return;
          }

          const batch = writeBatch(db);
          if (vote.action === "removeSong") {
            batch.delete(doc(db, "rooms", activeRoomId, "songs", targetSong.id));
          } else if (vote.action === "playNext") {
            const queueWithoutTarget = songs.filter((song) => song.id !== targetSong.id);
            const currentIndex = queueWithoutTarget.findIndex((song) => song.id === room?.nowPlayingId);
            let nextPosition = Number(targetSong.position) || nextQueuePosition(songs);
            if (currentIndex >= 0) {
              const currentPosition = Number(queueWithoutTarget[currentIndex]?.position) || 0;
              const nextSong = queueWithoutTarget[currentIndex + 1] || null;
              nextPosition = nextSong
                ? (currentPosition + (Number(nextSong.position) || currentPosition + 1)) / 2
                : currentPosition + 1;
            } else if (queueWithoutTarget.length > 0) {
              nextPosition = (Number(queueWithoutTarget[0].position) || Date.now()) - 1;
            }
            batch.update(doc(db, "rooms", activeRoomId, "songs", targetSong.id), { position: nextPosition });
          }

          batch.update(voteRef, {
            status: "approved",
            appliedAt: serverTimestamp(),
            appliedBy: user.uid
          });
          await batch.commit();
        } catch {
          // Another admin may have applied it first.
        } finally {
          applyingVoteIdsRef.current.delete(vote.id);
        }
      })();
    });
  }, [activeRoomId, activeVotes, isAdmin, members.length, room?.nowPlayingId, songs, user, voteThreshold]);

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
      activePlayerDeviceId: deviceId,
      activeDjAt: serverTimestamp(),
      ...roomActivityUpdate()
    });
    setPlayerChoicePrompt(null);
    setExistingRoomPrompt(null);
    setDismissedPlayerPromptKey("");
    setToast("This device is now the party player.");
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
      roomUpdate.activePlayerDeviceId = deviceId;
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
    if (!isAdmin || !activeRoomId) {
      setToast("Only admins can control playback.");
      return;
    }
    if (!isActiveDj) {
      await updateDoc(doc(db, "rooms", activeRoomId), {
        playbackCommand: "next",
        playbackCommandId: `${deviceId}-${Date.now()}`,
        playbackCommandAt: serverTimestamp(),
        playbackUpdatedBy: user.uid,
        ...roomActivityUpdate()
      });
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

  async function togglePlayback() {
    if (!isAdmin || !activeRoomId || !nowPlayingSong) {
      setToast("Choose a track first.");
      return;
    }
    const nextState = playbackState.state === "playing" ? "paused" : "playing";
    await updateDoc(doc(db, "rooms", activeRoomId), {
      playbackSongId: nowPlayingSong.id,
      playbackSeconds: Math.max(0, livePlaybackSeconds),
      playbackState: nextState,
      playbackCommand: nextState === "playing" ? "play" : "pause",
      playbackCommandId: `${deviceId}-${Date.now()}`,
      playbackCommandAt: serverTimestamp(),
      playbackUpdatedAt: serverTimestamp(),
      playbackUpdatedBy: user.uid,
      ...roomActivityUpdate()
    });
  }

  async function handlePlaybackUnavailable(errorCode) {
    const failedSong = nowPlayingSong;
    if (!isActiveDj || !activeRoomId || !failedSong || unavailableHandlingRef.current === failedSong.id) return;
    unavailableHandlingRef.current = failedSong.id;
    const numericErrorCode = Number(errorCode);
    const permanentlyUnavailable = errorCode === "preflight" || [100, 101, 150].includes(numericErrorCode);
    if (!permanentlyUnavailable) {
      setToast("YouTube playback failed on this device. Skipping without removing the track.");
      window.setTimeout(async () => {
        try {
          await playNextSong();
        } finally {
          unavailableHandlingRef.current = "";
        }
      }, 1800);
      return;
    }

    const reason = [101, 150].includes(numericErrorCode)
      ? "Embedding is blocked by the video owner."
      : numericErrorCode === 100
        ? "The video was removed or made private."
        : "YouTube's availability check rejected playback inside PartyBeats.";
    try {
      await updateDoc(doc(db, "rooms", activeRoomId, "songs", failedSong.id), {
        unavailable: true,
        unavailableReason: reason,
        unavailableAt: serverTimestamp()
      });
      setToast(`${playlistTrackDisplay(failedSong).title} is unavailable. Skipping.`);
      window.setTimeout(async () => {
        try {
          await playNextSong();
        } finally {
          unavailableHandlingRef.current = "";
        }
      }, 1800);
    } catch {
      unavailableHandlingRef.current = "";
      setToast("This track is unavailable, but PartyBeats could not mark it.");
    }
  }

  async function restartTrack() {
    if (!isAdmin || !activeRoomId || !room?.nowPlayingId) {
      setToast("Choose a track to restart.");
      return;
    }
    await updateDoc(doc(db, "rooms", activeRoomId), {
      playbackSongId: room.nowPlayingId,
      playbackSeconds: 0,
      playbackState: "playing",
      playbackUpdatedAt: serverTimestamp(),
      playbackCommand: "restart",
      playbackCommandId: `${deviceId}-${Date.now()}`,
      playbackCommandAt: serverTimestamp(),
      playbackUpdatedBy: user.uid,
      ...roomActivityUpdate()
    });
    setToast("Track restarted.");
  }

  async function replayLastSong() {
    if (!isAdmin || !activeRoomId || !replaySong?.id) {
      setToast("No previous track to replay.");
      return;
    }
    await updateDoc(doc(db, "rooms", activeRoomId), {
      nowPlayingId: replaySong.id,
      playbackSongId: replaySong.id,
      playbackSeconds: 0,
      playbackState: "playing",
      playbackCommand: isActiveDj ? "" : "select",
      playbackCommandId: `${deviceId}-${Date.now()}`,
      playbackCommandAt: serverTimestamp(),
      playbackUpdatedAt: serverTimestamp(),
      playbackUpdatedBy: user.uid,
      ...roomActivityUpdate()
    });
    setToast(`Replaying: ${decodeHtmlEntities(replaySong.title || "track")}`);
  }

  async function updateRoomVolume(value) {
    if (!isAdmin || !activeRoomId || !user) return;
    const nextVolume = Math.min(100, Math.max(0, Math.round(Number(value) || 0)));
    await updateDoc(doc(db, "rooms", activeRoomId), {
      roomVolume: nextVolume,
      roomVolumeUpdatedAt: serverTimestamp(),
      roomVolumeUpdatedBy: user.uid,
      ...roomActivityUpdate()
    });
  }

  async function updateVisualizerEnabled(enabled) {
    if (!isAdmin || !activeRoomId) return;
    await updateDoc(doc(db, "rooms", activeRoomId), { visualizerEnabled: enabled, ...roomActivityUpdate() });
  }

  function renderVisualizerControl() {
    return (
      <button
        className={visualizerEnabled ? "mini-action icon-only-toggle is-on" : "mini-action icon-only-toggle"}
        type="button"
        aria-label={visualizerEnabled ? "Hide visualizer" : "Show visualizer"}
        title={visualizerEnabled ? "Hide visualizer" : "Show visualizer"}
        onClick={() => updateVisualizerEnabled(!visualizerEnabled)}
      >
        <Activity aria-hidden="true" />
      </button>
    );
  }

  function renderVolumeControl() {
    return (
      <div className={`room-volume-control${volumeControlOpen ? " is-open" : ""}`}>
        <button
          className="mini-action volume-toggle"
          type="button"
          aria-label={`Volume ${roomVolume}%`}
          aria-expanded={volumeControlOpen}
          onClick={() => setVolumeControlOpen((isOpen) => !isOpen)}
        >
          <Volume2 aria-hidden="true" />
        </button>
      </div>
    );
  }

  function renderVolumeOverlay() {
    if (!volumeControlOpen) return null;
    return (
      <>
        <button
          className="tap-away-layer volume-tap-away"
          aria-label="Close volume menu"
          onClick={() => setVolumeControlOpen(false)}
          type="button"
        />
        <label className="volume-popover volume-overlay-popover">
          <span>
            Volume
            <strong>{roomVolume}%</strong>
          </span>
          <input
            type="range"
            min="0"
            max="100"
            value={roomVolume}
            onChange={(event) => updateRoomVolume(event.target.value)}
          />
        </label>
      </>
    );
  }

  function spawnEmojiBurst(song, emoji) {
    const row = songListRef.current?.querySelector(`[data-song-id="${song.id}"]`);
    const rect = row?.getBoundingClientRect();
    const burst = {
      id: `${song.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      emoji,
      x: rect ? rect.left + rect.width / 2 : window.innerWidth / 2,
      y: rect ? rect.top + rect.height / 2 : window.innerHeight / 2
    };
    setEmojiBursts((current) => [...current.slice(-5), burst]);
    window.setTimeout(() => {
      setEmojiBursts((current) => current.filter((item) => item.id !== burst.id));
    }, EMOJI_BURST_LIFETIME_MS);
  }

  function spawnFloatingReaction(emoji = floatingReactionEmoji) {
    const reaction = {
      id: `float-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      emoji,
      x: Math.round(12 + Math.random() * 76),
      drift: Math.round((Math.random() - 0.5) * 80),
      scale: Number((0.9 + Math.random() * 0.45).toFixed(2))
    };
    setFloatingReactions((current) => [...current.slice(-18), reaction]);
    window.setTimeout(() => {
      setFloatingReactions((current) => current.filter((item) => item.id !== reaction.id));
    }, 2600);
  }

  function spawnRoomShout(shout) {
    const nextShout = {
      id: shout.id || `shout-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: shout.name || "Guest",
      text: String(shout.text || "").slice(0, 128),
      isAnonymous: shout.isAnonymous === true
    };
    setRoomShouts((current) => [...current.slice(-2), nextShout]);
    window.setTimeout(() => {
      setRoomShouts((current) => current.filter((item) => item.id !== nextShout.id));
    }, 5000);
  }

  function dismissRoomShout(shoutId) {
    setRoomShouts((current) => current.filter((item) => item.id !== shoutId));
  }

  function startRoomShoutSwipe(event, shoutId) {
    roomShoutSwipeStartRef.current = {
      id: shoutId,
      x: event.clientX,
      y: event.clientY
    };
  }

  function finishRoomShoutSwipe(event, shoutId) {
    const start = roomShoutSwipeStartRef.current;
    roomShoutSwipeStartRef.current = null;
    if (!start || start.id !== shoutId) return;
    const deltaX = event.clientX - start.x;
    const deltaY = Math.abs(event.clientY - start.y);
    if (deltaX > 72 && deltaY < 48) {
      dismissRoomShout(shoutId);
    }
  }

  async function sendFloatingReaction(emoji = floatingReactionEmoji) {
    if (!user || !activeRoomId || !EMOJIS.includes(emoji)) {
      spawnFloatingReaction(emoji);
      return;
    }
    try {
      await setDoc(doc(collection(db, "rooms", activeRoomId, "reactions")), {
        emoji,
        uid: user.uid,
        at: Date.now(),
        createdAt: serverTimestamp()
      });
    } catch {
      spawnFloatingReaction(emoji);
    }
  }

  async function sendRoomShout(event) {
    event?.preventDefault();
    const text = roomShoutDraft.trim().slice(0, 128);
    if (!user || !activeRoomId || !text) return;
    if (!roomShoutsEnabled) {
      setToast("Room shoutouts are off.");
      return;
    }
    if (hasProfanity(text)) {
      setToast("Message blocked for profanity.");
      return;
    }
    try {
      await setDoc(doc(collection(db, "rooms", activeRoomId, "shouts")), {
        uid: user.uid,
        name: activeNickname.slice(0, 30) || "Guest",
        isAnonymous: user.isAnonymous,
        text,
        at: Date.now(),
        createdAt: serverTimestamp()
      });
      await touchRoomActivity();
      setRoomShoutDraft("");
      setRoomShoutOpen(false);
    } catch {
      setToast("Could not send that message. Try again.");
    }
  }

  function startFloatingReactionPress() {
    if (!floatingReactionChosen) return;
    floatingReactionLongPressRef.current = false;
    window.clearTimeout(floatingReactionPressTimerRef.current);
    floatingReactionPressTimerRef.current = window.setTimeout(() => {
      floatingReactionLongPressRef.current = true;
      setReactionPickerOpen(true);
    }, 520);
  }

  function finishFloatingReactionPress() {
    window.clearTimeout(floatingReactionPressTimerRef.current);
    if (!floatingReactionChosen) return;
    if (floatingReactionLongPressRef.current) return;
    setReactionPickerOpen(false);
    sendFloatingReaction();
  }

  function handleFloatingReactionClick(event) {
    event.preventDefault();
    event.stopPropagation();
    if (floatingReactionChosen) return;
    window.setTimeout(() => setReactionPickerOpen(true), 0);
  }

  function openSongEmojiPicker(song, mode = "react") {
    setMessageSongId("");
    setEmojiPickerMode(mode);
    setEmojiSongId(song.id);
  }

  function startSongDeleteSwipe(event, song, canDeleteOwnSong) {
    if (!canDeleteOwnSong || event.pointerType === "mouse") return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    songSwipeStartRef.current = {
      songId: song.id,
      x: event.clientX,
      y: event.clientY
    };
  }

  function revealSongDeleteFromSwipe(event, song, canDeleteOwnSong) {
    const start = songSwipeStartRef.current;
    if (!canDeleteOwnSong || !start || start.songId !== song.id) return false;
    const deltaX = event.clientX - start.x;
    const deltaY = Math.abs(event.clientY - start.y);
    if (deltaX > 44 && deltaY < 42) {
      event.preventDefault();
      event.stopPropagation();
      songSwipeRevealedRef.current = true;
      songSwipeStartRef.current = null;
      setSelectedSongId("");
      setDeleteRevealSongId(song.id);
      return true;
    }
    return false;
  }

  function moveSongDeleteSwipe(event, song, canDeleteOwnSong) {
    revealSongDeleteFromSwipe(event, song, canDeleteOwnSong);
  }

  function finishSongDeleteSwipe(event, song, canDeleteOwnSong) {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (revealSongDeleteFromSwipe(event, song, canDeleteOwnSong)) return;
    songSwipeStartRef.current = null;
  }

  function cancelSongDeleteSwipe() {
    songSwipeStartRef.current = null;
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
      spawnEmojiBurst(song, emoji);
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
    try {
      await setDoc(doc(collection(db, "rooms", activeRoomId, "messages")), {
        songId: song.id,
        uid: user.uid,
        name: senderName,
        isAnonymous: user.isAnonymous,
        text,
        at: Date.now(),
        createdAt: serverTimestamp()
      });
      await touchRoomActivity();
      setMessageDraft("");
      setMessageSongId("");
      setEmojiSongId("");
    } catch {
      setToast("Could not send that message. Try again.");
    }
  }

  function closeEmojiPopoverSoon() {
    window.setTimeout(() => {
      setEmojiSongId("");
      setMessageSongId("");
      setEmojiPickerMode("react");
    }, 140);
  }

  function clearRoomState() {
    try {
      localStorage.removeItem(LAST_ACTIVE_ROOM_KEY);
    } catch {
      // Local storage can be unavailable in private browsing.
    }
    setActiveRoomId("");
    setRoom(null);
    setSongs([]);
    setMembers([]);
    setSongMessages([]);
    setVotes([]);
    setVoteMenuSongId("");
    setPlayerChoicePrompt(null);
    setDismissedPlayerPromptKey("");
    setDismissedVersionPrompt("");
    setRoomLoading(false);
    setSongsLoading(false);
    setMembersLoading(false);
    setMenuOpen(false);
    setRoomPanelOpen(false);
    setRoomPanelTab("room");
    setShareChoiceOpen(false);
    setInstallHelpOpen(false);
    setAddSheetOpen(false);
    setAddingSongKey("");
    setRecentlyAddedSongId("");
    setSelectedSongId("");
    setEmojiSongId("");
    setEmojiPickerMode("react");
    setMessageSongId("");
    setMessageDraft("");
    setFloatingReactions([]);
    setRoomShouts([]);
    setRoomShoutOpen(false);
    setRoomShoutDraft("");
    setReactionPickerOpen(false);
    setRenameMemberId("");
    setRenameDraft("");
    setSelfRenameOpen(false);
    setSelfRenameDraft("");
    setNowPlayingNotice(null);
    setJoinNotice(null);
    previousMemberIds.current = undefined;
    reactionBaselineReadyRef.current = false;
    shoutBaselineReadyRef.current = false;
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

  async function updateToastEnabled(enabled) {
    if (!isAdmin || !activeRoomId) return;
    await updateDoc(doc(db, "rooms", activeRoomId), { toastEnabled: enabled, ...roomActivityUpdate() });
  }

  async function updateInternalSearchEnabled(enabled) {
    if (!isAdmin || !activeRoomId) return;
    await updateDoc(doc(db, "rooms", activeRoomId), { internalSearchEnabled: enabled, ...roomActivityUpdate() });
  }

  async function updateFloatingReactionsEnabled(enabled) {
    if (!isAdmin || !activeRoomId) return;
    await updateDoc(doc(db, "rooms", activeRoomId), { floatingReactionsEnabled: enabled, ...roomActivityUpdate() });
  }

  async function updateRoomShoutsEnabled(enabled) {
    if (!isAdmin || !activeRoomId) return;
    await updateDoc(doc(db, "rooms", activeRoomId), { roomShoutsEnabled: enabled, ...roomActivityUpdate() });
  }

  async function updatePartyMotionEnabled(enabled) {
    if (!user || !activeRoomId) return;
    if (!isAdmin) {
      setPartyMotionOverride(enabled);
      try {
        localStorage.setItem("partybeats-party-motion-override", enabled ? "on" : "off");
      } catch {
        // Local storage can be blocked in private browsing.
      }
      return;
    }
    await updateDoc(doc(db, "rooms", activeRoomId), { partyMotionEnabled: enabled, ...roomActivityUpdate() });
  }

  async function saveRoomTagline(event) {
    event?.preventDefault();
    if (!isAdmin || !activeRoomId) return;
    const nextTagline = taglineDraft.trim().slice(0, 60);
    if (hasProfanity(nextTagline)) {
      setToast("Tagline blocked for profanity.");
      return;
    }
    await updateDoc(doc(db, "rooms", activeRoomId), { tagline: nextTagline, ...roomActivityUpdate() });
    setToast(nextTagline ? "Room vibe updated." : "Room vibe cleared.");
  }

  async function leaveSpecificRoom(leavingRoomId, leavingUser) {
    if (!leavingRoomId || !leavingUser) return;
    const normalizedRoomId = normalizeRoomId(leavingRoomId);
    const roomRef = doc(db, "rooms", normalizedRoomId);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) {
      await clearRememberedUserRoom(leavingUser, normalizedRoomId);
      return;
    }

    const roomData = roomSnap.data();
    const adminUids = adminMapFor(roomData);
    const userIsAdmin = adminUids[leavingUser.uid] === true;
    const batch = writeBatch(db);

    if (userIsAdmin) {
      const membersSnap = await getDocs(query(collection(db, "rooms", normalizedRoomId, "members"), orderBy("joinedAt", "asc")));
      const roomMembers = membersSnap.docs.map((memberDoc) => ({ id: memberDoc.id, ...memberDoc.data() }));
      const remainingAdmins = roomMembers.filter((member) => member.id !== leavingUser.uid && adminUids[member.id] === true);
      if (remainingAdmins.length === 0) {
        batch.update(roomRef, {
          closed: true,
          closedAt: serverTimestamp(),
          closedByUid: leavingUser.uid,
          nowPlayingId: null,
          playbackSongId: null,
          playbackSeconds: 0,
          playbackState: "stopped",
          [`adminUids.${leavingUser.uid}`]: deleteField()
        });
      } else {
        batch.update(roomRef, {
          [`adminUids.${leavingUser.uid}`]: deleteField(),
          adminUid: remainingAdmins[0].id,
          adminName: remainingAdmins[0].name || "Google user",
          ...(roomData.activeDjUid === leavingUser.uid
            ? {
                activeDjUid: remainingAdmins[0].id,
                activeDjName: remainingAdmins[0].name || "Google user",
                activePlayerDeviceId: ""
              }
            : {}),
          ...roomActivityUpdate()
        });
      }
    }

    batch.delete(doc(db, "rooms", normalizedRoomId, "members", leavingUser.uid));
    await batch.commit();
    await clearRememberedUserRoom(leavingUser, normalizedRoomId);
  }

  async function leaveRoom() {
    const leavingRoomId = activeRoomId;
    const leavingUser = user;

    try {
      if (leavingRoomId && leavingUser) {
        if (isAdmin && isActiveDjAccount && !isActiveDj) {
          return;
        }
        const batch = writeBatch(db);
        if (isAdmin) {
          const remainingAdmins = members.filter((member) => member.id !== leavingUser.uid && isRoomAdminId(member.id));
          if (remainingAdmins.length === 0) {
            batch.update(doc(db, "rooms", leavingRoomId), {
              closed: true,
              closedAt: serverTimestamp(),
              closedByUid: leavingUser.uid,
              nowPlayingId: null,
              playbackSongId: null,
              playbackSeconds: 0,
              playbackState: "stopped",
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
                    activeDjName: remainingAdmins[0].name || "Google user",
                    activePlayerDeviceId: ""
                  }
                : {}),
              ...roomActivityUpdate()
            });
          }
        }
        batch.delete(doc(db, "rooms", leavingRoomId, "members", leavingUser.uid));
        await batch.commit();
        await clearRememberedUserRoom(leavingUser, leavingRoomId);
      }
    } finally {
      clearRoomState();
    }
  }

  async function joinExistingRoomFromPrompt() {
    const prompt = existingRoomPrompt;
    if (!prompt?.roomId || !prompt?.user) return;
    setExistingRoomPrompt(null);
    await joinRoomById(prompt.roomId, { userOverride: prompt.user, nicknameOverride: nicknameFor(prompt.user, "Host") });
  }

  async function createNewRoomFromPrompt() {
    const prompt = existingRoomPrompt;
    if (!prompt?.roomId || !prompt?.user) return;
    setExistingRoomPrompt(null);
    setCreatingRoom(true);
    try {
      await leaveSpecificRoom(prompt.roomId, prompt.user);
      await createRoom(prompt.user);
    } catch (error) {
      setToast(roomCreateErrorMessage(error));
    } finally {
      setCreatingRoom(false);
    }
  }

  async function handleSignOut() {
    try {
      await leaveRoom();
    } finally {
      await signOut(auth);
    }
  }

  async function installApp() {
    setMenuOpen(false);
    if (appInstalled) {
      setToast("BP PartyBeats is already installed.");
      return;
    }
    if (!installPrompt) {
      setInstallHelpOpen(true);
      return;
    }
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (choice?.outcome === "accepted") {
        setToast("Installing BP PartyBeats.");
      } else {
        setToast("Install cancelled.");
      }
    } catch {
      setToast("Install was blocked. Use your browser menu to add BP PartyBeats to your home screen.");
    }
  }

  function refreshApp() {
    setMenuOpen(false);
    window.location.reload();
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
    setShareChoiceOpen(false);
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
    setShareChoiceOpen(false);
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
    setShareChoiceOpen(false);
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

  async function shareAnalytics() {
    setMenuOpen(false);
    const lines = [
      "BP PartyBeats Analytics",
      `Room: ${activeRoomId}`,
      `Shared: ${new Date().toLocaleString()}`,
      "",
      `Songs: ${songs.length}`,
      `Reactions: ${totalReactions}`,
      `Messages: ${totalMessages}`,
      `People: ${members.length}`,
      `Google users: ${googleMemberCount}`,
      `Guests: ${guestMemberCount}`,
      "",
      "People",
      ...analyticsPeople.map((member) => `${member.name || "Guest"} (${member.isAnonymous ? "Guest" : "Google"}): ${member.added} adds, ${member.reactions} reacts, ${member.messages} msgs`),
      "",
      "Top Tracks",
      ...(mostReactedSongs.length
        ? mostReactedSongs.map((song, index) => `${index + 1}. ${song.display.artist ? `${song.display.artist} - ` : ""}${song.display.title}: ${song.reactionCount} reacts, ${song.messageCount} msgs`)
        : ["No reactions or messages yet."])
    ];
    const text = lines.join("\n");
    const shareData = {
      title: `BP PartyBeats ${activeRoomId} analytics`,
      text
    };
    if (navigator.share) {
      await navigator.share(shareData).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(text);
    setToast("Analytics copied.");
  }

  async function sharePartyRecap() {
    setMenuOpen(false);
    const topTrack = mostReactedSongs[0];
    const topPerson = analyticsPeople[0];
    const lines = [
      "BP PartyBeats Recap",
      `Room: ${activeRoomId}`,
      `Date: ${new Date().toLocaleString()}`,
      `Songs: ${songs.length}`,
      `People: ${members.length}`,
      topTrack ? `Crowd favorite: ${topTrack.display.artist ? `${topTrack.display.artist} - ` : ""}${topTrack.display.title}` : "Crowd favorite: none yet",
      topPerson ? `Most active: ${topPerson.name || "Guest"} (${topPerson.total} actions)` : "Most active: none yet",
      activeReactionStreak?.streak > 1 ? `Reaction streak: ${activeReactionStreak.name || "Guest"} hit ${activeReactionStreak.streak} songs` : "",
      "",
      "Playlist",
      ...songs.map((song, index) => {
        const display = playlistTrackDisplay(song);
        return `${index + 1}. ${display.artist ? `${display.artist} - ` : ""}${display.title}${song.link ? ` ${song.link}` : ""}`;
      })
    ].filter(Boolean);
    const text = lines.join("\n");
    const shareData = {
      title: `BP PartyBeats ${activeRoomId} recap`,
      text
    };
    if (navigator.share) {
      await navigator.share(shareData).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(text);
    setToast("Party recap copied.");
  }

  if (!firebaseReady) {
    return <SetupMissing />;
  }

  const themePickerModal = themePickerOpen && (
    <div
      className="modal-backdrop theme-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Choose a theme"
      onClick={() => setThemePickerOpen(false)}
    >
      <section className="about-modal color-theme-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Themes</h2>
            <p className="muted">Pick the full look for this device.</p>
          </div>
          <button className="icon-button" onClick={() => setThemePickerOpen(false)} title="Close" type="button">
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="color-theme-grid">
          {COLOR_THEMES.map((option) => (
            <button
              className={colorTheme === option.id ? "color-theme-option is-selected" : "color-theme-option"}
              data-theme-choice={option.id}
              key={option.id}
              onClick={() => {
                setColorTheme(option.id);
                setThemePickerOpen(false);
              }}
              type="button"
            >
              <span className="theme-swatch" aria-hidden="true" />
              <strong>
                {option.name}
                {colorTheme === option.id && <Check className="theme-check" aria-hidden="true" />}
              </strong>
              <small>{option.note}</small>
            </button>
          ))}
        </div>
      </section>
    </div>
  );

  const confettiLayer = confettiKey > 0 && (
    <div className="confetti-layer" key={confettiKey} aria-hidden="true">
      {Array.from({ length: 28 }, (_, index) => (
        <i
          key={index}
          className={`confetti-piece tone-${index % 4}`}
          style={{
            "--confetti-x": `${((index * 137) % 100)}%`,
            "--confetti-delay": `${(index % 9) * 110}ms`,
            "--confetti-spin": `${((index * 47) % 280) - 140}deg`,
            "--confetti-drift": `${((index * 31) % 90) - 45}px`
          }}
        />
      ))}
    </div>
  );

  if (!activeRoomId || !room) {
    return (
      <main className="app-shell landing-shell">
        <div className="landing-notes" aria-hidden="true">
          <span>♪</span>
          <span>♫</span>
          <span>♪</span>
          <span>♬</span>
          <span>♫</span>
          <span>♪</span>
        </div>
        <div className="landing-top-actions">
          <button
            className="icon-button landing-share-button"
            onClick={shareApp}
            title="Share app"
            type="button"
          >
            <QrCode aria-hidden="true" />
          </button>
          <button
            className="icon-button landing-theme-button"
            onClick={() => setThemePickerOpen(true)}
            title="Themes"
            type="button"
          >
            <Palette aria-hidden="true" />
          </button>
        </div>
        <section className="landing-hero">
          <div className="brand-mark">
            <AppIcon />
            <span>BP PartyBeats</span>
          </div>
          <div className="landing-copy">
            <h1>BP PartyBeats</h1>
            <p>Start a room, pass around the code, and let everyone build the music queue from their phone.</p>
            <div className="landing-chips" aria-hidden="true">
              <span>Live shared queue</span>
              <span>Emoji reactions</span>
              <span>Crossfade</span>
              <span>QR invites</span>
            </div>
          </div>

          <div className="landing-actions-grid">
            <section className="landing-action-card create-room-card">
              <div>
                <span className="landing-card-kicker">Host</span>
                <h2>Create a Room</h2>
                <p className="muted">Sign in with Google, create the room, and become the Active DJ.</p>
              </div>
              <button className="google-action create-google-action" onClick={signInAndCreateRoom} disabled={authLoading || creatingRoom} type="button">
                <span className="google-mark" aria-hidden="true">G</span>
                {creatingRoom ? "Creating Room..." : user && !user.isAnonymous ? "Create Room" : "Continue with Google"}
              </button>
              {showFirefoxAndroidAuthNote && !user && (
                <p className="firefox-auth-note">
                  Firefox Android may leave a blank Firebase tab after Google sign-in. If that happens, close that tab to return to PartyBeats.
                </p>
              )}
              {user && !user.isAnonymous && (
                <div className="landing-signed-in-row">
                  <span className="landing-signed-in">
                    Signed in as <GoogleBadge /> {nickname || nicknameFor(user)}
                  </span>
                  <button className="icon-button" onClick={handleSignOut} title="Sign out" type="button">
                    <LogOut aria-hidden="true" />
                  </button>
                </div>
              )}
            </section>

            <section className="landing-action-card join-room-card">
              <div>
                <span className="landing-card-kicker">Guest</span>
                <h2>Join a Room</h2>
                <p className="muted">Enter your nickname and the room code from the host.</p>
              </div>
              <div className="landing-join-form">
                <div className="landing-join-fields">
                  <label>
                    <span>Nickname</span>
                    <input
                      value={nickname}
                      onChange={(event) => setNickname(event.target.value)}
                      onFocus={selectExistingText}
                      placeholder="Your name"
                      maxLength={30}
                    />
                  </label>
                  <label>
                    <span>Room ID</span>
                    <input
                      value={roomId}
                      onChange={(event) => setRoomId(normalizeRoomId(event.target.value))}
                      placeholder="VIBE123"
                      maxLength={7}
                    />
                  </label>
                </div>
                <button onClick={() => joinRoomById()} disabled={joiningRoom || authLoading || nickname.trim().length < 2 || !/^[A-Z]{4}\d{3}$/.test(normalizeRoomId(roomId))} type="button">
                  <DoorOpen aria-hidden="true" />
                  {joiningRoom ? "Joining Room..." : "Join"}
                </button>
              </div>
            </section>
          </div>
          <p className="landing-version">Version {APP_VERSION}</p>
        </section>

        {themePickerModal}
        {confettiLayer}
        {existingRoomPrompt && (
          <div className="modal-backdrop existing-room-backdrop" role="dialog" aria-modal="true" onClick={() => setExistingRoomPrompt(null)}>
            <section className="about-modal existing-room-modal" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <h2>Room already running</h2>
                  <p className="muted">You are already signed in to room {existingRoomPrompt.roomId}.</p>
                </div>
                <button className="icon-button" onClick={() => setExistingRoomPrompt(null)} title="Close" type="button">
                  <X aria-hidden="true" />
                </button>
              </div>
              <div className="existing-room-actions">
                <button className="primary-action" onClick={joinExistingRoomFromPrompt} type="button">
                  <DoorOpen aria-hidden="true" />
                  Join {existingRoomPrompt.roomId}
                </button>
                <button className="subtle-action danger-action" onClick={createNewRoomFromPrompt} disabled={creatingRoom} type="button">
                  <LogOut aria-hidden="true" />
                  {creatingRoom ? "Creating..." : "Leave it and create new"}
                </button>
              </div>
            </section>
          </div>
        )}

        {toast && (
          <button className="toast" onClick={() => setToast("")} type="button">
            {toast}
          </button>
        )}
      </main>
    );
  }

  return (
    <main
      ref={roomAppRef}
      className={`app-shell room-app ${isDarkTheme ? "dark-mode" : "light-mode"} ${partyMotionEnabled ? "has-party-motion" : ""} ${isIos ? "is-ios" : ""}`}
      style={{ "--desktop-player-split": `${desktopPlayerSplit}%` }}
    >
      {partyMotionEnabled && (
        <PartyMotionCanvas
          className="party-motion-bg"
        />
      )}
      <header className="app-topbar">
        <button className="topbar-brand" onClick={() => setRoomQrOpen(true)} title="Show room QR code" type="button">
          <div className="brand-dot">
            <AppIcon />
          </div>
          <div>
            <strong>BP PartyBeats</strong>
            <span>{activeRoomId}</span>
            <span className="topbar-room-meta">{members.length} people · {activeDjStatus}</span>
            <small className="topbar-version">{APP_VERSION}</small>
          </div>
        </button>

        <div className="topbar-actions">
          <button className="topbar-user-button" onClick={openSelfRename} type="button">
            {!user.isAnonymous && <GoogleBadge />}
            <span>{activeNickname}</span>
            <small>{user.isAnonymous ? "Guest" : "Google"}</small>
          </button>
          <div className="menu-wrap">
            <button className="icon-button" onClick={() => setMenuOpen((open) => !open)} title="Menu" type="button">
              <MoreVertical aria-hidden="true" />
            </button>
            {menuOpen && (
              <>
                <button
                  className="tap-away-layer menu-tap-away"
                  aria-label="Close menu"
                  onClick={() => setMenuOpen(false)}
                  type="button"
                />
                <div className="overflow-menu">
                  <button onClick={() => { setRoomPanelTab("settings"); setRoomPanelOpen(true); setMenuOpen(false); }} type="button">
                    <SlidersHorizontal aria-hidden="true" />
                    Settings
                  </button>
                  <button onClick={() => { setThemePickerOpen(true); setMenuOpen(false); }} type="button">
                    <Palette aria-hidden="true" />
                    Themes
                  </button>
                  <button
                    className={partyMotionEnabled ? "menu-toggle-row is-on" : "menu-toggle-row"}
                    onClick={() => {
                      updatePartyMotionEnabled(!partyMotionEnabled);
                      setMenuOpen(false);
                    }}
                    type="button"
                  >
                    <Activity aria-hidden="true" />
                    <span>Party Motion</span>
                    <small>{partyMotionEnabled ? "On" : "Off"}</small>
                  </button>
                  <button onClick={() => { setShareChoiceOpen(true); setMenuOpen(false); }} type="button">
                    <Share2 aria-hidden="true" />
                    Share
                  </button>
                  <button onClick={() => { setAboutOpen(true); setMenuOpen(false); }} type="button">
                    <Info aria-hidden="true" />
                    About
                  </button>
                  <button onClick={installApp} type="button">
                    <Download aria-hidden="true" />
                    Install App
                  </button>
                  <button onClick={refreshApp} type="button">
                    <RotateCcw aria-hidden="true" />
                    Refresh App
                  </button>
                  <button onClick={leaveRoom} type="button">
                    <DoorOpen aria-hidden="true" />
                    Leave Room
                  </button>
                  <button onClick={handleSignOut} type="button">
                    <LogOut aria-hidden="true" />
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {appNeedsRefresh && dismissedVersionPrompt !== latestRoomVersion && (
        <div className="version-refresh-banner" role="alert">
          <Info aria-hidden="true" />
          <div>
            <strong>Refresh PartyBeats</strong>
            <span>You are running {APP_VERSION}. Latest is {latestRoomVersion}.</span>
          </div>
          <button className="primary-action" onClick={refreshApp} type="button">
            <RotateCcw aria-hidden="true" />
            Refresh
          </button>
          <button className="icon-button" onClick={() => setDismissedVersionPrompt(latestRoomVersion)} title="Dismiss" type="button">
            <X aria-hidden="true" />
          </button>
        </div>
      )}

      <section
        ref={playerCardRef}
        className={[
          playerFullscreen ? "now-playing-card is-fullscreen-player" : "now-playing-card",
          nowPlayingSong ? "has-track" : "is-idle",
          partyMotionEnabled && playerFullscreen && visualizerEnabled ? "has-fullscreen-motion" : "",
          playerCollapsed ? "is-player-collapsed" : ""
        ].join(" ")}
      >
        {(nowPlayingSong || isAdmin) && (
          <div className="now-playing-corner-actions">
            <div className="now-playing-corner-row">
              {playbackTimeLabel && (
                <span className="playback-time-label" aria-label="Playback time">
                  {playbackTimeLabel}
                </span>
              )}
              {nowPlayingSong && !isActiveDjPhone ? (
                <a className="lyrics-corner-button" href={lyricsSearchUrl(nowPlayingSong)} target="_blank" rel="noreferrer">
                  <Search aria-hidden="true" />
                  Lyrics
                </a>
              ) : null}
            </div>
            {isActiveDjPhone && (
              <button
                className="collapse-player-button"
                onClick={() => setPlayerCollapsed((collapsed) => !collapsed)}
                title={playerCollapsed ? "Expand player" : "Collapse player"}
                type="button"
              >
                {playerCollapsed ? <ArrowDown aria-hidden="true" /> : <ArrowUp aria-hidden="true" />}
                {playerCollapsed ? "Expand" : "Collapse"}
              </button>
            )}
          </div>
        )}
        <div className="now-playing-copy">
          <span>
            {nowPlayingSong && <Equalizer paused={playbackState.state !== "playing"} />}
            {isActiveDj ? "This device is playing" : "Now playing"}
          </span>
          <div className="fullscreen-title-row">
            <div className="fullscreen-room-brand" aria-label={`PartyBeats room ${activeRoomId}`}>
              <AppIcon />
              <div>
                <strong>PartyBeats</strong>
                <span>Room {activeRoomId}</span>
              </div>
            </div>
            <h1>{nowPlayingSong ? nowPlayingDisplay?.title || "Untitled" : nowPlayingSyncing ? "Syncing current track" : "Nothing playing yet"}</h1>
          </div>
          <p className="track-credit">
            {nowPlayingSong
              ? `${nowPlayingDisplay?.artist || decodeHtmlEntities(nowPlayingSong.artist || "YouTube")} · added by ${nowPlayingSong.addedByName || "Guest"}${nowPlayingSong.dedication ? ` · for ${nowPlayingSong.dedication}` : ""}`
              : nowPlayingSyncing
                ? "Fetching the song that is already playing in this room."
                : "The Active DJ starts playback from the phone connected to the speaker."}
          </p>
          {roomTagline && <p className="room-vibe-line">{roomTagline}</p>}
        </div>
        {isActiveDj ? (
          <>
            <YouTubePlayer
              song={nowPlayingSong}
              onEnded={playNextSong}
              onCrossfade={playNextSong}
              onUnavailable={handlePlaybackUnavailable}
              verifyPlayback={fetchYouTubePlaybackDetails}
              crossfadeEnabled={effectivePlaybackSettings.crossfadeEnabled}
              crossfadeSeconds={effectivePlaybackSettings.crossfadeSeconds}
              volume={roomVolume}
              visualizerEnabled={visualizerEnabled}
              displayTrack={nowPlayingDisplay}
              qrDataUrl={qrDataUrl}
              roomId={activeRoomId}
              playbackState={playbackState}
              onPlaybackUpdate={syncPlaybackState}
              fullscreenMotion={partyMotionEnabled && playerFullscreen}
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
              <button className="mini-action" onClick={togglePlayback} disabled={!nowPlayingSong} type="button">
                {playbackState.state === "playing" ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                {playbackState.state === "playing" ? "Pause" : "Play"}
              </button>
              <button className="mini-action" onClick={restartTrack} disabled={!nowPlayingSong} type="button">
                <RotateCcw aria-hidden="true" />
                Restart
              </button>
              <button className="mini-action" onClick={replayLastSong} disabled={!replaySong} type="button">
                <History aria-hidden="true" />
                Replay Last
              </button>
              <button className="mini-action" onClick={playNextSong} disabled={!songs.length} type="button">
                <SkipForward aria-hidden="true" />
                Next
              </button>
              {renderVisualizerControl()}
              {renderVolumeControl()}
            </div>
          </>
        ) : isAdmin ? (
          <div className="player-actions dj-control-deck">
            <button className="mini-action" onClick={togglePlayback} disabled={!nowPlayingSong} type="button">
              {playbackState.state === "playing" ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
              {playbackState.state === "playing" ? "Pause" : "Play"}
            </button>
            <button className="mini-action" onClick={restartTrack} disabled={!nowPlayingSong} type="button">
              <RotateCcw aria-hidden="true" />
              Restart
            </button>
            <button className="mini-action" onClick={replayLastSong} disabled={!replaySong} type="button">
              <History aria-hidden="true" />
              Replay Last
            </button>
            <button className="mini-action" onClick={playNextSong} disabled={!songs.length} type="button">
              <SkipForward aria-hidden="true" />
              Next
            </button>
            {renderVisualizerControl()}
            {renderVolumeControl()}
            <button className="mini-action" onClick={takeOverDj} type="button">
              <Crown aria-hidden="true" />
              Play From This Device
            </button>
          </div>
        ) : null}
      </section>

      <div
        className="desktop-panel-divider"
        role="separator"
        aria-label="Resize player and playlist"
        aria-orientation="vertical"
        aria-valuemin="45"
        aria-valuemax="80"
        aria-valuenow={Math.round(desktopPlayerSplit)}
        tabIndex="0"
        title="Drag to resize. Double-click to reset."
        onDoubleClick={() => setDesktopPlayerSplit(DEFAULT_DESKTOP_PLAYER_SPLIT)}
        onKeyDown={adjustDesktopPanelSplit}
        onPointerDown={startDesktopPanelResize}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture?.(event.pointerId)) resizeDesktopPanels(event);
        }}
        onPointerUp={(event) => event.currentTarget.releasePointerCapture?.(event.pointerId)}
        onPointerCancel={(event) => event.currentTarget.releasePointerCapture?.(event.pointerId)}
      >
        <span />
      </div>

      <section className="queue-panel" ref={queuePanelRef}>
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
          {songsLoading ? (
            <div className="empty-state syncing-state">
              <Music2 aria-hidden="true" />
              <strong>Syncing playlist</strong>
              <span>Connected to room {activeRoomId}. Loading tracks now.</span>
            </div>
          ) : songs.length === 0 ? (
            <div className="empty-state">
              <Music2 aria-hidden="true" />
              <strong>Add the first track</strong>
              <span>{roomNeedsFirstTrack ? "Anyone in the room can start the party." : "Drop a track and set the tone."}</span>
              {roomNeedsFirstTrack && (
                <button className="primary-action" onClick={() => setAddSheetOpen(true)} type="button">
                  <Plus aria-hidden="true" />
                  Add Song
                </button>
              )}
            </div>
          ) : (
            songs.map((song, index) => {
              const queueIndex = songs.findIndex((item) => item.id === song.id);
              const trackDisplay = playlistTrackDisplay(song);
              const isCurrentSong = song.id === room.nowPlayingId;
              const isPlayedSong = nowPlayingIndex >= 0 && index < nowPlayingIndex;
              const isUpNextSong = song.id === nextQueuedSong(songs, room.nowPlayingId)?.id;
              const isRecentlyAddedSong = recentlyAddedSongId === song.id;
              const isSelectedSong = selectedSongId === song.id;
              const canDeleteOwnSong = Boolean(user && song.addedByUid === user.uid && !isAdmin);
              const isDeleteRevealed = deleteRevealSongId === song.id;
              const isVoteMenuOpen = voteMenuSongId === song.id;
              const openVoteForSong = activeVotes.find((vote) => vote.songId === song.id);
              const hideMysteryTrack = song.mystery && !isCurrentSong && !isPlayedSong && !isAdmin;
              const visibleTrackDisplay = hideMysteryTrack
                ? { artist: "Mystery Track", title: `from ${song.addedByName || "Guest"}` }
                : trackDisplay;
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
                    isDeleteRevealed ? "is-delete-revealed" : "",
                    isAdmin && isSelectedSong ? "is-admin-selected" : "",
                    emojiSongId === song.id ? "is-reacting" : "",
                    song.unavailable ? "is-unavailable" : ""
                  ].filter(Boolean).join(" ")}
                  data-song-id={song.id}
                  key={song.id}
                  onClick={() => {
                    if (songSwipeRevealedRef.current) {
                      songSwipeRevealedRef.current = false;
                      return;
                    }
                    if (isDeleteRevealed) {
                      setDeleteRevealSongId("");
                      return;
                    }
                    setSelectedSongId((current) => {
                      const next = current === song.id ? "" : song.id;
                      if (!next || next !== song.id) setVoteMenuSongId("");
                      return next;
                    });
                  }}
                  onPointerDown={(event) => startSongDeleteSwipe(event, song, canDeleteOwnSong)}
                  onPointerMove={(event) => moveSongDeleteSwipe(event, song, canDeleteOwnSong)}
                  onPointerUp={(event) => finishSongDeleteSwipe(event, song, canDeleteOwnSong)}
                  onPointerCancel={cancelSongDeleteSwipe}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    if (isAdmin) {
                      openSongEmojiPicker(song);
                    } else {
                      setSelectedSongId(song.id);
                    }
                  }}
                >
                  {canDeleteOwnSong && isDeleteRevealed && (
                    <button
                      className="own-song-delete-action"
                      type="button"
                      title="Remove song"
                      aria-label="Remove song"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setDeleteRevealSongId("");
                        removeOwnSong(song);
                      }}
                    >
                      <Trash2 aria-hidden="true" />
                    </button>
                  )}
                  <button className="song-main" type="button">
                    <span className="song-index">{index + 1}</span>
                    <span className="track-line">
                      <strong>{visibleTrackDisplay.title}</strong>
                      {visibleTrackDisplay.artist && <b>{visibleTrackDisplay.artist}</b>}
                    </span>
                    <span className="uploaded-by">
                      Uploaded by {uploaderIsGoogle && <GoogleBadge />}{uploader?.name || song.addedByName || "Guest"}
                      {song.dedication ? ` · dedicated to ${song.dedication}` : ""}
                    </span>
                  </button>

                  <div className="reaction-strip">
                    <span className="row-uploader">
                      {uploaderIsGoogle && <GoogleBadge />}{uploader?.name || song.addedByName || "Guest"}
                    </span>
                    <span className="track-badges">
                      {isCurrentSong && (
                        <em className="now-tag">
                          <Equalizer paused={playbackState.state !== "playing"} />
                          Now
                        </em>
                      )}
                      {isUpNextSong && <em>Up next</em>}
                    </span>
                    {emojiCounts.length > 0 && (
                      <span className="emoji-summary">
                        {emojiCounts.map(({ emoji, count }) => `${emoji}${count}`).join(" ")}
                      </span>
                    )}
                    {messagesForSong(song).slice(-2).map((item, messageIndex) => (
                      <span className="song-message" key={`${item.uid || "guest"}-${item.at || messageIndex}`}>
                        <b>{item.isAnonymous === false && <GoogleBadge />}{item.name || "Guest"}:</b> {item.text}
                      </span>
                    ))}
                  </div>

                  {isAdmin && isSelectedSong && (
                    <div className="admin-actions" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
                      <button className="icon-button" onClick={() => moveSong(song, -1)} title="Move up" disabled={queueIndex <= 0} type="button">
                        <ArrowUp aria-hidden="true" />
                      </button>
                      <button className="icon-button" onClick={() => moveSong(song, 1)} title="Move down" disabled={queueIndex < 0 || queueIndex === songs.length - 1} type="button">
                        <ArrowDown aria-hidden="true" />
                      </button>
                      <button className="icon-button" onClick={() => setNowPlaying(song.id)} title="Play" type="button">
                        <Play aria-hidden="true" />
                      </button>
                      <button className="icon-button danger" onClick={() => removeSong(song.id)} title="Remove song" type="button">
                        <Trash2 aria-hidden="true" />
                      </button>
                    </div>
                  )}

                  {!isAdmin && isSelectedSong && (
                    <div className={isVoteMenuOpen ? "song-reaction-actions is-vote-open" : "song-reaction-actions"} onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
                      <button
                        className="song-reaction-button song-smiley-button"
                        type="button"
                        aria-label="Choose reaction emoji"
                        title="Choose reaction emoji"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          openSongEmojiPicker(song, "choose");
                        }}
                      >
                        <Smile aria-hidden="true" />
                      </button>
                      <button
                        className="song-reaction-button vote-track-button"
                        type="button"
                        aria-label="Start a vote"
                        title={openVoteForSong ? `Vote open: ${voteActionLabel(openVoteForSong.action)}` : "Start a vote"}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setVoteMenuSongId((current) => current === song.id ? "" : song.id);
                        }}
                      >
                        <Vote aria-hidden="true" />
                      </button>
                      {isVoteMenuOpen && (
                        <div className="track-vote-menu" role="menu" aria-label="Vote action">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              setVoteMenuSongId("");
                              startSongVote(song, "playNext");
                            }}
                          >
                            Play Next
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              setVoteMenuSongId("");
                              startSongVote(song, "removeSong");
                            }}
                          >
                            {canDeleteOwnSong ? "Remove My Song" : "Remove Song"}
                          </button>
                        </div>
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

      {(floatingReactionsEnabled || roomShoutsEnabled) && (
        <div className="floating-main-controls">
          {floatingReactionsEnabled && (
            <div className={reactionPickerOpen ? "floating-reaction-control is-picker-open" : "floating-reaction-control"}>
              {reactionPickerOpen && (
                <>
                  <button
                    className="tap-away-layer reaction-tap-away"
                    aria-label="Close reaction picker"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      setReactionPickerOpen(false);
                    }}
                    type="button"
                  />
                  <div className="floating-reaction-picker" role="menu" aria-label="Choose reaction emoji">
                    {EMOJIS.map((emoji) => (
                      <button
                        className={floatingReactionEmoji === emoji ? "is-active" : ""}
                        key={emoji}
                        onClick={() => {
                          setFloatingReactionEmoji(emoji);
                          setFloatingReactionChosen(true);
                          setReactionPickerOpen(false);
                        }}
                        type="button"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <button
                className={floatingReactionChosen ? "floating-reaction-button" : "floating-reaction-button is-unset"}
                type="button"
                aria-label={floatingReactionChosen ? `Send ${floatingReactionEmoji} reaction` : "Choose reaction emoji"}
                title={floatingReactionChosen ? "Tap to react. Hold to change emoji." : "Choose reaction emoji"}
                onPointerDown={startFloatingReactionPress}
                onPointerUp={finishFloatingReactionPress}
                onPointerCancel={() => window.clearTimeout(floatingReactionPressTimerRef.current)}
                onPointerLeave={() => window.clearTimeout(floatingReactionPressTimerRef.current)}
                onClick={handleFloatingReactionClick}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setReactionPickerOpen(true);
                }}
              >
                {floatingReactionChosen ? floatingReactionEmoji : <Smile aria-hidden="true" />}
              </button>
            </div>
          )}
          {roomShoutsEnabled && (
            <button
              className="floating-chat-button"
              type="button"
              aria-label="Send a room shoutout"
              title="Send a room shoutout"
              onClick={() => setRoomShoutOpen(true)}
            >
              <MessageCircle aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {roomShoutOpen && (
        <div ref={roomShoutBackdropRef} className="modal-backdrop room-shout-backdrop" onClick={() => setRoomShoutOpen(false)}>
          <form className="room-shout-composer" onClick={(event) => event.stopPropagation()} onSubmit={sendRoomShout}>
            <div>
              <strong>Room shoutout</strong>
              <span>{128 - roomShoutDraft.length} left</span>
            </div>
            <textarea
              ref={roomShoutTextareaRef}
              value={roomShoutDraft}
              onChange={(event) => setRoomShoutDraft(event.target.value.slice(0, 128))}
              placeholder="Send a quick message to everyone"
              maxLength={128}
              rows={3}
            />
            <div className="room-shout-actions">
              <button className="mini-action ghost" onClick={() => setRoomShoutOpen(false)} type="button">
                Cancel
              </button>
              <button className="mini-action primary" disabled={!roomShoutDraft.trim()} type="submit">
                Send
              </button>
            </div>
          </form>
        </div>
      )}

      {votePrompt && (
        <div className="modal-backdrop vote-prompt-backdrop" role="dialog" aria-modal="true" aria-labelledby="vote-prompt-title">
          <section className="vote-prompt-card">
            <div>
              <span className="vote-kicker">Room Vote</span>
              <h2 id="vote-prompt-title">{voteActionLabel(votePrompt.action)}?</h2>
              <p>
                <strong>{votePrompt.songArtist ? `${votePrompt.songArtist} - ` : ""}{votePrompt.songTitle || "This song"}</strong>
                <span>Started by {votePrompt.startedByName || "Guest"}</span>
              </p>
            </div>
            <div className="vote-counts" aria-label="Vote progress">
              <span>Yes {voteCounts(votePrompt).yes}</span>
              <span>No {voteCounts(votePrompt).no}</span>
              <span>Needs {voteThreshold}</span>
            </div>
            <div className="vote-prompt-actions">
              <button className="mini-action primary" onClick={() => castSongVote(votePrompt, "yes")} type="button">
                <Check aria-hidden="true" />
                Yes
              </button>
              <button className="mini-action ghost" onClick={() => castSongVote(votePrompt, "no")} type="button">
                <X aria-hidden="true" />
                No
              </button>
            </div>
          </section>
        </div>
      )}

      {renderVolumeOverlay()}

      {emojiSongId && (
        <button
          className="emoji-dismiss-layer"
          aria-label="Close reactions"
          onClick={() => {
            setEmojiSongId("");
            setMessageSongId("");
            setMessageDraft("");
            setEmojiPickerMode("react");
          }}
          type="button"
        />
      )}

      {reactionSong && (
        <div
          ref={emojiBarRef}
          className={[
            "emoji-popover",
            "emoji-action-sheet",
            emojiBarPosition ? "is-row-anchored" : "",
            emojiBarPosition?.placement ? `is-${emojiBarPosition.placement}` : "",
            messageSongId === reactionSong.id ? "is-message-mode" : ""
          ].filter(Boolean).join(" ")}
          style={emojiBarPosition
            ? {
              top: `${emojiBarPosition.top}px`,
              left: `${emojiBarPosition.left}px`,
              width: `${emojiBarPosition.width}px`,
              maxHeight: `${emojiBarPosition.maxHeight}px`,
              bottom: "auto"
            }
            : undefined}
          role="dialog"
          aria-label="React to song"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
          onTouchEnd={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onMouseUp={(event) => event.stopPropagation()}
        >
          {EMOJIS.map((emoji) => (
            <button
              className={
                (emojiPickerMode === "choose"
                  ? (songReactionEmojiBySong[reactionSong.id] || reactionSong.emojiByUser?.[user.uid] || EMOJIS[0]) === emoji
                  : reactionSong.emojiByUser?.[user.uid] === emoji)
                  ? "selected"
                  : ""
              }
              key={emoji}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setSongReactionEmojiBySong((current) => ({ ...current, [reactionSong.id]: emoji }));
                reactToSong(reactionSong, emoji);
                closeEmojiPopoverSoon();
              }}
              type="button"
            >
              {emoji}
            </button>
          ))}
          <button
            className={messageSongId === reactionSong.id ? "selected" : ""}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setEmojiPickerMode("react");
              setMessageSongId(reactionSong.id);
            }}
            type="button"
            title="Send message"
          >
            <MessageCircle aria-hidden="true" />
          </button>
          {messageSongId === reactionSong.id && (
            <form className="reaction-message" onSubmit={(event) => { event.preventDefault(); sendSongMessage(reactionSong); }}>
              <input
                value={messageDraft}
                onChange={(event) => setMessageDraft(event.target.value.slice(0, 90))}
                onFocus={() => window.setTimeout(() => {
                  window.visualViewport?.dispatchEvent?.(new Event("resize"));
                }, 80)}
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

      {playerChoicePrompt && (
        <div className="modal-backdrop player-choice-backdrop" role="dialog" aria-modal="true">
          <section className="about-modal player-choice-modal">
            <div className="modal-header">
              <div>
                <h2>Player Device</h2>
                <p>Your Google account is already playing from another device.</p>
              </div>
            </div>
            <div className="player-choice-copy">
              <strong>Keep playing from {playerChoicePrompt.playerName || "the other device"}?</strong>
              <p>You will stay admin here, but this device will not load the YouTube player.</p>
            </div>
            <div className="player-choice-actions">
              <button
                className="mini-action"
                onClick={() => {
                  setDismissedPlayerPromptKey(playerChoicePrompt.key);
                  setPlayerChoicePrompt(null);
                }}
                type="button"
              >
                Keep There
              </button>
              <button className="primary-action" onClick={takeOverDj} type="button">
                Play From Here
              </button>
            </div>
          </section>
        </div>
      )}

      {selfRenameOpen && (
        <div ref={nicknameBackdropRef} className="modal-backdrop nickname-modal-backdrop" role="dialog" aria-modal="true">
          <section className="about-modal nickname-modal">
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
                ref={nicknameInputRef}
                value={selfRenameDraft}
                onChange={(event) => setSelfRenameDraft(event.target.value.slice(0, 30))}
                onFocus={(event) => {
                  const input = event.currentTarget;
                  selectExistingText(event);
                  window.setTimeout(() => input.scrollIntoView({ block: "center", behavior: "auto" }), 180);
                }}
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
        <div className="modal-backdrop add-sheet-backdrop" role="dialog" aria-modal="true" onClick={() => setAddSheetOpen(false)}>
          <section className="add-panel add-sheet" onClick={(event) => event.stopPropagation()}>
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

            {!isAdmin && cooldownEnabled && !roomNeedsFirstTrack && (
              <div className={cooldownRemaining > 0 ? "cooldown-countdown is-waiting" : "cooldown-countdown is-ready"} role="status" aria-live="polite">
                <span>{cooldownRemaining > 0 ? "Cooldown" : "Ready"}</span>
                <strong>{cooldownRemaining > 0 ? cooldownCountdown : "Add now"}</strong>
                <small>
                  {cooldownRemaining > 0
                    ? "You can add another song when this reaches 0:00."
                    : "You can add a song now."}
                </small>
              </div>
            )}

            <div className="song-fun-options">
              <label>
                <span>Dedication</span>
                <input
                  value={songDedication}
                  onChange={(event) => setSongDedication(event.target.value.slice(0, 48))}
                  onFocus={selectExistingText}
                  placeholder="Optional: for someone in the room"
                  maxLength={48}
                />
              </label>
              <label className="mystery-toggle">
                <input
                  type="checkbox"
                  checked={mysteryAdd}
                  onChange={(event) => setMysteryAdd(event.target.checked)}
                />
                <span>Mystery add</span>
              </label>
            </div>

            {internalSearchAvailable && (
              <div className="search-tabs" role="tablist" aria-label="Song search mode">
                <button
                  className={searchMode === "external" ? "is-active" : ""}
                  onClick={() => setSearchMode("external")}
                  type="button"
                  role="tab"
                  aria-selected={searchMode === "external"}
                >
                  External Search
                </button>
                <button
                  className={searchMode === "internal" ? "is-active" : ""}
                  onClick={() => setSearchMode("internal")}
                  type="button"
                  role="tab"
                  aria-selected={searchMode === "internal"}
                >
                  Internal Search
                </button>
              </div>
            )}

            {internalSearchAvailable && searchMode === "internal" ? (
              <>
                <form className="youtube-search" onSubmit={searchYouTube}>
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    onFocus={placeCursorAtTextEnd}
                    onClick={placeCursorAtTextEnd}
                    placeholder={YOUTUBE_API_KEY ? "Search YouTube" : "Add VITE_YOUTUBE_API_KEY"}
                  />
                    <button className="primary-action" disabled={!YOUTUBE_API_KEY || searching} type="submit">
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
                          <button className="mini-action" onClick={() => addSong(null, result)} disabled={!canAddSong || Boolean(addingSongKey)} type="button">
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
                {externalSearchStep === "search" ? (
                  <>
                    <div>
                      <strong>Search {externalSearchProvider === "youtube" ? "YouTube" : "YouTube Music"}</strong>
                      <span>Open {externalSearchProvider === "youtube" ? "YouTube" : "YouTube Music"}, copy a song link, then come back to PartyBeats.</span>
                    </div>
                    <div className="external-provider-toggle" role="tablist" aria-label="External search provider">
                      <button
                        className={externalSearchProvider === "music" ? "is-active" : ""}
                        onClick={() => setExternalSearchProvider("music")}
                        type="button"
                        role="tab"
                        aria-selected={externalSearchProvider === "music"}
                      >
                        YouTube Music
                      </button>
                      <button
                        className={externalSearchProvider === "youtube" ? "is-active" : ""}
                        onClick={() => setExternalSearchProvider("youtube")}
                        type="button"
                        role="tab"
                        aria-selected={externalSearchProvider === "youtube"}
                      >
                        YouTube
                      </button>
                    </div>
                    <form
                      className="external-search-actions"
                      onSubmit={(event) => {
                        event.preventDefault();
                        openExternalSearch();
                      }}
                    >
                      <input
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        onFocus={placeCursorAtTextEnd}
                        onClick={placeCursorAtTextEnd}
                        placeholder={`Search ${externalSearchProvider === "youtube" ? "YouTube" : "YouTube Music"}`}
                      />
                      <button className="mini-action" type="submit">
                        <ExternalLink aria-hidden="true" />
                        Open
                      </button>
                    </form>
                    <button className="external-tutorial-button" onClick={() => setExternalTutorialOpen(true)} type="button">
                      <Info aria-hidden="true" />
                      How do I add a song?
                    </button>
                  </>
                ) : (
                  <>
                    {externalClipboardCandidate ? (
                      <div className="clipboard-link-card">
                        <span>Found link in your clipboard</span>
                        <div className="clipboard-track">
                          <img src={externalClipboardCandidate.thumbnail} alt="" />
                          <div>
                            <strong>{externalClipboardCandidate.title}</strong>
                            <small>{externalClipboardCandidate.channelTitle}</small>
                          </div>
                        </div>
                        <div className="clipboard-actions">
                          <button className="primary-action" onClick={addClipboardCandidate} disabled={!canAddSong || Boolean(addingSongKey)} type="button">
                            <Plus aria-hidden="true" />
                            {addingSongKey ? "Adding..." : "Add to Playlist"}
                          </button>
                          <button className="mini-action" onClick={cancelExternalPasteStep} type="button">
                            <X aria-hidden="true" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <strong>{externalClipboardChecking ? "Checking clipboard" : "Add copied song link"}</strong>
                          <span>{externalClipboardMessage || "Return to PartyBeats after copying a YouTube or YouTube Music link. If your browser asks for a tap, tap Add Copied Song."}</span>
                        </div>
                        <button className="primary-action clipboard-check-action" onClick={addCopiedSongFromButton} disabled={externalClipboardChecking || Boolean(addingSongKey)} type="button">
                          <Plus aria-hidden="true" />
                          {externalClipboardChecking || addingSongKey ? "Adding..." : "Add Copied Song"}
                        </button>
                        {clipboardPasteMode && (
                          <label className="clipboard-paste-target">
                            <span>Paste copied link</span>
                            <input
                              ref={clipboardPasteInputRef}
                              value={youtubeLink}
                              onChange={(event) => setYoutubeLink(event.target.value)}
                              onPaste={addPastedSongLink}
                              placeholder="Tap here, then Paste"
                              inputMode="url"
                              autoCapitalize="none"
                              autoCorrect="off"
                            />
                          </label>
                        )}
                        <form className="youtube-link-form compact-link-form" onSubmit={addSongFromLink}>
                          <input
                            value={youtubeLink}
                            onChange={(event) => setYoutubeLink(event.target.value)}
                            placeholder="Paste song, album, or playlist link"
                          />
                          <button className="primary-action" disabled={!canAddSong || !youtubeLink.trim() || Boolean(addingSongKey)} type="submit">
                            <Plus aria-hidden="true" />
                            {addingSongKey ? "Adding..." : "Add Link"}
                          </button>
                        </form>
                        <button className="mini-action" onClick={cancelExternalPasteStep} type="button">
                          <X aria-hidden="true" />
                          Cancel
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {externalTutorialOpen && (
        <ExternalSearchTutorial onClose={() => setExternalTutorialOpen(false)} />
      )}

      {roomPanelOpen && (
        <div className="modal-backdrop room-panel-backdrop" role="dialog" aria-modal="true" onClick={() => setRoomPanelOpen(false)}>
          <section className="about-modal room-panel" onClick={(event) => event.stopPropagation()}>
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
            </div>

            {roomPanelTab === "room" && (
              <div className="room-panel-page">
                <div className="about-grid room-summary-grid">
                  <div>
                    <span>Room ID</span>
                    <strong>{activeRoomId}</strong>
                  </div>
                  <div>
                    <span>People</span>
                    <strong>{members.length}</strong>
                  </div>
                  <div>
                    <span>Player</span>
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
                  const canPromoteMember = member.isAnonymous === false && !memberIsAdmin;
                  return (
                    <div className={isAdmin ? "member-row manageable" : "member-row"} key={member.id}>
                      {isAdmin && isRenaming ? (
                        <form className="rename-member-form" onSubmit={(event) => { event.preventDefault(); renameMember(member); }}>
                          <input
                            value={renameDraft}
                            onChange={(event) => setRenameDraft(event.target.value.slice(0, 30))}
                            onFocus={selectExistingText}
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
                        <div className="member-name-cell">
                          <strong>{member.isAnonymous === false && <GoogleBadge />}{member.name}{isCurrentUser ? " (You)" : ""}</strong>
                          <span>
                            {member.isAnonymous ? "Guest" : "Google"}
                            {memberIsAdmin ? " · Admin" : ""}
                          </span>
                        </div>
                      )}
                      {isAdmin && !isRenaming && (
                        <div className="member-actions">
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
                          {canPromoteMember && (
                            <button className="icon-button" onClick={() => promoteMember(member)} title="Make admin" type="button">
                              <Crown aria-hidden="true" />
                            </button>
                          )}
                          {memberIsAdmin && <Crown className="member-admin-badge" aria-label="Admin" />}
                          {!isCurrentUser && (
                            <button className="icon-button danger" onClick={() => removeMember(member)} title="Remove from room" type="button">
                              <Trash2 aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      )}
                      {!isAdmin && memberIsAdmin && <Crown className="member-admin-badge" aria-label="Admin" />}
                    </div>
                  );
                })}
              </section>
            )}

            {roomPanelTab === "settings" && (
              <div className="room-panel-page">
                <form className="setting-row tagline-setting" onSubmit={saveRoomTagline}>
                  <div>
                    <strong>DJ tagline</strong>
                    <span>{roomTagline || "Set the room vibe message"}</span>
                  </div>
                  <input
                    value={taglineDraft}
                    onChange={(event) => setTaglineDraft(event.target.value.slice(0, 60))}
                    onFocus={selectExistingText}
                    placeholder="80s rock only tonight"
                    maxLength={60}
                    disabled={!isAdmin}
                  />
                  <button className="mini-action" disabled={!isAdmin} type="submit">
                    Save
                  </button>
                </form>
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
                <div className="setting-row">
                  <div>
                    <strong>Toast notifications</strong>
                    <span>{toastEnabled ? "Show app status and action messages" : "App toast messages are off"}</span>
                  </div>
                  <button
                    className={toastEnabled ? "toggle-button is-on" : "toggle-button"}
                    onClick={() => updateToastEnabled(!toastEnabled)}
                    disabled={!isAdmin}
                    type="button"
                  >
                    {toastEnabled ? "On" : "Off"}
                  </button>
                </div>
                <div className="setting-row">
                  <div>
                    <strong>Internal search</strong>
                    <span>{internalSearchEnabled ? "Show internal and external search options" : "Only external song adding is available"}</span>
                  </div>
                  <button
                    className={internalSearchEnabled ? "toggle-button is-on" : "toggle-button"}
                    onClick={() => updateInternalSearchEnabled(!internalSearchEnabled)}
                    disabled={!isAdmin}
                    type="button"
                  >
                    {internalSearchEnabled ? "On" : "Off"}
                  </button>
                </div>
                <div className="setting-row">
                  <div>
                    <strong>Main react button</strong>
                    <span>{floatingReactionsEnabled ? "Show the floating emoji react button" : "Floating emoji reactions are hidden"}</span>
                  </div>
                  <button
                    className={floatingReactionsEnabled ? "toggle-button is-on" : "toggle-button"}
                    onClick={() => updateFloatingReactionsEnabled(!floatingReactionsEnabled)}
                    disabled={!isAdmin}
                    type="button"
                  >
                    {floatingReactionsEnabled ? "On" : "Off"}
                  </button>
                </div>
                <div className="setting-row">
                  <div>
                    <strong>Shoutout chat</strong>
                    <span>{roomShoutsEnabled ? "Show the main chat bubble for 5-second room messages" : "Main screen shoutouts are hidden"}</span>
                  </div>
                  <button
                    className={roomShoutsEnabled ? "toggle-button is-on" : "toggle-button"}
                    onClick={() => updateRoomShoutsEnabled(!roomShoutsEnabled)}
                    disabled={!isAdmin}
                    type="button"
                  >
                    {roomShoutsEnabled ? "On" : "Off"}
                  </button>
                </div>
                {!isAdmin && <p className="muted">Only admins can change room settings.</p>}
              </div>
            )}

            {roomPanelTab === "analytics" && (
              <div className="room-panel-page analytics-page">
                <div className="analytics-actions">
                  <button className="primary-action analytics-share-action" onClick={sharePartyRecap} type="button">
                    <Share2 aria-hidden="true" />
                    Share Party Recap
                  </button>
                  <button className="mini-action analytics-share-action" onClick={shareAnalytics} type="button">
                    <Share2 aria-hidden="true" />
                    Share Analytics
                  </button>
                </div>
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
                  <div>
                    <span>Streak</span>
                    <strong>{activeReactionStreak?.streak > 1 ? `${activeReactionStreak.name || "Guest"} ${activeReactionStreak.streak}` : "----"}</strong>
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
          </section>
        </div>
      )}

      {roomQrOpen && (
        <div
          className="modal-backdrop room-qr-popup-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="room-qr-popup-title"
          onClick={() => setRoomQrOpen(false)}
        >
          <section className="about-modal room-qr-popup" onClick={(event) => event.stopPropagation()}>
            <button className="icon-button room-qr-popup-close" onClick={() => setRoomQrOpen(false)} title="Close" type="button">
              <X aria-hidden="true" />
            </button>
            <AppIcon />
            <div>
              <h2 id="room-qr-popup-title">Join Room</h2>
              <strong>{activeRoomId}</strong>
            </div>
            {qrDataUrl ? (
              <div className="qr-block room-qr-popup-code">
                <img src={qrDataUrl} alt={`Join ${activeRoomId}`} />
                <span>
                  <QrCode aria-hidden="true" />
                  Scan to join BP PartyBeats
                </span>
              </div>
            ) : (
              <p className="muted">QR code is loading.</p>
            )}
            <div className="support-card room-qr-support-card">
              <p>Enjoying the party? Send me a shoutout! 🙂</p>
              <a className="etransfer-email" href="mailto:bill.defiant@gmail.com">bill.defiant@gmail.com</a>
            </div>
          </section>
        </div>
      )}

      {shareChoiceOpen && (
        <div
          className="modal-backdrop share-choice-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-choice-title"
          onClick={() => setShareChoiceOpen(false)}
        >
          <section className="about-modal share-choice-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 id="share-choice-title">Share</h2>
                <p className="muted">Choose what to send.</p>
              </div>
              <button className="icon-button" onClick={() => setShareChoiceOpen(false)} title="Close" type="button">
                <X aria-hidden="true" />
              </button>
            </div>
            <div className="share-choice-grid">
              <button onClick={shareApp} type="button">
                <Share2 aria-hidden="true" />
                <strong>App</strong>
                <span>Send the BP PartyBeats link.</span>
              </button>
              <button onClick={exportPlaylist} type="button">
                <Music2 aria-hidden="true" />
                <strong>Playlist</strong>
                <span>Share the current queue.</span>
              </button>
            </div>
          </section>
        </div>
      )}

      {aboutOpen && (
        <div
          className="modal-backdrop about-app-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="about-app-title"
          onClick={() => setAboutOpen(false)}
        >
          <section className="about-modal about-app-modal" onClick={(event) => event.stopPropagation()}>
            <button className="icon-button about-app-close" onClick={() => setAboutOpen(false)} title="Close" type="button">
              <X aria-hidden="true" />
            </button>
            <AppIcon />
            <h2 id="about-app-title">BP PartyBeats</h2>
            <strong>{APP_VERSION}</strong>
            <span>Created by: Bill Parsons</span>
            <div className="support-card">
              <p>Enjoying the party? Send me a shoutout! 🙂</p>
              <a className="etransfer-email" href="mailto:bill.defiant@gmail.com">bill.defiant@gmail.com</a>
            </div>
          </section>
        </div>
      )}

      {installHelpOpen && (
        <div
          className="modal-backdrop install-help-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-help-title"
          onClick={() => setInstallHelpOpen(false)}
        >
          <section className="about-modal install-help-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 id="install-help-title">Install BP PartyBeats</h2>
                <p className="muted">Your browser does not show the install prompt from inside the app.</p>
              </div>
              <button className="icon-button" onClick={() => setInstallHelpOpen(false)} title="Close" type="button">
                <X aria-hidden="true" />
              </button>
            </div>
            <div className="install-help-steps">
              <div>
                <strong>Firefox on Android</strong>
                <span>Tap the Firefox menu, then choose Install or Add app to Home screen.</span>
              </div>
              <div>
                <strong>iPhone</strong>
                <span>Open in Safari, tap Share, then Add to Home Screen.</span>
              </div>
              <div>
                <strong>Chrome or Edge</strong>
                <span>Use the browser menu if the install prompt does not appear.</span>
              </div>
            </div>
            <button className="primary-action" onClick={() => setInstallHelpOpen(false)} type="button">
              OK
            </button>
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

      {themePickerModal}
      {confettiLayer}

      {emojiBursts.length > 0 && (
        <div className="emoji-burst-layer" aria-hidden="true">
          {emojiBursts.map((burst) => (
            <span className="emoji-burst" key={burst.id} style={{ left: `${burst.x}px`, top: `${burst.y}px` }}>
              {Array.from({ length: 6 }, (_, index) => (
                <i
                  key={index}
                  style={{
                    "--burst-dx": `${(index - 2.5) * 30 + ((index * 13) % 11) - 5}px`,
                    "--burst-dy": `${-(96 + (index % 3) * 26)}px`,
                    "--burst-delay": `${index * 45}ms`,
                    "--burst-scale": `${0.8 + (index % 3) * 0.25}`
                  }}
                >
                  {burst.emoji}
                </i>
              ))}
            </span>
          ))}
        </div>
      )}

      {floatingReactions.length > 0 && (
        <div className="floating-reaction-layer" aria-hidden="true">
          {floatingReactions.map((reaction) => (
            <span
              className="floating-reaction"
              key={reaction.id}
              style={{
                left: `${reaction.x}%`,
                "--float-drift": `${reaction.drift}px`,
                "--float-scale": reaction.scale
              }}
            >
              {reaction.emoji}
            </span>
          ))}
        </div>
      )}

      {roomShouts.length > 0 && (
        <div className="room-shout-layer" aria-live="polite" aria-atomic="false">
          {roomShouts.map((shout) => (
            <div
              className="room-shout-bubble"
              key={shout.id}
              onPointerDown={(event) => startRoomShoutSwipe(event, shout.id)}
              onPointerUp={(event) => finishRoomShoutSwipe(event, shout.id)}
              onPointerCancel={() => { roomShoutSwipeStartRef.current = null; }}
            >
              <div className="room-shout-copy">
                <strong>{shout.name}</strong>
                <p>{shout.text}</p>
              </div>
              <button
                className="room-shout-close"
                type="button"
                aria-label="Close shoutout"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => dismissRoomShout(shout.id)}
              >
                <X aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      {(toastEnabled || isImportantToast(toast)) && toast && (
        <button className="toast" onClick={() => setToast("")} role={isImportantToast(toast) ? "alert" : "status"} type="button">
          {toast}
        </button>
      )}
    </main>
  );
}

function Equalizer({ paused = false }) {
  return (
    <span className={paused ? "equalizer is-paused" : "equalizer"} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

function YouTubePlayer({
  song,
  onEnded,
  onCrossfade,
  onUnavailable,
  verifyPlayback,
  crossfadeEnabled,
  crossfadeSeconds,
  volume,
  visualizerEnabled,
  displayTrack,
  qrDataUrl,
  roomId,
  playbackState,
  onPlaybackUpdate,
  fullscreenMotion
}) {
  const containerId = useRef(`yt-player-${Math.random().toString(36).slice(2)}`);
  const playerFrameRef = useRef(null);
  const qrOverlayRef = useRef(null);
  const playerRef = useRef(null);
  const playerTimerRef = useRef(null);
  const endedRef = useRef(onEnded);
  const crossfadeRef = useRef(onCrossfade);
  const unavailableRef = useRef(onUnavailable);
  const verifyPlaybackRef = useRef(verifyPlayback);
  const playbackRef = useRef(playbackState);
  const playbackUpdateRef = useRef(onPlaybackUpdate);
  const crossfadeEnabledRef = useRef(crossfadeEnabled);
  const crossfadeSecondsRef = useRef(crossfadeSeconds);
  const volumeRef = useRef(volume);
  const crossfadeTriggeredRef = useRef(false);
  const currentVideoIdRef = useRef("");
  const currentSongIdRef = useRef("");
  const pendingVideoIdRef = useRef("");
  const pauseAfterLoadRef = useRef(false);
  const lastPlaybackReportRef = useRef(0);
  const lastAppliedPlaybackCommandRef = useRef(0);
  const playerReadyRef = useRef(false);
  const errorHandledSongRef = useRef("");
  const [playerError, setPlayerError] = useState("");
  const [localPlaybackState, setLocalPlaybackState] = useState("paused");
  const [qrOverlayStyle, setQrOverlayStyle] = useState(null);

  function forcePlayerIframeSize() {
    const iframe = playerRef.current?.getIframe?.() || playerFrameRef.current?.querySelector?.("iframe");
    if (!iframe) return;
    iframe.setAttribute("width", "100%");
    iframe.setAttribute("height", "100%");
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.minWidth = "100%";
    iframe.style.minHeight = "100%";
    iframe.style.maxWidth = "none";
    iframe.style.maxHeight = "none";
    iframe.style.display = "block";
  }

  useEffect(() => {
    endedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    crossfadeRef.current = onCrossfade;
  }, [onCrossfade]);

  useEffect(() => {
    unavailableRef.current = onUnavailable;
    verifyPlaybackRef.current = verifyPlayback;
  }, [onUnavailable, verifyPlayback]);

  useEffect(() => {
    playbackRef.current = playbackState;
    playbackUpdateRef.current = onPlaybackUpdate;
  }, [playbackState, onPlaybackUpdate]);

  useEffect(() => {
    const player = playerRef.current;
    if (!song?.id || !playerReadyRef.current || !player || playbackState?.songId !== song.id) return;
    if (!["restart", "select", "next", "stop", "play", "pause"].includes(playbackState.command) || !playbackState.commandId) return;
    if (lastAppliedPlaybackCommandRef.current === playbackState.commandId) return;
    if (!playbackState.commandAt || Date.now() - playbackState.commandAt > PLAYBACK_COMMAND_WINDOW_MS) return;

    lastAppliedPlaybackCommandRef.current = playbackState.commandId;
    if (playbackState.command === "next") {
      endedRef.current?.();
      return;
    }
    if (playbackState.command === "stop") {
      if (playerTimerRef.current) {
        window.clearInterval(playerTimerRef.current);
        playerTimerRef.current = null;
      }
      player.stopVideo?.();
      setLocalPlaybackState("paused");
      return;
    }
    if (playbackState.command === "pause") {
      if (playerTimerRef.current) {
        window.clearInterval(playerTimerRef.current);
        playerTimerRef.current = null;
      }
      player.pauseVideo?.();
      setLocalPlaybackState("paused");
      return;
    }
    if (playbackState.command === "play") {
      player.playVideo?.();
      setLocalPlaybackState("playing");
      return;
    }
    crossfadeTriggeredRef.current = false;
    lastPlaybackReportRef.current = 0;
    player.seekTo?.(0, true);
    player.playVideo?.();
    setLocalPlaybackState("playing");
  }, [song?.id, playbackState?.songId, playbackState?.command, playbackState?.commandId, playbackState?.commandAt]);

  useEffect(() => {
    crossfadeEnabledRef.current = crossfadeEnabled;
    crossfadeSecondsRef.current = crossfadeSeconds;
  }, [crossfadeEnabled, crossfadeSeconds]);

  useEffect(() => {
    volumeRef.current = Math.min(100, Math.max(0, Number(volume) || 0));
    if (playerReadyRef.current) {
      playerRef.current?.setVolume?.(volumeRef.current);
    }
  }, [volume]);

  useEffect(() => {
    if (!song?.id || playbackState?.state === "paused") {
      setLocalPlaybackState("paused");
    }
  }, [song?.id, playbackState?.state]);

  useEffect(() => {
    let frame = 0;
    const scheduleSizing = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(forcePlayerIframeSize);
    };
    scheduleSizing();
    window.addEventListener("resize", scheduleSizing);
    document.addEventListener("fullscreenchange", scheduleSizing);
    const resizeObserver = typeof ResizeObserver === "undefined" || !playerFrameRef.current
      ? null
      : new ResizeObserver(scheduleSizing);
    resizeObserver?.observe(playerFrameRef.current);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", scheduleSizing);
      document.removeEventListener("fullscreenchange", scheduleSizing);
      resizeObserver?.disconnect();
    };
  }, [song?.videoId, visualizerEnabled]);

  useEffect(() => {
    if (!qrDataUrl || !roomId || !song?.videoId || visualizerEnabled) {
      setQrOverlayStyle(null);
      return undefined;
    }

    let frame = 0;
    const updateQrPosition = () => {
      const frameEl = playerFrameRef.current;
      const qrEl = qrOverlayRef.current;
      if (!frameEl || !qrEl) return;

      const frameRect = frameEl.getBoundingClientRect();
      const qrRect = qrEl.getBoundingClientRect();
      if (!frameRect.width || !frameRect.height || !qrRect.width || !qrRect.height) return;

      const videoAspect = 16 / 9;
      let contentWidth = frameRect.width;
      let contentHeight = frameRect.width / videoAspect;
      if (contentHeight > frameRect.height) {
        contentHeight = frameRect.height;
        contentWidth = frameRect.height * videoAspect;
      }
      const insetX = Math.max(0, (frameRect.width - contentWidth) / 2);
      const insetY = Math.max(0, (frameRect.height - contentHeight) / 2);
      const gap = Math.max(8, Math.min(18, frameRect.width * 0.018));
      const left = Math.max(gap, insetX + contentWidth - qrRect.width - gap);
      const top = Math.max(gap, insetY + contentHeight - qrRect.height - gap);
      const nextStyle = {
        left: `${Math.round(left)}px`,
        top: `${Math.round(top)}px`,
        right: "auto",
        bottom: "auto"
      };
      setQrOverlayStyle((current) => (
        current?.left === nextStyle.left
        && current?.top === nextStyle.top
        && current?.right === nextStyle.right
        && current?.bottom === nextStyle.bottom
          ? current
          : nextStyle
      ));
    };
    const scheduleUpdate = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(updateQrPosition);
    };

    scheduleUpdate();
    const delayedUpdate = window.setTimeout(scheduleUpdate, 250);
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleUpdate);
    resizeObserver?.observe(playerFrameRef.current);
    resizeObserver?.observe(qrOverlayRef.current);
    window.addEventListener("resize", scheduleUpdate);
    document.addEventListener("fullscreenchange", scheduleUpdate);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(delayedUpdate);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
      document.removeEventListener("fullscreenchange", scheduleUpdate);
    };
  }, [qrDataUrl, roomId, song?.videoId, visualizerEnabled]);

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
      forcePlayerIframeSize();
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
      setPlayerError("");
      errorHandledSongRef.current = "";
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

      const verification = await verifyPlaybackRef.current?.(videoId);
      if (cancelled) return;
      if (verification?.embeddable === false) {
        errorHandledSongRef.current = song?.id || "";
        setPlayerError("This track cannot play inside PartyBeats. Skipping to the next track.");
        unavailableRef.current?.("preflight");
        return;
      }

      await loadYouTubeIframeApi();
      if (cancelled) return;

      if (playerRef.current) {
        loadVideo(playerRef.current, videoId);
        return;
      }

      playerRef.current = new window.YT.Player(containerId.current, {
        width: "100%",
        height: "100%",
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
            forcePlayerIframeSize();
            event.target.setVolume?.(volumeRef.current);
            loadVideo(event.target, pendingVideoIdRef.current);
            window.setTimeout(forcePlayerIframeSize, 100);
            window.setTimeout(forcePlayerIframeSize, 350);
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              setLocalPlaybackState("playing");
              if (pauseAfterLoadRef.current) {
                pauseAfterLoadRef.current = false;
                event.target.pauseVideo?.();
                setLocalPlaybackState("paused");
                reportPlayback(event.target, "paused", true);
                return;
              }
              reportPlayback(event.target, "playing", true);
              startPlaybackTimer(event.target);
            }
            if (event.data === window.YT.PlayerState.PAUSED) {
              setLocalPlaybackState("paused");
              stopPlaybackTimer();
              reportPlayback(event.target, "paused", true);
            }
            if (event.data === window.YT.PlayerState.ENDED) {
              setLocalPlaybackState("paused");
              stopPlaybackTimer();
              endedRef.current?.();
            }
            if (event.data === window.YT.PlayerState.CUED || event.data === window.YT.PlayerState.UNSTARTED) {
              setLocalPlaybackState("paused");
            }
          },
          onError: (event) => {
            stopPlaybackTimer();
            const failedSongId = currentSongIdRef.current;
            if (errorHandledSongRef.current === failedSongId) return;
            errorHandledSongRef.current = failedSongId;
            setPlayerError("This track cannot play inside PartyBeats. Skipping to the next track.");
            unavailableRef.current?.(event.data);
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

  function syncVisualizerPlaybackState(state) {
    const player = playerRef.current;
    playbackUpdateRef.current?.({
      songId: song.id,
      seconds: Math.max(0, Number(player?.getCurrentTime?.()) || Number(playbackRef.current?.seconds) || 0),
      state
    });
  }

  function toggleVisualizerPlayback() {
    const player = playerRef.current;
    if (!song?.id || !playerReadyRef.current || !player) return;
    const ytState = player.getPlayerState?.();
    const isPlaying = ytState === window.YT?.PlayerState?.PLAYING || localPlaybackState === "playing";

    if (isPlaying) {
      player.pauseVideo?.();
      setLocalPlaybackState("paused");
      syncVisualizerPlaybackState("paused");
      return;
    }

    player.playVideo?.();
    setLocalPlaybackState("playing");
    syncVisualizerPlaybackState("playing");
  }

  return (
    <div
      ref={playerFrameRef}
      className={[
      song?.videoId ? "player-frame" : "player-frame is-empty",
      visualizerEnabled && song?.videoId ? "is-visualizer" : ""
    ].filter(Boolean).join(" ")}
    >
      <div className="youtube-frame">
        <div className="youtube-target" id={containerId.current} />
      </div>
      {visualizerEnabled && song?.videoId && (
        <MusicVisualizer
          song={song}
          displayTrack={displayTrack}
          isPlaying={localPlaybackState === "playing"}
          onTogglePlayback={toggleVisualizerPlayback}
          fullscreenMotion={fullscreenMotion}
        />
      )}
      {qrDataUrl && roomId && (
        <div
          ref={qrOverlayRef}
          className="player-qr-overlay"
          style={qrOverlayStyle || undefined}
          aria-label={`Join room ${roomId}`}
        >
          <img src={qrDataUrl} alt="" />
          <span>{roomId}</span>
        </div>
      )}
      {!song?.videoId && (
        <div className="player-empty">
          <Music2 aria-hidden="true" />
        </div>
      )}
      {playerError && (
        <div className="player-error-overlay" role="status">
          <Info aria-hidden="true" />
          <strong>Track unavailable</strong>
          <span>{playerError}</span>
        </div>
      )}
    </div>
  );
}

function MusicVisualizer({ song, displayTrack, isPlaying, onTogglePlayback, fullscreenMotion = false }) {
  const title = displayTrack?.title || decodeHtmlEntities(song?.title || "Untitled");
  const artist = displayTrack?.artist || decodeHtmlEntities(song?.artist || "YouTube");

  return (
    <div className={[isPlaying ? "music-visualizer" : "music-visualizer is-paused", fullscreenMotion ? "has-embedded-party-motion" : ""].filter(Boolean).join(" ")}>
      {fullscreenMotion && <PartyMotionCanvas className="embedded-party-motion" embedded />}
      <div className="visualizer-glow visualizer-glow-a" />
      <div className="visualizer-glow visualizer-glow-b" />
      <div className="visualizer-ring visualizer-ring-a" />
      <div className="visualizer-ring visualizer-ring-b" />
      <div className="visualizer-center">
        <Activity aria-hidden="true" />
        <strong>{title}</strong>
        <span>{artist}</span>
        <button
          className={isPlaying ? "visualizer-playback-button is-playing" : "visualizer-playback-button"}
          onClick={onTogglePlayback}
          type="button"
          aria-label={isPlaying ? "Pause visualizer playback" : "Play visualizer playback"}
        >
          {isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          {isPlaying ? "Pause" : "Play"}
        </button>
      </div>
      <div className="visualizer-bars">
        {Array.from({ length: 18 }, (_, index) => (
          <i key={index} style={{ "--bar-index": index }} />
        ))}
      </div>
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
            <p className="muted">Search YouTube or YouTube Music, copy the song link, then paste it back into PartyBeats.</p>
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
          <div className="tutorial-step step-6">6. Go back to PartyBeats</div>
          <div className="tutorial-step step-7">7. Return to PartyBeats</div>
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
      <button className="google-action" onClick={onGoogle} type="button">
        <span className="google-mark" aria-hidden="true">G</span>
        Continue with Google
      </button>
      <input
        value={nickname}
        onChange={(event) => setNickname(event.target.value)}
        onFocus={selectExistingText}
        placeholder="Nickname"
        maxLength={30}
      />
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
          onFocus={selectExistingText}
          placeholder="Party nickname"
          maxLength={30}
        />
      )}
      <button className="icon-button" onClick={onSignOut} title="Sign out" type="button">
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
