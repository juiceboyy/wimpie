/**
 * tickets.js - Interactieve 2-staps ticket & gastenlijst module met bunq.me iDEAL & QR-code
 */

function formatEuroClient(amount) {
    return '€ ' + Number(amount || 0).toFixed(2).replace('.', ',');
}

function sanitizeDescPart(text) {
    return String(text || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[/?#&]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function generateRefCode(showSlug) {
    const slugUpper = String(showSlug || 'SHOW')
        .replace(/^show-?/i, '')
        .replace(/[^a-z0-9]/gi, '')
        .toUpperCase()
        .slice(0, 6) || 'SHOW';
    const rand = Math.floor(100 + Math.random() * 900);
    return `WIM-${slugUpper}-${rand}`;
}

function buildBunqTicketUrl({ amount, refCode, quantity, showDate, buyerName }) {
    const formattedAmount = Number(amount || 0).toFixed(2);
    const prefix = `https://bunq.me/Wimpie/${formattedAmount}/`;
    const shortDate = sanitizeDescPart(showDate).replace(/\b20\d{2}\b/g, '').trim();
    const rawDesc = [
        sanitizeDescPart(refCode),
        `${Number(quantity || 1)}x`,
        shortDate,
        sanitizeDescPart(buyerName)
    ].filter(Boolean).join(' ');

    // Beperk de totale URL onder 98 bytes zodat QR Version 1-6 (max 106 bytes) in qr.js altijd past
    let desc = rawDesc.slice(0, 56).trim();
    while (desc.length > 8 && (prefix + encodeURIComponent(desc)).length > 98) {
        desc = desc.slice(0, -1).trim();
    }
    return prefix + encodeURIComponent(desc || 'Tickets');
}

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

    function updateSummary() {
        const show = getSelectedShow();
        const qty = Math.max(1, Math.min(10, parseInt(qtyInput?.value || '1', 10) || 1));
        if (qtyInput) qtyInput.value = String(qty);
        if (!show || !summaryEl) return;

        const isSoldOut = show.status === 'sold_out';
        const total = (Number(show.price) || 0) * qty;
        summaryEl.innerHTML = isSoldOut
            ? '<span class="text-red-400">Deze show is helaas uitverkocht.</span>'
            : `<span>${qty} ${qty === 1 ? 'kaart' : 'kaarten'} x ${formatEuroClient(show.price)}</span><span class="text-white font-semibold text-base">${formatEuroClient(total)}</span>`;

        if (submitBtn) {
            submitBtn.disabled = isSoldOut;
            submitBtn.classList.toggle('opacity-50', isSoldOut);
            submitBtn.classList.toggle('cursor-not-allowed', isSoldOut);
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

    const params = new URLSearchParams(window.location.search);
    const paramShow = params.get('show');
    if (paramShow && showMap.has(paramShow)) {
        selectShow(paramShow);
    } else if (shows[0]) {
        selectShow(shows[0].slug);
    }

    document.querySelectorAll('[data-select-show]').forEach(btn => {
        btn.addEventListener('click', () => {
            const slug = btn.getAttribute('data-select-show');
            selectShow(slug);
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
        qtyInput.value = String(Math.min(10, (parseInt(qtyInput.value, 10) || 1) + 1));
        updateSummary();
    });

    function showPaymentStep({ refCode, buyerName, show, qty, total, paymentUrl }) {
        document.getElementById('pay-ref-code').textContent = refCode;
        document.getElementById('pay-guest-name').textContent = buyerName;
        document.getElementById('pay-show-label').textContent = `${show.title} - ${show.date}`;
        document.getElementById('pay-qty-label').textContent = `${qty} ${qty === 1 ? 'kaart' : 'kaarten'}`;
        document.getElementById('pay-total-display').textContent = formatEuroClient(total);

        const bunqBtn = document.getElementById('pay-bunq-btn');
        bunqBtn.setAttribute('href', paymentUrl);
        bunqBtn.querySelector('span').textContent = `Betaal ${formatEuroClient(total)} via iDEAL (bunq.me)`;

        const qrContainer = document.getElementById('pay-bunq-qr');
        if (qrContainer && typeof createQrSvg === 'function') {
            qrContainer.innerHTML = createQrSvg(paymentUrl);
        }

        stepForm.classList.add('hidden');
        stepPayment.classList.remove('hidden');
        stepPayment.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (errorEl) {
            errorEl.classList.add('hidden');
            errorEl.textContent = '';
        }

        const show = getSelectedShow();
        if (!show || show.status === 'sold_out') return;

        const qty = Math.max(1, Math.min(10, parseInt(qtyInput?.value || '1', 10) || 1));
        const total = (Number(show.price) || 0) * qty;
        const refCode = generateRefCode(show.slug);
        const buyerName = (document.getElementById('ticket-name')?.value || '').trim();

        document.getElementById('ticket-ref-input').value = refCode;
        document.getElementById('ticket-total-input').value = formatEuroClient(total);
        document.getElementById('ticket-show-title-input').value = show.title;
        document.getElementById('ticket-show-date-input').value = show.date;

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Reservering opslaan...';
        }

        const formData = new FormData(form);
        const isLocal = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);

        try {
            const res = await fetch('/tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(formData).toString()
            });
            if (!res.ok && !isLocal) {
                throw new Error('Server gaf geen bevestiging');
            }
        } catch (err) {
            if (!isLocal) {
                if (errorEl) {
                    errorEl.textContent = 'Opslaan op gastenlijst mislukt. Bel 06-28143815 of mail wimpieweg@gmail.com.';
                    errorEl.classList.remove('hidden');
                }
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Reserveer & Ga naar Betalen';
                }
                return;
            }
        }

        const paymentUrl = buildBunqTicketUrl({
            amount: total,
            refCode,
            quantity: qty,
            showDate: show.date,
            buyerName
        });

        showPaymentStep({ refCode, buyerName, show, qty, total, paymentUrl });
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Reserveer & Ga naar Betalen';
        }
    });

    const resetBtn = document.getElementById('pay-reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            form.reset();
            selectShow(shows[0]?.slug || '');
            stepPayment.classList.add('hidden');
            stepForm.classList.remove('hidden');
        });
    }
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTicketsModule);
    } else {
        initTicketsModule();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        formatEuroClient,
        sanitizeDescPart,
        generateRefCode,
        buildBunqTicketUrl,
        initTicketsModule
    };
}
