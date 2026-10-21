/**
 * admin-podcasts.js - Beheer van videopodcasts voor Wimpie & de Domino's
 */

window.adminPodcasts = (function () {
    let podcastsData = { show: {}, episodes: [] };
    let editingEpisodeIndex = null;

    function extractYoutubeId(input) {
        if (!input || typeof input !== 'string') return '';
        const trimmed = input.trim();
        if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
        const patterns = [
            /youtu\.be\/([a-zA-Z0-9_-]{11})(?=[?&#/]|$)/,
            /youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/|v\/)([a-zA-Z0-9_-]{11})(?=[?&#/]|$)/
        ];
        for (const p of patterns) {
            const m = trimmed.match(p);
            if (m && m[1]) return m[1];
        }
        return '';
    }

    function init(data) {
        podcastsData = data || { show: {}, episodes: [] };
        if (!podcastsData.show) podcastsData.show = {};
        if (!Array.isArray(podcastsData.episodes)) podcastsData.episodes = [];

        populateShowSettings();
        renderEpisodesList();
        resetEpisodeForm();
        setupListeners();
    }

    function populateShowSettings() {
        const s = podcastsData.show || {};
        const titleEl = document.getElementById('pod-show-title');
        const subEl = document.getElementById('pod-show-subtitle');
        const spEl = document.getElementById('pod-show-spotify');
        const apEl = document.getElementById('pod-show-apple');
        const ytEl = document.getElementById('pod-show-youtube');

        if (titleEl) titleEl.value = s.title || 'De Wimpies Podcast';
        if (subEl) subEl.value = s.subtitle || '';
        if (spEl) spEl.value = (s.platforms && s.platforms.spotify) || '';
        if (apEl) apEl.value = (s.platforms && s.platforms.apple) || '';
        if (ytEl) ytEl.value = (s.platforms && s.platforms.youtube) || '';
    }

    function renderEpisodesList() {
        const container = document.getElementById('podcasts-list');
        if (!container) return;

        const episodes = podcastsData.episodes || [];
        if (episodes.length === 0) {
            container.innerHTML = '<div class="p-6 text-center text-sm font-mono text-neutral-400">Nog geen afleveringen aangemaakt.</div>';
            return;
        }

        container.innerHTML = episodes.map((ep, idx) => {
            const isEditing = editingEpisodeIndex === idx;
            const epNum = ep.episodeNumber ? `Aflevering ${String(ep.episodeNumber).padStart(2, '0')}` : `Item #${idx + 1}`;
            return `
                <div class="p-4 rounded-xl ${isEditing ? 'bg-[#C85A32]/10 shadow-[0_0_0_1px_rgba(200,90,50,0.5)]' : 'bg-[#181818] shadow-[0_0_0_1px_rgba(255,255,255,0.06)]'} flex items-center justify-between gap-4 transition">
                    <div class="min-w-0">
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-[#C85A32]/20 text-[#C85A32] font-semibold">${epNum}</span>
                            <h4 class="text-sm font-semibold text-white truncate">${ep.title || 'Zonder titel'}</h4>
                        </div>
                        <p class="text-xs font-mono text-neutral-400 truncate mt-0.5">${ep.slug ? `podcast.html#${ep.slug}` : ''} ${ep.date ? `&bull; ${ep.date}` : ''}</p>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        <button type="button" onclick="adminPodcasts.edit(${idx})" class="h-8 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-mono uppercase text-white transition flex items-center gap-1">
                            <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
                            <span class="hidden sm:inline">Bewerk</span>
                        </button>
                        <button type="button" onclick="adminPodcasts.remove(${idx})" class="h-8 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-xs font-mono uppercase text-red-400 transition flex items-center gap-1">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        if (window.adminApp && window.adminApp.refreshIcons) {
            window.adminApp.refreshIcons();
        }
    }

    function setupListeners() {
        const showForm = document.getElementById('podcast-show-form');
        if (showForm) {
            showForm.addEventListener('submit', handleShowSave);
        }

        const epForm = document.getElementById('podcast-episode-form');
        if (epForm) {
            epForm.addEventListener('submit', handleEpisodeSave);
        }

        const cancelBtn = document.getElementById('pod-cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', resetEpisodeForm);
        }

        const ytInput = document.getElementById('pod-youtube');
        if (ytInput) {
            ytInput.addEventListener('input', () => {
                const extracted = extractYoutubeId(ytInput.value);
                if (extracted && extracted !== ytInput.value.trim()) {
                    ytInput.value = extracted;
                }
                updatePreview();
            });
        }

        const previewFields = ['pod-title', 'pod-desc', 'pod-num', 'pod-date'];
        previewFields.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', updatePreview);
        });
    }

    function updatePreview() {
        const title = document.getElementById('pod-title')?.value || 'Titel van de Aflevering';
        const desc = document.getElementById('pod-desc')?.value || 'Korte toelichting op de inhoud van de aflevering...';
        const num = document.getElementById('pod-num')?.value || '1';
        const date = document.getElementById('pod-date')?.value || '';
        const ytId = extractYoutubeId(document.getElementById('pod-youtube')?.value || '');

        const prevNum = document.getElementById('prev-pod-num');
        const prevDate = document.getElementById('prev-pod-date');
        const prevTitle = document.getElementById('prev-pod-title');
        const prevDesc = document.getElementById('prev-pod-desc');
        const prevVideo = document.getElementById('prev-pod-video');

        if (prevNum) prevNum.textContent = `Aflevering ${String(num).padStart(2, '0')}`;
        if (prevDate) prevDate.textContent = date;
        if (prevTitle) prevTitle.textContent = title;
        if (prevDesc) prevDesc.textContent = desc;

        if (prevVideo) {
            if (ytId) {
                prevVideo.innerHTML = `<iframe class="w-full h-full rounded-xl" src="https://www.youtube-nocookie.com/embed/${ytId}" loading="lazy" allowfullscreen></iframe>`;
            } else {
                prevVideo.innerHTML = `<div class="w-full h-full flex flex-col items-center justify-center text-xs font-mono text-neutral-400 p-4 text-center"><span>9:16 Verticale Video</span><span class="text-[10px] text-neutral-400 mt-1">Vul YouTube ID of link in</span></div>`;
            }
        }
    }

    function edit(index) {
        const ep = podcastsData.episodes[index];
        if (!ep) return;

        editingEpisodeIndex = index;
        document.getElementById('pod-num').value = ep.episodeNumber || (index + 1);
        document.getElementById('pod-slug').value = ep.slug || `aflevering-${index + 1}`;
        document.getElementById('pod-title').value = ep.title || '';
        document.getElementById('pod-desc').value = ep.description || '';
        document.getElementById('pod-date').value = ep.date || '';
        document.getElementById('pod-youtube').value = ep.youtubeId || '';

        const pl = ep.platforms || {};
        document.getElementById('pod-spotify').value = pl.spotify || '';
        document.getElementById('pod-apple').value = pl.apple || '';

        document.getElementById('pod-form-heading').textContent = `Aflevering bewerken: #${ep.episodeNumber || index + 1}`;
        document.getElementById('pod-submit-btn').textContent = 'Aflevering Bijwerken';
        document.getElementById('pod-cancel-btn').classList.remove('hidden');

        renderEpisodesList();
        updatePreview();
        document.getElementById('podcast-episode-form')?.scrollIntoView({ behavior: 'smooth' });
    }

    function resetEpisodeForm() {
        editingEpisodeIndex = null;
        const form = document.getElementById('podcast-episode-form');
        if (form) form.reset();

        const episodes = podcastsData.episodes || [];
        const nextNum = episodes.length + 1;
        const numField = document.getElementById('pod-num');
        if (numField) numField.value = nextNum;
        const slugField = document.getElementById('pod-slug');
        if (slugField) slugField.value = `aflevering-${nextNum}`;

        const heading = document.getElementById('pod-form-heading');
        if (heading) heading.textContent = 'Nieuwe Aflevering Toevoegen';
        const submitBtn = document.getElementById('pod-submit-btn');
        if (submitBtn) submitBtn.textContent = 'Aflevering Toevoegen';
        const cancelBtn = document.getElementById('pod-cancel-btn');
        if (cancelBtn) cancelBtn.classList.add('hidden');

        renderEpisodesList();
        updatePreview();
    }

    async function handleShowSave(e) {
        e.preventDefault();
        const title = document.getElementById('pod-show-title')?.value.trim() || 'De Wimpies Podcast';
        const subtitle = document.getElementById('pod-show-subtitle')?.value.trim() || '';
        const spotify = document.getElementById('pod-show-spotify')?.value.trim();
        const apple = document.getElementById('pod-show-apple')?.value.trim();
        const youtube = document.getElementById('pod-show-youtube')?.value.trim();

        podcastsData.show = {
            title,
            subtitle,
            platforms: {
                ...(spotify && { spotify }),
                ...(apple && { apple }),
                ...(youtube && { youtube })
            }
        };

        if (window.adminApp && window.adminApp.saveData) {
            await window.adminApp.saveData('podcasts', podcastsData);
        }
    }

    async function handleEpisodeSave(e) {
        e.preventDefault();
        const epNum = parseInt(document.getElementById('pod-num')?.value, 10) || 1;
        const slug = document.getElementById('pod-slug')?.value.trim() || `aflevering-${epNum}`;
        const title = document.getElementById('pod-title')?.value.trim();
        const desc = document.getElementById('pod-desc')?.value.trim();
        const date = document.getElementById('pod-date')?.value.trim();
        const rawYt = document.getElementById('pod-youtube')?.value.trim();
        const youtubeId = extractYoutubeId(rawYt);

        if (!title) {
            alert('Vul een titel in voor de aflevering.');
            return;
        }

        const platforms = {};
        const spotify = document.getElementById('pod-spotify')?.value.trim();
        const apple = document.getElementById('pod-apple')?.value.trim();

        if (youtubeId) platforms.youtube = `https://youtu.be/${youtubeId}`;
        if (spotify) platforms.spotify = spotify;
        if (apple) platforms.apple = apple;

        const newEpisode = {
            slug,
            episodeNumber: epNum,
            title,
            description: desc,
            ...(date && { date }),
            youtubeId,
            platforms
        };

        if (editingEpisodeIndex !== null) {
            podcastsData.episodes[editingEpisodeIndex] = newEpisode;
        } else {
            podcastsData.episodes.unshift(newEpisode);
        }

        resetEpisodeForm();
        renderEpisodesList();

        if (window.adminApp && window.adminApp.saveData) {
            await window.adminApp.saveData('podcasts', podcastsData);
        }
    }

    async function remove(index) {
        const ep = podcastsData.episodes[index];
        const title = ep ? ep.title : `aflevering ${index + 1}`;
        if (!confirm(`Weet je zeker dat je "${title}" wilt verwijderen?`)) {
            return;
        }

        podcastsData.episodes.splice(index, 1);
        if (editingEpisodeIndex === index) resetEpisodeForm();
        renderEpisodesList();

        if (window.adminApp && window.adminApp.saveData) {
            await window.adminApp.saveData('podcasts', podcastsData);
        }
    }

    function getData() {
        return podcastsData;
    }

    return {
        init,
        edit,
        remove,
        resetEpisodeForm,
        getData
    };
})();
