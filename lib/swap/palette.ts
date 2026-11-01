// "Colors that love you": SwapNight's own palette logic, built on the raw
// facial color tones returned by YouCam's AI Facial Color Tones Analyzer.
// YouCam returns hex values only; undertone, depth, contrast, season and
// garment scoring below are ours. Pure functions, no I/O.

export type ToneReading = { skin: string; lip?: string; eyebrow?: string; hair?: string; eye?: string; eyeName?: string; hairName?: string };
export type Undertone = 'warm' | 'neutral' | 'cool';
export type Season = 'Spring' | 'Summer' | 'Autumn' | 'Winter';
export type ColorProfile = { undertone: Undertone; depth: 'light' | 'medium' | 'deep'; contrast: 'soft' | 'medium' | 'high'; season: Season; palette: string[]; tones: ToneReading; source: 'youcam' | 'sample' };
export type ColorMatch = { tier: 'loves' | 'works' | 'stretch'; score: number; nearest: string; label: string };

const HEX = /^#?([0-9a-f]{6})$/i;
export function validHex(value: unknown): value is string { return typeof value === 'string' && HEX.test(value); }
export function normalHex(value: string) { const m = HEX.exec(value); if (!m) throw new Error('Invalid color: ' + value); return '#' + m[1].toLowerCase(); }

// sRGB hex → OKLab (Björn Ottosson, 2020).
export function oklab(hex: string): [number, number, number] {
  const n = parseInt(normalHex(hex).slice(1), 16);
  const lin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const r = lin((n >> 16) & 255), g = lin((n >> 8) & 255), b = lin(n & 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
export function oklch(hex: string) { const [L, a, b] = oklab(hex); const h = (Math.atan2(b, a) * 180) / Math.PI; return { L, C: Math.hypot(a, b), h: h < 0 ? h + 360 : h }; }
// Perceptual distance with hue/chroma weighted ×2: for clothing next to a face,
// warm-vs-cool cast matters more than a small lightness shift.
export function distance(x: string, y: string) { const p = oklab(x), q = oklab(y); return Math.hypot(p[0] - q[0], 2 * (p[1] - q[1]), 2 * (p[2] - q[2])); }

// Hand-curated seasonal palettes (classic 4-season color analysis).
export const PALETTES: Record<Season, string[]> = {
  Spring: ['#f6efdc', '#f3e6c4', '#c9a26b', '#f4b393', '#f2795c', '#e5483a', '#f3c74f', '#7cbf5a', '#3bb3a8', '#66c7c0', '#3b6fb6', '#a5743a'],
  Summer: ['#f2f2ee', '#a9c3df', '#7d9ac0', '#6f8fb0', '#4a5a74', '#b6a6d3', '#d892a8', '#a8798f', '#b3446c', '#6aa3a3', '#7a8796', '#8a6f6a'],
  Autumn: ['#efe6d4', '#a89a6a', '#5b6236', '#6b7a3a', '#2f5233', '#2f6b6b', '#b98a50', '#c99a2e', '#c46a46', '#b5532f', '#9e3b2b', '#5a3a26'],
  Winter: ['#ffffff', '#111111', '#36393f', '#b8bcc4', '#1f2a5a', '#2850b4', '#d6e6f5', '#0f8a5f', '#c8102e', '#c81e78', '#f3d7e3', '#5b2a86'],
};
const UNDERTONE_SEASONS: Record<Undertone, Season[]> = { warm: ['Spring', 'Autumn'], cool: ['Summer', 'Winter'], neutral: ['Summer', 'Autumn'] };

const WARM_HAIR = ['Auburn', 'Red', 'Blonde'], COOL_HAIR = ['Black', 'Grey', 'White', 'Grey/White'];
const WARM_EYES = ['Amber', 'Green'], COOL_EYES = ['Blue', 'Gray'];

// Positive = warm, negative = cool. Skin hue carries most of the weight:
// golden/olive skin sits at a higher OKLCH hue than pink/rosy skin.
export function warmth(t: ToneReading) {
  const skin = oklch(t.skin);
  let score = (skin.h - 58) / 8;
  if (t.hairName) score += WARM_HAIR.includes(t.hairName) ? 0.5 : COOL_HAIR.includes(t.hairName) ? -0.5 : 0;
  if (t.eyeName) score += WARM_EYES.includes(t.eyeName) ? 0.35 : COOL_EYES.includes(t.eyeName) ? -0.35 : 0;
  return Math.round(score * 100) / 100;
}

export function analyze(input: ToneReading, source: ColorProfile['source'] = 'youcam'): ColorProfile {
  const tones: ToneReading = { ...input, skin: normalHex(input.skin) };
  for (const key of ['lip', 'eyebrow', 'hair', 'eye'] as const) { const v = input[key]; if (v !== undefined) { if (validHex(v)) tones[key] = normalHex(v); else delete tones[key]; } }
  const w = warmth(tones);
  const undertone: Undertone = w >= 0.6 ? 'warm' : w <= -0.6 ? 'cool' : 'neutral';
  const skinL = oklab(tones.skin)[0];
  const depth = skinL >= 0.8 ? 'light' : skinL >= 0.62 ? 'medium' : 'deep';
  const frame = tones.hair || tones.eyebrow;
  const gap = frame ? Math.abs(skinL - oklab(frame)[0]) : 0.3;
  const contrast = gap >= 0.38 ? 'high' : gap >= 0.22 ? 'medium' : 'soft';
  let season: Season;
  if (undertone === 'warm') season = depth === 'deep' || contrast === 'soft' ? 'Autumn' : 'Spring';
  else if (undertone === 'cool') season = depth === 'deep' || contrast === 'high' ? 'Winter' : 'Summer';
  else season = contrast === 'high' ? 'Winter' : depth === 'light' ? 'Summer' : w >= 0 ? 'Autumn' : 'Summer';
  return { undertone, depth, contrast, season, palette: PALETTES[season], tones, source };
}

// How well a garment color sits next to this person's face. Sister seasons
// (same undertone) count a little, so near-misses aren't punished.
export function matchColor(garment: string, profile: Pick<ColorProfile, 'season' | 'undertone'>): ColorMatch {
  const near = (season: Season) => PALETTES[season].map(c => ({ c, d: distance(garment, c) })).sort((a, b) => a.d - b.d)[0];
  const own = near(profile.season);
  const sister = UNDERTONE_SEASONS[profile.undertone].filter(s => s !== profile.season).map(near)[0];
  const best = sister && sister.d + 0.06 < own.d ? { c: sister.c, d: sister.d + 0.06 } : own;
  const d = best.d;
  const score = Math.max(0, Math.min(1, 1 - d / 0.2));
  const tier = d <= 0.05 ? 'loves' : d <= 0.1 ? 'works' : 'stretch';
  const label = tier === 'loves' ? (profile.undertone === 'neutral' ? 'Flatters your coloring' : `Flatters your ${profile.undertone} undertone`) : tier === 'works' ? `Works with your ${profile.season} palette` : 'A bold pick for your palette';
  return { tier, score: Math.round(score * 100) / 100, nearest: best.c, label };
}

// Average garment color from RGBA pixels. Ignores pixels that look like the
// backdrop (close to the image corners) and samples the central body area.
export function dominantColor(rgba: ArrayLike<number>, width: number, height: number): string {
  const px = (x: number, y: number) => { const i = (y * width + x) * 4; return [rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]]; };
  const toHex = (r: number, g: number, b: number) => '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  const corners = [px(0, 0), px(width - 1, 0), px(0, height - 1), px(width - 1, height - 1)].filter(c => c[3] > 200).map(c => toHex(c[0], c[1], c[2]));
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = Math.floor(height * 0.25); y < Math.ceil(height * 0.8); y++) for (let x = Math.floor(width * 0.3); x < Math.ceil(width * 0.7); x++) {
    const [pr, pg, pb, pa] = px(x, y); if (pa < 200) continue;
    const hex = toHex(pr, pg, pb); if (corners.some(c => distance(c, hex) < 0.06)) continue;
    r += pr; g += pg; b += pb; n++;
  }
  if (!n) { const [pr, pg, pb] = px(Math.floor(width / 2), Math.floor(height / 2)); return toHex(pr, pg, pb); }
  return toHex(r / n, g / n, b / n);
}

const RETAKE: Record<string, string> = {
  error_no_face: 'We could not find a face. Try a close-up selfie, facing the camera.',
  error_below_min_image_size: 'That photo is too small. Use one at least 320 pixels on each side.',
  error_face_position_too_small: 'Get closer: your face should fill most of the frame, like a passport photo.',
  error_face_position_invalid: 'Center your face in the frame and keep it fully visible.',
  error_face_position_out_of_boundary: 'Part of your face is cut off. Step back slightly and center it.',
  error_face_not_forward_facing: 'Look straight into the camera.',
  error_face_angle_upward: 'Tilt your head down slightly.', error_face_angle_downward: 'Tilt your head up slightly.',
  error_face_angle_leftward: 'Turn your head slightly to the right.', error_face_angle_rightward: 'Turn your head slightly to the left.',
  error_face_angle_left_tilt: 'Straighten your head a little to the right.', error_face_angle_right_tilt: 'Straighten your head a little to the left.',
};
export function retakeMessage(code: unknown) { return (typeof code === 'string' && RETAKE[code]) || 'We could not read your tones from that photo. Try a well-lit, front-facing close-up selfie.'; }

// Fictional demo personas. Sample tones only: no YouCam call, no real faces.
export const SAMPLE_TONES: Record<string, ToneReading> = {
  maya: { skin: '#d9a77c', hair: '#5a3a22', eyebrow: '#4a3020', lip: '#c0675a', eyeName: 'Amber', hairName: 'Brown' },
  sara: { skin: '#b07a45', hair: '#6b4a2e', eyebrow: '#6b4a2e', lip: '#9a5144', eyeName: 'Brown', hairName: 'Brown' },
  lina: { skin: '#efcfc4', hair: '#9a8a7c', eyebrow: '#7d6c61', lip: '#c9818d', eyeName: 'Gray', hairName: 'Blonde' },
};
