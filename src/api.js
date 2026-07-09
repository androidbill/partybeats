// All Firestore access lives here. Components never import firebase/firestore directly.
// Collection layout is identical to v1:
//   rooms/{roomId}
//   rooms/{roomId}/songs|members|messages|reactions|shouts
//   rooms/{roomId}/playback/state
//   users/{uid}

import {
  GoogleAuthProvider, onAuthStateChanged, signInAnonymously,
  signInWithPopup, signOut, updateProfile
} from "firebase/auth";
import {
  collection, deleteDoc, deleteField, doc, getDoc, limitToLast,
  onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, writeBatch
} from "firebase/firestore";
import { auth, db } from "./services/firebase";
import { APP_VERSION, ROOM_DEFAULTS } from "./constants";
import { randomRoomId } from "./utils";

const roomRef = (roomId) => doc(db, "rooms", roomId);
const songRef = (roomId, songId) => doc(db, "rooms", roomId, "songs", songId);
const memberRef = (roomId, uid) => doc(db, "rooms", roomId, "members", uid);
const playbackRef = (roomId) => doc(db, "rooms", roomId, "playback", "state");

function activityUpdate() {
  return { lastActivityAt: serverTimestamp() };
}

/* ---------- auth ---------- */

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function signInWithGoogle() {
  const credential = await signInWithPopup(auth, new GoogleAuthProvider());
  return credential.user;
}

export async function signInAsGuest(displayName) {
  const credential = await signInAnonymously(auth);
  if (displayName) await updateProfile(credential.user, { displayName });
  return credential.user;
}

export function signOutUser() {
  return signOut(auth);
}

/* ---------- room lifecycle ---------- */

export async function createRoom({ user, hostName, deviceId }) {
  let lastError = null;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = randomRoomId();
    try {
      await setDoc(roomRef(candidate), {
        roomId: candidate,
        adminUid: user.uid,
        adminUids: { [user.uid]: true },
        adminName: hostName,
        activeDjUid: user.uid,
        activeDjName: hostName,
        activePlayerDeviceId: deviceId,
        appVersion: APP_VERSION,
        latestAppVersion: APP_VERSION,
        latestAppVersionUpdatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        ...activityUpdate(),
        ...ROOM_DEFAULTS
      });
      return candidate;
    } catch (error) {
      lastError = error;
      if (error?.code !== "permission-denied") throw error;
    }
  }
  throw lastError || new Error("Could not find a free room code.");
}

export async function fetchRoom(roomId) {
  const snap = await getDoc(roomRef(roomId));
  return snap.exists() ? { id: roomId, ...snap.data() } : null;
}

export async function joinRoom({ roomId, user, nickname, avatarId }) {
  const existing = await getDoc(memberRef(roomId, user.uid)).catch(() => null);
  const isNew = !existing?.exists();
  await setDoc(memberRef(roomId, user.uid), {
    uid: user.uid,
    isAnonymous: user.isAnonymous,
    ...(isNew ? { avatarId, name: nickname, joinedAt: serverTimestamp() } : {})
  }, { merge: true });
  await setDoc(doc(db, "users", user.uid), {
    lastRoomId: roomId,
    lastRoomAt: serverTimestamp()
  }, { merge: true }).catch(() => undefined);
  await updateDoc(roomRef(roomId), {
    latestAppVersion: APP_VERSION,
    latestAppVersionUpdatedAt: serverTimestamp(),
    ...activityUpdate()
  }).catch(() => undefined);
  const savedName = existing?.exists() ? (existing.data().name || "").trim() : "";
  return { savedName };
}

export async function rememberedRoomId(uid) {
  const snap = await getDoc(doc(db, "users", uid)).catch(() => null);
  return snap?.exists() ? snap.data().lastRoomId || "" : "";
}

export async function leaveRoom(roomId, uid) {
  await deleteDoc(memberRef(roomId, uid)).catch(() => undefined);
}

export async function closeRoom(roomId) {
  await updateDoc(roomRef(roomId), { closed: true, ...activityUpdate() });
}

export function updateRoomSettings(roomId, settings) {
  return updateDoc(roomRef(roomId), { ...settings, ...activityUpdate() });
}

/* ---------- live listeners ---------- */

export function watchRoom(roomId, callbacks) {
  const unsubs = [
    onSnapshot(roomRef(roomId), (snap) =>
      callbacks.onRoom(snap.exists() ? { id: roomId, ...snap.data() } : null)),
    onSnapshot(query(collection(db, "rooms", roomId, "songs"), orderBy("position", "asc")), (snap) =>
      callbacks.onSongs(snap.docs.map((d) => ({ id: d.id, ...d.data() })))),
    onSnapshot(query(collection(db, "rooms", roomId, "members"), orderBy("joinedAt", "asc")), (snap) =>
      callbacks.onMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() })))),
    onSnapshot(query(collection(db, "rooms", roomId, "messages"), orderBy("createdAt", "asc"), limitToLast(100)), (snap) =>
      callbacks.onMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })))),
    onSnapshot(query(collection(db, "rooms", roomId, "reactions"), orderBy("createdAt", "asc"), limitToLast(50)), (snap) =>
      callbacks.onReactions(snap.docs.map((d) => ({ id: d.id, ...d.data() })))),
    onSnapshot(query(collection(db, "rooms", roomId, "shouts"), orderBy("createdAt", "asc"), limitToLast(50)), (snap) =>
      callbacks.onShouts(snap.docs.map((d) => ({ id: d.id, ...d.data() })))),
    onSnapshot(playbackRef(roomId), (snap) =>
      callbacks.onPlayback(snap.exists() ? snap.data() : null))
  ];
  return () => unsubs.forEach((unsub) => unsub());
}

/* ---------- queue ---------- */

export async function addSong({ roomId, user, nickname, track, position, makeNowPlaying, startPlayback }) {
  const newSongRef = doc(collection(db, "rooms", roomId, "songs"));
  const batch = writeBatch(db);
  batch.set(newSongRef, {
    title: track.title,
    artist: track.channelTitle,
    link: `https://www.youtube.com/watch?v=${track.videoId}`,
    provider: "youtube",
    videoId: track.videoId,
    thumbnail: track.thumbnail,
    durationSeconds: track.durationSeconds || null,
    addedByUid: user.uid,
    addedByName: nickname,
    addedByIsAnonymous: user.isAnonymous,
    position,
    emojiByUser: {},
    createdAt: serverTimestamp()
  });
  if (makeNowPlaying) {
    batch.update(roomRef(roomId), { nowPlayingId: newSongRef.id });
    if (startPlayback) {
      batch.set(playbackRef(roomId), {
        playbackSongId: newSongRef.id,
        playbackSeconds: 0,
        playbackState: "playing",
        playbackUpdatedAt: serverTimestamp(),
        playbackUpdatedBy: user.uid
      }, { merge: true });
    }
  }
  batch.set(memberRef(roomId, user.uid), { lastAddedAt: serverTimestamp() }, { merge: true });
  batch.update(roomRef(roomId), activityUpdate());
  await batch.commit();
  return newSongRef.id;
}

export async function removeSong(roomId, songId) {
  const batch = writeBatch(db);
  batch.delete(songRef(roomId, songId));
  batch.update(roomRef(roomId), activityUpdate());
  await batch.commit();
}

export async function clearQueue(roomId, songs, uid) {
  const batch = writeBatch(db);
  songs.forEach((song) => batch.delete(songRef(roomId, song.id)));
  batch.update(roomRef(roomId), { nowPlayingId: null, ...activityUpdate() });
  batch.set(playbackRef(roomId), {
    playbackSongId: null,
    playbackSeconds: 0,
    playbackState: "stopped",
    playbackUpdatedAt: serverTimestamp(),
    playbackUpdatedBy: uid
  }, { merge: true });
  await batch.commit();
}

export async function swapSongPositions(roomId, songA, songB) {
  const batch = writeBatch(db);
  batch.update(songRef(roomId, songA.id), { position: songB.position });
  batch.update(songRef(roomId, songB.id), { position: songA.position });
  batch.update(roomRef(roomId), activityUpdate());
  await batch.commit();
}

export function markSongUnavailable(roomId, songId, reason) {
  return updateDoc(songRef(roomId, songId), {
    unavailable: true,
    unavailableReason: reason,
    unavailableAt: serverTimestamp()
  });
}

export function toggleSongEmoji(roomId, songId, uid, emoji) {
  return updateDoc(songRef(roomId, songId), {
    [`emojiByUser.${uid}`]: emoji || deleteField()
  });
}

/* ---------- playback ---------- */

export function writePlayback(roomId, uid, fields) {
  return setDoc(playbackRef(roomId), {
    ...fields,
    playbackUpdatedAt: serverTimestamp(),
    playbackUpdatedBy: uid
  }, { merge: true });
}

export function sendPlaybackCommand(roomId, uid, deviceId, command, extra = {}) {
  return writePlayback(roomId, uid, {
    ...extra,
    playbackCommand: command,
    playbackCommandId: `${deviceId}-${Date.now()}`,
    playbackCommandAt: serverTimestamp()
  });
}

export async function setNowPlaying(roomId, uid, songId, playbackFields) {
  await Promise.all([
    updateDoc(roomRef(roomId), { nowPlayingId: songId, ...activityUpdate() }),
    writePlayback(roomId, uid, playbackFields)
  ]);
}

export function takeOverPlayer(roomId, uid, name, deviceId) {
  return updateDoc(roomRef(roomId), {
    activeDjUid: uid,
    activeDjName: name,
    activePlayerDeviceId: deviceId,
    activeDjAt: serverTimestamp(),
    ...activityUpdate()
  });
}

/* ---------- members ---------- */

export function promoteMember(roomId, selfUid, memberId) {
  return updateDoc(roomRef(roomId), {
    [`adminUids.${selfUid}`]: true,
    [`adminUids.${memberId}`]: true,
    ...activityUpdate()
  });
}

export function demoteMember(roomId, selfUid, selfName, memberId, wasPrimaryAdmin) {
  const update = {
    [`adminUids.${selfUid}`]: true,
    [`adminUids.${memberId}`]: deleteField(),
    ...activityUpdate()
  };
  if (wasPrimaryAdmin) {
    update.adminUid = selfUid;
    update.adminName = selfName;
  }
  return updateDoc(roomRef(roomId), update);
}

export async function removeMember(roomId, member, self, deviceId, room) {
  const batch = writeBatch(db);
  const update = {};
  if (room.adminUids?.[member.id]) {
    update[`adminUids.${self.uid}`] = true;
    update[`adminUids.${member.id}`] = deleteField();
    if (room.adminUid === member.id) {
      update.adminUid = self.uid;
      update.adminName = self.name;
    }
  }
  if (room.activeDjUid === member.id) {
    update.activeDjUid = self.uid;
    update.activeDjName = self.name;
    update.activePlayerDeviceId = deviceId;
  }
  batch.update(roomRef(roomId), { ...update, ...activityUpdate() });
  batch.delete(memberRef(roomId, member.id));
  await batch.commit();
}

export async function updateMemberProfile(roomId, memberId, fields, roomFields) {
  const batch = writeBatch(db);
  batch.update(memberRef(roomId, memberId), fields);
  if (roomFields && Object.keys(roomFields).length) {
    batch.update(roomRef(roomId), { ...roomFields, ...activityUpdate() });
  }
  await batch.commit();
}

/* ---------- party layer ---------- */

export function sendReaction(roomId, uid, name, emoji) {
  return setDoc(doc(collection(db, "rooms", roomId, "reactions")), {
    uid, name, emoji, createdAt: serverTimestamp()
  });
}

export function sendShout(roomId, uid, name, avatarId, text) {
  return setDoc(doc(collection(db, "rooms", roomId, "shouts")), {
    uid, name, avatarId, text, createdAt: serverTimestamp()
  });
}

export function sendSongMessage(roomId, uid, name, avatarId, songId, text) {
  return setDoc(doc(collection(db, "rooms", roomId, "messages")), {
    uid, name, avatarId, songId, text, createdAt: serverTimestamp()
  });
}
