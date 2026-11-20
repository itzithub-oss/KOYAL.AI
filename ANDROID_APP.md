# KOYAL AI Android app

The Android app is being prepared with Capacitor and connects to the existing production KOYAL AI website so its server-backed features (chat, AI modes, document processing, FIND UP, and Daily AI Hub) remain available without changing the website deployment.

## App identity

- Display name: KOYAL AI
- Android application ID: `com.koyalai.india`
- Production web origin: `https://koyal-ai-india.vercel.app`
- Website remains independently available in browsers.

## Create the native Android project

Requirements: Node.js 22+, Android Studio 2025.2.1 or newer, and an Android SDK (API 26+). See the [Capacitor Android setup guide](https://capacitorjs.com/docs/getting-started/environment-setup).

From the repository root, run:

```bash
npm install @capacitor/core@8.6.2 @capacitor/android@8.6.2 @capacitor/cli@8.6.2
npx cap add android
npx cap sync android
npx cap open android
```

Commit the updated `package.json`, `package-lock.json`, and generated `android/` directory after reviewing them. The `www/index.html` file is an offline/fallback shell; the production app loads the live KOYAL site configured in `capacitor.config.json`.

## Important release checks

Before a Google Play release, test sign-in/session persistence, file uploads, microphone permissions, keyboard resizing, external links, back navigation, offline/error states, and every dashboard feature on physical Android devices. Configure a privacy policy and complete the Play Console Data safety and app-content declarations. Use a protected upload key and build a signed Android App Bundle (`.aab`). Never put Gemini or Supabase secret/service-role keys in the Android app.

This is a hybrid Android shell, not a completed Play Store release. Google Play review may require meaningful mobile functionality beyond simply displaying a website; native integrations and a full device test are required before submission.
