/**
 * tickets-ui.js - Hulpfuncties voor ticketprijzen, bunq.me URL-opbouw en voorraadweergave
 */

const LOW_STOCK_THRESHOLD = 15;

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

function getStockLabel(info) {
    if (!info || !info.lowStock || !info.remaining || info.remaining >= LOW_STOCK_THRESHOLD) {
        return '';
    }
    return info.remaining === 1 ? 'Nog 1 kaart beschikbaar' : `Nog ${info.remaining} kaarten beschikbaar`;
}

function applyCardAvailability(slug, info) {
    if (typeof document === 'undefined' || !info) return;
    const badge = document.querySelector(`[data-show-status-badge="${slug}"]`);
    const btn = document.querySelector(`[data-select-show="${slug}"]`);
    const note = document.querySelector(`[data-show-stock-note="${slug}"]`);

    if (badge) {
        if (info.soldOut) {
            badge.textContent = 'Uitverkocht';
            badge.className = 'px-2.5 py-0.5 rounded-full text-[11px] uppercase tracking-wider text-red-400 bg-red-500/10';
        } else if (info.lowStock) {
            badge.textContent = getStockLabel(info);
            badge.className = 'px-2.5 py-0.5 rounded-full text-[11px] uppercase tracking-wider text-amber-300 bg-amber-500/15';
        }
    }

    if (btn) {
        btn.disabled = Boolean(info.soldOut);
        btn.textContent = info.soldOut ? 'Uitverkocht' : 'Kies deze show';
        btn.className = info.soldOut
            ? 'h-10 px-5 rounded-full bg-white/5 text-neutral-500 cursor-not-allowed text-xs font-mono uppercase tracking-wider transition'
            : 'h-10 px-5 rounded-full bg-[#C85A32] hover:bg-[#B34E2A] text-white shadow-[0_0_0_1px_rgba(200,90,50,0.5)] text-xs font-mono uppercase tracking-wider transition';
    }

    if (note && info.soldOut) {
        note.textContent = 'Geen kaarten meer beschikbaar';
    }
}

function renderPaymentStep({ refCode, buyerName, show, qty, total, paymentUrl }) {
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

    const stepForm = document.getElementById('ticket-step-form');
    const stepPayment = document.getElementById('ticket-step-payment');
    stepForm.classList.add('hidden');
    stepPayment.classList.remove('hidden');
    stepPayment.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

const uiExports = {
    LOW_STOCK_THRESHOLD,
    formatEuroClient,
    sanitizeDescPart,
    generateRefCode,
    buildBunqTicketUrl,
    getStockLabel,
    applyCardAvailability,
    renderPaymentStep
};

if (typeof window !== 'undefined') {
    window.ticketsUi = uiExports;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = uiExports;
}
