/**
 * tickets.js - Interactieve 2-staps ticket & gastenlijst module met cap-controle, bunq.me iDEAL & QR-code
 */

const ui = typeof window !== 'undefined' && window.ticketsUi
    ? window.ticketsUi
    : (typeof require === 'function' ? require('./tickets-ui') : {});

function initTicketsModule() {
    const dataEl = document.getElementById('shows-data');
    const form = document.getElementById('ticket-reservation-form');
    if (!dataEl || !form) return;

    let shows = [];
    try {
        const parsed = JSON.parse(dataEl.textContent || '{}');
        shows = Array.isArray(parsed.shows) ? parsed.shows : [];
    } catch (e) {
        console.error('Kon shows-data niet parsen:', e);
        return;
    }

    const showMap = new Map(shows.map(s => [s.slug, s]));
    const availabilityMap = new Map();
    const showSelect = document.getElementById('ticket-show-select');
    const qtyInput = document.getElementById('ticket-qty');
    const qtyMinus = document.getElementById('ticket-qty-minus');
    const qtyPlus = document.getElementById('ticket-qty-plus');
    const summaryEl = document.getElementById('ticket-price-summary');
    const submitBtn = document.getElementById('ticket-submit-btn');
    const errorEl = document.getElementById('ticket-form-error');
    const stepForm = document.getElementById('ticket-step-form');
    const stepPayment = document.getElementById('ticket-step-payment');

    function getSelectedShow() {
        return showMap.get(showSelect?.value) || shows[0] || null;
    }

    function getMaxAllowedQty(show) {
        const info = show ? availabilityMap.get(show.slug) : null;
        if (!info || info.remaining === null || info.remaining === undefined) return 10;
        return Math.max(1, Math.min(10, info.remaining));
    }

    function showError(msg) {
        if (!errorEl) return;
        errorEl.textContent = msg;
        errorEl.classList.toggle('hidden', !msg);
    }

    function setAvailability(slug, info) {
        if (!info) return;
        availabilityMap.set(slug, info);
        ui.applyCardAvailability(slug, info);
    }

    function updateSummary() {
        const show = getSelectedShow();
        const maxQty = getMaxAllowedQty(show);
        const qty = Math.max(1, Math.min(maxQty, parseInt(qtyInput?.value || '1', 10) || 1));
        if (qtyInput) {
            qtyInput.max = String(maxQty);
            qtyInput.value = String(qty);
        }
        if (!show || !summaryEl) return;

        const info = availabilityMap.get(show.slug);
        const isSoldOut = show.status === 'sold_out' || Boolean(info && info.soldOut);
        const total = (Number(show.price) || 0) * qty;
        const stockText = info && !isSoldOut ? ui.getStockLabel(info) : '';

        if (isSoldOut) {
            summaryEl.innerHTML = '<span class="text-red-400">Deze show is helaas uitverkocht.</span>';
        } else {
            const stockLine = stockText ? `<span class="block text-amber-300 text-[11px] mt-1">${stockText}</span>` : '';
            summaryEl.innerHTML = `<span>${qty} ${qty === 1 ? 'kaart' : 'kaarten'} x ${ui.formatEuroClient(show.price)}${stockLine}</span><span class="text-white font-semibold text-base">${ui.formatEuroClient(total)}</span>`;
        }

        if (submitBtn) {
            submitBtn.disabled = isSoldOut;
            submitBtn.classList.toggle('opacity-50', isSoldOut);
            submitBtn.classList.toggle('cursor-not-allowed', isSoldOut);
            submitBtn.textContent = isSoldOut ? 'Uitverkocht' : 'Reserveer & Ga naar Betalen';
        }
    }

    function selectShow(slug) {
        if (!showSelect || !showMap.has(slug)) return;
        showSelect.value = slug;
        updateSummary();
        document.querySelectorAll('[data-show-card]').forEach(card => {
            const active = card.getAttribute('data-show-card') === slug;
            card.classList.toggle('ring-2', active);
            card.classList.toggle('ring-[#C85A32]', active);
        });
    }

    async function loadLiveAvailability() {
        if (window.location.protocol === 'file:') return;
        try {
            const res = await fetch('/api/tickets-api', { cache: 'no-store' });
            if (!res.ok) return;
            const data = await res.json();
            if (!data || !data.shows) return;
            Object.entries(data.shows).forEach(([slug, info]) => setAvailability(slug, info));
            updateSummary();
        } catch (err) {
            console.warn('Live beschikbaarheid ophalen overgeslagen:', err.message);
        }
    }

    const paramShow = new URLSearchParams(window.location.search).get('show');
    if (paramShow && showMap.has(paramShow)) selectShow(paramShow);
    else if (shows[0]) selectShow(shows[0].slug);
    loadLiveAvailability();

    document.querySelectorAll('[data-select-show]').forEach(btn => {
        btn.addEventListener('click', () => {
            selectShow(btn.getAttribute('data-select-show'));
            if (stepPayment && !stepPayment.classList.contains('hidden')) {
                stepPayment.classList.add('hidden');
                stepForm.classList.remove('hidden');
            }
            form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
    });

    if (showSelect) showSelect.addEventListener('change', () => selectShow(showSelect.value));
    if (qtyInput) qtyInput.addEventListener('input', updateSummary);
    if (qtyMinus) qtyMinus.addEventListener('click', () => {
        qtyInput.value = String(Math.max(1, (parseInt(qtyInput.value, 10) || 1) - 1));
        updateSummary();
    });
    if (qtyPlus) qtyPlus.addEventListener('click', () => {
        qtyInput.value = String(Math.min(getMaxAllowedQty(getSelectedShow()), (parseInt(qtyInput.value, 10) || 1) + 1));
        updateSummary();
    });

    async function releaseReservedTickets(showSlug, refCode) {
        if (window.location.protocol === 'file:') return;
        try {
            const res = await fetch('/api/tickets-api', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'release', showSlug, refCode })
            });
            const body = res.ok ? await res.json() : null;
            if (body && body.availability) {
                setAvailability(showSlug, body.availability);
                updateSummary();
            }
        } catch (_) { /* best effort rollback */ }
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        showError('');

        const show = getSelectedShow();
        const existingInfo = show ? availabilityMap.get(show.slug) : null;
        if (!show || show.status === 'sold_out' || (existingInfo && existingInfo.soldOut)) return;

        const qty = Math.max(1, Math.min(getMaxAllowedQty(show), parseInt(qtyInput?.value || '1', 10) || 1));
        const total = (Number(show.price) || 0) * qty;
        const refCode = ui.generateRefCode(show.slug);
        const buyerName = (document.getElementById('ticket-name')?.value || '').trim();

        document.getElementById('ticket-ref-input').value = refCode;
        document.getElementById('ticket-total-input').value = ui.formatEuroClient(total);
        document.getElementById('ticket-show-title-input').value = show.title;
        document.getElementById('ticket-show-date-input').value = show.date;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Beschikbaarheid controleren...';
        }

        const isLocal = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);
        let reservedServerSide = false;

        if (window.location.protocol !== 'file:') {
            try {
                const capRes = await fetch('/api/tickets-api', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'reserve', showSlug: show.slug, quantity: qty, refCode })
                });
                const capData = await capRes.json().catch(() => ({}));
                if (capRes.status === 409) {
                    setAvailability(show.slug, {
                        ...(existingInfo || { slug: show.slug, maxTickets: capData.maxTickets || 0 }),
                        sold: capData.sold ?? (existingInfo ? existingInfo.sold : 0),
                        remaining: capData.remaining ?? 0,
                        soldOut: Boolean(capData.soldOut),
                        lowStock: !capData.soldOut && Number(capData.remaining) > 0 && Number(capData.remaining) < ui.LOW_STOCK_THRESHOLD
                    });
                    updateSummary();
                    showError(capData.error || 'Niet genoeg kaarten meer beschikbaar.');
                    return;
                }
                if (capRes.ok && capData.availability) {
                    reservedServerSide = true;
                    setAvailability(show.slug, capData.availability);
                    updateSummary();
                } else if (!capRes.ok && !isLocal) {
                    throw new Error(capData.error || 'Reservering controleren mislukt.');
                }
            } catch (_) {
                if (!isLocal) {
                    showError('Kon beschikbaarheid niet controleren. Probeer opnieuw of bel 06-28143815.');
                    updateSummary();
                    return;
                }
            }
        }

        if (submitBtn) submitBtn.textContent = 'Reservering opslaan...';
        try {
            const res = await fetch('/tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(new FormData(form)).toString()
            });
            if (!res.ok && !isLocal) throw new Error('Server gaf geen bevestiging');
        } catch (_) {
            if (!isLocal) {
                if (reservedServerSide) await releaseReservedTickets(show.slug, refCode);
                showError('Opslaan op gastenlijst mislukt. Bel 06-28143815 of mail wimpieweg@gmail.com.');
                updateSummary();
                return;
            }
        }

        const paymentUrl = ui.buildBunqTicketUrl({ amount: total, refCode, quantity: qty, showDate: show.date, buyerName });
        ui.renderPaymentStep({ refCode, buyerName, show, qty, total, paymentUrl });
        updateSummary();
    });

    document.getElementById('pay-reset-btn')?.addEventListener('click', () => {
        form.reset();
        selectShow(shows[0]?.slug || '');
        stepPayment.classList.add('hidden');
        stepForm.classList.remove('hidden');
    });
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initTicketsModule);
    else initTicketsModule();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        formatEuroClient: ui.formatEuroClient,
        sanitizeDescPart: ui.sanitizeDescPart,
        generateRefCode: ui.generateRefCode,
        buildBunqTicketUrl: ui.buildBunqTicketUrl,
        initTicketsModule
    };
}
