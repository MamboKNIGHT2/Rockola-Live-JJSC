// --- Inicialización ---
const roomId = sessionStorage.getItem('roomId');
const userName = sessionStorage.getItem('userName');
if (!roomId || !userName) window.location.href = 'index.html';

const roomRef = db.ref(`salas/${roomId}`);
let isAdmin = false;
let myUserId = userName + '_' + Math.random().toString(36).substr(2, 5);
let player;
let currentVideoId = null;
let playlistData = [];
let adminSyncInterval = null;

document.getElementById('roomTitle').textContent = roomId;
document.getElementById('userBadge').textContent = userName + (isAdmin ? ' 👑' : '');

// --- YouTube Player ---
function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '100%',
        width: '100%',
        videoId: '',
        playerVars: { autoplay: 0, controls: 1, modestbranding: 1, rel: 0 },
        events: {
            onReady: onPlayerReady,
            onStateChange: onPlayerStateChange
        }
    });
}

function onPlayerReady() {
    // Cargar datos iniciales de Firebase
    roomRef.once('value', snapshot => {
        const data = snapshot.val() || {};
        if (!data.creador) {
            // Primera persona -> Admin
            roomRef.child('creador').set(myUserId);
            roomRef.child('playlist').set([]);
            roomRef.child('currentVideo').set(null);
            isAdmin = true;
        } else {
            isAdmin = (data.creador === myUserId);
        }
        document.getElementById('userBadge').textContent = userName + (isAdmin ? ' 👑 Admin' : ' 🎧 Cliente');
        if (isAdmin) {
            document.getElementById('adminControls').classList.remove('hidden');
            startAdminSync();
        }
        updateUI();
    });

    // Escuchar cambios en tiempo real
    roomRef.child('playlist').on('value', snap => {
        playlistData = snap.val() || [];
        renderPlaylist();
    });
    roomRef.child('currentVideo').on('value', snap => {
        const videoData = snap.val();
        if (videoData && videoData.videoId !== currentVideoId) {
            currentVideoId = videoData.videoId;
            player.loadVideoById(videoData.videoId, videoData.currentTime || 0);
            if (!videoData.isPlaying) player.pauseVideo();
            updateNowPlaying(videoData);
        } else if (videoData && videoData.videoId === currentVideoId) {
            // Solo actualizar si no es admin
            if (!isAdmin) {
                if (videoData.isPlaying && player.getPlayerState() !== 1) {
                    player.playVideo();
                    player.seekTo(videoData.currentTime || 0, true);
                } else if (!videoData.isPlaying && player.getPlayerState() === 1) {
                    player.pauseVideo();
                }
            }
            updateNowPlaying(videoData);
        }
    });
    roomRef.child('creador').on('value', snap => {
        isAdmin = (snap.val() === myUserId);
        document.getElementById('adminControls').classList.toggle('hidden', !isAdmin);
        document.getElementById('userBadge').textContent = userName + (isAdmin ? ' 👑 Admin' : ' 🎧 Cliente');
        if (isAdmin) startAdminSync();
        else stopAdminSync();
    });
}

function onPlayerStateChange(event) {
    if (!isAdmin) return;
    if (event.data === YT.PlayerState.PLAYING || event.data === YT.PlayerState.PAUSED) {
        syncVideoState();
    } else if (event.data === YT.PlayerState.ENDED && isAdmin) {
        playNextVideo();
    }
}

function syncVideoState() {
    if (!currentVideoId || !isAdmin) return;
    const state = player.getPlayerState();
    roomRef.child('currentVideo').update({
        isPlaying: state === 1,
        currentTime: player.getCurrentTime()
    });
}

function startAdminSync() {
    stopAdminSync();
    if (isAdmin) {
        adminSyncInterval = setInterval(() => {
            if (player && currentVideoId) {
                const state = player.getPlayerState();
                if (state === 1 || state === 2) {
                    roomRef.child('currentVideo').update({ currentTime: player.getCurrentTime() });
                }
            }
        }, 3000);
    }
}
function stopAdminSync() {
    if (adminSyncInterval) { clearInterval(adminSyncInterval); adminSyncInterval = null; }
}

// --- Actualizar "Reproduciendo ahora" ---
function updateNowPlaying(videoData) {
    const np = document.getElementById('nowPlaying');
    if (videoData) {
        np.innerHTML = `<strong>▶ Reproduciendo:</strong> ${videoData.titulo || 'Video de YouTube'} 
                        <span style="color:#aaa;font-size:13px;">— ${videoData.canal || ''}</span>`;
    } else {
        np.innerHTML = '<p>Esperando que el Admin reproduzca algo...</p>';
    }
}

// --- Renderizar playlist ---
function renderPlaylist() {
    const container = document.getElementById('playlistContainer');
    container.innerHTML = '';
    if (!playlistData || playlistData.length === 0) {
        container.innerHTML = '<p style="color:#aaa;text-align:center;padding:20px;">Playlist vacía</p>';
        return;
    }
    playlistData.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'playlist-item';
        if (item.videoId === currentVideoId) div.classList.add('current');
        div.draggable = isAdmin;
        div.innerHTML = `
            <img src="${item.thumbnail || 'https://i.ytimg.com/vi/' + item.videoId + '/default.jpg'}" alt="">
            <div class="playlist-info">
                <div class="title">${item.titulo}</div>
                <div class="channel">${item.canal} · añadido por ${item.addedBy}</div>
            </div>
            ${isAdmin ? `
                <button class="drag-handle" title="Arrastrar para reordenar">
                    <span class="material-icons">drag_indicator</span>
                </button>
                <button class="remove-btn" title="Eliminar" data-index="${index}">
                    <span class="material-icons">delete</span>
                </button>
            ` : ''}
        `;
        // Eventos
        if (isAdmin) {
            div.addEventListener('dragstart', e => { e.dataTransfer.setData('index', index); div.classList.add('dragging'); });
            div.addEventListener('dragend', () => div.classList.remove('dragging'));
            div.addEventListener('dragover', e => e.preventDefault());
            div.addEventListener('drop', e => {
                e.preventDefault();
                const from = parseInt(e.dataTransfer.getData('index'));
                const to = index;
                if (from !== to) reorderPlaylist(from, to);
            });
        }
        div.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            if (isAdmin) playVideoFromPlaylist(index);
        });
        container.appendChild(div);
    });
    // Eventos de botones
    document.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeFromPlaylist(parseInt(btn.dataset.index));
        });
    });
}

// --- Funciones Admin ---
function addToPlaylist(videoObj) {
    if (!isAdmin && !videoObj.addedBy) videoObj.addedBy = userName;
    if (!videoObj.id) videoObj.id = Date.now().toString();
    if (!videoObj.addedBy) videoObj.addedBy = userName;
    const newList = [...playlistData];
    // Evitar duplicados consecutivos
    if (newList.length > 0 && newList[newList.length - 1].videoId === videoObj.videoId) return;
    newList.push(videoObj);
    roomRef.child('playlist').set(newList);
    // Si no hay video reproduciéndose y es admin, empezar
    if (isAdmin) {
        const currentVideoSnap = await roomRef.child('currentVideo').once('value');
        if (!currentVideoSnap.val()) {
            playVideoFromPlaylist(0);
        }
    }
}

function removeFromPlaylist(index) {
    if (!isAdmin) return;
    const newList = [...playlistData];
    const removed = newList.splice(index, 1)[0];
    roomRef.child('playlist').set(newList);
    if (removed.videoId === currentVideoId) {
        playNextVideo();
    }
}

function reorderPlaylist(from, to) {
    if (!isAdmin) return;
    const newList = [...playlistData];
    const [moved] = newList.splice(from, 1);
    newList.splice(to, 0, moved);
    roomRef.child('playlist').set(newList);
}

function playVideoFromPlaylist(index) {
    if (!isAdmin) return;
    const video = playlistData[index];
    if (!video) return;
    currentVideoId = video.videoId;
    roomRef.child('currentVideo').set({
        videoId: video.videoId,
        titulo: video.titulo,
        thumbnail: video.thumbnail,
        canal: video.canal,
        isPlaying: true,
        currentTime: 0,
        startedAt: Date.now()
    });
    player.loadVideoById(video.videoId);
}

function playNextVideo() {
    if (!isAdmin || playlistData.length === 0) return;
    const currentIndex = playlistData.findIndex(v => v.videoId === currentVideoId);
    const nextIndex = (currentIndex + 1) % playlistData.length;
    playVideoFromPlaylist(nextIndex);
}

function updateUI() {
    if (isAdmin) document.getElementById('adminControls').classList.remove('hidden');
    else document.getElementById('adminControls').classList.add('hidden');
}

// --- Eventos UI ---
// Búsqueda
document.getElementById('searchBtn').addEventListener('click', doSearch);
document.getElementById('searchInput').addEventListener('keypress', e => { if (e.key === 'Enter') doSearch(); });

async function doSearch() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;
    const container = document.getElementById('searchResults');
    container.innerHTML = '<p style="color:#aaa;">Buscando...</p>';
    const results = await searchYouTube(query);
    container.innerHTML = '';
    if (results.length === 0) {
        container.innerHTML = '<p style="color:#aaa;">Sin resultados 😕</p>';
        return;
    }
    results.forEach(video => {
        const div = document.createElement('div');
        div.className = 'result-item';
        div.innerHTML = `
            <img src="${video.thumbnail || ''}" alt="">
            <div class="result-info">
                <div class="title">${video.title}</div>
                <div class="channel">${video.channel}</div>
            </div>
            <button class="add-btn" title="Agregar a playlist">
                <span class="material-icons">add</span>
            </button>
        `;
        div.querySelector('.add-btn').addEventListener('click', () => {
            addToPlaylist({
                videoId: video.videoId,
                titulo: video.title,
                thumbnail: video.thumbnail,
                canal: video.channel,
                addedBy: userName,
                id: Date.now().toString()
            });
        });
        container.appendChild(div);
    });
}

// Controles Admin
document.getElementById('playPauseBtn').addEventListener('click', () => {
    if (!isAdmin) return;
    if (player.getPlayerState() === 1) {
        player.pauseVideo();
    } else {
        player.playVideo();
    }
    syncVideoState();
});
document.getElementById('nextBtn').addEventListener('click', () => { if (isAdmin) playNextVideo(); });
document.getElementById('prevBtn').addEventListener('click', () => {
    if (!isAdmin || playlistData.length === 0) return;
    const idx = playlistData.findIndex(v => v.videoId === currentVideoId);
    const prev = (idx - 1 + playlistData.length) % playlistData.length;
    playVideoFromPlaylist(prev);
});
