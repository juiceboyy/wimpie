/**
 * tickets-api.js - Publieke API voor ticketbeschikbaarheid, reservering en vrijgave
 */

const fs = require('fs');
const path = require('path');
const { readTicketState, mutateTicketState, computeShowAvailability } = require('./ticket-store');

const HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
};

function jsonResponse(statusCode, body) {
    return { statusCode, headers: HEADERS, body: JSON.stringify(body) };
}

function loadShowsConfig() {
    const candidates = [
        path.join(process.cwd(), 'data', 'shows.json'),
        path.join(__dirname, '..', '..', 'data', 'shows.json'),
        path.join(__dirname, 'data', 'shows.json')
    ];
    for (const p of candidates) {
        if (fs.existsSync(p)) {
            return JSON.parse(fs.readFileSync(p, 'utf-8'));
        }
    }
    return { shows: [] };
}

function getVisibleShowsMap() {
    const config = loadShowsConfig();
    const list = Array.isArray(config.shows) ? config.shows : [];
    const map = new Map();
    for (const show of list) {
        if (show && show.slug && show.status !== 'hidden' && !show.hidden) {
            map.set(show.slug, show);
        }
    }
    return map;
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: HEADERS, body: '' };
    }

    if (event.httpMethod === 'GET') {
        try {
            const showsMap = getVisibleShowsMap();
            const state = await readTicketState(event);
            const counts = state.counts || {};
            const availability = {};
            for (const [slug, show] of showsMap.entries()) {
                availability[slug] = computeShowAvailability(show, counts[slug]);
            }
            return jsonResponse(200, { ok: true, shows: availability });
        } catch (err) {
            return jsonResponse(500, { error: err.message || 'Kon beschikbaarheid niet ophalen.' });
        }
    }

    if (event.httpMethod !== 'POST') {
        return jsonResponse(405, { error: 'Methode niet toegestaan.' });
    }

    let body = {};
    try {
        body = event.body ? JSON.parse(event.body) : {};
    } catch (e) {
        return jsonResponse(400, { error: 'Ongeldige JSON in verzoek.' });
    }

    const action = String(body.action || '').toLowerCase();
    const showSlug = typeof body.showSlug === 'string' ? body.showSlug.trim() : '';
    const refCode = typeof body.refCode === 'string' ? body.refCode.trim() : '';

    if (action === 'reserve') {
        const quantity = Number(body.quantity);
        if (!showSlug || !refCode || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
            return jsonResponse(400, { error: 'Ongeldige reserveringsgegevens (show, aantal 1-10 en referentiecode vereist).' });
        }

        const showsMap = getVisibleShowsMap();
        const show = showsMap.get(showSlug);
        if (!show) {
            return jsonResponse(404, { error: 'Show niet gevonden of niet beschikbaar.' });
        }
        if (show.status === 'sold_out') {
            return jsonResponse(409, {
                error: 'Deze show is helaas uitverkocht.',
                soldOut: true,
                remaining: 0
            });
        }

        try {
            const result = await mutateTicketState(event, (state) => {
                if (state.recentRefs.some(r => r.refCode === refCode)) {
                    return {
                        abort: true,
                        statusCode: 200,
                        payload: {
                            ok: true,
                            alreadyCounted: true,
                            availability: computeShowAvailability(show, state.counts[showSlug])
                        }
                    };
                }

                const cap = Number(show.maxTickets) > 0 ? Math.floor(Number(show.maxTickets)) : 0;
                const sold = Math.max(0, Number(state.counts[showSlug]) || 0);

                if (cap > 0 && sold + quantity > cap) {
                    const remaining = Math.max(0, cap - sold);
                    const msg = remaining === 0
                        ? 'Deze show is helaas uitverkocht.'
                        : `Er ${remaining === 1 ? 'is' : 'zijn'} nog maar ${remaining} ${remaining === 1 ? 'kaart' : 'kaarten'} beschikbaar voor deze show.`;
                    return {
                        abort: true,
                        statusCode: 409,
                        payload: {
                            error: msg,
                            remaining,
                            sold,
                            maxTickets: cap,
                            soldOut: remaining === 0
                        }
                    };
                }

                state.counts[showSlug] = sold + quantity;
                state.recentRefs.push({
                    refCode,
                    slug: showSlug,
                    qty: quantity,
                    at: new Date().toISOString()
                });
                state.updatedAt = new Date().toISOString();
                return { sold: state.counts[showSlug] };
            }, `Reserveer ${quantity}x ${showSlug} (${refCode}) [skip ci]`);

            if (result.aborted) {
                return jsonResponse(result.statusCode, result.payload);
            }

            return jsonResponse(200, {
                ok: true,
                availability: computeShowAvailability(show, result.state.counts[showSlug])
            });
        } catch (err) {
            return jsonResponse(500, { error: err.message || 'Kon kaarten niet reserveren.' });
        }
    }

    if (action === 'release') {
        if (!refCode) {
            return jsonResponse(400, { error: 'Referentiecode ontbreekt.' });
        }

        try {
            const showsMap = getVisibleShowsMap();
            const result = await mutateTicketState(event, (state) => {
                const idx = state.recentRefs.findIndex(r => r.refCode === refCode);
                if (idx === -1) {
                    return {
                        abort: true,
                        statusCode: 200,
                        payload: { ok: true, released: false }
                    };
                }
                const entry = state.recentRefs[idx];
                state.recentRefs.splice(idx, 1);
                const prevSold = Math.max(0, Number(state.counts[entry.slug]) || 0);
                state.counts[entry.slug] = Math.max(0, prevSold - (Number(entry.qty) || 0));
                state.updatedAt = new Date().toISOString();
                return { released: true, slug: entry.slug };
            }, `Vrijgave reservering ${refCode} [skip ci]`);

            if (result.aborted) {
                return jsonResponse(result.statusCode, result.payload);
            }
            const slug = result.outcome && result.outcome.slug;
            const show = slug ? showsMap.get(slug) : null;
            return jsonResponse(200, {
                ok: true,
                released: true,
                availability: show ? computeShowAvailability(show, result.state.counts[slug]) : null
            });
        } catch (err) {
            return jsonResponse(500, { error: err.message || 'Vrijgeven mislukt.' });
        }
    }

    return jsonResponse(400, { error: `Onbekende actie: ${action}` });
};
