import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import './index.css'
import App from './App.tsx'
import { THEMES, buildThemeCss } from './theme/themes'

// Inject the generated theme stylesheet once: one `[data-theme="id"]` block per
// theme, each defining every token. Switching a theme is then just setting
// `data-theme` on <html> (see useTheme). Injected before render so tokens are
// available on first paint.
const themeStyle = document.createElement('style')
themeStyle.id = 'theme-vars'
themeStyle.textContent = buildThemeCss(THEMES)
document.head.appendChild(themeStyle)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: Infinity, gcTime: 1000 * 60 * 30, retry: 1, refetchOnWindowFocus: false },
  },
})
const persister = createSyncStoragePersister({ storage: window.localStorage, key: 'ado-taskboard-cache' })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24, buster: 'v3' }}
    >
      <App />
    </PersistQueryClientProvider>
  </StrictMode>,
)
