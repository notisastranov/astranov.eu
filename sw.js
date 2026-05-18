// AstranovOS — Service Worker
// Handles: offline shell, push notifications, notification click routing
'use strict';

const CACHE = 'astranov-v2';

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.add('/')));
});

self.addEventListener('activate', e => {
  e.waitUntil(Promise.all([
    clients.claim(),
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    )),
  ]));
});

// Offline shell — serve cached index.html for navigation requests
self.addEventListener('fetch', e => {
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/'))
    );
  }
});

// Push notification — fires even when app is closed
self.addEventListener('push', e => {
  const d = e.data ? e.data.json() : {};
  const isCall = d.type === 'call';

  const opts = {
    body:             d.body || '',
    icon:             d.icon || '/icon-192.png',
    badge:            '/badge-96.png',
    tag:              d.tag  || d.type || 'astranov',
    data:             d,
    requireInteraction: isCall,
    silent:           false,
    vibrate:          isCall ? [400, 150, 400, 150, 800] : [200, 80, 200],
    timestamp:        Date.now(),
    actions: isCall
      ? [{ action: 'accept',  title: '◈ Accept' },
         { action: 'decline', title: '✕ Decline' }]
      : (d.actions || []),
  };

  e.waitUntil(self.registration.showNotification(d.title || 'Astranov', opts));
});

// Notification click — focus or open app with context in URL
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const d      = e.notification.data || {};
  const action = e.action;

  // Decline without opening app
  if (d.type === 'call' && action === 'decline') {
    e.waitUntil(
      clients.matchAll({ type: 'window' }).then(list => {
        list.forEach(c => c.postMessage({ type: 'call-decline-push', callId: d.callId }));
      })
    );
    return;
  }

  // Build params to pass context into the app
  const p = new URLSearchParams();
  if (d.type)       p.set('notif', d.type);
  if (d.callId)     p.set('callId',     d.callId);
  if (d.callerId)   p.set('callerId',   d.callerId);
  if (d.callerName) p.set('callerName', d.callerName);
  if (d.senderId)   p.set('senderId',   d.senderId);
  if (d.senderName) p.set('senderName', d.senderName);
  if (d.deliveryId) p.set('deliveryId', d.deliveryId);
  if (action === 'accept' || d.autoAccept) p.set('accept', '1');

  const target = '/?' + p.toString();

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (new URL(c.url).origin === self.location.origin) {
          // App already open — post message and focus
          c.postMessage({ type: 'notif-nav', params: Object.fromEntries(p) });
          return c.focus();
        }
      }
      return clients.openWindow(target);
    })
  );
});

// Handle pushsubscriptionchange (subscription expired/renewed by browser)
self.addEventListener('pushsubscriptionchange', e => {
  e.waitUntil(
    self.registration.pushManager.subscribe(e.oldSubscription?.options)
      .then(sub => {
        // Post to main thread to re-save subscription
        return clients.matchAll({ type: 'window' }).then(list => {
          list.forEach(c => c.postMessage({ type: 'push-resubscribe', sub: sub.toJSON() }));
        });
      })
  );
});
