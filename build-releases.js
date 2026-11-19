#!/usr/bin/env node
/**
 * build-releases.js
 * Generates static release landing pages under s/:slug/index.html
 * based on data/releases.json and s/template.html.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const DATA_FILE = path.join(ROOT_DIR, 'data', 'releases.json');
const TEMPLATE_FILE = path.join(ROOT_DIR, 's', 'template.html');
const OUTPUT_DIR = path.join(ROOT_DIR, 's');
const INDEX_PAGE_FILE = path.join(ROOT_DIR, 'index.html');
const MUZIEK_PAGE_FILE = path.join(ROOT_DIR, 'muziek.html');
const FEATURE_START_MARKER = '<!-- RELEASE_FEATURE_START -->';
const FEATURE_END_MARKER = '<!-- RELEASE_FEATURE_END -->';

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const PLATFORM_CONFIG = {
    spotify: {
        name: 'Spotify',
        action: 'Play',
        btnBg: 'bg-[#1DB954]',
        hoverBg: 'group-hover:bg-[#1DB954]',
        hoverText: 'group-hover:text-black',
        icon: `<svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.497 17.306c-.215.353-.674.465-1.026.25-2.812-1.718-6.353-2.106-10.523-1.153-.404.093-.803-.16-.895-.563-.092-.403.16-.803.563-.895 4.568-1.044 8.49-.606 11.632 1.334.352.216.464.675.249 1.027zm1.467-3.26c-.27.44-.849.578-1.288.307-3.218-1.978-8.125-2.55-11.933-1.393-.497.151-1.025-.133-1.176-.63-.152-.497.133-1.025.63-1.176 4.356-1.322 9.774-.682 13.46 1.583.44.27.577.85.307 1.309zm.126-3.41c-3.858-2.29-10.223-2.502-13.896-1.387-.59.18-1.22-.16-1.398-.75-.18-.59.16-1.22.75-1.399 4.225-1.283 11.258-1.037 15.707 1.603.53.315.704 1.002.39 1.532-.316.53-1.003.704-1.553.401z"/></svg>`
    },
    apple: {
        name: 'Apple Music',
        action: 'Play',
        btnBg: 'bg-gradient-to-br from-[#FC3C44] to-[#F9243F]',
        hoverBg: 'group-hover:bg-[#FC3C44]',
        hoverText: 'group-hover:text-white',
        icon: `<svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.63-.76 1.06-1.82.94-2.88-.91.04-2.02.61-2.67 1.37-.58.67-1.09 1.74-.95 2.78 1.02.08 2.05-.51 2.68-1.27z"/></svg>`
    },
    youtube: {
        name: 'YouTube',
        action: 'Watch',
        btnBg: 'bg-[#FF0000]',
        hoverBg: 'group-hover:bg-[#FF0000]',
        hoverText: 'group-hover:text-white',
        icon: `<svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`
    }
};

function renderPlatformItem(key, url) {
    const config = PLATFORM_CONFIG[key] || {
        name: key.charAt(0).toUpperCase() + key.slice(1),
        action: 'Play',
        btnBg: 'bg-neutral-700',
        hoverBg: 'group-hover:bg-[#C85A32]',
        hoverText: 'group-hover:text-white',
        icon: '<i data-lucide="music" class="w-5 h-5"></i>'
    };

    return `                    <!-- ${config.name} -->
                    <a href="${url}"
                       target="_blank" rel="noopener noreferrer"
                       class="flex items-center justify-between p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] shadow-[0_0_0_1px_rgba(255,255,255,0.06)] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.14)] transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-xl ${config.btnBg} text-white flex items-center justify-center shrink-0 shadow-sm">
                                ${config.icon}
                            </div>
                            <span class="font-medium text-white text-sm">${config.name}</span>
                        </div>
                        <span class="h-8 px-4 rounded-full bg-white/10 ${config.hoverBg} text-neutral-200 ${config.hoverText} text-xs font-mono uppercase tracking-wider flex items-center justify-center transition shadow-[0_0_0_1px_rgba(255,255,255,0.1)] group-hover:shadow-none">
                            ${config.action}
                        </span>
                    </a>`;
}

function renderVideoSection(youtubeId, title, artist) {
    if (!youtubeId) return '';

    return `            <div class="pt-1">
                <div class="relative w-full aspect-video rounded-2xl overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.1)] bg-black">
                    <iframe
                        class="absolute top-0 left-0 w-full h-full"
                        src="https://www.youtube-nocookie.com/embed/${youtubeId}"
                        title="${artist} - ${title}"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowfullscreen>
                    </iframe>
                </div>
            </div>`;
}

function buildReleases() {
    console.log('Building release pages from data/releases.json...');

    if (!fs.existsSync(DATA_FILE)) {
        console.error('Error: data/releases.json not found');
        process.exit(1);
    }
    if (!fs.existsSync(TEMPLATE_FILE)) {
        console.error('Error: s/template.html not found');
        process.exit(1);
    }

    const releases = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    const template = fs.readFileSync(TEMPLATE_FILE, 'utf-8');

    const slugs = Object.keys(releases);
    if (slugs.length === 0) {
        console.warn('No releases found in data/releases.json');
        return;
    }

    slugs.forEach((slug) => {
        const data = releases[slug];
        const targetDir = path.join(OUTPUT_DIR, slug);

        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        const platformsList = Object.entries(data.platforms || {})
            .map(([platform, url]) => renderPlatformItem(platform, url))
            .join('\n\n');

        const videoSection = renderVideoSection(data.youtubeId, data.title, data.artist);

        let pageHtml = template
            .replace(/\{\{TITLE\}\}/g, data.title)
            .replace(/\{\{ARTIST\}\}/g, data.artist)
            .replace(/\{\{BADGE\}\}/g, data.badge || 'Nieuwe Single')
            .replace(/\{\{DESCRIPTION\}\}/g, data.description || '')
            .replace(/\{\{ARTWORK\}\}/g, data.artwork || '/single-cover.jpg')
            .replace(/\{\{VIDEO_SECTION\}\}/g, videoSection)
            .replace(/\{\{PLATFORMS_LIST\}\}/g, platformsList);

        const targetFile = path.join(targetDir, 'index.html');
        fs.writeFileSync(targetFile, pageHtml, 'utf-8');
        console.log(`Generated: s/${slug}/index.html`);
    });

    // Write index redirect for /s/ pointing to the first/latest release
    const latestSlug = slugs[0];
    const indexRedirectHtml = `<!DOCTYPE html>
<html lang="nl">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="refresh" content="0; url=/s/${latestSlug}">
    <title>Redirecting...</title>
    <link rel="icon" href="/favicon.ico" sizes="any">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
</head>
<body style="background:#0C0C0C;color:#fff;font-family:sans-serif;padding:2rem;">
    <p>Doorsturen naar <a href="/s/${latestSlug}" style="color:#C85A32;">/s/${latestSlug}</a>...</p>
</body>
</html>`;

    fs.writeFileSync(path.join(OUTPUT_DIR, 'index.html'), indexRedirectHtml, 'utf-8');
    console.log(`Generated: s/index.html (redirecting to /s/${latestSlug})`);

    updateHomeFeaturedRelease(latestSlug, releases[latestSlug]);
    fs.writeFileSync(MUZIEK_PAGE_FILE, renderMuziekPage(releases), 'utf-8');
    console.log('Generated: muziek.html');
    console.log(`Successfully built ${slugs.length} release page(s).`);
}

function renderReleaseCard(slug, release) {
    const artwork = escapeHtml(release.artwork || '/single-cover.jpg');
    const title = escapeHtml(release.title || 'Single');
    const badge = escapeHtml(release.badge || 'Single');
    const desc = escapeHtml(release.description || '');
    const buttons = Object.entries(release.platforms || {}).map(([key, url]) => {
        const cfg = PLATFORM_CONFIG[key] || { name: key.charAt(0).toUpperCase() + key.slice(1), icon: '<i data-lucide="music" class="w-4 h-4"></i>' };
        return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="h-10 px-4 rounded-full bg-white/5 hover:bg-white/10 text-white text-xs font-mono uppercase tracking-wider inline-flex items-center gap-2 shadow-[0_0_0_1px_rgba(255,255,255,0.1)] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.2)] transition">${cfg.icon}<span>${escapeHtml(cfg.name)}</span></a>`;
    }).join('');
    return `        <article id="${escapeHtml(slug)}" class="bg-[#141414] rounded-2xl overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.08)] grid grid-cols-1 md:grid-cols-12 gap-0 items-stretch">
            <div class="md:col-span-4 bg-black/50 p-6 flex items-center justify-center"><a href="/s/${escapeHtml(slug)}" class="block w-full max-w-[260px] aspect-square rounded-xl overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.1)]"><img src="${artwork}" alt="Cover ${title}" class="w-full h-full object-cover hover:scale-105 transition duration-500"></a></div>
            <div class="md:col-span-8 p-6 sm:p-10 flex flex-col justify-between space-y-6">
                <div class="space-y-3">
                    <div class="flex items-center justify-between gap-2 text-xs font-mono"><span class="text-[#C85A32] uppercase tracking-wider">${badge}</span><a href="/s/${escapeHtml(slug)}" class="text-neutral-400 hover:text-white transition">Open releasepagina &rarr;</a></div>
                    <h2 class="font-serif text-2xl sm:text-3xl font-semibold text-white tracking-[-0.02em]">${title}</h2>
                    <p class="text-neutral-300 text-sm sm:text-base leading-relaxed whitespace-pre-line">${desc}</p>
                </div>
                <div class="flex flex-wrap gap-2.5 pt-2">${buttons}</div>
            </div>
        </article>`;
}

function renderMuziekPage(releases) {
    const cards = Object.entries(releases).map(([slug, r]) => renderReleaseCard(slug, r)).join('\n\n');
    return `<!DOCTYPE html>
<html lang="nl" class="scroll-smooth bg-[#0C0C0C]">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Muziek &amp; Singles | Wimpie &amp; de Domino's</title>
    <meta name="description" content="Alle singles en muziekreleases van Wimpie &amp; de Domino's op Spotify, Apple Music en YouTube.">
    <link rel="icon" href="/favicon.ico" sizes="any">
    <link rel="icon" href="/icons/favicon-32x32.png" type="image/png" sizes="32x32">
    <link rel="icon" href="/icons/favicon-16x16.png" type="image/png" sizes="16x16">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <link rel="manifest" href="/site.webmanifest">
    <meta name="theme-color" content="#0C0C0C">
    <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..600;1,9..144,400..600&family=JetBrains+Mono:wght@400;500&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script><script src="https://unpkg.com/lucide@latest"></script><script src="app.js" defer></script>
</head>
<body class="bg-[#0C0C0C] text-[#FDFBF7] font-sans antialiased selection:bg-[#C85A32] selection:text-white min-h-screen flex flex-col justify-between">
    <header class="sticky top-0 z-50 bg-[#0C0C0C]/90 backdrop-blur-md shadow-[0_1px_0_0_rgba(255,255,255,0.08)] px-4 sm:px-8 py-3">
        <div class="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-3">
            <a href="index.html" class="flex items-center gap-2 text-xs font-mono tracking-[0.2em] text-neutral-300 uppercase hover:text-white transition"><span class="w-2 h-2 rounded-full bg-[#C85A32] animate-pulse"></span><span>Wimpie &amp; de Domino's</span></a>
            <div class="flex items-center gap-2 sm:gap-3">
                <a href="tickets.html" class="h-9 px-3.5 rounded-full bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] transition">Tickets</a>
                <a href="muziek.html" aria-current="page" class="h-9 px-3.5 rounded-full bg-[#C85A32] text-white text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_0_1px_rgba(200,90,50,0.5)] transition">Muziek</a>
                <a href="podcast.html" class="h-9 px-3.5 rounded-full bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] transition">Podcast</a>
                <a href="wall-of-fame.html" class="h-9 px-3.5 rounded-full bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-mono uppercase tracking-wider hidden sm:flex items-center gap-1.5 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] transition">Wall of Fame</a>
                <a href="boeken.html" class="h-9 px-3.5 rounded-full bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] transition">Boek optreden</a>
                <a href="index.html" class="h-9 px-3.5 rounded-full bg-white/10 hover:bg-white/20 text-neutral-200 text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_0_1px_rgba(255,255,255,0.12)] transition">&larr; Home</a>
            </div>
        </div>
    </header>
    <section class="max-w-7xl mx-auto w-full px-4 sm:px-8 pt-12 pb-8">
        <div class="max-w-3xl space-y-4">
            <span class="inline-block text-xs font-mono uppercase tracking-[0.25em] text-[#C85A32]">Discografie</span>
            <h1 class="font-serif text-4xl sm:text-6xl font-semibold text-white tracking-[-0.035em] leading-[1.05]">Onze Muziek</h1>
            <p class="text-neutral-300 text-base sm:text-lg font-normal leading-relaxed">Alle singles en releases van Wimpie &amp; de Domino's. Beluister via Spotify, Apple Music of bekijk de videoclip op YouTube.</p>
        </div>
    </section>
    <main class="max-w-7xl mx-auto w-full px-4 sm:px-8 py-6 space-y-8 flex-1">
${cards}
    </main>
    <footer class="bg-[#08090A] shadow-[0_-1px_0_0_rgba(255,255,255,0.08)] py-8 px-4 sm:px-8 text-xs font-mono text-neutral-400 mt-12">
        <div class="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
            <p>&copy; 2026 VOF Wimpie &amp; de Domino's | Amsterdam | KvK: 96802863</p>
            <div class="flex flex-wrap justify-center gap-4 text-xs"><a href="index.html" class="hover:text-white transition">&larr; Hoofdpagina</a><a href="tickets.html" class="hover:text-white transition">Tickets</a><a href="muziek.html" class="hover:text-white transition">Muziek</a><a href="podcast.html" class="hover:text-white transition">Podcast</a><a href="boeken.html" class="hover:text-white transition">Boek optreden</a></div>
        </div>
    </footer>
</body>
</html>\n`;
}

function updateHomeFeaturedRelease(slug, release) {
    if (!fs.existsSync(INDEX_PAGE_FILE) || !release) return;
    const indexHtml = fs.readFileSync(INDEX_PAGE_FILE, 'utf-8');
    const startIdx = indexHtml.indexOf(FEATURE_START_MARKER);
    const endIdx = indexHtml.indexOf(FEATURE_END_MARKER);
    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return;

    const artwork = escapeHtml(release.artwork || '/single-cover.jpg');
    const badge = escapeHtml(release.badge || 'Nieuwe Single Uit');
    const title = escapeHtml(release.title || 'Nieuwe Single');
    const sectionHtml = `${FEATURE_START_MARKER}
    <section class="max-w-7xl mx-auto w-full px-4 sm:px-8 py-8">
        <div class="bg-[#141414] rounded-2xl p-6 sm:p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] flex flex-col md:flex-row items-center justify-between gap-6">
            <div class="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
                <img src="${artwork}" alt="Cover ${title}" class="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover shadow-[0_0_0_1px_rgba(255,255,255,0.1)] shrink-0">
                <div class="space-y-1">
                    <span class="text-xs font-mono uppercase tracking-[0.2em] text-[#C85A32]">${badge}</span>
                    <h2 class="font-serif text-2xl sm:text-3xl font-semibold text-white tracking-[-0.02em]">${title}</h2>
                    <p class="text-neutral-400 text-sm max-w-xl">Beluister het nieuwste nummer op jouw favoriete streamingplatform.</p>
                </div>
            </div>
            <div class="flex flex-wrap items-center justify-center gap-3 shrink-0">
                <a href="muziek.html" class="h-11 px-5 rounded-full bg-white/5 hover:bg-white/10 text-neutral-200 text-xs font-mono uppercase tracking-wider flex items-center gap-2 shadow-[0_0_0_1px_rgba(255,255,255,0.12)] transition">Alle singles bekijken &rarr;</a>
                <a href="/s/${escapeHtml(slug)}" class="h-11 px-6 rounded-full bg-[#C85A32] hover:bg-[#B34E2A] text-white text-xs font-mono uppercase tracking-wider flex items-center gap-2 shadow-[0_0_0_1px_rgba(200,90,50,0.5)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#141414]"><i data-lucide="play" class="w-4 h-4"></i> Beluister Single</a>
            </div>
        </div>
    </section>
    ${FEATURE_END_MARKER}`;

    const updated = indexHtml.slice(0, startIdx) + sectionHtml + indexHtml.slice(endIdx + FEATURE_END_MARKER.length);
    fs.writeFileSync(INDEX_PAGE_FILE, updated, 'utf-8');
    console.log(`Updated featured release section in: index.html (/s/${slug})`);
}

buildReleases();
