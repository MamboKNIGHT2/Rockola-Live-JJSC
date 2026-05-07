// Búsqueda usando YouTube Data API v3 (requiere clave de API gratuita)
const YOUTUBE_API_KEY = 'AIzaSyD-NKQi-0Si0dDy8z5-w9F563iAIyi27R0';
const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const MAX_RESULTS = 12;   // resultados máximos

/**
 * Busca videos en YouTube (sin pageToken, versión simple)
 * @param {string} query - texto a buscar
 * @returns {Promise<Array>} lista de objetos { videoId, title, channel, thumbnail }
 */
async function searchYouTube(query) {
  const url = `${YOUTUBE_SEARCH_URL}?part=snippet&type=video&maxResults=${MAX_RESULTS}&q=${encodeURIComponent(query)}&key=${YOUTUBE_API_KEY}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Error en la API de YouTube:', errorData);
      throw new Error(errorData.error?.message || 'Error desconocido');
    }

    const data = await response.json();
    if (!data.items || data.items.length === 0) return [];

    return data.items.map(item => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails.default?.url || item.snippet.thumbnails.medium?.url || ''
    }));
  } catch (err) {
    console.error('❌ Falló la búsqueda:', err);
    return [];
  }
}
