#!/usr/bin/env node
/**
 * build-podcasts.js
 * Generates podcast.html and updates the featured podcast section in index.html
 * based on data/podcasts.json.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const DATA_FILE = path.join(ROOT_DIR, 'data', 'podcasts.json');
const PODCAST_PAGE_FILE = path.join(ROOT_DIR, 'podcast.html');
const INDEX_PAGE_FILE = path.join(ROOT_DIR, 'index.html');

const FEATURE_START_MARKER = '<!-- PODCAST_FEATURE_START -->';
const FEATURE_END_MARKER = '<!-- PODCAST_FEATURE_END -->';

const PLATFORM_META = {
    spotify: {
        label: 'Spotify',
        icon: '<svg class="w-4 h-4 fill-current text-[#1DB954] shrink-0" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.497 17.306c-.215.353-.674.465-1.026.25-2.812-1.718-6.353-2.106-10.523-1.153-.404.093-.803-.16-.895-.563-.092-.403.16-.803.563-.895 4.568-1.044 8.49-.606 11.632 1.334.352.216.464.675.249 1.027zm1.467-3.26c-.27.44-.849.578-1.288.307-3.218-1.978-8.125-2.55-11.933-1.393-.497.151-1.025-.133-1.176-.63-.152-.497.133-1.025.63-1.176 4.356-1.322 9.774-.682 13.46 1.583.44.27.577.85.307 1.309zm.126-3.41c-3.858-2.29-10.223-2.502-13.896-1.387-.59.18-1.22-.16-1.398-.75-.18-.59.16-1.22.75-1.399 4.225-1.283 11.258-1.037 15.707 1.603.53.315.704 1.002.39 1.532-.316.53-1.003.704-1.553.401z"/></svg>'
    },
    apple: {
        label: 'Apple Podcasts',
        icon: '<svg class="w-4 h-4 fill-current text-[#D56DFB] shrink-0" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1a11 11 0 0 0-8.65 17.78c.32.42.94.46 1.31.09l.1-.1a.93.93 0 0 0 .06-1.23A9 9 0 1 1 19.18 17.5a.93.93 0 0 0 .06 1.23l.1.1c.37.37.99.33 1.31-.09A11 11 0 0 0 12 1zm0 4.5a6.5 6.5 0 0 0-4.96 10.7c.33.39.92.41 1.28.05a.9.9 0 0 0 .05-1.2A4.7 4.7 0 1 1 15.63 15a.9.9 0 0 0 .05 1.2c.36.36.95.34 1.28-.05A6.5 6.5 0 0 0 12 5.5zm0 4a2.5 2.5 0 0 0-.9 4.83l-.52 4.44A1.15 1.15 0 0 0 11.72 20h.56a1.15 1.15 0 0 0 1.14-1.23l-.52-4.44A2.5 2.5 0 0 0 12 9.5z"/></svg>'
    },
    youtube: {
        label: 'YouTube',
        icon: '<svg class="w-4 h-4 fill-current text-[#FF0000] shrink-0" viewBox="0 0 24 24" aria-hidden="true"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>'
    }
};

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function extractYoutubeId(rawInput) {
    if (!rawInput || typeof rawInput !== 'string') return '';
    const trimmed = rawInput.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
    const patterns = [
        /youtu\.be\/([a-zA-Z0-9_-]{11})/,
        /youtube(?:-nocookie)?\.com\/(?:watch\?.*v=|embed\/|shorts\/|live\/)([a-zA-Z0-9_-]{11})/
    ];
    for (const pattern of patterns) {
        const match = trimmed.match(pattern);
        if (match && match[1]) return match[1];
    }
    return '';
}

function renderPlatformButtons(platforms = {}) {
    const order = ['spotify', 'apple', 'youtube'];
    const keys = [
        ...order.filter((k) => platforms[k]),
        ...Object.keys(platforms).filter((k) => !order.includes(k) && platforms[k])
    ];
    return keys
        .map((key) => {
            const url = escapeHtml(platforms[key]);
            const meta = PLATFORM_META[key] || {
                label: escapeHtml(key.charAt(0).toUpperCase() + key.slice(1)),
                icon: '<i data-lucide="headphones" class="w-4 h-4 text-[#C85A32]"></i>'
            };
            return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="h-10 px-4 rounded-full bg-white/5 hover:bg-white/10 text-white text-xs font-mono uppercase tracking-wider inline-flex items-center gap-2 shadow-[0_0_0_1px_rgba(255,255,255,0.1)] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.2)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">${meta.icon}<span>${meta.label}</span></a>`;
        })
        .join('\n                        ');
}

function renderEpisodeCard(episode, showTitle) {
    const ytId = extractYoutubeId(episode.youtubeId) || extractYoutubeId(episode.platforms && episode.platforms.youtube);
    const epNum = episode.episodeNumber ? `Aflevering ${String(episode.episodeNumber).padStart(2, '0')}` : 'Podcast';
    const title = escapeHtml(episode.title || 'Podcast Aflevering');
    const description = escapeHtml(episode.description || '');
    const slug = escapeHtml(episode.slug || `aflevering-${episode.episodeNumber || 1}`);
    const buttonsHtml = renderPlatformButtons(episode.platforms || {});
    const videoBlock = ytId
        ? `<iframe class="w-full h-full" src="https://www.youtube-nocookie.com/embed/${ytId}" title="${title} - ${escapeHtml(showTitle)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
        : `<div class="w-full h-full flex items-center justify-center text-xs font-mono text-neutral-400">Video volgt binnenkort</div>`;

    return `        <article id="${slug}" class="bg-[#141414] rounded-2xl overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.08)] grid grid-cols-1 md:grid-cols-12 gap-0">
            <div class="md:col-span-7 aspect-video bg-black">${videoBlock}</div>
            <div class="md:col-span-5 p-6 sm:p-8 flex flex-col justify-between space-y-6">
                <div class="space-y-3">
                    <div class="flex items-center justify-between text-xs font-mono text-neutral-400">
                        <span class="text-[#C85A32] uppercase tracking-wider">${escapeHtml(epNum)}</span>
                        <span>${escapeHtml(showTitle)}</span>
                    </div>
                    <h2 class="font-serif text-2xl sm:text-3xl font-semibold text-white tracking-[-0.02em]">${title}</h2>
                    <p class="text-neutral-300 text-sm leading-relaxed">${description}</p>
                </div>
                <div class="space-y-2.5 pt-2">
                    <span class="block text-xs font-mono uppercase tracking-wider text-neutral-400">Luister of kijk via</span>
                    <div class="flex flex-wrap gap-2.5">${buttonsHtml}</div>
                </div>
            </div>
        </article>`;
}

function renderFeaturedHomeSection(data) {
    const episodes = Array.isArray(data.episodes) ? data.episodes : [];
    if (episodes.length === 0) return '';
    const latest = episodes[0];
    const showTitle = (data.show && data.show.title) || 'De Wimpies Podcast';
    const ytId = extractYoutubeId(latest.youtubeId) || extractYoutubeId(latest.platforms && latest.platforms.youtube);
    const epNum = latest.episodeNumber ? `Aflevering ${String(latest.episodeNumber).padStart(2, '0')}` : 'Nieuwste Aflevering';
    const title = escapeHtml(latest.title || showTitle);
    const description = escapeHtml(latest.description || '');
    const buttonsHtml = renderPlatformButtons(latest.platforms || {});

    return `${FEATURE_START_MARKER}
    <section id="podcast" class="max-w-7xl mx-auto w-full px-4 sm:px-8 py-8">
        <div class="flex flex-col sm:flex-row sm:items-end justify-between mb-6 gap-4">
            <div>
                <span class="text-xs font-mono uppercase tracking-[0.2em] text-[#C85A32]">Nieuw: Videopodcast</span>
                <h2 class="font-serif text-3xl sm:text-4xl font-semibold text-white tracking-[-0.03em] mt-1">${escapeHtml(showTitle)}</h2>
            </div>
            <a href="podcast.html" class="text-xs font-mono uppercase tracking-wider text-[#C85A32] hover:underline">Alle afleveringen bekijken &rarr;</a>
        </div>
        <article class="bg-[#141414] rounded-2xl overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.08)] grid grid-cols-1 md:grid-cols-12 gap-0">
            <div class="md:col-span-7 aspect-video bg-black">
                <iframe class="w-full h-full" src="https://www.youtube-nocookie.com/embed/${ytId}" title="${title} - ${escapeHtml(showTitle)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
            </div>
            <div class="md:col-span-5 p-6 sm:p-8 flex flex-col justify-between space-y-6">
                <div class="space-y-3">
                    <div class="flex items-center justify-between text-xs font-mono text-neutral-400">
                        <span class="text-[#C85A32] uppercase tracking-wider">${escapeHtml(epNum)}</span>
                        <span>Video &amp; Audio</span>
                    </div>
                    <h3 class="font-serif text-2xl sm:text-3xl font-semibold text-white tracking-[-0.02em]">${title}</h3>
                    <p class="text-neutral-300 text-sm leading-relaxed">${description}</p>
                </div>
                <div class="space-y-2.5 pt-2">
                    <span class="block text-xs font-mono uppercase tracking-wider text-neutral-400">Kijk of beluister op</span>
                    <div class="flex flex-wrap gap-2.5">${buttonsHtml}</div>
                </div>
            </div>
        </article>
    </section>
    ${FEATURE_END_MARKER}`;
}

function renderPodcastPage(data) {
    const show = data.show || {};
    const showTitle = show.title || 'De Wimpies Podcast';
    const showSubtitle = show.subtitle || "Verhalen, muziek en gesprekken met de bandleden van Wimpie & de Domino's vanuit onze oefenruimte in Amsterdam.";
    const episodes = Array.isArray(data.episodes) ? data.episodes : [];
    const showButtons = renderPlatformButtons(show.platforms || (episodes[0] && episodes[0].platforms) || {});
    const episodesHtml = episodes.map((ep) => renderEpisodeCard(ep, showTitle)).join('\n\n');

    return `<!DOCTYPE html>
<html lang="nl" class="scroll-smooth bg-[#0C0C0C]">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(showTitle)} | Wimpie &amp; de Domino's</title>
    <meta name="description" content="Kijk en beluister ${escapeHtml(showTitle)} van Wimpie &amp; de Domino's via YouTube, Spotify en Apple Podcasts.">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..600;1,9..144,400..600&family=JetBrains+Mono:wght@400;500&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <script src="app.js" defer></script>
</head>
<body class="bg-[#0C0C0C] text-[#FDFBF7] font-sans antialiased selection:bg-[#C85A32] selection:text-white min-h-screen flex flex-col justify-between">
    <header class="sticky top-0 z-50 bg-[#0C0C0C]/90 backdrop-blur-md shadow-[0_1px_0_0_rgba(255,255,255,0.08)] px-4 sm:px-8 py-3">
        <div class="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-3">
            <a href="index.html" class="flex items-center gap-2 text-xs font-mono tracking-[0.2em] text-neutral-300 uppercase hover:text-white transition">
                <span class="w-2 h-2 rounded-full bg-[#C85A32] animate-pulse"></span>
                <span>Wimpie &amp; de Domino's</span>
            </a>
            <div class="flex items-center gap-2 sm:gap-3">
                <a href="/s/rozen" class="h-9 px-3.5 rounded-full bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] transition">Nieuwe Single</a>
                <a href="podcast.html" aria-current="page" class="h-9 px-3.5 rounded-full bg-[#C85A32] text-white text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_0_1px_rgba(200,90,50,0.5)] transition">Podcast</a>
                <a href="wall-of-fame.html" class="h-9 px-3.5 rounded-full bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-mono uppercase tracking-wider hidden sm:flex items-center gap-1.5 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] transition">Wall of Fame</a>
                <a href="boeken.html" class="h-9 px-3.5 rounded-full bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] transition">Boek optreden</a>
                <a href="contact.html" class="h-9 px-3.5 rounded-full bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-mono uppercase tracking-wider hidden md:flex items-center gap-1.5 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] transition">Contact</a>
                <a href="index.html" class="h-9 px-3.5 rounded-full bg-white/10 hover:bg-white/20 text-neutral-200 text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_0_1px_rgba(255,255,255,0.12)] transition">&larr; Home</a>
            </div>
        </div>
    </header>
    <section class="max-w-7xl mx-auto w-full px-4 sm:px-8 pt-12 pb-8">
        <div class="max-w-3xl space-y-4">
            <span class="inline-block text-xs font-mono uppercase tracking-[0.25em] text-[#C85A32]">Video &amp; Audio</span>
            <h1 class="font-serif text-4xl sm:text-6xl font-semibold text-white tracking-[-0.035em] leading-[1.05]">${escapeHtml(showTitle)}</h1>
            <p class="text-neutral-300 text-base sm:text-lg font-normal leading-relaxed">${escapeHtml(showSubtitle)}</p>
            <div class="flex flex-wrap items-center gap-2.5 pt-2">${showButtons}</div>
        </div>
    </section>
    <main class="max-w-7xl mx-auto w-full px-4 sm:px-8 py-6 space-y-12 flex-1">
${episodesHtml}
        <section class="bg-[#141414] rounded-2xl p-8 sm:p-10 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] flex flex-col md:flex-row items-center justify-between gap-6">
            <div class="space-y-2 text-center md:text-left max-w-2xl">
                <span class="text-xs font-mono uppercase tracking-[0.2em] text-[#C85A32]">Boekingen</span>
                <h3 class="font-serif text-2xl sm:text-3xl font-semibold text-white">Wil je ons ook live meemaken?</h3>
                <p class="text-neutral-400 text-sm sm:text-base leading-relaxed">Haal Wimpie &amp; de Domino's naar jouw zorgcentrum, festival, feest of theaterzaal.</p>
            </div>
            <a href="boeken.html" class="shrink-0 h-12 px-7 rounded-full bg-[#C85A32] hover:bg-[#B34E2A] text-white text-xs font-mono uppercase tracking-wider flex items-center gap-2 shadow-[0_0_0_1px_rgba(200,90,50,0.5)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#141414]">Direct Boeken &rarr;</a>
        </section>
    </main>
    <footer class="bg-[#08090A] shadow-[0_-1px_0_0_rgba(255,255,255,0.08)] py-8 px-4 sm:px-8 text-xs font-mono text-neutral-400 mt-12">
        <div class="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
            <p>&copy; 2026 VOF Wimpie &amp; de Domino's | Admiraal de Ruijterweg, Amsterdam | KvK: 96802863</p>
            <div class="flex flex-wrap justify-center gap-4 text-xs">
                <a href="index.html" class="hover:text-white transition">&larr; Hoofdpagina</a>
                <a href="/s/rozen" class="hover:text-white transition">Nieuwe Single</a>
                <a href="podcast.html" class="hover:text-white transition">Podcast</a>
                <a href="wall-of-fame.html" class="hover:text-white transition">Wall of Fame</a>
                <a href="boeken.html" class="hover:text-white transition">Boek optreden</a>
                <a href="contact.html" class="hover:text-white transition">Contact &amp; Aanmelding</a>
            </div>
        </div>
    </footer>
</body>
</html>
`;
}

function buildPodcasts() {
    console.log('Building podcast pages from data/podcasts.json...');
    if (!fs.existsSync(DATA_FILE)) {
        console.error('Error: data/podcasts.json not found');
        process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    const podcastHtml = renderPodcastPage(data);
    fs.writeFileSync(PODCAST_PAGE_FILE, podcastHtml, 'utf-8');
    console.log('Generated: podcast.html');

    if (fs.existsSync(INDEX_PAGE_FILE)) {
        const indexHtml = fs.readFileSync(INDEX_PAGE_FILE, 'utf-8');
        const startIdx = indexHtml.indexOf(FEATURE_START_MARKER);
        const endIdx = indexHtml.indexOf(FEATURE_END_MARKER);
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
            const featuredHtml = renderFeaturedHomeSection(data);
            const updatedIndex =
                indexHtml.slice(0, startIdx) +
                featuredHtml +
                indexHtml.slice(endIdx + FEATURE_END_MARKER.length);
            fs.writeFileSync(INDEX_PAGE_FILE, updatedIndex, 'utf-8');
            console.log('Updated featured podcast section in: index.html');
        }
    }
}

if (require.main === module) {
    buildPodcasts();
}

module.exports = {
    extractYoutubeId,
    renderEpisodeCard,
    renderFeaturedHomeSection,
    renderPodcastPage,
    buildPodcasts
};
