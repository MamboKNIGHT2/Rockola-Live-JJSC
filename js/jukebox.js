/**
 * jukebox.js — Lógica compartida de la rockola en vivo
 *
 * Sincronización entre pestañas/dispositivos usando:
 * - localStorage para persistir la cola y el estado
 * - window.addEventListener('storage') para detectar cambios desde OTRAS pestañas
 * - BroadcastChannel para detectar cambios en la MISMA pestaña (fallback)
 *
 * IMPORTANTE: window 'storage' event solo se dispara en otras pestañas del mismo
 * origen, no en la pestaña que hizo el cambio. Por eso usamos ambos mecanismos.
 */

// ─── Claves de localStorage ───────────────────────────────────────────────────
const QUEUE_KEY        = 'rockola:queue';
const PLAYBACK_KEY     = 'rockola:playback';   // 'playing' | 'paused'
const LAST_EVENT_KEY   = 'rockola:last_event'; // último evento emitido

// ─── BroadcastChannel (misma pestaña / mismo dispositivo) ────────────────────
let channel = null;
try {
  channel = new BroadcastChannel('rockola');
} catch (e) {
  // BroadcastChannel no disponible (Safari antiguo, etc.)
  channel = { postMessage: () => {}, onmessage: null };
}

// ─── Gestión de la cola ───────────────────────────────────────────────────────

function getQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  _emit({ type: 'queue:updated', queue });
}

function addToQueue(item) {
  const queue = getQueue();
  const newItem = {
    id: crypto.randomUUID(),
    videoId: item.videoId,
    title: item.title,
    thumbnail: item.thumbnail,
    requestedAt: Date.now(),
  };
  queue.push(newItem);
  saveQueue(queue);
  return newItem;
}

function removeFromQueue(id) {
  const queue = getQueue();
  const idx = queue.findIndex((item) => item.id === id);
  if (idx === -1) return false;
  queue.splice(idx, 1);
  saveQueue(queue);
  return true;
}

function skipCurrent() {
  const queue = getQueue();
  if (queue.length === 0) return null;
  const removed = queue.shift();
  saveQueue(queue);
  return removed;
}

function reorderQueue(ids) {
  const queue = getQueue();
  const map = new Map(queue.map((item) => [item.id, item]));
  const reordered = ids.map((id) => map.get(id)).filter(Boolean);
  saveQueue(reordered);
  return reordered;
}

function clearQueue() {
  saveQueue([]);
}

// ─── Eventos de reproducción ──────────────────────────────────────────────────

function emitPause() {
  localStorage.setItem(PLAYBACK_KEY, 'paused');
  _emit({ type: 'playback:pause' });
}

function emitResume() {
  localStorage.setItem(PLAYBACK_KEY, 'playing');
  _emit({ type: 'playback:resume' });
}

function emitSkip() {
  _emit({ type: 'playback:skip' });
}

function getPlaybackState() {
  return localStorage.getItem(PLAYBACK_KEY) || 'playing';
}

// ─── Sistema de eventos interno ───────────────────────────────────────────────
// Emite via BroadcastChannel (misma pestaña) Y via localStorage (otras pestañas)

function _emit(eventObj) {
  // 1. BroadcastChannel — para otras pestañas en el mismo navegador/dispositivo
  try {
    channel.postMessage(eventObj);
  } catch (e) {}

  // 2. localStorage storage event — para otras pestañas (se dispara en ellas, no aquí)
  // Usamos un timestamp para forzar el evento aunque el valor sea el mismo
  const payload = JSON.stringify({ ...eventObj, _ts: Date.now() });
  localStorage.setItem(LAST_EVENT_KEY, payload);
}

// ─── Escuchar eventos desde otras pestañas ────────────────────────────────────
// Los listeners se registran externamente con Jukebox.onEvent(handler)

const _handlers = [];

function onEvent(handler) {
  _handlers.push(handler);
}

function _dispatch(eventObj) {
  _handlers.forEach((h) => {
    try { h(eventObj); } catch (e) {}
  });
}

// Escuchar BroadcastChannel (misma pestaña que emitió NO recibe esto,
// pero otras pestañas del mismo navegador sí)
channel.onmessage = (e) => {
  _dispatch(e.data);
};

// Escuchar storage events (se disparan en OTRAS pestañas cuando localStorage cambia)
window.addEventListener('storage', (e) => {
  if (e.key === LAST_EVENT_KEY && e.newValue) {
    try {
      const eventObj = JSON.parse(e.newValue);
      delete eventObj._ts;
      _dispatch(eventObj);
    } catch {}
  }
  // También reaccionar a cambios directos en la cola
  if (e.key === QUEUE_KEY && e.newValue) {
    try {
      const queue = JSON.parse(e.newValue);
      _dispatch({ type: 'queue:updated', queue });
    } catch {}
  }
});

// ─── Exportar ─────────────────────────────────────────────────────────────────
const Jukebox = {
  getQueue,
  addToQueue,
  removeFromQueue,
  skipCurrent,
  reorderQueue,
  clearQueue,
  emitPause,
  emitResume,
  emitSkip,
  getPlaybackState,
  onEvent,
  channel, // expuesto por compatibilidad
};

if (typeof window !== 'undefined') {
  window.Jukebox = Jukebox;
}
