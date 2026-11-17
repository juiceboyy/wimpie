#!/usr/bin/env node
/**
 * build-shows.js
 * Genereert tickets.html en werkt de Live Shows sectie in index.html bij
 * op basis van data/shows.json.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const DATA_FILE = path.join(ROOT_DIR, 'data', 'shows.json');
const TICKETS_PAGE_FILE = path.join(ROOT_DIR, 'tickets.html');
const INDEX_PAGE_FILE = path.join(ROOT_DIR, 'index.html');

const FEATURE_START_MARKER = '<!-- SHOWS_FEATURE_START -->';
const FEATURE_END_MARKER = '<!-- SHOWS_FEATURE_END -->';

const STATUS_META = {
    available: { label: 'Beschikbaar', cls: 'text-emerald-400 bg-emerald-500/10' },
    few_left: { label: 'Laatste kaarten', cls: 'text-amber-300 bg-amber-500/15' },
    sold_out: { label: 'Uitverkocht', cls: 'text-red-400 bg-red-500/10' }
};

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatEuro(price) {
    const num = Number(price || 0);
    return `€ ${num.toFixed(2).replace('.', ',')}`;
}

function renderShowCard(show) {
    const slug = escapeHtml(show.slug || '');
    const title = escapeHtml(show.title || "Wimpie & de Domino's Live");
    const date = escapeHtml(show.date || '');
    const time = escapeHtml(show.time || 'Tijden volgen');
    const location = escapeHtml(show.location || 'Locatie volgt');
    const address = escapeHtml(show.address || '');
    const desc = escapeHtml(show.description || '');
    const priceLabel = formatEuro(show.price);
    const status = STATUS_META[show.status] || STATUS_META.available;
    const isSoldOut = show.status === 'sold_out';

    return `            <article data-show-card="${slug}" class="bg-[#141414] rounded-2xl p-6 sm:p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] flex flex-col justify-between space-y-5 transition">
                <div class="space-y-3">
                    <div class="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                        <span class="text-[#C85A32] uppercase tracking-wider font-medium">${date}</span>
                        <span class="px-2.5 py-0.5 rounded-full text-[11px] uppercase tracking-wider ${status.cls}">${status.label}</span>
                    </div>
                    <div class="flex items-baseline justify-between gap-4">
                        <h2 class="font-serif text-2xl sm:text-3xl font-semibold text-white tracking-[-0.02em]">${title}</h2>
                        <span class="text-xl sm:text-2xl font-serif font-semibold text-white shrink-0">${priceLabel}</span>
                    </div>
                    <div class="flex flex-wrap gap-x-5 gap-y-1.5 text-xs font-mono text-neutral-400">
                        <span class="inline-flex items-center gap-1.5"><i data-lucide="clock" class="w-3.5 h-3.5 text-[#C85A32]"></i> ${time}</span>
                        <span class="inline-flex items-center gap-1.5"><i data-lucide="map-pin" class="w-3.5 h-3.5 text-[#C85A32]"></i> ${location}${address ? ` (${address})` : ''}</span>
                    </div>
                    ${desc ? `<p class="text-neutral-300 text-sm leading-relaxed pt-1">${desc}</p>` : ''}
                </div>
                <div class="pt-2 flex items-center justify-between gap-4 border-t border-white/5">
                    <span class="text-xs font-mono text-neutral-400">0% servicekosten via bunq.me</span>
                    <button type="button" data-select-show="${slug}" ${isSoldOut ? 'disabled' : ''} class="h-10 px-5 rounded-full ${isSoldOut ? 'bg-white/5 text-neutral-500 cursor-not-allowed' : 'bg-[#C85A32] hover:bg-[#B34E2A] text-white shadow-[0_0_0_1px_rgba(200,90,50,0.5)]'} text-xs font-mono uppercase tracking-wider transition">${isSoldOut ? 'Uitverkocht' : 'Kies deze show'}</button>
                </div>
            </article>`;
}

function getVisibleShows(data) {
    return (Array.isArray(data.shows) ? data.shows : []).filter(s => s && s.status !== 'hidden' && !s.hidden);
}

function renderFeaturedShowsSection(data) {
    const shows = getVisibleShows(data);
    if (shows.length === 0) {
        return `${FEATURE_START_MARKER}\n    ${FEATURE_END_MARKER}`;
    }

    const cardsHtml = shows.map(show => {
        const slug = escapeHtml(show.slug || '');
        const title = escapeHtml(show.title || "Wimpie & de Domino's Live");
        const date = escapeHtml(show.date || '');
        const time = escapeHtml(show.time || 'Tijden volgen');
        const location = escapeHtml(show.location || 'Locatie volgt');
        const priceLabel = formatEuro(show.price);
        const isSoldOut = show.status === 'sold_out';
        const status = STATUS_META[show.status] || STATUS_META.available;

        return `            <article class="bg-[#141414] rounded-2xl p-6 sm:p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] flex flex-col justify-between space-y-5">
                <div class="space-y-3">
                    <div class="flex items-center justify-between gap-2 text-xs font-mono"><span class="text-[#C85A32] uppercase tracking-wider">${date}</span><span class="px-2.5 py-0.5 rounded-full text-[11px] uppercase tracking-wider ${status.cls}">${status.label}</span></div>
                    <div class="flex items-baseline justify-between gap-3"><h3 class="font-serif text-2xl font-semibold text-white">${title}</h3><span class="font-serif text-2xl font-semibold text-white shrink-0">${priceLabel}</span></div>
                    <p class="text-xs font-mono text-neutral-400">${location} &bull; ${time}</p>
                </div>
                <a href="/tickets?show=${slug}" class="h-11 px-6 rounded-full ${isSoldOut ? 'bg-white/5 text-neutral-400' : 'bg-[#C85A32] hover:bg-[#B34E2A] text-white shadow-[0_0_0_1px_rgba(200,90,50,0.5)]'} text-xs font-mono uppercase tracking-wider inline-flex items-center justify-center gap-2 transition">${isSoldOut ? 'Bekijk details' : `Bestel kaarten (${priceLabel})`}</a>
            </article>`;
    }).join('\n');

    const gridCols = shows.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2';

    return `${FEATURE_START_MARKER}
    <section id="shows" class="max-w-7xl mx-auto w-full px-4 sm:px-8 py-8">
        <div class="flex flex-col sm:flex-row sm:items-end justify-between mb-6 gap-4">
            <div><span class="text-xs font-mono uppercase tracking-[0.2em] text-[#C85A32]">Aankomende Optredens</span><h2 class="font-serif text-3xl sm:text-4xl font-semibold text-white tracking-[-0.03em] mt-1">Live Shows &amp; Kaarten</h2></div>
            <a href="tickets.html" class="text-xs font-mono uppercase tracking-wider text-[#C85A32] hover:underline">Alle shows &amp; kaarten &rarr;</a>
        </div>
        <div class="grid ${gridCols} gap-6">
${cardsHtml}
        </div>
    </section>
    ${FEATURE_END_MARKER}`;
}

function renderTicketsPage(data) {
    const shows = getVisibleShows(data);
    const cardsHtml = shows.length > 0
        ? shows.map(renderShowCard).join('\n')
        : '<div class="bg-[#141414] rounded-2xl p-8 text-center text-sm font-mono text-neutral-400">Er staan momenteel geen nieuwe shows gepland.</div>';

    const optionsHtml = shows.map(s =>
        `<option value="${escapeHtml(s.slug)}">${escapeHtml(s.date)} - ${escapeHtml(s.title)} (${formatEuro(s.price)})</option>`
    ).join('');

    const embeddedJson = JSON.stringify({ shows }).replace(/</g, '\\u003c');

    return `<!DOCTYPE html>
<html lang="nl" class="scroll-smooth bg-[#0C0C0C]">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Live Shows &amp; Kaarten | Wimpie &amp; de Domino's</title>
    <meta name="description" content="Bestel direct kaarten zonder servicekosten voor de live shows van Wimpie &amp; de Domino's via de gastenlijst en iDEAL (bunq.me).">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..600;1,9..144,400..600&family=JetBrains+Mono:wght@400;500&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <script src="qr.js" defer></script>
    <script src="app.js" defer></script>
    <script src="tickets.js" defer></script>
</head>
<body class="bg-[#0C0C0C] text-[#FDFBF7] font-sans antialiased selection:bg-[#C85A32] selection:text-white min-h-screen flex flex-col justify-between">
    <header class="sticky top-0 z-50 bg-[#0C0C0C]/90 backdrop-blur-md shadow-[0_1px_0_0_rgba(255,255,255,0.08)] px-4 sm:px-8 py-3">
        <div class="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-3">
            <a href="index.html" class="flex items-center gap-2 text-xs font-mono tracking-[0.2em] text-neutral-300 uppercase hover:text-white transition"><span class="w-2 h-2 rounded-full bg-[#C85A32] animate-pulse"></span><span>Wimpie &amp; de Domino's</span></a>
            <div class="flex items-center gap-2 sm:gap-3">
                <a href="tickets.html" aria-current="page" class="h-9 px-3.5 rounded-full bg-[#C85A32] text-white text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_0_1px_rgba(200,90,50,0.5)] transition">Tickets</a>
                <a href="/s" class="h-9 px-3.5 rounded-full bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] transition">Nieuwe Single</a>
                <a href="podcast.html" class="h-9 px-3.5 rounded-full bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-mono uppercase tracking-wider hidden sm:flex items-center gap-1.5 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] transition">Podcast</a>
                <a href="boeken.html" class="h-9 px-3.5 rounded-full bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-mono uppercase tracking-wider hidden md:flex items-center gap-1.5 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] transition">Boek optreden</a>
                <a href="index.html" class="h-9 px-3.5 rounded-full bg-white/10 hover:bg-white/20 text-neutral-200 text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_0_1px_rgba(255,255,255,0.12)] transition">&larr; Home</a>
            </div>
        </div>
    </header>
    <section class="max-w-7xl mx-auto w-full px-4 sm:px-8 pt-10 pb-6">
        <div class="max-w-3xl space-y-3">
            <span class="inline-block text-xs font-mono uppercase tracking-[0.25em] text-[#C85A32]">Gastenlijst &amp; Kaartverkoop</span>
            <h1 class="font-serif text-4xl sm:text-5xl lg:text-6xl font-semibold text-white tracking-[-0.035em] leading-[1.05]">Live Shows &amp; Kaarten</h1>
            <p class="text-neutral-300 text-base sm:text-lg leading-relaxed">Reserveer je plek op de gastenlijst en reken direct zonder extra servicekosten af via iDEAL (bunq.me). Aan de deur kom je binnen op naam.</p>
        </div>
    </section>
    <main class="max-w-7xl mx-auto w-full px-4 sm:px-8 py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start flex-1">
        <div class="lg:col-span-7 space-y-5">
${cardsHtml}
        </div>
        <aside class="lg:col-span-5 lg:sticky lg:top-20 bg-[#141414] rounded-2xl p-6 sm:p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.1)]">
            <div id="ticket-step-form" class="space-y-5">
                <div><span class="text-xs font-mono uppercase tracking-[0.2em] text-[#C85A32]">Stap 1 van 2</span><h2 class="font-serif text-2xl font-semibold text-white mt-1">Zet jezelf op de gastenlijst</h2></div>
                <form id="ticket-reservation-form" name="tickets" method="POST" data-netlify="true" netlify-honeypot="bot-field" class="space-y-4">
                    <input type="hidden" name="form-name" value="tickets" /><input type="hidden" name="bot-field" />
                    <input type="hidden" id="ticket-ref-input" name="referentiecode" /><input type="hidden" id="ticket-total-input" name="totaalbedrag" />
                    <input type="hidden" id="ticket-show-title-input" name="show_titel" /><input type="hidden" id="ticket-show-date-input" name="show_datum" />
                    <div><label for="ticket-show-select" class="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1.5">Kies een show *</label><select id="ticket-show-select" name="show_slug" required class="w-full h-11 px-3.5 rounded-xl bg-black/60 text-white text-sm shadow-[0_0_0_1px_rgba(255,255,255,0.12)] focus:outline-none focus:ring-2 focus:ring-white">${optionsHtml}</select></div>
                    <div>
                        <label for="ticket-qty" class="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1.5">Aantal kaarten *</label>
                        <div class="flex items-center gap-3">
                            <button type="button" id="ticket-qty-minus" class="w-11 h-11 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono text-lg transition" aria-label="Minder kaarten">-</button>
                            <input type="number" id="ticket-qty" name="aantal" min="1" max="10" value="1" required class="w-20 h-11 text-center rounded-xl bg-black/60 text-white font-mono text-base shadow-[0_0_0_1px_rgba(255,255,255,0.12)] focus:outline-none focus:ring-2 focus:ring-white">
                            <button type="button" id="ticket-qty-plus" class="w-11 h-11 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono text-lg transition" aria-label="Meer kaarten">+</button>
                        </div>
                    </div>
                    <div><label for="ticket-name" class="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1.5">Volledige naam (voor op gastenlijst) *</label><input type="text" id="ticket-name" name="naam" required placeholder="Voor- en achternaam" class="w-full h-11 px-3.5 rounded-xl bg-black/60 text-white text-sm shadow-[0_0_0_1px_rgba(255,255,255,0.12)] focus:outline-none focus:ring-2 focus:ring-white"></div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div><label for="ticket-email" class="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1.5">E-mailadres *</label><input type="email" id="ticket-email" name="email" required placeholder="naam@voorbeeld.nl" class="w-full h-11 px-3.5 rounded-xl bg-black/60 text-white text-sm shadow-[0_0_0_1px_rgba(255,255,255,0.12)] focus:outline-none focus:ring-2 focus:ring-white"></div>
                        <div><label for="ticket-phone" class="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1.5">Telefoonnummer</label><input type="tel" id="ticket-phone" name="telefoon" placeholder="06-..." class="w-full h-11 px-3.5 rounded-xl bg-black/60 text-white text-sm shadow-[0_0_0_1px_rgba(255,255,255,0.12)] focus:outline-none focus:ring-2 focus:ring-white"></div>
                    </div>
                    <div><label for="ticket-notes" class="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1.5">Rolstoelplek of bijzonderheden (optioneel)</label><input type="text" id="ticket-notes" name="bijzonderheden" placeholder="Bijv. 1 rolstoelplek gewenst" class="w-full h-11 px-3.5 rounded-xl bg-black/60 text-white text-sm shadow-[0_0_0_1px_rgba(255,255,255,0.12)] focus:outline-none focus:ring-2 focus:ring-white"></div>
                    <div class="p-4 rounded-xl bg-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] space-y-1">
                        <div id="ticket-price-summary" class="flex items-center justify-between text-xs font-mono text-neutral-300"></div>
                        <p class="text-[11px] font-mono text-neutral-400">0% servicekosten - direct via bunq.me</p>
                    </div>
                    <div id="ticket-form-error" class="hidden p-3 rounded-xl bg-red-950/60 text-red-300 text-xs font-mono"></div>
                    <button type="submit" id="ticket-submit-btn" class="w-full h-12 rounded-full bg-[#C85A32] hover:bg-[#B34E2A] text-white text-xs font-mono font-medium uppercase tracking-wider shadow-[0_0_0_1px_rgba(200,90,50,0.5)] transition">Reserveer &amp; Ga naar Betalen</button>
                </form>
            </div>
            <div id="ticket-step-payment" class="hidden space-y-5">
                <div class="space-y-1"><span class="text-xs font-mono uppercase tracking-[0.2em] text-emerald-400">Stap 2 van 2 - Gastenlijst bevestigd</span><h2 class="font-serif text-2xl font-semibold text-white">Rond je betaling af</h2></div>
                <div class="p-4 rounded-xl bg-black/50 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] space-y-2 text-xs font-mono">
                    <div class="flex justify-between"><span class="text-neutral-400">Referentie</span><span id="pay-ref-code" class="text-[#C85A32] font-semibold"></span></div>
                    <div class="flex justify-between"><span class="text-neutral-400">Naam</span><span id="pay-guest-name" class="text-white"></span></div>
                    <div class="flex justify-between"><span class="text-neutral-400">Show</span><span id="pay-show-label" class="text-white text-right"></span></div>
                    <div class="flex justify-between"><span class="text-neutral-400">Aantal</span><span id="pay-qty-label" class="text-white"></span></div>
                    <div class="flex justify-between pt-2 border-t border-white/10"><span class="text-neutral-300">Totaal</span><span id="pay-total-display" class="text-white font-semibold text-sm"></span></div>
                </div>
                <a id="pay-bunq-btn" href="https://bunq.me/Wimpie" target="_blank" rel="noopener noreferrer" class="w-full h-12 px-6 rounded-full bg-[#C85A32] hover:bg-[#B34E2A] text-white text-xs font-mono font-medium uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_0_1px_rgba(200,90,50,0.5)] transition"><span>Betaal via iDEAL (bunq.me)</span></a>
                <div class="flex flex-col items-center text-center space-y-3 pt-2">
                    <div id="pay-bunq-qr" class="w-44 h-44 p-2 rounded-2xl bg-white shadow-[0_0_0_1px_rgba(255,255,255,0.15)]"></div>
                    <p class="text-xs font-mono text-neutral-400">Of scan deze QR-code met je camera of bank-app</p>
                </div>
                <button type="button" id="pay-reset-btn" class="w-full h-10 rounded-full bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-mono uppercase tracking-wider transition">Nieuwe reservering maken</button>
            </div>
        </aside>
    </main>
    <footer class="bg-[#08090A] shadow-[0_-1px_0_0_rgba(255,255,255,0.08)] py-8 px-4 sm:px-8 text-xs font-mono text-neutral-400 mt-12">
        <div class="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
            <p>&copy; 2026 VOF Wimpie &amp; de Domino's | Admiraal de Ruijterweg, Amsterdam | KvK: 96802863</p>
            <div class="flex flex-wrap justify-center gap-4 text-xs">
                <a href="index.html" class="hover:text-white transition">&larr; Hoofdpagina</a>
                <a href="tickets.html" class="hover:text-white transition">Tickets</a>
                <a href="/s" class="hover:text-white transition">Nieuwe Single</a>
                <a href="podcast.html" class="hover:text-white transition">Podcast</a>
                <a href="boeken.html" class="hover:text-white transition">Boek optreden</a>
            </div>
        </div>
    </footer>
    <script id="shows-data" type="application/json">${embeddedJson}</script>
</body>
</html>
`;
}

function buildShows({ dataFile = DATA_FILE, ticketsPageFile = TICKETS_PAGE_FILE, indexPageFile = INDEX_PAGE_FILE } = {}) {
    console.log('Building show & ticket pages from data/shows.json...');
    if (!fs.existsSync(dataFile)) {
        throw new Error(`Error: ${dataFile} not found`);
    }
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
    fs.writeFileSync(ticketsPageFile, renderTicketsPage(data), 'utf-8');
    console.log('Generated: tickets.html');

    if (fs.existsSync(indexPageFile)) {
        const indexHtml = fs.readFileSync(indexPageFile, 'utf-8');
        const startIdx = indexHtml.indexOf(FEATURE_START_MARKER);
        const endIdx = indexHtml.indexOf(FEATURE_END_MARKER);
        if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
            throw new Error(`Missing or invalid ${FEATURE_START_MARKER} / ${FEATURE_END_MARKER} markers in ${indexPageFile}`);
        }
        const featuredHtml = renderFeaturedShowsSection(data);
        const updatedIndex =
            indexHtml.slice(0, startIdx) +
            featuredHtml +
            indexHtml.slice(endIdx + FEATURE_END_MARKER.length);
        fs.writeFileSync(indexPageFile, updatedIndex, 'utf-8');
        console.log('Updated featured shows section in: index.html');
    }
}

if (require.main === module) {
    buildShows();
}

module.exports = {
    formatEuro,
    renderShowCard,
    renderFeaturedShowsSection,
    renderTicketsPage,
    buildShows
};
