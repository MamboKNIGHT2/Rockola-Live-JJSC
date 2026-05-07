// Búsqueda usando YouTube Data API v3 (requiere clave de API gratuita)
const YOUTUBE_API_KEY = 'AIzaSy...TU_CLAVE'; // ← CAMBIA ESTO

async function searchYouTube(query) {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=12&q=${encodeURIComponent(query)}&key=${YOUTUBE_API_KEY}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.error) {
            console.error('Error de API:', data.error);
            return [];
        }
        
        return data.items.map(item => ({
            videoId: item.id.videoId,
            title: item.snippet.title,
            channel: item.snippet.channelTitle,
            thumbnail: item.snippet.thumbnails.default.url
        }));
    } catch (err) {
        console.error('Error en búsqueda:', err);
        return [];
    }
}
