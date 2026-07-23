import type { IRtcEngine } from 'react-native-agora';
import { LighteningContrastLevel } from 'react-native-agora';

export type BeautyPreset = {
  smooth?: number;
  whiten?: number;
  slim?: number;
  bigEye?: number;
  filterId?: string;
};

/** Map 0–100 preset to Agora BeautyOptions (0–1) and enable effect. */
export function applyBeautyToEngine(
  engine: IRtcEngine | undefined,
  preset?: BeautyPreset | null,
  enabled = true,
) {
  if (!engine) return;
  try {
    const smooth = Math.min(1, Math.max(0, (preset?.smooth ?? 40) / 100));
    const whiten = Math.min(1, Math.max(0, (preset?.whiten ?? 20) / 100));
    const sharpness = Math.min(1, Math.max(0, (preset?.slim ?? 10) / 100));
    const redness = Math.min(1, Math.max(0, (preset?.bigEye ?? 0) / 100));
    engine.setBeautyEffectOptions(enabled, {
      lighteningContrastLevel: LighteningContrastLevel.LighteningContrastNormal,
      lighteningLevel: whiten,
      smoothnessLevel: smooth,
      rednessLevel: redness * 0.5,
      sharpnessLevel: sharpness * 0.4,
    });
  } catch {
    /* beauty may be unavailable on some devices / free tiers */
  }
}

/** Lightweight AR sticker overlay ids (UI layer). */
export const AR_STICKERS = [
  { id: 'none', label: 'None', emoji: '○' },
  { id: 'cat_ears', label: 'Cat ears', emoji: '🐱' },
  { id: 'crown', label: 'Crown', emoji: '👑' },
  { id: 'glasses', label: 'Glasses', emoji: '🕶' },
  { id: 'hearts', label: 'Hearts', emoji: '💕' },
  { id: 'fire', label: 'Fire', emoji: '🔥' },
] as const;
