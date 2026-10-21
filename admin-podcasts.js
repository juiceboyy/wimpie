/**
 * admin-podcasts.js - Beheer van videopodcasts voor Wimpie & de Domino's
 */

window.adminPodcasts = (function () {
    let podcastsData = { show: {}, episodes: [] };
    let editingEpisodeIndex = null;
    let lastRenderedYtId = null;

    const utils = window.adminUtils || {
        escapeHtml: str => str || '',
        extractYoutubeId: str => str || ''
    };

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
        const p = s.platforms || {};
        document.getElementById('pod-show-title').value = s.title || 'De Wimpies Podcast';
        document.getElementById('pod-show-subtitle').value = s.subtitle || '';
        document.getElementById('pod-show-spotify').value = p.spotify || '';
        document.getElementById('pod-show-apple').value = p.apple || '';
        document.getElementById('pod-show-youtube').value = p.youtube || '';
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
            const isPortrait = ep.orientation === 'portrait' || ep.orientation === '9:16';
            const fmtBadge = `<span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-neutral-300">${isPortrait ? '9:16' : '16:9'}</span>`;
            const safeTitle = utils.escapeHtml(ep.title || 'Zonder titel');
            const safeSlug = utils.escapeHtml(ep.slug || '');
            const safeDate = utils.escapeHtml(ep.date || '');

            return `
                <div class="p-4 rounded-xl ${isEditing ? 'bg-[#C85A32]/10 shadow-[0_0_0_1px_rgba(200,90,50,0.5)]' : 'bg-[#181818] shadow-[0_0_0_1px_rgba(255,255,255,0.06)]'} flex items-center justify-between gap-4 transition">
                    <div class="min-w-0">
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-[#C85A32]/20 text-[#C85A32] font-semibold">${epNum}</span>
                            ${fmtBadge}
                            <h4 class="text-sm font-semibold text-white truncate">${safeTitle}</h4>
                        </div>
                        <p class="text-xs font-mono text-neutral-400 truncate mt-0.5">${safeSlug ? `podcast.html#${safeSlug}` : ''} ${safeDate ? `&bull; ${safeDate}` : ''}</p>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        <button type="button" data-edit-idx="${idx}" class="pod-btn-edit h-8 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-mono uppercase text-white transition flex items-center gap-1">
                            <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
                            <span class="hidden sm:inline">Bewerk</span>
                        </button>
                        <button type="button" data-remove-idx="${idx}" class="pod-btn-remove h-8 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-xs font-mono uppercase text-red-400 transition flex items-center gap-1">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.pod-btn-edit').forEach(btn => {
            btn.addEventListener('click', () => edit(parseInt(btn.getAttribute('data-edit-idx'), 10)));
        });
        container.querySelectorAll('.pod-btn-remove').forEach(btn => {
            btn.addEventListener('click', () => remove(parseInt(btn.getAttribute('data-remove-idx'), 10)));
        });
        if (window.adminApp && window.adminApp.refreshIcons) window.adminApp.refreshIcons();
    }

    function setupListeners() {
        const showForm = document.getElementById('podcast-show-form');
        if (showForm) showForm.addEventListener('submit', handleShowSave);
        const epForm = document.getElementById('podcast-episode-form');
        if (epForm) epForm.addEventListener('submit', handleEpisodeSave);
        const cancelBtn = document.getElementById('pod-cancel-btn');
        if (cancelBtn) cancelBtn.addEventListener('click', resetEpisodeForm);

        const numInput = document.getElementById('pod-num');
        const slugInput = document.getElementById('pod-slug');
        if (numInput && slugInput) {
            numInput.addEventListener('input', () => {
                if (editingEpisodeIndex === null && numInput.value) slugInput.value = `aflevering-${numInput.value}`;
                updatePreview();
            });
        }

        const ytInput = document.getElementById('pod-youtube');
        if (ytInput) {
            ytInput.addEventListener('input', () => {
                const extracted = utils.extractYoutubeId(ytInput.value);
                if (extracted && extracted !== ytInput.value.trim()) ytInput.value = extracted;
                updatePreview();
            });
        }

        ['pod-title', 'pod-desc', 'pod-date', 'pod-orientation'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', updatePreview);
        });
    }

    function updatePreview() {
        const title = document.getElementById('pod-title')?.value || 'Titel van de Aflevering';
        const desc = document.getElementById('pod-desc')?.value || 'Korte toelichting op de inhoud van de aflevering...';
        const num = document.getElementById('pod-num')?.value || '1';
        const date = document.getElementById('pod-date')?.value || '';
        const orientation = document.getElementById('pod-orientation')?.value || 'portrait';
        const isPortrait = orientation === 'portrait' || orientation === '9:16';
        const ytId = utils.extractYoutubeId(document.getElementById('pod-youtube')?.value || '');

        const prevNum = document.getElementById('prev-pod-num');
        const prevDate = document.getElementById('prev-pod-date');
        const prevTitle = document.getElementById('prev-pod-title');
        const prevDesc = document.getElementById('prev-pod-desc');
        const prevVideo = document.getElementById('prev-pod-video');
        const prevFrame = document.getElementById('prev-pod-frame');
        const prevLabel = document.getElementById('prev-pod-orientation-label');

        if (prevNum) prevNum.textContent = `Aflevering ${String(num).padStart(2, '0')}`;
        if (prevDate) prevDate.textContent = date;
        if (prevTitle) prevTitle.textContent = title;
        if (prevDesc) prevDesc.textContent = desc;
        if (prevLabel) prevLabel.textContent = `Live Preview Podcast Card (${isPortrait ? '9:16 Staand' : '16:9 Liggend'})`;
        if (prevFrame) {
            prevFrame.className = isPortrait
                ? 'w-full max-w-[260px] mx-auto aspect-[9/16] rounded-xl overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.12)] bg-black transition-all duration-200'
                : 'w-full max-w-full aspect-video rounded-xl overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.12)] bg-black transition-all duration-200';
        }

        if (prevVideo && (ytId !== lastRenderedYtId || !prevVideo.innerHTML.includes(isPortrait ? '9:16' : '16:9'))) {
            lastRenderedYtId = ytId;
            if (ytId) {
                prevVideo.innerHTML = `<iframe class="w-full h-full rounded-xl" src="https://www.youtube-nocookie.com/embed/${ytId}" loading="lazy" allowfullscreen></iframe>`;
            } else {
                prevVideo.innerHTML = `<div class="w-full h-full flex flex-col items-center justify-center text-xs font-mono text-neutral-400 p-4 text-center"><span>${isPortrait ? '9:16 Staande Video' : '16:9 Liggende Video'}</span><span class="text-[10px] text-neutral-500 mt-1">Vul YouTube ID of link in</span></div>`;
            }
        }
    }

    function setEpisodeFormValues(ep = {}) {
        document.getElementById('pod-num').value = ep.episodeNumber || 1;
        document.getElementById('pod-slug').value = ep.slug || '';
        document.getElementById('pod-title').value = ep.title || '';
        document.getElementById('pod-desc').value = ep.description || '';
        document.getElementById('pod-date').value = ep.date || '';
        document.getElementById('pod-orientation').value = ep.orientation || (ep.episodeNumber && ep.episodeNumber <= 2 ? 'portrait' : 'landscape');
        document.getElementById('pod-youtube').value = ep.youtubeId || '';
        const pl = ep.platforms || {};
        document.getElementById('pod-spotify').value = pl.spotify || '';
        document.getElementById('pod-apple').value = pl.apple || '';
    }
        document.getElementById('pod-date').value = ep.date || '';
        document.getElementById('pod-youtube').value = ep.youtubeId || '';
        const pl = ep.platforms || {};
        document.getElementById('pod-spotify').value = pl.spotify || '';
        document.getElementById('pod-apple').value = pl.apple || '';
    }

    function edit(index) {
        const ep = podcastsData.episodes[index];
        if (!ep) return;

        editingEpisodeIndex = index;
        setEpisodeFormValues(ep, index);

        const heading = document.getElementById('pod-form-heading');
        if (heading) heading.textContent = `Aflevering bewerken: #${ep.episodeNumber || index + 1}`;
        const submitText = document.getElementById('pod-submit-text');
        if (submitText) submitText.textContent = 'Aflevering Bijwerken';
        const cancelBtn = document.getElementById('pod-cancel-btn');
        if (cancelBtn) cancelBtn.classList.remove('hidden');

        renderEpisodesList();
        updatePreview();
        document.getElementById('podcast-episode-form')?.scrollIntoView({ behavior: 'smooth' });
    }

    function resetEpisodeForm() {
        editingEpisodeIndex = null;
        lastRenderedYtId = null;
        const form = document.getElementById('podcast-episode-form');
        if (form) form.reset();

        const episodes = podcastsData.episodes || [];
        const nextNum = episodes.length + 1;
        setEpisodeFormValues({ episodeNumber: nextNum, slug: `aflevering-${nextNum}` });

        const heading = document.getElementById('pod-form-heading');
        if (heading) heading.textContent = 'Nieuwe Aflevering Toevoegen';
        const submitBtn = document.getElementById('pod-submit-btn');
        if (submitBtn) submitBtn.disabled = false;
        const submitText = document.getElementById('pod-submit-text');
        if (submitText) submitText.textContent = 'Aflevering Toevoegen';
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
        const updatedShow = { title, subtitle, platforms: { ...(spotify && { spotify }), ...(apple && { apple }), ...(youtube && { youtube }) } };
        let ok = true;
        if (window.adminApp && window.adminApp.saveData) ok = await window.adminApp.saveData('podcasts', { ...podcastsData, show: updatedShow });
        if (ok) podcastsData.show = updatedShow;
    }

    async function handleEpisodeSave(e) {
        e.preventDefault();
        const epNum = parseInt(document.getElementById('pod-num')?.value, 10) || 1;
        const slug = document.getElementById('pod-slug')?.value.trim() || `aflevering-${epNum}`;
        const title = document.getElementById('pod-title')?.value.trim();
        const desc = document.getElementById('pod-desc')?.value.trim();
        const date = document.getElementById('pod-date')?.value.trim();
        const orientation = document.getElementById('pod-orientation')?.value || 'portrait';
        const youtubeId = utils.extractYoutubeId(document.getElementById('pod-youtube')?.value.trim());

        if (!title) { alert('Vul een titel in voor de aflevering.'); return; }
        const platforms = {};
        const spotify = document.getElementById('pod-spotify')?.value.trim();
        const apple = document.getElementById('pod-apple')?.value.trim();
        if (youtubeId) platforms.youtube = `https://youtu.be/${youtubeId}`;
        if (spotify) platforms.spotify = spotify;
        if (apple) platforms.apple = apple;

        const newEpisode = { slug, episodeNumber: epNum, title, description: desc, orientation, ...(date && { date }), youtubeId, platforms };
        const updatedEpisodes = [...podcastsData.episodes];
        if (editingEpisodeIndex !== null) updatedEpisodes[editingEpisodeIndex] = newEpisode;
        else updatedEpisodes.unshift(newEpisode);

        const submitBtn = document.getElementById('pod-submit-btn');
        const submitText = document.getElementById('pod-submit-text');
        if (submitBtn) submitBtn.disabled = true;
        if (submitText) submitText.textContent = 'Bezig met opslaan...';

        let success = true;
        if (window.adminApp && window.adminApp.saveData) {
            success = await window.adminApp.saveData('podcasts', { ...podcastsData, episodes: updatedEpisodes });
        }

        if (success) {
            podcastsData.episodes = updatedEpisodes;
            resetEpisodeForm();
            renderEpisodesList();
        } else {
            if (submitBtn) submitBtn.disabled = false;
            if (submitText) submitText.textContent = editingEpisodeIndex !== null ? 'Aflevering Bijwerken' : 'Aflevering Toevoegen';
        }
    }

    async function remove(index) {
        const ep = podcastsData.episodes[index];
        const title = ep ? ep.title : `aflevering ${index + 1}`;
        if (!confirm(`Weet je zeker dat je "${title}" wilt verwijderen?`)) return;

        const updatedEpisodes = podcastsData.episodes.filter((_, i) => i !== index);
        let success = true;
        if (window.adminApp && window.adminApp.saveData) {
            success = await window.adminApp.saveData('podcasts', { ...podcastsData, episodes: updatedEpisodes });
        }
        if (success) {
            podcastsData.episodes = updatedEpisodes;
            if (editingEpisodeIndex === index) resetEpisodeForm();
            renderEpisodesList();
        }
    }

    function getData() { return podcastsData; }

    return { init, edit, remove, resetEpisodeForm, getData };
})();
