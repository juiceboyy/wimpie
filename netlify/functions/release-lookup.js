/**
 * release-lookup.js - Zoekt automatisch Spotify, Apple Music en Deezer links op basis van een YouTube video of titel.
 */

const WIMPIE_ARTIST = "Wimpie & de Domino's";
const SPOTIFY_ARTIST_ID = '0Ydnz2FM9AVMdzMl3YDib0';
const ITUNES_ARTIST_ID = '1181081587';
const DEEZER_ARTIST_ID = '11493396';
const SPOTIFY_SEARCH_HASH = 'fcad5a3e0d5af727fb76966f06971c19cfa2275e6ff7671196753e008611873c';

function normalizeText(str) {
    return (str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function cleanYoutubeTitle(rawTitle) {
    if (!rawTitle || typeof rawTitle !== 'string') return '';
    return rawTitle
        .replace(/^wimpie\s*(?:&|en)\s*de\s*domino['\u2019]?s\s*[-\u2013\u2014:|]\s*/i, '')
        .replace(/\s*[-\u2013\u2014:|]\s*wimpie\s*(?:&|en)\s*de\s*domino['\u2019]?s.*$/i, '')
        .replace(/\s*[\(\[](?:offici[eë]le?\s*)?(?:video(?:clip)?|music\s*video|audio|lyrics?|hd|4k)[\)\]]/gi, '')
        .trim();
}

function titlesMatch(candidateTitle, targetNorm) {
    const normCand = normalizeText(candidateTitle);
    if (!normCand || !targetNorm) return false;
    return normCand === targetNorm || normCand.includes(targetNorm) || targetNorm.includes(normCand);
}

async function fetchYoutubeMeta(youtubeId) {
    if (!youtubeId) return null;
    try {
        const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${youtubeId}`)}&format=json`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        return {
            rawTitle: data.title || '',
            cleanTitle: cleanYoutubeTitle(data.title || ''),
            authorName: data.author_name || ''
        };
    } catch {
        return null;
    }
}

async function lookupSpotify(cleanTitle, artist) {
    const targetNorm = normalizeText(cleanTitle);
    const isWimpie = /wimpie|domino/i.test(artist);
    try {
        const res = await fetch(`https://open.spotify.com/embed/artist/${SPOTIFY_ARTIST_ID}`);
        if (!res.ok) return '';
        const html = await res.text();
        const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
        if (!m) return '';
        const data = JSON.parse(m[1]);

        if (isWimpie) {
            const list = data?.props?.pageProps?.state?.data?.entity?.trackList || [];
            const exact = list.find(t => normalizeText(t.title) === targetNorm) ||
                list.find(t => titlesMatch(t.title, targetNorm));
            if (exact && exact.uri) {
                return `https://open.spotify.com/track/${exact.uri.split(':').pop()}`;
            }
        }

        const token = data?.props?.pageProps?.state?.settings?.session?.accessToken;
        if (!token) return '';

        const variables = {
            searchTerm: `${artist.replace(/&/g, 'en')} ${cleanTitle}`,
            offset: 0,
            limit: 10,
            numberOfTopResults: 5,
            includeAudiobooks: false,
            includeArtistHasConcertsField: false,
            includePreReleases: false,
            includeLocalConcertsField: false
        };
        const extensions = {
            persistedQuery: { version: 1, sha256Hash: SPOTIFY_SEARCH_HASH }
        };
        const pfUrl = `https://api-partner.spotify.com/pathfinder/v1/query?operationName=searchDesktop&variables=${encodeURIComponent(JSON.stringify(variables))}&extensions=${encodeURIComponent(JSON.stringify(extensions))}`;
        const pfRes = await fetch(pfUrl, { headers: { Authorization: `Bearer ${token}` } });
        if (!pfRes.ok) return '';

        const pfData = await pfRes.json();
        const items = (pfData?.data?.searchV2?.tracksV2?.items || []).map(x => x.item?.data).filter(Boolean);
        const matchesArtist = t => !isWimpie || t.artists?.items?.some(a => /wimpie|domino/i.test(a.profile?.name || ''));
        const match = items.find(t => normalizeText(t.name) === targetNorm && matchesArtist(t)) ||
            items.find(t => titlesMatch(t.name, targetNorm) && matchesArtist(t));
        return match?.id ? `https://open.spotify.com/track/${match.id}` : '';
    } catch {
        return '';
    }
}

async function lookupAppleMusic(cleanTitle, artist) {
    const targetNorm = normalizeText(cleanTitle);
    const isWimpie = /wimpie|domino/i.test(artist);
    try {
        const searchQ = `${artist.replace(/&/g, 'en')} ${cleanTitle}`;
        const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchQ)}&entity=song&country=nl&limit=15`);
        const data = res.ok ? await res.json() : { results: [] };
        let results = data.results || [];

        if (results.length === 0 && isWimpie) {
            const lRes = await fetch(`https://itunes.apple.com/lookup?id=${ITUNES_ARTIST_ID}&entity=song&country=nl&limit=100`);
            if (lRes.ok) {
                const lData = await lRes.json();
                results = (lData.results || []).filter(r => r.wrapperType === 'track');
            }
        }

        const matchesArtist = r => !isWimpie || /wimpie|domino/i.test(r.artistName || '');
        const match = results.find(r => normalizeText(r.trackName) === targetNorm && matchesArtist(r)) ||
            results.find(r => titlesMatch(r.trackName, targetNorm) && matchesArtist(r));
        return match?.trackViewUrl ? match.trackViewUrl.replace(/&uo=4$/, '') : '';
    } catch {
        return '';
    }
}

async function lookupDeezer(cleanTitle, artist) {
    const targetNorm = normalizeText(cleanTitle);
    const isWimpie = /wimpie|domino/i.test(artist);
    try {
        const res = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(cleanTitle)}&limit=20`);
        const data = res.ok ? await res.json() : { data: [] };
        const list = data.data || [];
        const matchesArtist = t => !isWimpie || /wimpie|domino/i.test(t.artist?.name || '');

        let match = list.find(t => normalizeText(t.title) === targetNorm && matchesArtist(t)) ||
            list.find(t => titlesMatch(t.title, targetNorm) && matchesArtist(t));

        if (!match && isWimpie) {
            const albumsRes = await fetch(`https://api.deezer.com/artist/${DEEZER_ARTIST_ID}/albums?limit=50`);
            const albumsData = albumsRes.ok ? await albumsRes.json() : { data: [] };
            const albums = albumsData.data || [];
            const prioritized = [
                ...albums.filter(a => titlesMatch(a.title, targetNorm)),
                ...albums.filter(a => !titlesMatch(a.title, targetNorm)).slice(0, 5)
            ];
            for (const alb of prioritized) {
                const trRes = await fetch(`https://api.deezer.com/album/${alb.id}/tracks`);
                if (!trRes.ok) continue;
                const trData = await trRes.json();
                const found = (trData.data || []).find(t => titlesMatch(t.title, targetNorm));
                if (found) {
                    match = found;
                    break;
                }
            }
        }

        return match?.link || '';
    } catch {
        return '';
    }
}

async function lookupReleaseByYoutube({ youtubeId = '', title = '', artist = '' } = {}) {
    const ytMeta = youtubeId ? await fetchYoutubeMeta(youtubeId) : null;
    const resolvedTitle = cleanYoutubeTitle(title) || (ytMeta && ytMeta.cleanTitle) || '';
    const resolvedArtist = (artist || '').trim() || WIMPIE_ARTIST;

    const platforms = {};
    if (youtubeId) {
        platforms.youtube = `https://youtu.be/${youtubeId}`;
    }

    if (!resolvedTitle) {
        return {
            title: '',
            artist: resolvedArtist,
            youtubeId,
            platforms
        };
    }

    const [spotify, apple, deezer] = await Promise.all([
        lookupSpotify(resolvedTitle, resolvedArtist),
        lookupAppleMusic(resolvedTitle, resolvedArtist),
        lookupDeezer(resolvedTitle, resolvedArtist)
    ]);

    if (spotify) platforms.spotify = spotify;
    if (apple) platforms.apple = apple;
    if (deezer) platforms.deezer = deezer;

    return {
        title: resolvedTitle,
        artist: resolvedArtist,
        youtubeId,
        platforms
    };
}

module.exports = {
    lookupReleaseByYoutube,
    cleanYoutubeTitle,
    normalizeText
};
