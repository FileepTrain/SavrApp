# Savr

Savr is a meal planning and grocery budgeting app. It helps you organize weekly meals, build grocery lists, track a pantry, save personal recipes, discover recipes from the web, and compare ingredient prices so you can shop with a clearer budget in mind.

The product is split into a **React Native (Expo)** client and a **Node.js** API server. **This document is written for Android development** (Android Studio, emulator or USB device, and a development build of the app—not Expo Go).

## Tech stack


| Area              | Technologies                                                                                                                                                                                                                                                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Client**        | [Expo](https://expo.dev/) (SDK 54), [React Native](https://reactnative.dev/), [React 19](https://react.dev/), [Expo Router](https://docs.expo.dev/router/introduction/), TypeScript, [NativeWind](https://www.nativewind.dev/) / Tailwind CSS, [Zod](https://zod.dev/)                                                                    |
| **Auth (client)** | [Firebase](https://firebase.google.com/) JavaScript SDK (email/password, password reset), [Google Sign-In](https://github.com/react-native-google-signin/google-signin) bridged to Firebase Auth                                                                                                                                          |
| **Server**        | [Node.js](https://nodejs.org/), [Express 5](https://expressjs.com/), [Firebase Admin](https://firebase.google.com/docs/admin/setup) (Firestore and related backend operations), [Axios](https://axios-http.com/), [Zod](https://zod.dev/), [Multer](https://github.com/expressjs/multer) (uploads), [Resend](https://resend.com/) (email) |
| **Data & infra**  | Firebase (Firestore, Storage; Admin SDK initialized with your Firebase project including its default database URL), deep links and share flows via custom URL scheme (`savr://`)                                                                                                                                                          |


## Prerequisites (Android)

- [Node.js](https://nodejs.org/) (LTS recommended) and npm
- [Android Studio](https://developer.android.com/studio) (includes the Android SDK, platform tools, and emulator)
- **Server:** Firebase service account JSON (see [Run the server](#run-the-server))

## Android Studio and the emulator

### 1. Install Android Studio

1. Download and install [Android Studio](https://developer.android.com/studio).
2. Complete the setup wizard. When prompted, install the **Android SDK**, **Android SDK Platform**, and **Android Virtual Device** components.

### 2. Install SDK packages

1. Open Android Studio.
2. Go to **Settings** (Windows/Linux: **File → Settings**; macOS: **Android Studio → Settings**) → **Languages & Frameworks → Android SDK**.
3. On the **SDK Platforms** tab, enable **Show Package Details** and install at least one **Android API** platform (for example the latest stable API your project targets; Expo SDK 54 typically works with recent API levels—install the platform Expo or the Gradle sync error asks for).
4. On the **SDK Tools** tab, ensure these are installed (check and apply if missing):

- **Android SDK Build-Tools**
- **Android SDK Platform-Tools** (includes `adb`)
- **Android Emulator**

1. Click **Apply** / **OK** and wait for downloads to finish.

### 3. Create a virtual device (AVD)

1. In Android Studio, open **Device Manager** (toolbar phone icon, or **Tools → Device Manager**).
2. Click **Create Device**.
3. Pick a phone definition (for example **Pixel 6**) → **Next**.
4. Pick a **system image** (a row with **Download** if needed—complete the download, then select it). Prefer an **API level** that matches your installed SDK platform → **Next**.
5. Finish the wizard (**Finish**). The new device appears in the Device Manager list.

### 4. Run the emulator

1. In **Device Manager**, click the **Run** (play) button next to your AVD.
2. Wait until the virtual phone has fully booted to the home screen.

Leave the emulator running while you start the API and the Savr app.

## Run the server

From the repository root:

```bash
cd server
npm install
```

1. Add `server/firebaseAdminConfig.json` — a Firebase **service account** key (this path is gitignored). Download it from the Firebase console (Project settings → Service accounts).
2. Create `server/.env` with the variables your deployment needs (see [Environment variables](#environment-variables)).
3. Start the API (default **[http://0.0.0.0:3000](http://0.0.0.0:3000)**):

```bash
npm run dev
```

Use `npm start` for production-style runs without file watching.

## Run the Savr app on Android

Savr uses native modules (for example Google Sign-In), so use a **development build** via `npx expo run:android`.

1. Start the **emulator** (see above) or connect a phone with **USB debugging** enabled.
2. From the repo root:

```bash
cd client
npm install
npx expo run:android
```

`npx expo run:android` runs Gradle, installs the app on the emulator or device, and starts Metro. The first build can take several minutes; later runs are faster.

**API base URL**

- **Emulator:** the client defaults to `http://10.0.2.2:3000`, which is the host machine’s port 3000 from inside the emulator. Keep the server on port 3000 so the app can reach your local API without extra config.

### Other platforms (brief)

- **iOS:** on macOS with Xcode: `npm run ios` from `client/` (same development-build idea).
- **Web:** `npm run web` from `client/` (browser; not a substitute for testing Android native modules).

## Environment variables

Configure these in `server/.env` (never commit real secrets):


| Variable                                                      | Purpose                                                                                                                                                     |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FIREBASE_API_KEY`                                            | Used by the server when calling Firebase **Identity Toolkit**–style REST endpoints (for example account flows that need the Web API key).                   |
| `SPOONACULAR_API_KEY`                                         | [Spoonacular](https://spoonacular.com/food-api) recipe search, details, and related features.                                                               |
| `KROGER_CLIENT_ID`, `KROGER_CLIENT_SECRET`, `KROGER_API_BASE` | [Kroger](https://developer.kroger.com/) OAuth and API base URL for product/price lookups tied to grocery flows.                                             |
| `RESEND_API_KEY`                                              | [Resend](https://resend.com/) for transactional email from the auth and notification flows.                                                                 |
| `WEB_APP_PUBLIC_URL`                                          | Optional. Public URL of the hosted **web** app so server share routes can redirect desktop browsers to the SPA instead of only deep-linking the native app. |
| `NODE_ENV`                                                    | Set to `production` to tighten CORS for browser origins, otherwise set to `development`.                                                                    |


## APIs and external services


| Service         | Role in Savr                                                                                                                |
| --------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Firebase**    | End-user authentication, Firestore for user and app data, Storage for images/uploads, and Admin SDK access from the server. |
| **Google**      | Sign-in with Google on Android (and other clients) using OAuth credentials wired to the same Firebase project.              |
| **Spoonacular** | External recipe discovery, nutrition metadata, and meal-plan filtering backed by Spoonacular’s REST API.                    |
| **Kroger**      | Product catalog and pricing aligned with grocery list and comparison features.                                              |
| **Resend**      | Outbound email (for example verification or password-related messages sent from the server).                                |


