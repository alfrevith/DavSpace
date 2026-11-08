// Keep the gap between the two movement buttons active while sliding. Leaving
// the pad releases movement, but capture lets the same finger slide back in.
export function movementDirection(x, y, left, right, tolerance = 14) {
  if (!left.width || !left.height || !right.width || !right.height) return null;
  if (x < Math.min(left.left, right.left) - tolerance || x > Math.max(left.right, right.right) + tolerance ||
      y < Math.min(left.top, right.top) - tolerance || y > Math.max(left.bottom, right.bottom) + tolerance) return null;
  return x < (left.right + right.left) / 2 ? 'left' : 'right';
}
