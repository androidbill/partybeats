# ROCK BeatsParty

ROCK BeatsParty is a Firebase-backed PWA for party music rooms. Google-authenticated users can create or join rooms. Anonymous nickname users can join rooms only. Room admins control the YouTube player and queue; non-admins can add YouTube songs every 3 minutes; everyone can react to queued songs with emojis.

## Run Locally

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in your Firebase web app values.

3. Start the app:

   ```powershell
   npm run dev
   ```

## Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/) and create a project named `ROCK BeatsParty`.
2. Add a Web app from Project settings, then copy its Firebase config into `.env.local`.
3. Open Authentication, click Get started, and enable these providers:
   - Google
   - Anonymous
4. In Authentication settings, add your local and deployed domains to Authorized domains:
   - `localhost`
   - your production domain later
5. Open Firestore Database, create a database, and start it in production mode.
6. Replace your Firestore rules with the contents of `firestore.rules`, then publish.
7. Optional for hosting: enable Firebase Hosting and deploy the `dist` folder after running `npm run build`.

## Environment Variables

```text
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_YOUTUBE_API_KEY=optional_youtube_data_api_key
```

## YouTube Setup

You can paste YouTube URLs without any extra setup. To search YouTube inside ROCK BeatsParty:

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Select the same project or create one for ROCK BeatsParty.
3. Enable **YouTube Data API v3**.
4. Create an API key in **APIs & Services > Credentials**.
5. Add it to `.env.local`:

   ```env
   VITE_YOUTUBE_API_KEY=your_youtube_data_api_key
   ```

6. Restart the dev server.

## Room Behavior

- Room IDs are generated as a four-letter word plus three numbers, such as `VIBE123`.
- The room creator becomes admin.
- Admins can add, remove, reorder, and play YouTube songs.
- Non-admins can add songs, then must wait 3 minutes before adding another.
- Any room member can add or change their emoji reaction on any song.
