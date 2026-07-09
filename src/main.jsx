import React from "react";
import { createRoot } from "react-dom/client";
import { firebaseReady } from "./services/firebase";
import { APP_ICON_URL } from "./constants";
import App from "./App";
import "./styles.css";

function SetupMissing() {
  return (
    <main className="boot">
      <img className="boot-icon" src={APP_ICON_URL} alt="" />
      <h1>PartyBeats needs its Firebase config</h1>
      <p>Copy <code>.env.example</code> to <code>.env.local</code> and fill in the values from your Firebase web app, then restart the dev server.</p>
    </main>
  );
}

createRoot(document.getElementById("root")).render(
  firebaseReady ? <App /> : <SetupMissing />
);
