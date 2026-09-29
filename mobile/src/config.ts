const configured = process.env.EXPO_PUBLIC_API_BASE_URL;

// localhost only reaches the backend from a simulator on the same computer.
// On a physical phone it points at the phone itself, so a missing setting
// must be loud rather than silently unreachable.
if (!configured) {
  if (!__DEV__) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL is not set for this build.");
  }
  console.warn(
    "EXPO_PUBLIC_API_BASE_URL is not set; using http://localhost:8000, which only works " +
      "in a simulator. On a phone, set it in mobile/.env to your computer's LAN address.",
  );
}

export const API_BASE_URL = configured ?? "http://localhost:8000";

export const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? null;
