export function springTo(state, target, dt) {
  const w = 50, damping = 0.65, steps = 4, h = dt / steps;
  for (let i = 0; i < steps; i++) {
    state.v += (w * w * (target - state.x) - 2 * damping * w * state.v) * h;
    state.x += state.v * h;
  }
  if (Math.abs(target - state.x) < 1e-3 && Math.abs(state.v) < 1e-2) {
    state.x = target;
    state.v = 0;
    return false;
  }
  return true;
}
