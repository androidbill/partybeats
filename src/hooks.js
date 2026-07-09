import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as api from "./api";
import { LAST_ACTIVE_ROOM_KEY, ROOM_ID_PATTERN } from "./constants";
import {
  avatarIdForMember, fallbackAvatarId, hasProfanity, nicknameFor, normalizeRoomId
} from "./utils";

/* A 1-second clock for countdowns and progress bars. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/* Toast queue with auto-dismiss. */
export function useToast() {
  const [toast, setToastState] = useState("");
  const timerRef = useRef(0);
  const showToast = useCallback((message) => {
    window.clearTimeout(timerRef.current);
    setToastState(message);
    if (message) timerRef.current = window.setTimeout(() => setToastState(""), 3600);
  }, []);
  useEffect(() => () => window.clearTimeout(timerRef.current), []);
  return [toast, showToast];
}

/* Firebase auth session. */
export function useAuth(showToast) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nickname, setNickname] = useState("");

  useEffect(() => api.watchAuth((nextUser) => {
    setUser(nextUser);
    setNickname((current) => current || nicknameFor(nextUser, ""));
    setLoading(false);
  }), []);

  const signInGoogle = useCallback(async () => {
    try {
      const nextUser = await api.signInWithGoogle();
      setNickname((current) => current || nicknameFor(nextUser, ""));
      return nextUser;
    } catch (error) {
      if (error?.code !== "auth/popup-closed-by-user") {
        showToast("Google sign-in didn't finish. Try again.");
      }
      return null;
    }
  }, [showToast]);

  const signInGuest = useCallback(async (name) => {
    const cleanName = String(name || "").trim().slice(0, 30);
    if (!cleanName) {
      showToast("Pick a nickname first.");
      return null;
    }
    if (hasProfanity(cleanName)) {
      showToast("That nickname isn't allowed.");
      return null;
    }
    try {
      const nextUser = await api.signInAsGuest(cleanName);
      setUser(nextUser);
      setNickname(cleanName);
      return nextUser;
    } catch {
      showToast("Couldn't start a guest session. Check your connection.");
      return null;
    }
  }, [showToast]);

  const signOut = useCallback(async () => {
    await api.signOutUser().catch(() => undefined);
    setNickname("");
  }, []);

  return { user, loading, nickname, setNickname, signInGoogle, signInGuest, signOut };
}

/* The live room: join/create, snapshots, leave. */
export function useRoomSession({ user, nickname, setNickname, deviceId, showToast }) {
  const [activeRoomId, setActiveRoomId] = useState("");
  const [room, setRoom] = useState(null);
  const [songs, setSongs] = useState([]);
  const [members, setMembers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [shouts, setShouts] = useState([]);
  const [playback, setPlayback] = useState(null);
  const [joining, setJoining] = useState(false);
  const [creating, setCreating] = useState(false);
  const [celebrateKey, setCelebrateKey] = useState(0);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!activeRoomId) return undefined;
    return api.watchRoom(activeRoomId, {
      onRoom: setRoom,
      onSongs: setSongs,
      onMembers: setMembers,
      onMessages: setMessages,
      onReactions: setReactions,
      onShouts: setShouts,
      onPlayback: setPlayback
    });
  }, [activeRoomId]);

  const join = useCallback(async (rawId, { silent = false, joiningUser = user } = {}) => {
    const roomId = normalizeRoomId(rawId);
    if (!ROOM_ID_PATTERN.test(roomId)) {
      if (!silent) showToast("Room codes look like VIBE123.");
      return false;
    }
    if (busyRef.current || !joiningUser) return false;
    busyRef.current = true;
    setJoining(true);
    try {
      const roomData = await api.fetchRoom(roomId);
      if (!roomData) {
        if (!silent) showToast("That room doesn't exist yet.");
        return false;
      }
      if (roomData.closed) {
        if (!silent) showToast("That room has been closed by its host.");
        return false;
      }
      const joinName = (nickname || nicknameFor(joiningUser, "Guest")).slice(0, 30);
      const { savedName } = await api.joinRoom({
        roomId,
        user: joiningUser,
        nickname: joinName,
        avatarId: avatarIdForMember({ avatarId: "" }, joiningUser.uid) || fallbackAvatarId(joiningUser.uid)
      });
      if (savedName) setNickname(savedName);
      setRoom(roomData);
      setActiveRoomId(roomId);
      try { localStorage.setItem(LAST_ACTIVE_ROOM_KEY, roomId); } catch { /* private mode */ }
      window.history.replaceState({}, "", `${window.location.pathname}?room=${roomId}`);
      if (!silent) setCelebrateKey(Date.now());
      return true;
    } catch (error) {
      if (!silent) {
        showToast(error?.code === "permission-denied"
          ? "You don't have access to that room."
          : "Couldn't join the room. Try again.");
      }
      return false;
    } finally {
      busyRef.current = false;
      setJoining(false);
    }
  }, [user, nickname, setNickname, showToast]);

  const create = useCallback(async () => {
    if (!user || user.isAnonymous) {
      showToast("Sign in with Google to host a room.");
      return false;
    }
    if (busyRef.current) return false;
    setCreating(true);
    try {
      const hostName = (nickname || nicknameFor(user, "Host")).slice(0, 30);
      const roomId = await api.createRoom({ user, hostName, deviceId });
      setCreating(false);
      return join(roomId, { joiningUser: user });
    } catch {
      showToast("Couldn't create a room. Try again.");
      setCreating(false);
      return false;
    }
  }, [user, nickname, deviceId, join, showToast]);

  const leave = useCallback(async () => {
    if (activeRoomId && user) await api.leaveRoom(activeRoomId, user.uid);
    setActiveRoomId("");
    setRoom(null);
    setSongs([]);
    setMembers([]);
    setMessages([]);
    setReactions([]);
    setShouts([]);
    setPlayback(null);
    try { localStorage.removeItem(LAST_ACTIVE_ROOM_KEY); } catch { /* private mode */ }
    window.history.replaceState({}, "", window.location.pathname);
  }, [activeRoomId, user]);

  const derived = useMemo(() => {
    const isAdmin = Boolean(user && room?.adminUids?.[user.uid]);
    const isPlayerDevice = isAdmin && room?.activePlayerDeviceId === deviceId && room?.activeDjUid === user?.uid;
    const nowPlayingSong = songs.find((song) => song.id === room?.nowPlayingId) || null;
    const orderedSongs = [...songs].sort((a, b) => (a.position || 0) - (b.position || 0));
    const nowIndex = orderedSongs.findIndex((song) => song.id === room?.nowPlayingId);
    return {
      isAdmin,
      isPlayerDevice,
      nowPlayingSong,
      upcomingSongs: nowIndex >= 0 ? orderedSongs.slice(nowIndex + 1) : orderedSongs,
      playedSongs: nowIndex > 0 ? orderedSongs.slice(0, nowIndex) : []
    };
  }, [user, room, songs, deviceId]);

  return {
    activeRoomId, room, songs, members, messages, reactions, shouts, playback,
    joining, creating, celebrateKey, join, create, leave, ...derived
  };
}
