const CACHE_NAME = 'clima-nautico-shell-v1'
const DATA_CACHE_NAME = 'clima-nautico-data-v1'

// App Shell assets to pre-cache
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-512-maskable.png',
  '/apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('Falha no pre-cache de assets:', err)
      }),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== DATA_CACHE_NAME) {
              return caches.delete(cacheName)
            }
          }),
        )
      })
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Intercepta requisições de API de previsão e janelas (/backend/v1/previsao e /backend/v1/janelas)
  // Estratégia: Network-first com fallback para cache e atualização em segundo plano quando online
  if (
    url.pathname.includes('/backend/v1/previsao') ||
    url.pathname.includes('/backend/v1/janelas')
  ) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Se a resposta da rede for válida, clona e guarda no cache de dados
          if (response && response.status === 200) {
            const responseClone = response.clone()
            caches.open(DATA_CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone)
            })
          }
          return response
        })
        .catch(async () => {
          // Offline fallback para cache
          const cachedResponse = await caches.match(event.request)
          if (cachedResponse) {
            return cachedResponse
          }
          return new Response(
            JSON.stringify({
              error: 'Offline e sem dados em cache para esta rota',
              offline: true,
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }),
    )
    return
  }

  // Para navegações e arquivos estáticos (App shell: HTML, JS, CSS, fontes, imagens)
  // Estratégia: Cache-first com fallback para rede e cache dinâmico de novos chunks
  if (event.request.method === 'GET') {
    // Para navegação SPA (HTML)
    if (event.request.mode === 'navigate') {
      event.respondWith(
        fetch(event.request)
          .then((response) => {
            if (response && response.status === 200) {
              const responseClone = response.clone()
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone)
              })
            }
            return response
          })
          .catch(async () => {
            const cachedPage = await caches.match(event.request)
            if (cachedPage) return cachedPage
            const cachedIndex = await caches.match('/')
            if (cachedIndex) return cachedIndex
            return caches.match('/index.html')
          }),
      )
      return
    }

    // Para outros recursos estáticos (CSS, JS, fonts, imagens)
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Busca atualização de fundo se online
          fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(event.request, networkResponse)
                })
              }
            })
            .catch(() => {
              // Silenciosamente ignora falha de background fetch quando offline
            })
          return cachedResponse
        }

        return fetch(event.request)
          .then((networkResponse) => {
            if (
              networkResponse &&
              networkResponse.status === 200 &&
              (event.request.url.startsWith(self.location.origin) ||
                event.request.url.includes('fonts.gstatic.com') ||
                event.request.url.includes('fonts.googleapis.com'))
            ) {
              const responseClone = networkResponse.clone()
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone)
              })
            }
            return networkResponse
          })
          .catch(() => {
            // Recurso não disponível offline
            return new Response('', { status: 408, statusText: 'Request Timeout' })
          })
      }),
    )
  }
})
