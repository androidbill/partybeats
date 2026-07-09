import React, { useEffect, useMemo, useState } from "react";
import { LAST_ACTIVE_ROOM_KEY } from "./constants";
import { rememberedRoomId } from "./api";
import { useAuth, useNow, useRoomSession, useToast } from "./hooks";
import {
  normalizeRoomId, savedDeviceId, savedMotionOverride, saveMotionOverride,
  savedTheme, saveTheme
} from "./utils";
import Lobby from "./components/Lobby";
import Room from "./components/Room";
import { ThemePicker } from "./components/Panels";
import { Confetti, Toast } from "./components/ui";

export default function App() {
  const deviceId = useMemo(savedDeviceId, []);
  const now = useNow();
  const [toast, showToast] = useToast();
  const [theme, setTheme] = useState(savedTheme);
  const [motionOverride, setMotionOverride] = useState(savedMotionOverride);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [rememberedRoom, setRememberedRoom] = useState("");
  const auth = useAuth(showToast);
  const session = useRoomSession({
    user: auth.user,
    nickname: auth.nickname,
    setNickname: auth.setNickname,
    deviceId,
    showToast
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  /* Deep link: ?room=VIBE123 auto-joins once signed in; otherwise pre-fill memory. */
  useEffect(() => {
    if (auth.loading) return;
    const urlRoom = normalizeRoomId(new URLSearchParams(window.location.search).get("room") || "");
    if (urlRoom && auth.user && !session.activeRoomId) {
      session.join(urlRoom, { silent: false });
      return;
    }
    let localRoom = "";
    try { localRoom = localStorage.getItem(LAST_ACTIVE_ROOM_KEY) || ""; } catch { /* private mode */ }
    if (localRoom) {
      setRememberedRoom(localRoom);
    } else if (auth.user) {
      rememberedRoomId(auth.user.uid).then((remoteRoom) => setRememberedRoom(remoteRoom || ""));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.loading, auth.user]);

  if (auth.loading) {
    return (
      <main className="boot">
        <span className="boot-pulse" aria-hidden="true" />
        <p>Warming up the speakers…</p>
      </main>
    );
  }

  return (
    <>
      {session.activeRoomId && session.room ? (
        <Room
          auth={auth}
          session={session}
          deviceId={deviceId}
          now={now}
          showToast={showToast}
          onOpenThemes={() => setThemePickerOpen(true)}
          motionOverride={motionOverride}
        />
      ) : (
        <Lobby
          auth={auth}
          session={session}
          rememberedRoom={rememberedRoom}
          onOpenThemes={() => setThemePickerOpen(true)}
        />
      )}

      {themePickerOpen && (
        <ThemePicker
          currentTheme={theme}
          onPick={(id) => { setTheme(id); saveTheme(id); setThemePickerOpen(false); }}
          onClose={() => setThemePickerOpen(false)}
          motion={session.activeRoomId ? {
            value: motionOverride,
            onChange: (value) => { setMotionOverride(value); saveMotionOverride(value); }
          } : null}
        />
      )}

      <Confetti burstKey={session.celebrateKey} />
      <Toast message={toast} />
    </>
  );
}
