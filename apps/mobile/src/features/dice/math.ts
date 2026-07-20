export type Vec3 = { x: number; y: number; z: number };
export type Quat = { w: number; x: number; y: number; z: number };

export const vec = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
export const add = (a: Vec3, b: Vec3): Vec3 => vec(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a: Vec3, b: Vec3): Vec3 => vec(a.x - b.x, a.y - b.y, a.z - b.z);
export const scale = (a: Vec3, s: number): Vec3 => vec(a.x * s, a.y * s, a.z * s);
export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: Vec3, b: Vec3): Vec3 =>
  vec(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const length = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
export const normalize = (a: Vec3): Vec3 => {
  const l = length(a) || 1;
  return scale(a, 1 / l);
};

export const quat = (w: number, x: number, y: number, z: number): Quat => ({ w, x, y, z });
export const quatIdentity = (): Quat => quat(1, 0, 0, 0);

export function quatMultiply(a: Quat, b: Quat): Quat {
  return quat(
    a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w
  );
}

export function quatNormalize(q: Quat): Quat {
  const l = Math.hypot(q.w, q.x, q.y, q.z) || 1;
  return quat(q.w / l, q.x / l, q.y / l, q.z / l);
}

export function quatFromAxisAngle(axis: Vec3, angle: number): Quat {
  const s = Math.sin(angle / 2);
  return quat(Math.cos(angle / 2), axis.x * s, axis.y * s, axis.z * s);
}

export function quatRotate(q: Quat, v: Vec3): Vec3 {
  const u = vec(q.x, q.y, q.z);
  const s = q.w;
  return add(
    add(scale(u, 2 * dot(u, v)), scale(v, s * s - dot(u, u))),
    scale(cross(u, v), 2 * s)
  );
}

/** Shortest-arc rotation carrying unit vector `from` onto unit vector `to`. */
export function quatBetween(from: Vec3, to: Vec3): Quat {
  const c = cross(from, to);
  const d = dot(from, to);
  if (d < -0.9999) {
    const orthogonal = Math.abs(from.x) < 0.9 ? cross(from, vec(1, 0, 0)) : cross(from, vec(0, 0, 1));
    return quatFromAxisAngle(normalize(orthogonal), Math.PI);
  }
  return quatNormalize(quat(1 + d, c.x, c.y, c.z));
}

export function quatSlerp(a: Quat, b: Quat, t: number): Quat {
  let d = a.w * b.w + a.x * b.x + a.y * b.y + a.z * b.z;
  let target = b;
  if (d < 0) {
    target = quat(-b.w, -b.x, -b.y, -b.z);
    d = -d;
  }
  if (d > 0.9995) {
    return quatNormalize(
      quat(
        a.w + t * (target.w - a.w),
        a.x + t * (target.x - a.x),
        a.y + t * (target.y - a.y),
        a.z + t * (target.z - a.z)
      )
    );
  }
  const theta = Math.acos(d);
  const s = Math.sin(theta);
  const wa = Math.sin((1 - t) * theta) / s;
  const wb = Math.sin(t * theta) / s;
  return quatNormalize(
    quat(
      wa * a.w + wb * target.w,
      wa * a.x + wb * target.x,
      wa * a.y + wb * target.y,
      wa * a.z + wb * target.z
    )
  );
}
