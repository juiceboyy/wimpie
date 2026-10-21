/**
 * admin-releases.js - Beheer van muziekreleases voor Wimpie & de Domino's
 */

window.adminReleases = (function () {
    let releasesData = {};
    let editingSlug = null;

    function slugify(text) {
        return (text || '')
            .toString()
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')
            .replace(/[^\w\-]+/g, '')
            .replace(/\-\-+/g, '-')
            .replace(/^-+/, '')
            .replace(/-+$/, '');
    }

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
            const r = releasesData[slug];
            const isEditing = editingSlug === slug;
            return `
                <div class="p-4 rounded-xl ${isEditing ? 'bg-[#C85A32]/10 shadow-[0_0_0_1px_rgba(200,90,50,0.5)]' : 'bg-[#181818] shadow-[0_0_0_1px_rgba(255,255,255,0.06)]'} flex items-center justify-between gap-4 transition">
                    <div class="flex items-center gap-3 min-w-0">
                        <img src="${r.artwork || '/single-cover.jpg'}" alt="" class="w-12 h-12 rounded-lg object-cover bg-black shrink-0 shadow-sm" onerror="this.src='/single-cover.jpg'">
                        <div class="min-w-0">
                            <div class="flex items-center gap-2">
                                <h4 class="text-sm font-semibold text-white truncate">${r.title || 'Zonder titel'}</h4>
                                <span class="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-white/10 text-neutral-300">${r.badge || 'Single'}</span>
                            </div>
                            <p class="text-xs font-mono text-neutral-400 truncate">/s/${slug}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        <button type="button" onclick="adminReleases.edit('${slug}')" class="h-8 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-mono uppercase text-white transition flex items-center gap-1">
                            <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
                            <span class="hidden sm:inline">Bewerk</span>
                        </button>
                        <button type="button" onclick="adminReleases.remove('${slug}')" class="h-8 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-xs font-mono uppercase text-red-400 transition flex items-center gap-1">
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
        const titleInput = document.getElementById('rel-title');
        const slugInput = document.getElementById('rel-slug');
        const ytInput = document.getElementById('rel-youtube');

        if (titleInput && slugInput) {
            titleInput.addEventListener('input', () => {
                if (!editingSlug) {
                    slugInput.value = slugify(titleInput.value);
                }
                updatePreview();
            });
        }

        if (ytInput) {
            ytInput.addEventListener('input', () => {
                const extracted = extractYoutubeId(ytInput.value);
                if (extracted && extracted !== ytInput.value.trim()) {
                    ytInput.value = extracted;
                }
                updatePreview();
            });
        }

        const previewFields = ['rel-artist', 'rel-badge', 'rel-description', 'rel-artwork', 'rel-spotify', 'rel-apple', 'rel-deezer'];
        previewFields.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', updatePreview);
        });

        const form = document.getElementById('releases-form');
        if (form) {
            form.addEventListener('submit', handleSubmit);
        }

        const cancelBtn = document.getElementById('rel-cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', resetForm);
        }
    }

    function updatePreview() {
        const title = document.getElementById('rel-title')?.value || 'Titel van de Release';
        const artist = document.getElementById('rel-artist')?.value || "Wimpie & de Domino's";
        const badge = document.getElementById('rel-badge')?.value || 'Nieuwe Single';
        const description = document.getElementById('rel-description')?.value || 'Beschrijving van de single...';
        const artwork = document.getElementById('rel-artwork')?.value || '/single-cover.jpg';
        const ytId = extractYoutubeId(document.getElementById('rel-youtube')?.value || '');

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

        if (previewVideo) {
            if (ytId) {
                previewVideo.innerHTML = `<iframe class="w-full aspect-video rounded-xl bg-black" src="https://www.youtube-nocookie.com/embed/${ytId}" loading="lazy" allowfullscreen></iframe>`;
            } else {
                previewVideo.innerHTML = `<div class="aspect-video rounded-xl bg-black/40 shadow-[0_0_0_1px_rgba(255,255,255,0.06)] flex items-center justify-center text-xs font-mono text-neutral-400">Optionele YouTube videoclip</div>`;
            }
        }
    }

    function edit(slug) {
        const item = releasesData[slug];
        if (!item) return;

        editingSlug = slug;
        document.getElementById('rel-slug').value = slug;
        document.getElementById('rel-slug').readOnly = true;
        document.getElementById('rel-title').value = item.title || '';
        document.getElementById('rel-artist').value = item.artist || "Wimpie & de Domino's";
        document.getElementById('rel-badge').value = item.badge || 'Nieuwe Single';
        document.getElementById('rel-description').value = item.description || '';
        document.getElementById('rel-artwork').value = item.artwork || '/single-cover.jpg';
        document.getElementById('rel-youtube').value = item.youtubeId || '';

        const platforms = item.platforms || {};
        document.getElementById('rel-spotify').value = platforms.spotify || '';
        document.getElementById('rel-apple').value = platforms.apple || '';
        document.getElementById('rel-deezer').value = platforms.deezer || '';

        document.getElementById('rel-form-heading').textContent = `Release bewerken: /s/${slug}`;
        document.getElementById('rel-submit-btn').textContent = 'Release Bijwerken';
        document.getElementById('rel-cancel-btn').classList.remove('hidden');

        renderList();
        updatePreview();
        document.getElementById('releases-form')?.scrollIntoView({ behavior: 'smooth' });
    }

    function resetForm() {
        editingSlug = null;
        const form = document.getElementById('releases-form');
        if (form) form.reset();

        const slugField = document.getElementById('rel-slug');
        if (slugField) {
            slugField.readOnly = false;
            slugField.value = '';
        }
        const artistField = document.getElementById('rel-artist');
        if (artistField) artistField.value = "Wimpie & de Domino's";
        const artworkField = document.getElementById('rel-artwork');
        if (artworkField) artworkField.value = '/single-cover.jpg';
        const badgeField = document.getElementById('rel-badge');
        if (badgeField) badgeField.value = 'Nieuwe Single';

        const heading = document.getElementById('rel-form-heading');
        if (heading) heading.textContent = 'Nieuwe Release Toevoegen';
        const submitBtn = document.getElementById('rel-submit-btn');
        if (submitBtn) submitBtn.textContent = 'Release Toevoegen aan Lijst';
        const cancelBtn = document.getElementById('rel-cancel-btn');
        if (cancelBtn) cancelBtn.classList.add('hidden');

        renderList();
        updatePreview();
    }

    async function handleSubmit(e) {
        e.preventDefault();
        const rawSlug = document.getElementById('rel-slug')?.value.trim();
        const slug = slugify(rawSlug);
        const title = document.getElementById('rel-title')?.value.trim();
        const artist = document.getElementById('rel-artist')?.value.trim() || "Wimpie & de Domino's";
        const badge = document.getElementById('rel-badge')?.value.trim() || 'Nieuwe Single';
        const description = document.getElementById('rel-description')?.value.trim();
        const artwork = document.getElementById('rel-artwork')?.value.trim() || '/single-cover.jpg';
        const rawYt = document.getElementById('rel-youtube')?.value.trim();
        const youtubeId = extractYoutubeId(rawYt);

        if (!slug) {
            alert('Vul een geldige slug in (bijv. rozen).');
            return;
        }
        if (!title) {
            alert('Vul een titel in.');
            return;
        }

        const platforms = {};
        const spotify = document.getElementById('rel-spotify')?.value.trim();
        const apple = document.getElementById('rel-apple')?.value.trim();
        const deezer = document.getElementById('rel-deezer')?.value.trim();

        if (spotify) platforms.spotify = spotify;
        if (apple) platforms.apple = apple;
        if (deezer) platforms.deezer = deezer;
        if (youtubeId) platforms.youtube = `https://youtu.be/${youtubeId}`;

        releasesData[slug] = {
            title,
            artist,
            badge,
            description,
            artwork,
            youtubeId: youtubeId || undefined,
            platforms
        };

        resetForm();
        renderList();

        if (window.adminApp && window.adminApp.saveData) {
            await window.adminApp.saveData('releases', releasesData);
        }
    }

    async function remove(slug) {
        if (!confirm(`Weet je zeker dat je de release "/s/${slug}" wilt verwijderen?`)) {
            return;
        }
        delete releasesData[slug];
        if (editingSlug === slug) resetForm();
        renderList();

        if (window.adminApp && window.adminApp.saveData) {
            await window.adminApp.saveData('releases', releasesData);
        }
    }

    function getData() {
        return releasesData;
    }

    return {
        init,
        edit,
        remove,
        resetForm,
        getData
    };
})();
