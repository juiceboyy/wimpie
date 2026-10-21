/**
 * admin-podcasts.js - Beheer van videopodcasts voor Wimpie & de Domino's
 */

window.adminPodcasts = (function () {
    let podcastsData = { show: {}, episodes: [] };
    let editingEpisodeIndex = null;
    let lastRenderedYtId = null;
    let listenersAttached = false;
    let isSavingShow = false;
    let isSavingEpisode = false;

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
        const s = podcastsData.show || {}, p = s.platforms || {};
        const map = {
            'pod-show-title': s.title || 'De Wimpies Podcast',
            'pod-show-subtitle': s.subtitle || '',
            'pod-show-spotify': p.spotify || '',
            'pod-show-apple': p.apple || '',
            'pod-show-youtube': p.youtube || ''
        };
        Object.entries(map).forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.value = val; });
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
            const safeTitle = utils.escapeHtml(ep.title || 'Zonder titel'), safeSlug = utils.escapeHtml(ep.slug || ''), safeDate = utils.escapeHtml(ep.date || '');
            const cardBg = isEditing ? 'bg-[#C85A32]/10 shadow-[0_0_0_1px_rgba(200,90,50,0.5)]' : 'bg-[#181818] shadow-[0_0_0_1px_rgba(255,255,255,0.06)]';

            return `
                <div class="p-4 rounded-xl ${cardBg} flex items-center justify-between gap-4 transition">
                    <div class="min-w-0">
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-[#C85A32]/20 text-[#C85A32] font-semibold">${epNum}</span>
                            ${fmtBadge}<h4 class="text-sm font-semibold text-white truncate">${safeTitle}</h4>
                        </div>
                        <p class="text-xs font-mono text-neutral-400 truncate mt-0.5">${safeSlug ? `podcast.html#${safeSlug}` : ''} ${safeDate ? `&bull; ${safeDate}` : ''}</p>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        <button type="button" data-edit-idx="${idx}" class="pod-btn-edit h-8 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-mono uppercase text-white transition flex items-center gap-1"><i data-lucide="edit-2" class="w-3.5 h-3.5"></i><span class="hidden sm:inline">Bewerk</span></button>
                        <button type="button" data-remove-idx="${idx}" class="pod-btn-remove h-8 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-xs font-mono uppercase text-red-400 transition flex items-center gap-1"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                    </div>
                </div>`;
        }).join('');

        container.querySelectorAll('.pod-btn-edit').forEach(b => b.addEventListener('click', () => edit(parseInt(b.getAttribute('data-edit-idx'), 10))));
        container.querySelectorAll('.pod-btn-remove').forEach(b => b.addEventListener('click', () => remove(parseInt(b.getAttribute('data-remove-idx'), 10))));
        if (window.adminApp?.refreshIcons) window.adminApp.refreshIcons();
    }

    function setupListeners() {
        if (listenersAttached) return;
        const showForm = document.getElementById('podcast-show-form');
        const showSubmitBtn = document.getElementById('pod-show-submit-btn');
        const epForm = document.getElementById('podcast-episode-form');
        if (!showForm && !showSubmitBtn && !epForm) return;
        listenersAttached = true;

        if (showForm) showForm.addEventListener('submit', handleShowSave);
        if (showSubmitBtn) showSubmitBtn.addEventListener('click', handleShowSave);
        if (epForm) epForm.addEventListener('submit', handleEpisodeSave);
        document.getElementById('pod-cancel-btn')?.addEventListener('click', resetEpisodeForm);

        const numInput = document.getElementById('pod-num'), slugInput = document.getElementById('pod-slug');
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
            document.getElementById(id)?.addEventListener('input', updatePreview);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupListeners);
    } else {
        setupListeners();
    }

    function updatePreview() {
        const val = id => document.getElementById(id)?.value || '';
        const title = val('pod-title') || 'Titel van de Aflevering', desc = val('pod-desc') || 'Korte toelichting...';
        const num = val('pod-num') || '1', date = val('pod-date'), orientation = val('pod-orientation') || 'portrait';
        const isPortrait = orientation === 'portrait' || orientation === '9:16';
        const ytId = utils.extractYoutubeId(val('pod-youtube'));

        const txtMap = {
            'prev-pod-num': `Aflevering ${String(num).padStart(2, '0')}`,
            'prev-pod-date': date, 'prev-pod-title': title, 'prev-pod-desc': desc,
            'prev-pod-orientation-label': `Live Preview Podcast Card (${isPortrait ? '9:16 Staand' : '16:9 Liggend'})`
        };
        Object.entries(txtMap).forEach(([id, v]) => { const el = document.getElementById(id); if (el) el.textContent = v; });

        const prevFrame = document.getElementById('prev-pod-frame');
        if (prevFrame) {
            prevFrame.className = `${isPortrait ? 'w-full max-w-[260px] mx-auto aspect-[9/16]' : 'w-full max-w-full aspect-video'} rounded-xl overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.12)] bg-black transition-all duration-200`;
        }

        const prevVideo = document.getElementById('prev-pod-video');
        if (prevVideo && (ytId !== lastRenderedYtId || !prevVideo.innerHTML.includes(isPortrait ? '9:16' : '16:9'))) {
            lastRenderedYtId = ytId;
            prevVideo.innerHTML = ytId
                ? `<iframe class="w-full h-full rounded-xl" src="https://www.youtube-nocookie.com/embed/${ytId}" loading="lazy" allowfullscreen></iframe>`
                : `<div class="w-full h-full flex flex-col items-center justify-center text-xs font-mono text-neutral-400 p-4 text-center"><span>${isPortrait ? '9:16 Staande Video' : '16:9 Liggende Video'}</span><span class="text-[10px] text-neutral-500 mt-1">Vul YouTube ID of link in</span></div>`;
        }
    }

    function setEpisodeFormValues(ep = {}) {
        const pl = ep.platforms || {};
        const map = {
            'pod-num': ep.episodeNumber || 1, 'pod-slug': ep.slug || '', 'pod-title': ep.title || '',
            'pod-desc': ep.description || '', 'pod-date': ep.date || '',
            'pod-orientation': ep.orientation || (ep.episodeNumber && ep.episodeNumber <= 2 ? 'portrait' : 'landscape'),
            'pod-youtube': ep.youtubeId || '', 'pod-spotify': pl.spotify || '', 'pod-apple': pl.apple || ''
        };
        Object.entries(map).forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.value = val; });
    }

    function edit(index) {
        const ep = podcastsData.episodes[index];
        if (!ep) return;
        editingEpisodeIndex = index;
        setEpisodeFormValues(ep);

        const heading = document.getElementById('pod-form-heading');
        if (heading) heading.textContent = `Aflevering bewerken: #${ep.episodeNumber || index + 1}`;
        const submitText = document.getElementById('pod-submit-text');
        if (submitText) submitText.textContent = 'Aflevering Bijwerken';
        document.getElementById('pod-cancel-btn')?.classList.remove('hidden');

        renderEpisodesList();
        updatePreview();
        document.getElementById('podcast-episode-form')?.scrollIntoView({ behavior: 'smooth' });
    }

    function resetEpisodeForm() {
        editingEpisodeIndex = null;
        lastRenderedYtId = null;
        document.getElementById('podcast-episode-form')?.reset();
        const nextNum = (podcastsData.episodes || []).length + 1;
        setEpisodeFormValues({ episodeNumber: nextNum, slug: `aflevering-${nextNum}` });

        const heading = document.getElementById('pod-form-heading');
        if (heading) heading.textContent = 'Nieuwe Aflevering Toevoegen';
        const submitBtn = document.getElementById('pod-submit-btn');
        if (submitBtn) submitBtn.disabled = false;
        const submitText = document.getElementById('pod-submit-text');
        if (submitText) submitText.textContent = 'Aflevering Toevoegen';
        document.getElementById('pod-cancel-btn')?.classList.add('hidden');

        renderEpisodesList();
        updatePreview();
    }

    async function handleShowSave(e) {
        if (e && e.preventDefault) e.preventDefault();
        if (isSavingShow) return;

        const val = id => document.getElementById(id)?.value.trim() || '';
        const title = val('pod-show-title') || 'De Wimpies Podcast', subtitle = val('pod-show-subtitle');
        const spotify = val('pod-show-spotify'), apple = val('pod-show-apple'), youtube = val('pod-show-youtube');
        const updatedShow = {
            title, subtitle,
            platforms: { ...(spotify && { spotify }), ...(apple && { apple }), ...(youtube && { youtube }) }
        };

        const submitBtn = document.getElementById('pod-show-submit-btn');
        const origText = submitBtn ? submitBtn.textContent : 'Show Instellingen Opslaan';
        isSavingShow = true;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Bezig met opslaan...';
        }

        try {
            let ok = true;
            if (window.adminApp?.saveData) {
                ok = await window.adminApp.saveData('podcasts', { ...podcastsData, show: updatedShow });
            }
            if (ok) {
                podcastsData.show = updatedShow;
                populateShowSettings();
            }
        } finally {
            isSavingShow = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = origText;
            }
        }
    }

    async function handleEpisodeSave(e) {
        if (e && e.preventDefault) e.preventDefault();
        if (isSavingEpisode) return;

        const val = id => document.getElementById(id)?.value.trim() || '';
        const epNum = parseInt(val('pod-num'), 10) || 1, slug = val('pod-slug') || `aflevering-${epNum}`;
        const title = val('pod-title'), desc = val('pod-desc'), date = val('pod-date');
        const orientation = document.getElementById('pod-orientation')?.value || 'portrait';
        const youtubeId = utils.extractYoutubeId(val('pod-youtube'));

        if (!title) { alert('Vul een titel in voor de aflevering.'); return; }

        const platforms = {};
        const spotify = val('pod-spotify'), apple = val('pod-apple');
        if (youtubeId) platforms.youtube = `https://youtu.be/${youtubeId}`;
        if (spotify) platforms.spotify = spotify;
        if (apple) platforms.apple = apple;

        const newEpisode = { slug, episodeNumber: epNum, title, description: desc, orientation, ...(date && { date }), youtubeId, platforms };
        const updatedEpisodes = [...podcastsData.episodes];
        if (editingEpisodeIndex !== null) updatedEpisodes[editingEpisodeIndex] = newEpisode;
        else updatedEpisodes.unshift(newEpisode);

        const submitBtn = document.getElementById('pod-submit-btn');
        const submitText = document.getElementById('pod-submit-text');
        isSavingEpisode = true;
        if (submitBtn) submitBtn.disabled = true;
        if (submitText) submitText.textContent = 'Bezig met opslaan...';

        try {
            let success = true;
            if (window.adminApp?.saveData) {
                success = await window.adminApp.saveData('podcasts', { ...podcastsData, episodes: updatedEpisodes });
            }
            if (success) {
                podcastsData.episodes = updatedEpisodes;
                resetEpisodeForm();
                renderEpisodesList();
            }
        } finally {
            isSavingEpisode = false;
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
        if (window.adminApp?.saveData) {
            success = await window.adminApp.saveData('podcasts', { ...podcastsData, episodes: updatedEpisodes });
        }
        if (success) {
            podcastsData.episodes = updatedEpisodes;
            if (editingEpisodeIndex === index) resetEpisodeForm();
            renderEpisodesList();
        }
    }

    function getData() { return podcastsData; }

    return { init, edit, remove, resetEpisodeForm, getData, handleShowSave };
})();
