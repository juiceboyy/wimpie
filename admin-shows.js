/**
 * admin-shows.js - Beheer van live shows, ticket caps & tellers voor Wimpie & de Domino's
 */

window.adminShows = (function () {
    let showsData = { shows: [] };
    let ticketCounts = {};
    let editingIndex = null;
    let listenersAttached = false;
    let isSaving = false;

    const utils = window.adminUtils || {
        escapeHtml: str => str || '',
        slugify: str => (str || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-')
    };

    function getUi() {
        return window.adminShowsUi || {
            STATUS_LABELS: {
                available: { text: 'Beschikbaar', cls: 'bg-emerald-500/10 text-emerald-400' },
                few_left: { text: 'Laatste kaarten', cls: 'bg-amber-500/15 text-amber-300' },
                sold_out: { text: 'Uitverkocht', cls: 'bg-red-500/10 text-red-400' },
                hidden: { text: 'Verborgen', cls: 'bg-white/10 text-neutral-400' }
            },
            formatPrice: val => `€ ${Number(val || 0).toFixed(2).replace('.', ',')}`,
            buildTabMarkup: () => '',
            renderShowRow: s => `<div>${utils.escapeHtml(s.date)}</div>`
        };
    }

    function ensureTabMarkup() {
        const container = document.getElementById('tab-shows');
        if (!container || container.dataset.rendered === '1') return;
        container.dataset.rendered = '1';
        container.innerHTML = getUi().buildTabMarkup();
    }

    function init(data, counts = {}) {
        ensureTabMarkup();
        showsData = (data && Array.isArray(data.shows)) ? { shows: data.shows } : { shows: [] };
        ticketCounts = counts && typeof counts === 'object' ? { ...counts } : {};
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
        const ui = getUi();
        container.innerHTML = shows.map((s, idx) =>
            ui.renderShowRow(s, idx, editingIndex === idx, ticketCounts[s.slug] || 0, utils.escapeHtml)
        ).join('');

        container.querySelectorAll('.show-btn-count').forEach(b =>
            b.addEventListener('click', () => adjustCount(Number(b.getAttribute('data-adjust-count'))))
        );
        container.querySelectorAll('.show-btn-edit').forEach(b =>
            b.addEventListener('click', () => edit(Number(b.getAttribute('data-edit-show'))))
        );
        container.querySelectorAll('.show-btn-remove').forEach(b =>
            b.addEventListener('click', () => remove(Number(b.getAttribute('data-remove-show'))))
        );
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
        ['show-title', 'show-slug', 'show-time', 'show-location', 'show-address', 'show-price', 'show-max-tickets', 'show-status', 'show-desc'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', updatePreview);
            if (el && el.tagName === 'SELECT') el.addEventListener('change', updatePreview);
        });
        document.getElementById('shows-form')?.addEventListener('submit', handleSubmit);
        document.getElementById('show-cancel-btn')?.addEventListener('click', resetForm);
    }

    function updatePreview() {
        const ui = getUi();
        const title = document.getElementById('show-title')?.value || "Wimpie & de Domino's Live";
        const date = document.getElementById('show-date')?.value || 'Datum volgt';
        const time = document.getElementById('show-time')?.value || 'Tijden volgen';
        const loc = document.getElementById('show-location')?.value || 'Locatie volgt';
        const addr = document.getElementById('show-address')?.value || '';
        const priceVal = parseFloat(document.getElementById('show-price')?.value || '0') || 0;
        const capVal = parseInt(document.getElementById('show-max-tickets')?.value || '0', 10) || 0;
        const statusKey = document.getElementById('show-status')?.value || 'available';
        const desc = document.getElementById('show-desc')?.value || '';
        const st = ui.STATUS_LABELS[statusKey] || ui.STATUS_LABELS.available;

        const el = id => document.getElementById(id);
        if (el('prev-show-title')) el('prev-show-title').textContent = title;
        if (el('prev-show-date')) el('prev-show-date').textContent = date;
        if (el('prev-show-price')) el('prev-show-price').textContent = ui.formatPrice(priceVal);
        if (el('prev-show-meta')) el('prev-show-meta').textContent = `${loc}${addr ? ` (${addr})` : ''} - ${time}`;
        if (el('prev-show-desc')) el('prev-show-desc').textContent = desc;
        if (el('prev-show-cap')) el('prev-show-cap').textContent = capVal > 0 ? `Cap: max ${capVal} kaarten` : 'Geen limiet';
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
            'show-max-tickets': s.maxTickets !== undefined && s.maxTickets !== null ? String(s.maxTickets) : '',
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

    async function adjustCount(idx) {
        const s = showsData.shows[idx];
        if (!s) return;
        const currentSold = Math.max(0, Number(ticketCounts[s.slug]) || 0);
        const raw = prompt(`Aantal verkochte kaarten aanpassen voor "${s.title} (${s.date})":`, String(currentSold));
        if (raw === null) return;
        const nextSold = Number(raw.trim());
        if (!Number.isInteger(nextSold) || nextSold < 0) {
            alert('Vul een geldig geheel getal >= 0 in.');
            return;
        }
        if (window.adminApp?.setTicketCount) {
            const newCounts = await window.adminApp.setTicketCount(s.slug, nextSold);
            if (newCounts) {
                ticketCounts = { ...ticketCounts, ...newCounts };
                renderList();
            }
        } else {
            ticketCounts[s.slug] = nextSold;
            renderList();
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (isSaving) return;
        const val = id => document.getElementById(id)?.value.trim() || '';
        const title = val('show-title');
        const date = val('show-date');
        const slug = utils.slugify(val('show-slug') || `show-${date}`);
        const price = parseFloat(document.getElementById('show-price')?.value || 'NaN');
        const rawCap = val('show-max-tickets');
        const maxTickets = rawCap === '' ? 0 : Number(rawCap);

        if (!title || !date || !slug || Number.isNaN(price) || price < 0 || !Number.isInteger(maxTickets) || maxTickets < 0) {
            alert('Vul een geldige titel, slug, datum, prijs en ticket cap (>= 0) in.');
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
            maxTickets,
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
    return { init, edit, remove, adjustCount, resetForm, getData };
})();
