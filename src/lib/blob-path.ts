/**
 * One outline for `n` circles of radius `r` in a row, `d` apart, joined by a smooth neck.
 * `w` = how far the top and bottom edges dip in at the waist (the neck is `r - w` from the centre line).
 * The valleys are true circular fillets tangent to both neighbouring circles, so the edge flows like a
 * soft wave: round domes over each circle, gentle round valleys between. Size: (r*2 + (n-1)*d) by r*2.
 */
export function blobPath(n: number, r: number, d: number, w: number): string {
  const cx = (i: number) => r + i * d;
  const h = r * 2;
  const half = d / 2;
  const b = r - w; // half-height of the neck
  // Radius of the valley fillet: tangent to both circles (outside) and to the neck line.
  const f = Math.max(1, (half * half + b * b - r * r) / (2 * (r - b)));
  const dx = (r * half) / (r + f); // tangent point offset from the circle centre, along x
  const topY = r - (r * (b + f)) / (r + f); // tangent point height (top edge)
  const botY = h - topY;
  const fmt = (v: number) => v.toFixed(2);

  let p = `M ${fmt(cx(0))} 0`;
  for (let i = 0; i < n - 1; i++) {
    p += ` A ${r} ${r} 0 0 1 ${fmt(cx(i) + dx)} ${fmt(topY)}`;
    p += ` A ${fmt(f)} ${fmt(f)} 0 0 0 ${fmt(cx(i + 1) - dx)} ${fmt(topY)}`;
    p += ` A ${r} ${r} 0 0 1 ${fmt(cx(i + 1))} 0`;
  }
  p += ` A ${r} ${r} 0 0 1 ${fmt(cx(n - 1))} ${h}`;
  for (let i = n - 1; i > 0; i--) {
    p += ` A ${r} ${r} 0 0 1 ${fmt(cx(i) - dx)} ${fmt(botY)}`;
    p += ` A ${fmt(f)} ${fmt(f)} 0 0 0 ${fmt(cx(i - 1) + dx)} ${fmt(botY)}`;
    p += ` A ${r} ${r} 0 0 1 ${fmt(cx(i - 1))} ${h}`;
  }
  return `${p} A ${r} ${r} 0 0 1 ${fmt(cx(0))} 0 Z`;
}

/**
 * One outline for a row of capsules (beads) of height `h` that touch and pinch inward between neighbours.
 * `beads` are the x and width of each capsule, left to right; neighbours should overlap by about 6px.
 * `w` is how far the top and bottom edges dip at each waist.
 */
export function chainPath(beads: { x: number; w: number }[], h: number, w: number): string {
  if (beads.length === 0) return '';
  const r = h / 2;
  const left = beads.map((b) => b.x + r); // centre of each left cap
  const right = beads.map((b) => b.x + b.w - r); // centre of each right cap
  let p = `M ${left[0]} 0`;
  for (let i = 0; i < beads.length; i++) {
    p += ` L ${right[i]} 0`;
    if (i < beads.length - 1) {
      const e = right[i];
      const s = left[i + 1];
      const m = (e + s) / 2;
      const k = s - e;
      p += ` C ${e + k * 0.4} 0 ${m - k * 0.2} ${w} ${m} ${w} C ${m + k * 0.2} ${w} ${s - k * 0.4} 0 ${s} 0`;
    }
  }
  const last = beads.length - 1;
  p += ` A ${r} ${r} 0 0 1 ${right[last]} ${h}`;
  for (let i = last; i >= 0; i--) {
    p += ` L ${left[i]} ${h}`;
    if (i > 0) {
      const e = left[i];
      const s = right[i - 1];
      const m = (e + s) / 2;
      const k = e - s;
      p += ` C ${e - k * 0.4} ${h} ${m + k * 0.2} ${h - w} ${m} ${h - w} C ${m - k * 0.2} ${h - w} ${s + k * 0.4} ${h} ${s} ${h}`;
    }
  }
  return `${p} A ${r} ${r} 0 0 1 ${left[0]} 0 Z`;
}
