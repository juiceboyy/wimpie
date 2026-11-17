/**
 * admin-shows.js - Beheer van live shows & ticketverkoop voor Wimpie & de Domino's
 */

window.adminShows = (function () {
    let showsData = { shows: [] };
    let editingIndex = null;
    let listenersAttached = false;
    let isSaving = false;

    const utils = window.adminUtils || {
        escapeHtml: str => str || '',
        slugify: str => (str || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-')
    };

    const STATUS_LABELS = {
        available: { text: 'Beschikbaar', cls: 'bg-emerald-500/10 text-emerald-400' },
        few_left: { text: 'Laatste kaarten', cls: 'bg-amber-500/15 text-amber-300' },
        sold_out: { text: 'Uitverkocht', cls: 'bg-red-500/10 text-red-400' },
        hidden: { text: 'Verborgen', cls: 'bg-white/10 text-neutral-400' }
    };

    function formatPrice(val) {
        return `€ ${Number(val || 0).toFixed(2).replace('.', ',')}`;
    }

    function ensureTabMarkup() {
        const container = document.getElementById('tab-shows');
        if (!container || container.dataset.rendered === '1') return;
        container.dataset.rendered = '1';
        container.innerHTML = `
            <div class="lg:col-span-7 space-y-6">
                <form id="shows-form" onsubmit="event.preventDefault(); return false;" class="bg-[#141414] rounded-2xl p-6 sm:p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] space-y-5">
                    <div class="flex items-center justify-between pb-3 border-b border-white/5">
                        <h2 id="show-form-heading" class="font-serif text-xl sm:text-2xl font-semibold text-white">Nieuwe Show Toevoegen</h2>
                        <button type="button" id="show-cancel-btn" class="hidden text-xs font-mono text-neutral-400 hover:text-white transition">Annuleren</button>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div><label for="show-title" class="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1.5">Show Titel *</label><input type="text" id="show-title" required placeholder="Wimpie &amp; de Domino's Live" class="w-full h-11 px-3.5 rounded-xl bg-black/50 text-white text-sm shadow-[0_0_0_1px_rgba(255,255,255,0.1)] focus:outline-none focus:ring-2 focus:ring-white"></div>
                        <div><label for="show-slug" class="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1.5">URL Slug *</label><input type="text" id="show-slug" required placeholder="show-8-januari" class="w-full h-11 px-3.5 rounded-xl bg-black/50 text-white text-sm font-mono shadow-[0_0_0_1px_rgba(255,255,255,0.1)] focus:outline-none focus:ring-2 focus:ring-white"></div>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div><label for="show-date" class="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1.5">Datum *</label><input type="text" id="show-date" required placeholder="bijv. 8 januari 2027" class="w-full h-11 px-3.5 rounded-xl bg-black/50 text-white text-sm shadow-[0_0_0_1px_rgba(255,255,255,0.1)] focus:outline-none focus:ring-2 focus:ring-white"></div>
                        <div><label for="show-time" class="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1.5">Tijd / Deuren</label><input type="text" id="show-time" placeholder="bijv. Deuren 19:30, aanvang 20:00" class="w-full h-11 px-3.5 rounded-xl bg-black/50 text-white text-sm shadow-[0_0_0_1px_rgba(255,255,255,0.1)] focus:outline-none focus:ring-2 focus:ring-white"></div>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div><label for="show-location" class="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1.5">Locatie / Zaal</label><input type="text" id="show-location" placeholder="bijv. Tolhuistuin" class="w-full h-11 px-3.5 rounded-xl bg-black/50 text-white text-sm shadow-[0_0_0_1px_rgba(255,255,255,0.1)] focus:outline-none focus:ring-2 focus:ring-white"></div>
                        <div><label for="show-address" class="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1.5">Adres / Stad</label><input type="text" id="show-address" placeholder="bijv. Amsterdam" class="w-full h-11 px-3.5 rounded-xl bg-black/50 text-white text-sm shadow-[0_0_0_1px_rgba(255,255,255,0.1)] focus:outline-none focus:ring-2 focus:ring-white"></div>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div><label for="show-price" class="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1.5">Ticketprijs (EUR) *</label><input type="number" id="show-price" step="0.50" min="0" required placeholder="7.50" class="w-full h-11 px-3.5 rounded-xl bg-black/50 text-white text-sm font-mono shadow-[0_0_0_1px_rgba(255,255,255,0.1)] focus:outline-none focus:ring-2 focus:ring-white"></div>
                        <div><label for="show-status" class="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1.5">Beschikbaarheid</label><select id="show-status" class="w-full h-11 px-3 rounded-xl bg-black/50 text-white text-xs font-mono shadow-[0_0_0_1px_rgba(255,255,255,0.1)] focus:outline-none focus:ring-2 focus:ring-white"><option value="available">Beschikbaar</option><option value="few_left">Laatste kaarten</option><option value="sold_out">Uitverkocht</option><option value="hidden">Verborgen (concept)</option></select></div>
                    </div>
                    <div><label for="show-desc" class="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1.5">Korte beschrijving</label><textarea id="show-desc" rows="2" placeholder="Informatie over de show..." class="w-full p-3 rounded-xl bg-black/50 text-white text-sm shadow-[0_0_0_1px_rgba(255,255,255,0.1)] focus:outline-none focus:ring-2 focus:ring-white"></textarea></div>
                    <button type="submit" id="show-submit-btn" class="w-full h-12 rounded-xl bg-[#C85A32] hover:bg-[#B34E2A] text-white text-xs font-mono uppercase tracking-wider font-semibold shadow-[0_0_0_1px_rgba(200,90,50,0.5)] transition flex items-center justify-center gap-2">
                        <i data-lucide="plus-circle" class="w-4 h-4"></i><span id="show-submit-text">Show Toevoegen</span>
                    </button>
                </form>
                <div class="bg-[#141414] rounded-2xl p-6 sm:p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] space-y-4">
                    <h3 class="font-serif text-lg font-semibold text-white">Geplande Shows</h3>
                    <div id="shows-list" class="space-y-2"></div>
                </div>
            </div>
            <div class="lg:col-span-5 sticky top-20 space-y-4">
                <span class="text-xs font-mono uppercase tracking-wider text-neutral-400 block">Live Preview Showkaart (/tickets)</span>
                <div class="bg-[#141414] rounded-2xl p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.12)] space-y-4">
                    <div class="flex items-center justify-between text-xs font-mono"><span id="prev-show-date" class="text-[#C85A32] uppercase tracking-wider">8 januari 2027</span><span id="prev-show-status" class="px-2.5 py-0.5 rounded-full text-[11px] uppercase bg-emerald-500/10 text-emerald-400">Beschikbaar</span></div>
                    <div class="flex items-baseline justify-between gap-3"><h3 id="prev-show-title" class="font-serif text-2xl font-semibold text-white">Wimpie &amp; de Domino's Live</h3><span id="prev-show-price" class="font-serif text-2xl font-semibold text-white shrink-0">€ 7,50</span></div>
                    <p id="prev-show-meta" class="text-xs font-mono text-neutral-400">Locatie volgt &bull; Aanvangstijd volgt</p>
                    <p id="prev-show-desc" class="text-neutral-300 text-xs leading-relaxed">Korte beschrijving...</p>
                    <div class="p-3 rounded-xl bg-black/40 shadow-[0_0_0_1px_rgba(255,255,255,0.06)] space-y-1">
                        <span class="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block">Voorbeeld bunq.me link (1 kaart)</span>
                        <p id="prev-show-bunq" class="text-xs font-mono text-[#C85A32] break-all">https://bunq.me/Wimpie/7.50</p>
                    </div>
                </div>
            </div>`;
    }

    function init(data) {
        ensureTabMarkup();
        showsData = (data && Array.isArray(data.shows)) ? { shows: data.shows } : { shows: [] };
        renderList();
        resetForm();
        setupListeners();
    }

    function renderList() {
        const container = document.getElementById('shows-list');
        if (!container) return;
        const shows = showsData.shows || [];
        if (shows.length === 0) {
            container.innerHTML = '<div class="p-6 text-center text-sm font-mono text-neutral-400">Nog geen shows toegevoegd.</div>';
            return;
        }
        container.innerHTML = shows.map((s, idx) => {
            const isEditing = editingIndex === idx;
            const st = STATUS_LABELS[s.status] || STATUS_LABELS.available;
            const cardBg = isEditing ? 'bg-[#C85A32]/10 shadow-[0_0_0_1px_rgba(200,90,50,0.5)]' : 'bg-[#181818] shadow-[0_0_0_1px_rgba(255,255,255,0.06)]';
            return `
                <div class="p-4 rounded-xl ${cardBg} flex items-center justify-between gap-4 transition">
                    <div class="min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-xs font-mono text-[#C85A32] uppercase">${utils.escapeHtml(s.date)}</span>
                            <span class="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full ${st.cls}">${st.text}</span>
                            <span class="text-xs font-mono text-white font-semibold">${formatPrice(s.price)}</span>
                        </div>
                        <h4 class="text-sm font-semibold text-white truncate mt-1">${utils.escapeHtml(s.title)}</h4>
                        <p class="text-xs font-mono text-neutral-400 truncate">${utils.escapeHtml(s.location || 'Locatie volgt')} - ${utils.escapeHtml(s.time || 'Tijd volgt')}</p>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        <button type="button" data-edit-show="${idx}" class="show-btn-edit h-8 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-mono uppercase text-white transition flex items-center gap-1"><i data-lucide="edit-2" class="w-3.5 h-3.5"></i><span class="hidden sm:inline">Bewerk</span></button>
                        <button type="button" data-remove-show="${idx}" class="show-btn-remove h-8 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-xs font-mono uppercase text-red-400 transition flex items-center gap-1"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                    </div>
                </div>`;
        }).join('');

        container.querySelectorAll('.show-btn-edit').forEach(b => b.addEventListener('click', () => edit(Number(b.getAttribute('data-edit-show')))));
        container.querySelectorAll('.show-btn-remove').forEach(b => b.addEventListener('click', () => remove(Number(b.getAttribute('data-remove-show')))));
        if (window.adminApp?.refreshIcons) window.adminApp.refreshIcons();
    }

    function setupListeners() {
        if (listenersAttached) return;
        listenersAttached = true;
        const dateEl = document.getElementById('show-date');
        const slugEl = document.getElementById('show-slug');
        if (dateEl && slugEl) {
            dateEl.addEventListener('input', () => {
                if (editingIndex === null) slugEl.value = utils.slugify(`show-${dateEl.value}`);
                updatePreview();
            });
        }
        ['show-title', 'show-slug', 'show-time', 'show-location', 'show-address', 'show-price', 'show-status', 'show-desc'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', updatePreview);
            if (el && el.tagName === 'SELECT') el.addEventListener('change', updatePreview);
        });
        document.getElementById('shows-form')?.addEventListener('submit', handleSubmit);
        document.getElementById('show-cancel-btn')?.addEventListener('click', resetForm);
    }

    function updatePreview() {
        const title = document.getElementById('show-title')?.value || "Wimpie & de Domino's Live";
        const date = document.getElementById('show-date')?.value || 'Datum volgt';
        const time = document.getElementById('show-time')?.value || 'Tijden volgen';
        const loc = document.getElementById('show-location')?.value || 'Locatie volgt';
        const addr = document.getElementById('show-address')?.value || '';
        const priceVal = parseFloat(document.getElementById('show-price')?.value || '0') || 0;
        const statusKey = document.getElementById('show-status')?.value || 'available';
        const desc = document.getElementById('show-desc')?.value || '';
        const st = STATUS_LABELS[statusKey] || STATUS_LABELS.available;

        const el = id => document.getElementById(id);
        if (el('prev-show-title')) el('prev-show-title').textContent = title;
        if (el('prev-show-date')) el('prev-show-date').textContent = date;
        if (el('prev-show-price')) el('prev-show-price').textContent = formatPrice(priceVal);
        if (el('prev-show-meta')) el('prev-show-meta').textContent = `${loc}${addr ? ` (${addr})` : ''} - ${time}`;
        if (el('prev-show-desc')) el('prev-show-desc').textContent = desc;
        if (el('prev-show-status')) {
            el('prev-show-status').textContent = st.text;
            el('prev-show-status').className = `px-2.5 py-0.5 rounded-full text-[11px] uppercase ${st.cls}`;
        }
        if (el('prev-show-bunq')) el('prev-show-bunq').textContent = `https://bunq.me/Wimpie/${priceVal.toFixed(2)}`;
    }

    function setFormValues(s = {}) {
        const map = {
            'show-title': s.title || '',
            'show-slug': s.slug || '',
            'show-date': s.date || '',
            'show-time': s.time || '',
            'show-location': s.location || '',
            'show-address': s.address || '',
            'show-price': s.price !== undefined ? String(s.price) : '',
            'show-status': s.status || 'available',
            'show-desc': s.description || ''
        };
        Object.entries(map).forEach(([id, v]) => { const e = document.getElementById(id); if (e) e.value = v; });
    }

    function edit(idx) {
        const item = showsData.shows[idx];
        if (!item) return;
        editingIndex = idx;
        setFormValues(item);
        const h = document.getElementById('show-form-heading');
        if (h) h.textContent = `Show bewerken: ${item.date}`;
        const t = document.getElementById('show-submit-text');
        if (t) t.textContent = 'Show Bijwerken';
        document.getElementById('show-cancel-btn')?.classList.remove('hidden');
        renderList();
        updatePreview();
        document.getElementById('shows-form')?.scrollIntoView({ behavior: 'smooth' });
    }

    function resetForm() {
        editingIndex = null;
        document.getElementById('shows-form')?.reset();
        setFormValues();
        const h = document.getElementById('show-form-heading');
        if (h) h.textContent = 'Nieuwe Show Toevoegen';
        const btn = document.getElementById('show-submit-btn');
        if (btn) btn.disabled = false;
        const t = document.getElementById('show-submit-text');
        if (t) t.textContent = 'Show Toevoegen';
        document.getElementById('show-cancel-btn')?.classList.add('hidden');
        renderList();
        updatePreview();
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (isSaving) return;
        const val = id => document.getElementById(id)?.value.trim() || '';
        const title = val('show-title');
        const date = val('show-date');
        const slug = utils.slugify(val('show-slug') || `show-${date}`);
        const price = parseFloat(document.getElementById('show-price')?.value || 'NaN');

        if (!title || !date || !slug || Number.isNaN(price) || price < 0) {
            alert('Vul een geldige titel, slug, datum en prijs in.');
            return;
        }
        const entry = {
            slug,
            title,
            date,
            time: val('show-time') || 'Aanvangstijd volgt',
            location: val('show-location') || 'Locatie volgt',
            address: val('show-address') || 'Amsterdam',
            price: Math.round(price * 100) / 100,
            status: document.getElementById('show-status')?.value || 'available',
            description: val('show-desc')
        };

        const updated = [...showsData.shows];
        if (editingIndex !== null) updated[editingIndex] = entry;
        else updated.push(entry);

        isSaving = true;
        const btn = document.getElementById('show-submit-btn');
        const txt = document.getElementById('show-submit-text');
        if (btn) btn.disabled = true;
        if (txt) txt.textContent = 'Bezig met opslaan...';

        try {
            let ok = true;
            if (window.adminApp?.saveData) ok = await window.adminApp.saveData('shows', { shows: updated });
            if (ok) {
                showsData = { shows: updated };
                resetForm();
                renderList();
            }
        } finally {
            isSaving = false;
            if (btn) btn.disabled = false;
            if (txt) txt.textContent = editingIndex !== null ? 'Show Bijwerken' : 'Show Toevoegen';
        }
    }

    async function remove(idx) {
        const s = showsData.shows[idx];
        if (!s || !confirm(`Weet je zeker dat je "${s.title} (${s.date})" wilt verwijderen?`)) return;
        const updated = showsData.shows.filter((_, i) => i !== idx);
        let ok = true;
        if (window.adminApp?.saveData) ok = await window.adminApp.saveData('shows', { shows: updated });
        if (ok) {
            showsData = { shows: updated };
            if (editingIndex === idx) resetForm();
            renderList();
        }
    }

    function getData() { return showsData; }
    return { init, edit, remove, resetForm, getData };
})();
