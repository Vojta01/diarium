export interface CheckInData {
  mood: number;
  moodEmoji: string;
  sleepQuality: number; // 1-5 (1 = špatný, 5 = výborný)
  stress: number;       // 1-5 (1 = klid, 5 = extrémní stres)
  activities: string[];
  habits: Record<string, boolean>;
  gratitude: string[];
  note: string;
  photoDataUrl: string | null;
}
