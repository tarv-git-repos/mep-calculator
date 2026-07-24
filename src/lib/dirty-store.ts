// ponytail: module-level singleton - no framework needed for a single boolean flag
let _dirty = false;
const _listeners: Array<() => void> = [];

export const dirtyStore = {
  get isDirty() { return _dirty; },
  set(val: boolean) {
    if (_dirty === val) return;
    _dirty = val;
    _listeners.forEach(fn => fn());
  },
  subscribe(fn: () => void) {
    _listeners.push(fn);
    return () => { const i = _listeners.indexOf(fn); if (i >= 0) _listeners.splice(i, 1); };
  },
};