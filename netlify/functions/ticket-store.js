/**
 * ticket-store.js - Opslag en concurrency-veilig beheer van verkochte ticket-tellers
 */

const fs = require('fs');
const path = require('path');

const STATE_BRANCH = 'ticket-counts';
const MAX_RECENT_REFS = 200;

function ghHeaders(token, extra = {}) {
    return {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Wimpie-Ticketing-Netlify',
        ...extra
    };
}

function resolveEnvironmentKey(event) {
    const h = (event && event.headers) || {};
    const host = String(h.host || h.Host || '').toLowerCase();
    const ctx = String(process.env.CONTEXT || '').toLowerCase();

    if ((ctx && ctx !== 'production') ||
        (host.includes('--') && host.includes('.netlify.app')) ||
        host.startsWith('localhost') ||
        host.startsWith('127.0.0.1')) {
        return 'test';
    }
    return 'production';
}

function resolveDataDir() {
    const candidates = [
        path.join(process.cwd(), 'data'),
        path.join(__dirname, '..', '..', 'data'),
        path.join(__dirname, 'data')
    ];
    for (const dir of candidates) {
        if (fs.existsSync(dir)) return dir;
    }
    return candidates[0];
}

function resolveStateRelPath(envKey) {
    return `.ticket-state/${envKey}.json`;
}

function resolveLocalStatePath(envKey) {
    return path.join(resolveDataDir(), `.ticket-counts-${envKey}.local.json`);
}

async function ensureTicketBranch(repo, baseBranch, token) {
    const refUrl = `https://api.github.com/repos/${repo}/git/ref/heads/${STATE_BRANCH}`;
    const checkRes = await fetch(refUrl, { headers: ghHeaders(token) });
    if (checkRes.ok) return;
    if (checkRes.status !== 404) {
        throw new Error(`Kan branch ${STATE_BRANCH} niet controleren (${checkRes.status}).`);
    }

    let baseRes = await fetch(`https://api.github.com/repos/${repo}/git/ref/heads/${baseBranch}`, {
        headers: ghHeaders(token)
    });
    if (!baseRes.ok && baseBranch !== 'main') {
        baseRes = await fetch(`https://api.github.com/repos/${repo}/git/ref/heads/main`, {
            headers: ghHeaders(token)
        });
    }
    if (!baseRes.ok) {
        throw new Error(`Kan basisbranch voor ${STATE_BRANCH} niet ophalen (${baseRes.status}).`);
    }
    const baseData = await baseRes.json();
    const sha = baseData && baseData.object && baseData.object.sha;
    if (!sha) {
        throw new Error('Geen commit SHA gevonden om ticket-counts branch aan te maken.');
    }

    const createRes = await fetch(`https://api.github.com/repos/${repo}/git/refs`, {
        method: 'POST',
        headers: ghHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ ref: `refs/heads/${STATE_BRANCH}`, sha })
    });
    if (!createRes.ok && createRes.status !== 422) {
        throw new Error(`Aanmaken van branch ${STATE_BRANCH} mislukt (${createRes.status}).`);
    }
}

async function readTicketState(event) {
    const envKey = resolveEnvironmentKey(event);
    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPO || 'juiceboyy/wimpie';

    if (token) {
        const relPath = resolveStateRelPath(envKey);
        const url = `https://api.github.com/repos/${repo}/contents/${relPath}?ref=${STATE_BRANCH}`;
        const res = await fetch(url, { headers: ghHeaders(token) });
        if (res.status === 404) {
            return { counts: {}, recentRefs: [], updatedAt: null, sha: null };
        }
        if (!res.ok) {
            throw new Error(`Ticket-teller ophalen mislukt (${res.status}).`);
        }
        const gh = await res.json();
        const parsed = gh && gh.content
            ? JSON.parse(Buffer.from(gh.content, 'base64').toString('utf-8'))
            : {};
        return {
            counts: parsed.counts && typeof parsed.counts === 'object' ? parsed.counts : {},
            recentRefs: Array.isArray(parsed.recentRefs) ? parsed.recentRefs : [],
            updatedAt: parsed.updatedAt || null,
            sha: gh.sha || null
        };
    }

    const localPath = resolveLocalStatePath(envKey);
    if (!fs.existsSync(localPath)) {
        return { counts: {}, recentRefs: [], updatedAt: null, sha: null };
    }
    const parsed = JSON.parse(fs.readFileSync(localPath, 'utf-8') || '{}');
    return {
        counts: parsed.counts && typeof parsed.counts === 'object' ? parsed.counts : {},
        recentRefs: Array.isArray(parsed.recentRefs) ? parsed.recentRefs : [],
        updatedAt: parsed.updatedAt || null,
        sha: null
    };
}

async function writeTicketState(event, nextState, prevSha, commitMessage) {
    const envKey = resolveEnvironmentKey(event);
    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPO || 'juiceboyy/wimpie';
    const baseBranch = process.env.GITHUB_BRANCH || 'main';

    const payload = {
        counts: nextState.counts || {},
        recentRefs: Array.isArray(nextState.recentRefs) ? nextState.recentRefs.slice(-MAX_RECENT_REFS) : [],
        updatedAt: nextState.updatedAt || new Date().toISOString()
    };
    const rawJson = JSON.stringify(payload, null, 2) + '\n';

    if (token) {
        if (!prevSha) {
            await ensureTicketBranch(repo, baseBranch, token);
        }
        const relPath = resolveStateRelPath(envKey);
        const msg = String(commitMessage || 'Update ticket count').includes('[skip ci]')
            ? String(commitMessage)
            : `${commitMessage || 'Update ticket count'} [skip ci]`;
        const body = {
            message: msg,
            content: Buffer.from(rawJson, 'utf-8').toString('base64'),
            branch: STATE_BRANCH
        };
        if (prevSha) body.sha = prevSha;

        const res = await fetch(`https://api.github.com/repos/${repo}/contents/${relPath}`, {
            method: 'PUT',
            headers: ghHeaders(token, { 'Content-Type': 'application/json' }),
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            const errText = await res.text();
            const err = new Error(`Ticket-teller opslaan mislukt (${res.status}): ${errText}`);
            err.status = res.status;
            throw err;
        }
        const saved = await res.json();
        return { state: payload, sha: saved.content ? saved.content.sha : null };
    }

    const localPath = resolveLocalStatePath(envKey);
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    fs.writeFileSync(localPath, rawJson, 'utf-8');
    return { state: payload, sha: null };
}

async function mutateTicketState(event, mutatorFn, commitMessage) {
    const maxRetries = 3;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const current = await readTicketState(event);
        const draft = {
            counts: { ...(current.counts || {}) },
            recentRefs: Array.isArray(current.recentRefs) ? current.recentRefs.map(r => ({ ...r })) : [],
            updatedAt: current.updatedAt || null
        };
        const outcome = await mutatorFn(draft);
        if (outcome && outcome.abort) {
            return { aborted: true, ...outcome };
        }
        try {
            const written = await writeTicketState(event, draft, current.sha, commitMessage);
            return { aborted: false, state: written.state, outcome };
        } catch (err) {
            if ((err.status === 409 || err.status === 422) && attempt < maxRetries) {
                continue;
            }
            throw err;
        }
    }
    throw new Error('Te veel gelijktijdige wijzigingen op de ticket-teller.');
}

function computeShowAvailability(show, soldCount) {
    const sold = Math.max(0, Number(soldCount) || 0);
    const maxTickets = Number(show && show.maxTickets) > 0 ? Math.floor(Number(show.maxTickets)) : 0;
    const remaining = maxTickets > 0 ? Math.max(0, maxTickets - sold) : null;
    const soldOut = (show && show.status === 'sold_out') || (maxTickets > 0 && remaining === 0);
    const lowStock = !soldOut && maxTickets > 0 && remaining > 0 && remaining < 15;

    return {
        slug: show ? show.slug : '',
        sold,
        maxTickets,
        remaining,
        soldOut,
        lowStock,
        status: (show && show.status) || 'available'
    };
}

module.exports = {
    STATE_BRANCH,
    resolveEnvironmentKey,
    resolveStateRelPath,
    resolveLocalStatePath,
    ensureTicketBranch,
    readTicketState,
    writeTicketState,
    mutateTicketState,
    computeShowAvailability
};
