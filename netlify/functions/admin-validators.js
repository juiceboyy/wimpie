/**
 * admin-validators.js - Validatiefuncties voor releases, podcasts en shows
 */

function validateReleases(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return 'Releases data moet een JSON object zijn met slug-keys.';
    }
    const entries = Object.entries(data);
    if (entries.length === 0) {
        return 'Releases data mag niet leeg zijn om dataverlies te voorkomen.';
    }
    for (const [slug, item] of entries) {
        if (!slug || typeof slug !== 'string' || !/^[a-z0-9_-]+$/i.test(slug)) {
            return `Ongeldige slug: "${slug}". Gebruik alleen kleine letters, cijfers en koppeltekens.`;
        }
        if (!item || typeof item !== 'object') {
            return `Release "${slug}" bevat ongeldige gegevens.`;
        }
        if (!item.title || typeof item.title !== 'string') {
            return `Release "${slug}" mist een titel.`;
        }
        if (!item.artist || typeof item.artist !== 'string') {
            return `Release "${slug}" mist een artiest.`;
        }
    }
    return null;
}

function validatePodcasts(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return 'Podcast data moet een JSON object zijn met "show" en "episodes".';
    }
    if (!data.show || typeof data.show.title !== 'string') {
        return 'Podcast data mist een geldige "show.title".';
    }
    if (!Array.isArray(data.episodes)) {
        return 'Podcast data mist een "episodes" array.';
    }
    for (let i = 0; i < data.episodes.length; i++) {
        const ep = data.episodes[i];
        if (!ep.title || typeof ep.title !== 'string') {
            return `Aflevering ${i + 1} mist een titel.`;
        }
    }
    return null;
}

function validateShows(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return 'Shows data moet een JSON object zijn met een "shows" array.';
    }
    if (!Array.isArray(data.shows)) {
        return 'Shows data mist een "shows" array.';
    }
    const allowedStatuses = ['available', 'few_left', 'sold_out', 'hidden'];
    const seenSlugs = new Set();

    for (let i = 0; i < data.shows.length; i++) {
        const show = data.shows[i];
        if (!show || typeof show !== 'object') {
            return `Show ${i + 1} bevat ongeldige gegevens.`;
        }
        if (!show.slug || typeof show.slug !== 'string' || !/^[a-z0-9_-]+$/i.test(show.slug)) {
            return `Show ${i + 1} heeft een ongeldige slug: "${show.slug || ''}". Gebruik alleen letters, cijfers en koppeltekens.`;
        }
        if (seenSlugs.has(show.slug)) {
            return `Dubbele slug gevonden: "${show.slug}". Elke show moet een unieke slug hebben.`;
        }
        seenSlugs.add(show.slug);

        if (!show.title || typeof show.title !== 'string' || !show.title.trim()) {
            return `Show "${show.slug}" mist een titel.`;
        }
        if (!show.date || typeof show.date !== 'string' || !show.date.trim()) {
            return `Show "${show.slug}" mist een datum.`;
        }
        if (typeof show.price !== 'number' || Number.isNaN(show.price) || !Number.isFinite(show.price) || show.price < 0) {
            return `Show "${show.slug}" heeft een ongeldige prijs.`;
        }
        const status = show.status || 'available';
        if (!allowedStatuses.includes(status)) {
            return `Show "${show.slug}" heeft een ongeldige status: "${status}".`;
        }
    }
    return null;
}

module.exports = {
    validateReleases,
    validatePodcasts,
    validateShows
};
