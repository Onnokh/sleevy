// The beat grid of the track the video was cut to (the track itself is no
// longer in the project): 110 BPM, first
// downbeat at frame ~12.19 (30 fps). BEAT_ENERGY is the track's normalized
// RMS per beat across the video's span — the groove accents every 8th beat.
export const BPM = 110;
export const BEAT = 1800 / BPM; // 16.36 frames per beat
export const BEAT_OFFSET = 12.19;

const BEAT_ENERGY = [
  0.7, 0.71, 0.71, 0.57, 0.73, 0.7, 0.61, 0.72, 0.88, 0.56, 0.76, 0.59,
  0.73, 0.7, 0.71, 0.99, 0.9, 0.71, 0.76, 0.58, 0.76, 0.72, 0.68, 0.7,
  0.91, 0.53, 0.8, 0.57, 0.76, 0.71, 0.67, 0.91, 1.0, 0.69, 0.75, 0.59,
  0.79, 0.7, 0.66, 0.74, 0.93, 0.56, 0.77, 0.58, 0.77, 0.73, 0.77,
];

// A zoom pump on every beat whose strength follows the song: quiet bars
// barely move, the phrase accents hit visibly. Fast attack, ~9-frame decay.
export const beatPump = (frame: number): number => {
  const k = Math.floor((frame - BEAT_OFFSET) / BEAT);
  if (k < 0 || k >= BEAT_ENERGY.length) {
    return 1;
  }
  const sinceBeat = frame - (BEAT_OFFSET + k * BEAT);
  const envelope =
    sinceBeat < 1.5 ? sinceBeat / 1.5 : Math.max(0, 1 - (sinceBeat - 1.5) / 9);
  // Square the energy so the dynamic range of the track reads in the motion.
  return 1 + BEAT_ENERGY[k] ** 2 * envelope * 0.016;
};
