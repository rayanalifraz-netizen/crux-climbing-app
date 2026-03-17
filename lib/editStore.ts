// One-shot store for passing an edit date from calendar to session/checkin.
// Calendar sets the date before navigating; the screen reads and clears it in useFocusEffect.
// This avoids stale URL params persisting across tab switches.
export const editStore: { sessionDate: string | null; checkinDate: string | null } = {
  sessionDate: null,
  checkinDate: null,
};
