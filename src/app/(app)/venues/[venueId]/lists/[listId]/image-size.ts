/** The size a photo is drawn at before upload: the long side is at most `max`, the shape is kept, never enlarged. */
export function fitWithin(
  width: number,
  height: number,
  max = 1600,
): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 1, height: 1 };
  const longest = Math.max(width, height);
  if (longest <= max)
    return { width: Math.round(width), height: Math.round(height) };
  const scale = max / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
