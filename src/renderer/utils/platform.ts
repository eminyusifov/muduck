export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);

/** Label for the primary shortcut modifier: "Cmd" on macOS, "Ctrl" elsewhere. */
export const MOD = isMac ? 'Cmd' : 'Ctrl';

export const basename = (p: string) => p.split(/[\\/]/).pop() || p;
