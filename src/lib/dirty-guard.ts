/**
 * Lightweight registry for auto-saving unsaved form state before forced actions
 * (e.g. idle logout). Only one save function can be registered at a time.
 */

type SaveFn = () => Promise<boolean | string>

let _saveFn: SaveFn | null = null

/** Register a save function. Returns an unregister callback. */
export function registerDirtyGuard(fn: SaveFn): () => void {
  _saveFn = fn
  return () => {
    if (_saveFn === fn) _saveFn = null
  }
}

/** Auto-save if a guard is registered. Silently ignores errors. */
export async function autoSaveIfDirty(): Promise<void> {
  if (_saveFn) {
    try {
      await _saveFn()
    } catch {
      // best-effort — we're about to logout regardless
    }
  }
}
