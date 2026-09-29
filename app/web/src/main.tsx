import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './state/theme' // applies the saved theme before the first paint
import App from './app'
import './styles/global.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if (import.meta.env.DEV || location.search.includes('debug')) {
  void Promise.all([import('./state/viewport'), import('./state/app')]).then(([v, a]) => {
    ;(window as unknown as Record<string, unknown>).__ic = { viewports: v.viewports, app: a.useApp }
  })
}
