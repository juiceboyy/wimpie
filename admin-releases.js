/**
 * admin-releases.js - Beheer van muziekreleases voor Wimpie & de Domino's
 */

window.adminReleases = (function () {
    let releasesData = {};
    let editingSlug = null;
    let lastRenderedYtId = null;

    const utils = window.adminUtils || {
        escapeHtml: str => str || '',
        slugify: str => (str || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-'),
        extractYoutubeId: str => str || ''
    };

    function init(data) {
        releasesData = data || {};
        renderList();
        resetForm();
        setupListeners();
    }

    function renderList() {
        const container = document.getElementById('releases-list');
        if (!container) return;

        const slugs = Object.keys(releasesData);
        if (slugs.length === 0) {
            container.innerHTML = '<div class="p-6 text-center text-sm font-mono text-neutral-400">Nog geen releases aangemaakt.</div>';
            return;
        }

        container.innerHTML = slugs.map(slug => {
            const r = releasesData[slug] || {};
            const isEditing = editingSlug === slug;
            const safeSlug = utils.escapeHtml(slug);
            const safeTitle = utils.escapeHtml(r.title || 'Zonder titel');
            const safeBadge = utils.escapeHtml(r.badge || 'Single');
            const safeArtwork = utils.escapeHtml(r.artwork || '/single-cover.jpg');

            return `
                <div class="p-4 rounded-xl ${isEditing ? 'bg-[#C85A32]/10 shadow-[0_0_0_1px_rgba(200,90,50,0.5)]' : 'bg-[#181818] shadow-[0_0_0_1px_rgba(255,255,255,0.06)]'} flex items-center justify-between gap-4 transition">
                    <div class="flex items-center gap-3 min-w-0">
                        <img src="${safeArtwork}" alt="" class="w-12 h-12 rounded-lg object-cover bg-black shrink-0 shadow-sm" onerror="this.src='/single-cover.jpg'">
                        <div class="min-w-0">
                            <div class="flex items-center gap-2">
                                <h4 class="text-sm font-semibold text-white truncate">${safeTitle}</h4>
                                <span class="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-white/10 text-neutral-300">${safeBadge}</span>
                            </div>
                            <p class="text-xs font-mono text-neutral-400 truncate">/s/${safeSlug}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        <button type="button" data-edit-slug="${safeSlug}" class="rel-btn-edit h-8 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-mono uppercase text-white transition flex items-center gap-1">
                            <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
                            <span class="hidden sm:inline">Bewerk</span>
                        </button>
                        <button type="button" data-remove-slug="${safeSlug}" class="rel-btn-remove h-8 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-xs font-mono uppercase text-red-400 transition flex items-center gap-1">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.rel-btn-edit').forEach(btn => {
            btn.addEventListener('click', () => edit(btn.getAttribute('data-edit-slug')));
        });
        container.querySelectorAll('.rel-btn-remove').forEach(btn => {
            btn.addEventListener('click', () => remove(btn.getAttribute('data-remove-slug')));
        });

        if (window.adminApp && window.adminApp.refreshIcons) {
            window.adminApp.refreshIcons();
        }
    }

    function setupListeners() {
        const titleInput = document.getElementById('rel-title');
        const slugInput = document.getElementById('rel-slug');
        const ytInput = document.getElementById('rel-youtube');

        if (titleInput && slugInput) {
            titleInput.addEventListener('input', () => {
                if (!editingSlug) {
                    slugInput.value = utils.slugify(titleInput.value);
                }
                updatePreview();
            });
        }

        if (ytInput) {
            ytInput.addEventListener('input', () => {
                const extracted = utils.extractYoutubeId(ytInput.value);
                if (extracted && extracted !== ytInput.value.trim()) {
                    ytInput.value = extracted;
                }
                updatePreview();
            });
        }

        const previewFields = ['rel-slug', 'rel-artist', 'rel-badge', 'rel-description', 'rel-artwork', 'rel-spotify', 'rel-apple', 'rel-deezer'];
        previewFields.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', updatePreview);
        });

        const form = document.getElementById('releases-form');
        if (form) form.addEventListener('submit', handleSubmit);

        const cancelBtn = document.getElementById('rel-cancel-btn');
        if (cancelBtn) cancelBtn.addEventListener('click', resetForm);
    }

    function updatePreview() {
        const title = document.getElementById('rel-title')?.value || 'Titel van de Release';
        const artist = document.getElementById('rel-artist')?.value || "Wimpie & de Domino's";
        const badge = document.getElementById('rel-badge')?.value || 'Nieuwe Single';
        const description = document.getElementById('rel-description')?.value || 'Beschrijving van de single...';
        const artwork = document.getElementById('rel-artwork')?.value || '/single-cover.jpg';
        const ytId = utils.extractYoutubeId(document.getElementById('rel-youtube')?.value || '');

        const previewArtwork = document.getElementById('prev-rel-artwork');
        const previewBadge = document.getElementById('prev-rel-badge');
        const previewTitle = document.getElementById('prev-rel-title');
        const previewArtist = document.getElementById('prev-rel-artist');
        const previewDesc = document.getElementById('prev-rel-desc');
        const previewVideo = document.getElementById('prev-rel-video');

        if (previewArtwork) previewArtwork.src = artwork;
        if (previewBadge) previewBadge.textContent = badge;
        if (previewTitle) previewTitle.textContent = title;
        if (previewArtist) previewArtist.textContent = artist;
        if (previewDesc) previewDesc.textContent = description;

        if (previewVideo && ytId !== lastRenderedYtId) {
            lastRenderedYtId = ytId;
            if (ytId) {
                previewVideo.innerHTML = `<iframe class="w-full aspect-video rounded-xl bg-black" src="https://www.youtube-nocookie.com/embed/${ytId}" loading="lazy" allowfullscreen></iframe>`;
            } else {
                previewVideo.innerHTML = `<div class="aspect-video rounded-xl bg-black/40 shadow-[0_0_0_1px_rgba(255,255,255,0.06)] flex items-center justify-center text-xs font-mono text-neutral-400">Optionele YouTube videoclip</div>`;
            }
        }
    }

    function setFormValues(v = {}) {
        document.getElementById('rel-slug').value = v.slug || '';
        document.getElementById('rel-slug').readOnly = Boolean(v.slugReadOnly);
        document.getElementById('rel-title').value = v.title || '';
        document.getElementById('rel-artist').value = v.artist || "Wimpie & de Domino's";
        document.getElementById('rel-badge').value = v.badge || 'Nieuwe Single';
        document.getElementById('rel-description').value = v.description || '';
        document.getElementById('rel-artwork').value = v.artwork || '/single-cover.jpg';
        document.getElementById('rel-youtube').value = v.youtubeId || '';
        const p = v.platforms || {};
        document.getElementById('rel-spotify').value = p.spotify || '';
        document.getElementById('rel-apple').value = p.apple || '';
        document.getElementById('rel-deezer').value = p.deezer || '';
    }

    function edit(slug) {
        const item = releasesData[slug];
        if (!item) return;

        editingSlug = slug;
        setFormValues({ ...item, slug, slugReadOnly: true });

        const heading = document.getElementById('rel-form-heading');
        if (heading) heading.textContent = `Release bewerken: /s/${slug}`;
        const submitText = document.getElementById('rel-submit-text');
        if (submitText) submitText.textContent = 'Release Bijwerken';
        const cancelBtn = document.getElementById('rel-cancel-btn');
        if (cancelBtn) cancelBtn.classList.remove('hidden');

        renderList();
        updatePreview();
        document.getElementById('releases-form')?.scrollIntoView({ behavior: 'smooth' });
    }

    function resetForm() {
        editingSlug = null;
        lastRenderedYtId = null;
        const form = document.getElementById('releases-form');
        if (form) form.reset();
        setFormValues();

        const heading = document.getElementById('rel-form-heading');
        if (heading) heading.textContent = 'Nieuwe Release Toevoegen';
        const submitBtn = document.getElementById('rel-submit-btn');
        if (submitBtn) submitBtn.disabled = false;
        const submitText = document.getElementById('rel-submit-text');
        if (submitText) submitText.textContent = 'Release Toevoegen aan Lijst';
        const cancelBtn = document.getElementById('rel-cancel-btn');
        if (cancelBtn) cancelBtn.classList.add('hidden');

        renderList();
        updatePreview();
    }

    async function handleSubmit(e) {
        e.preventDefault();
        const rawSlug = document.getElementById('rel-slug')?.value.trim();
        const slug = utils.slugify(rawSlug);
        const title = document.getElementById('rel-title')?.value.trim();
        const artist = document.getElementById('rel-artist')?.value.trim() || "Wimpie & de Domino's";
        const badge = document.getElementById('rel-badge')?.value.trim() || 'Nieuwe Single';
        const description = document.getElementById('rel-description')?.value.trim();
        const artwork = document.getElementById('rel-artwork')?.value.trim() || '/single-cover.jpg';
        const rawYt = document.getElementById('rel-youtube')?.value.trim();
        const youtubeId = utils.extractYoutubeId(rawYt);

        if (!slug) {
            alert('Vul een geldige slug in (bijv. rozen).');
            return;
        }
        if (!title) {
            alert('Vul een titel in.');
            return;
        }

        if (!editingSlug && releasesData[slug]) {
            if (!confirm(`Release met slug "${slug}" bestaat al. Wil je deze overschrijven?`)) {
                return;
            }
        }

        const platforms = {};
        const spotify = document.getElementById('rel-spotify')?.value.trim();
        const apple = document.getElementById('rel-apple')?.value.trim();
        const deezer = document.getElementById('rel-deezer')?.value.trim();

        if (spotify) platforms.spotify = spotify;
        if (apple) platforms.apple = apple;
        if (deezer) platforms.deezer = deezer;
        if (youtubeId) platforms.youtube = `https://youtu.be/${youtubeId}`;

        const newRelease = {
            title,
            artist,
            badge,
            description,
            artwork,
            youtubeId: youtubeId || undefined,
            platforms
        };

        const updatedData = editingSlug
            ? { ...releasesData, [slug]: newRelease }
            : { [slug]: newRelease, ...releasesData };

        const submitBtn = document.getElementById('rel-submit-btn');
        const submitText = document.getElementById('rel-submit-text');
        if (submitBtn) submitBtn.disabled = true;
        if (submitText) submitText.textContent = 'Bezig met opslaan...';

        let success = true;
        if (window.adminApp && window.adminApp.saveData) {
            success = await window.adminApp.saveData('releases', updatedData);
        }

        if (success) {
            releasesData = updatedData;
            resetForm();
            renderList();
        } else {
            if (submitBtn) submitBtn.disabled = false;
            if (submitText) submitText.textContent = editingSlug ? 'Release Bijwerken' : 'Release Toevoegen aan Lijst';
        }
    }

    async function remove(slug) {
        if (!confirm(`Weet je zeker dat je de release "/s/${slug}" wilt verwijderen?`)) {
            return;
        }

        const updatedData = { ...releasesData };
        delete updatedData[slug];

        let success = true;
        if (window.adminApp && window.adminApp.saveData) {
            success = await window.adminApp.saveData('releases', updatedData);
        }

        if (success) {
            releasesData = updatedData;
            if (editingSlug === slug) resetForm();
            renderList();
        }
    }

    function getData() { return releasesData; }

    return { init, edit, remove, resetForm, getData };
})();
