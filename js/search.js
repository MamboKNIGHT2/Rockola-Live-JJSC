// Búsqueda usando el feed RSS público de YouTube + proxy CORS gratuito
async function searchYouTube(query) {
    const proxy = 'https://api.allorigins.win/raw?url=';
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?q=${encodeURIComponent(query)}`;
    
    try {
        const response = await fetch(proxy + encodeURIComponent(feedUrl));
        const text = await response.text();
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, 'text/xml');
        const entries = xml.querySelectorAll('entry');
        
        const results = [];
        entries.forEach(entry => {
            const videoId = entry.querySelector('yt\\:videoId, videoId')?.textContent;
            const title = entry.querySelector('title')?.textContent;
            const author = entry.querySelector('author name')?.textContent;
            const mediaGroup = entry.querySelector('media\\:group, group');
            const thumbnail = mediaGroup?.querySelector('media\\:thumbnail, thumbnail')?.getAttribute('url');
            
            if (videoId && title) {
                results.push({ videoId, title, channel: author || 'YouTube', thumbnail });
            }
        });
        return results.slice(0, 12);
    } catch (err) {
        console.error('Error en búsqueda:', err);
        return [];
    }
}
