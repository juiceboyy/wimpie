/**
 * admin-releases.js - Beheer van muziekreleases voor Wimpie & de Domino's
 */

window.adminReleases = (function () {
    let releasesData = {};
    let editingSlug = null;
    let lastRenderedYtId = null;
    let lastLookedUpYtId = null;
    let listenersBound = false;

    const utils = window.adminUtils || {
        escapeHtml: str => str || '',
        slugify: str => (str || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-'),
        extractYoutubeId: str => str || ''
    };
    const byId = id => document.getElementById(id);
    const setText = (id, text) => { const el = byId(id); if (el) el.textContent = text; };

    function init(data) {
        releasesData = data || {};
        renderList();
        resetForm();
        if (!listenersBound) {
            setupListeners();
            listenersBound = true;
        }
    }

    function renderList() {
        const container = byId('releases-list');
        if (!container) return;

        const slugs = Object.keys(releasesData);
        if (slugs.length === 0) {
            container.innerHTML = '<div class="p-6 text-center text-sm font-mono text-neutral-400">Nog geen releases aangemaakt.</div>';
            return;
        }

        container.innerHTML = slugs.map(slug => {
            const r = releasesData[slug] || {};
            const cardCls = editingSlug === slug
                ? 'bg-[#C85A32]/10 shadow-[0_0_0_1px_rgba(200,90,50,0.5)]'
                : 'bg-[#181818] shadow-[0_0_0_1px_rgba(255,255,255,0.06)]';
            const safeSlug = utils.escapeHtml(slug);
            const safeTitle = utils.escapeHtml(r.title || 'Zonder titel');
            const safeBadge = utils.escapeHtml(r.badge || 'Single');
            const safeArtwork = utils.escapeHtml(r.artwork || '/single-cover.jpg');

            return `<div class="p-4 rounded-xl ${cardCls} flex items-center justify-between gap-4 transition">
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
                    <button type="button" data-edit-slug="${safeSlug}" class="rel-btn-edit h-8 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-mono uppercase text-white transition flex items-center gap-1"><i data-lucide="edit-2" class="w-3.5 h-3.5"></i><span class="hidden sm:inline">Bewerk</span></button>
                    <button type="button" data-remove-slug="${safeSlug}" class="rel-btn-remove h-8 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-xs font-mono uppercase text-red-400 transition flex items-center gap-1"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                </div>
            </div>`;
        }).join('');

        container.querySelectorAll('.rel-btn-edit').forEach(btn => btn.addEventListener('click', () => edit(btn.getAttribute('data-edit-slug'))));
        container.querySelectorAll('.rel-btn-remove').forEach(btn => btn.addEventListener('click', () => remove(btn.getAttribute('data-remove-slug'))));
        window.adminApp?.refreshIcons?.();
    }

    function applyLookupResult(result, force) {
        const titleEl = byId('rel-title');
        const slugEl = byId('rel-slug');
        const descEl = byId('rel-description');

        if (result.title && titleEl && !titleEl.value.trim()) {
            titleEl.value = result.title;
            if (!editingSlug && slugEl && !slugEl.value.trim()) slugEl.value = utils.slugify(result.title);
            if (descEl && !descEl.value.trim()) {
                const art = result.artist || byId('rel-artist')?.value.trim() || "Wimpie & de Domino's";
                descEl.value = `Beluister de nieuwe single '${result.title}' van ${art} op Spotify, Apple Music en YouTube.`;
            }
        }

        const found = [];
        for (const [key, id, label] of [['spotify', 'rel-spotify', 'Spotify'], ['apple', 'rel-apple', 'Apple Music']]) {
            const el = byId(id);
            const url = result.platforms && result.platforms[key];
            if (el && url && (force || !el.value.trim() || el.dataset?.autoFilled === '1')) {
                el.value = url;
                if (el.dataset) el.dataset.autoFilled = '1';
                found.push(label);
            }
        }

        updatePreview();
        if (found.length > 0) {
            window.adminApp.showToast(`Links ingevuld: ${found.join(', ')}`, 'success');
        } else if (force) {
            window.adminApp.showToast('Geen Spotify of Apple Music links gevonden.', 'error');
        }
    }

    async function autoFillPlatformLinks({ youtubeId = '', title = '', force = false } = {}) {
        if (!window.adminApp?.lookupRelease) return;
        const lookupBtn = byId('rel-lookup-btn');

        if (youtubeId) lastLookedUpYtId = youtubeId;
        if (lookupBtn) lookupBtn.disabled = true;
        setText('rel-lookup-text', 'Links zoeken...');

        try {
            const result = await window.adminApp.lookupRelease({
                youtubeId,
                title: title || byId('rel-title')?.value.trim() || '',
                artist: byId('rel-artist')?.value.trim() || ''
            });
            const currentYtId = utils.extractYoutubeId(byId('rel-youtube')?.value || '');
            if (youtubeId && currentYtId && currentYtId !== youtubeId) return;
            applyLookupResult(result, force);
        } catch (err) {
            if (force) window.adminApp.showToast(err.message, 'error');
        } finally {
            if (lookupBtn) lookupBtn.disabled = false;
            setText('rel-lookup-text', 'Links automatisch invullen');
        }
    }

    function setupListeners() {
        const titleInput = byId('rel-title');
        const slugInput = byId('rel-slug');
        const ytInput = byId('rel-youtube');

        if (titleInput && slugInput) {
            titleInput.addEventListener('input', () => {
                if (!editingSlug) slugInput.value = utils.slugify(titleInput.value);
                updatePreview();
            });
        }

        if (ytInput) {
            ytInput.addEventListener('input', () => {
                const extracted = utils.extractYoutubeId(ytInput.value);
                if (extracted && extracted !== ytInput.value.trim()) ytInput.value = extracted;
                updatePreview();
                if (extracted && extracted !== lastLookedUpYtId) autoFillPlatformLinks({ youtubeId: extracted });
            });
        }

        byId('rel-lookup-btn')?.addEventListener('click', () => {
            const ytId = utils.extractYoutubeId(ytInput?.value || '');
            const title = titleInput?.value.trim() || '';
            if (!ytId && !title) return window.adminApp?.showToast('Vul eerst een YouTube link of titel in.', 'error');
            autoFillPlatformLinks({ youtubeId: ytId, title, force: true });
        });

        ['rel-slug', 'rel-artist', 'rel-badge', 'rel-description', 'rel-artwork', 'rel-spotify', 'rel-apple'].forEach(id => {
            const el = byId(id);
            if (el) el.addEventListener('input', () => {
                if (el.dataset) delete el.dataset.autoFilled;
                updatePreview();
            });
        });

        byId('releases-form')?.addEventListener('submit', handleSubmit);
        byId('rel-cancel-btn')?.addEventListener('click', resetForm);
    }

    function updatePreview() {
        const previewArtwork = byId('prev-rel-artwork');
        if (previewArtwork) previewArtwork.src = byId('rel-artwork')?.value || '/single-cover.jpg';
        setText('prev-rel-badge', byId('rel-badge')?.value || 'Nieuwe Single');
        setText('prev-rel-title', byId('rel-title')?.value || 'Titel van de Release');
        setText('prev-rel-artist', byId('rel-artist')?.value || "Wimpie & de Domino's");
        setText('prev-rel-desc', byId('rel-description')?.value || 'Beschrijving van de single...');

        const ytId = utils.extractYoutubeId(byId('rel-youtube')?.value || '');
        const previewVideo = byId('prev-rel-video');
        if (previewVideo && ytId !== lastRenderedYtId) {
            lastRenderedYtId = ytId;
            previewVideo.innerHTML = ytId
                ? `<iframe class="w-full aspect-video rounded-xl bg-black" src="https://www.youtube-nocookie.com/embed/${ytId}" loading="lazy" allowfullscreen></iframe>`
                : `<div class="aspect-video rounded-xl bg-black/40 shadow-[0_0_0_1px_rgba(255,255,255,0.06)] flex items-center justify-center text-xs font-mono text-neutral-400">Optionele YouTube videoclip</div>`;
        }
    }

    function setFormValues(v = {}) {
        const p = v.platforms || {};
        const fields = [
            ['rel-slug', v.slug], ['rel-title', v.title],
            ['rel-artist', v.artist || "Wimpie & de Domino's"], ['rel-badge', v.badge || 'Nieuwe Single'],
            ['rel-description', v.description], ['rel-artwork', v.artwork || '/single-cover.jpg'],
            ['rel-youtube', v.youtubeId], ['rel-spotify', p.spotify], ['rel-apple', p.apple]
        ];
        fields.forEach(([id, value]) => {
            const el = byId(id);
            if (!el) return;
            el.value = value || '';
            if (el.dataset) delete el.dataset.autoFilled;
        });
        const slugEl = byId('rel-slug');
        if (slugEl) slugEl.readOnly = Boolean(v.slugReadOnly);
    }

    function edit(slug) {
        const item = releasesData[slug];
        if (!item) return;

        editingSlug = slug;
        lastLookedUpYtId = item.youtubeId || null;
        setFormValues({ ...item, slug, slugReadOnly: true });
        setText('rel-form-heading', `Release bewerken: /s/${slug}`);
        setText('rel-submit-text', 'Release Bijwerken');
        byId('rel-cancel-btn')?.classList.remove('hidden');

        renderList();
        updatePreview();
        byId('releases-form')?.scrollIntoView({ behavior: 'smooth' });
    }

    function resetForm() {
        editingSlug = null;
        lastRenderedYtId = null;
        lastLookedUpYtId = null;
        byId('releases-form')?.reset();
        setFormValues();
        setText('rel-form-heading', 'Nieuwe Release Toevoegen');
        const submitBtn = byId('rel-submit-btn');
        if (submitBtn) submitBtn.disabled = false;
        setText('rel-submit-text', 'Release Toevoegen aan Lijst');
        byId('rel-cancel-btn')?.classList.add('hidden');

        renderList();
        updatePreview();
    }

    async function handleSubmit(e) {
        e.preventDefault();
        const slug = utils.slugify(byId('rel-slug')?.value.trim());
        const title = byId('rel-title')?.value.trim();
        const artist = byId('rel-artist')?.value.trim() || "Wimpie & de Domino's";
        const badge = byId('rel-badge')?.value.trim() || 'Nieuwe Single';
        const description = byId('rel-description')?.value.trim();
        const artwork = byId('rel-artwork')?.value.trim() || '/single-cover.jpg';
        const youtubeId = utils.extractYoutubeId(byId('rel-youtube')?.value.trim());

        if (!slug) return alert('Vul een geldige slug in (bijv. rozen).');
        if (!title) return alert('Vul een titel in.');
        if (!editingSlug && releasesData[slug] && !confirm(`Release met slug "${slug}" bestaat al. Wil je deze overschrijven?`)) return;

        const platforms = {};
        [['spotify', 'rel-spotify'], ['apple', 'rel-apple']].forEach(([key, id]) => {
            const val = byId(id)?.value.trim();
            if (val) platforms[key] = val;
        });
        if (youtubeId) platforms.youtube = `https://youtu.be/${youtubeId}`;

        const newRelease = { title, artist, badge, description, artwork, youtubeId: youtubeId || undefined, platforms };
        const updatedData = editingSlug ? { ...releasesData, [slug]: newRelease } : { [slug]: newRelease, ...releasesData };

        const submitBtn = byId('rel-submit-btn');
        if (submitBtn) submitBtn.disabled = true;
        setText('rel-submit-text', 'Bezig met opslaan...');

        let success = true;
        if (window.adminApp?.saveData) success = await window.adminApp.saveData('releases', updatedData);

        if (success) {
            releasesData = updatedData;
            resetForm();
            renderList();
        } else {
            if (submitBtn) submitBtn.disabled = false;
            setText('rel-submit-text', editingSlug ? 'Release Bijwerken' : 'Release Toevoegen aan Lijst');
        }
    }

    async function remove(slug) {
        if (!confirm(`Weet je zeker dat je de release "/s/${slug}" wilt verwijderen?`)) return;
        const updatedData = { ...releasesData };
        delete updatedData[slug];

        let success = true;
        if (window.adminApp?.saveData) success = await window.adminApp.saveData('releases', updatedData);
        if (success) {
            releasesData = updatedData;
            if (editingSlug === slug) resetForm();
            renderList();
        }
    }

    function getData() { return releasesData; }

    return { init, edit, remove, resetForm, getData, autoFillPlatformLinks };
})();
