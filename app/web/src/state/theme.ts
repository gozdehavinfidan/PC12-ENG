import { create } from 'zustand'

/**
 * Light / dark theme. The palette lives in CSS custom properties
 * (styles/tokens.css); switching flips `data-theme` on <html>, so every DOM
 * surface re-colours without a React re-render. Only the canvas / WebGL
 * surfaces (atlas, 3D room) subscribe here, because they cannot read CSS.
 */
export type ThemeMode = 'dark' | 'light' | 'system'
export type Theme = 'dark' | 'light'

const KEY = 'camex.theme'
const OLD_KEY = 'intellicell.theme'

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function readMode(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY) ?? localStorage.getItem(OLD_KEY)
    if (v === 'dark' || v === 'light' || v === 'system') return v
  } catch {
    /* storage blocked: fall back to the default */
  }
  return 'dark' // Dracula-family dark stays the default (CLAUDE.md s6)
}

function apply(theme: Theme, animate: boolean) {
  const root = document.documentElement
  if (animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.classList.add('theme-anim')
    window.setTimeout(() => root.classList.remove('theme-anim'), 420)
  }
  root.dataset.theme = theme
  root.style.colorScheme = theme
}

interface ThemeStore {
  mode: ThemeMode
  theme: Theme
  setMode: (m: ThemeMode) => void
  toggle: () => void
}

const initialMode = readMode()
const initialTheme = initialMode === 'system' ? systemTheme() : initialMode
apply(initialTheme, false)

export const useTheme = create<ThemeStore>((set, get) => ({
  mode: initialMode,
  theme: initialTheme,
  setMode: (mode) => {
    const theme = mode === 'system' ? systemTheme() : mode
    try {
      localStorage.setItem(KEY, mode)
    } catch {
      /* not persisted: still applied for this session */
    }
    apply(theme, true)
    set({ mode, theme })
  },
  toggle: () => get().setMode(get().theme === 'dark' ? 'light' : 'dark'),
}))

window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
  if (useTheme.getState().mode === 'system') useTheme.getState().setMode('system')
})

/** resolved value of a CSS custom property (for canvas / WebGL drawing) */
export function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}
