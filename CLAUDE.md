# Crux — Climbing Recovery App

React Native / Expo app (file-based routing via expo-router). Bouldering recovery tracker.

## Stack
- **Expo SDK** with expo-router (tab-based navigation)
- **expo-secure-store** for all persistence (chunked, 2KB limit per key)
- **No Redux / Context for data** — local component state + `useFocusEffect` to reload on tab focus
- **ThemeContext** (`context/ThemeContext.tsx`) for light/dark mode — use `useTheme()` to get `{ C, isDark, toggleDark }`

## Project structure
```
app/(tabs)/       — screen files (index=Profile, session, checkin, heatmap, calendar, settings)
app/_layout.tsx   — root layout, wraps with AppThemeProvider, custom in-app splash screen
context/          — ThemeContext (LIGHT/DARK palettes)
storage.ts        — all SecureStore read/write helpers + scoring logic
assets/images/    — splash-icon.png, icon.png (chalk handprint)
```

## Styling rules
- Every screen uses `makeStyles(C)` called inside `useMemo(() => makeStyles(C), [C])` — never hardcode colors
- `LIGHT` and `DARK` palettes are defined in `ThemeContext.tsx` — always use `C.ink`, `C.terra`, `C.sand` etc.
- `WindowBox` component is defined locally in each screen (not shared) — retro bordered card with floating label
- `borderRadius: 4` everywhere — no pill shapes
- Typography: eyebrow labels are `fontSize: 9, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase'`

## Data / storage patterns
- Sessions stored under date key (`YYYY-MM-DD`) in `sessions` SecureStore key (chunked)
- Check-ins stored similarly under `checkIns` key
- User profile under `profile` key — includes `maxGrade`, `projectGrade`, `name`, `sendsToUnlock`
- Alert settings under `alertSettings` key — `{ weeklyLoad, injuryOverload, bodyHighLoad }` (all boolean)
- Dark mode preference under `darkMode` key

## Key scores
- **RES** (Relative Effort Score) — 0–100, computed from grade attempts relative to user's max grade + hold type multipliers
- **DRS** (Daily Readiness Score) — 0–100, computed from soreness + pain areas + recent session load

## Haptics
- Use `Haptics.selectionAsync()` for chip/toggle/button taps
- Use `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)` on save actions

## Conventions
- Save to GitHub after completing each task (`git add`, `git commit`, `git push origin main`)
- Sticky save buttons sit outside ScrollView in a `stickyFooter` view with `borderTopWidth: 1, borderTopColor: C.borderLight`
- Finger IDs are stored as `L_index`, `R_ring` etc. (side prefix + finger name)
- Grade scale: `['VB', 'V0', 'V1', ... 'V12']`
