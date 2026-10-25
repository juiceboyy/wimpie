const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-pin',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8'
};

function jsonResponse(statusCode, body) {
    return {
        statusCode,
        headers: CORS_HEADERS,
        body: JSON.stringify(body)
    };
}

function extractPin(event, body) {
    const headers = event.headers || {};
    const pinHeader = headers['x-admin-pin'] || headers['X-Admin-Pin'];
    if (pinHeader) return pinHeader.trim();

    const authHeader = headers['authorization'] || headers['Authorization'];
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
        return authHeader.slice(7).trim();
    }

    if (body && typeof body.pin === 'string') {
        return body.pin.trim();
    }

    const query = event.queryStringParameters || {};
    if (query.pin) return query.pin.trim();

    return '';
}

function verifyAuth(providedPin) {
    const serverPin = process.env.ADMIN_PIN;
    if (!serverPin) {
        return {
            valid: false,
            error: 'ADMIN_PIN is niet geconfigureerd in de serveromgeving.'
        };
    }
    if (!providedPin) {
        return {
            valid: false,
            error: 'Geen pincode meegegeven.'
        };
    }

    const hashA = crypto.createHash('sha256').update(String(providedPin)).digest();
    const hashB = crypto.createHash('sha256').update(String(serverPin)).digest();
    const isMatch = crypto.timingSafeEqual(hashA, hashB);

    if (!isMatch) {
        return { valid: false, error: 'Ongeldige pincode.' };
    }
    return { valid: true };
}

function resolveDataPath(filename) {
    const candidates = [
        path.join(process.cwd(), 'data', filename),
        path.join(__dirname, '..', '..', 'data', filename),
        path.join(__dirname, 'data', filename)
    ];
    for (const p of candidates) {
        if (fs.existsSync(p)) return p;
    }
    return candidates[0];
}

function readLocalJson(filename) {
    const filePath = resolveDataPath(filename);
    if (!fs.existsSync(filePath)) {
        return null;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
}

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

async function fetchFromGithub(filePath, repo, branch, token) {
    const url = `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`;
    const res = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Wimpie-Admin-Netlify'
        }
    });
    if (!res.ok) {
        if (res.status === 404) return null;
        const errText = await res.text();
        throw new Error(`GitHub ophalen mislukt (${res.status}): ${errText}`);
    }
    return await res.json();
}

async function commitToGithub(filePath, contentString, message, repo, branch, token) {
    const currentFile = await fetchFromGithub(filePath, repo, branch, token);
    const sha = currentFile ? currentFile.sha : undefined;

    const url = `https://api.github.com/repos/${repo}/contents/${filePath}`;
    const payload = {
        message,
        content: Buffer.from(contentString, 'utf-8').toString('base64'),
        branch
    };
    if (sha) payload.sha = sha;

    const res = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'Wimpie-Admin-Netlify'
        },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`GitHub commit mislukt (${res.status}): ${errText}`);
    }
    return await res.json();
}

async function loadJsonData(filename, repo, branch, token) {
    let data = null;
    if (token) {
        try {
            const gh = await fetchFromGithub(`data/${filename}`, repo, branch, token);
            if (gh && gh.content) data = JSON.parse(Buffer.from(gh.content, 'base64').toString('utf-8'));
        } catch (e) {
            console.warn(`GitHub ophalen ${filename} mislukt:`, e.message);
        }
    }
    return data || readLocalJson(filename);
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: CORS_HEADERS, body: '' };
    }

    let body = {};
    if (event.body) {
        try {
            body = JSON.parse(event.body);
        } catch (e) {
            return jsonResponse(400, { error: 'Ongeldige JSON in verzoek.' });
        }
    }

    const providedPin = extractPin(event, body);
    const auth = verifyAuth(providedPin);
    if (!auth.valid) {
        return jsonResponse(401, { error: auth.error });
    }

    const query = event.queryStringParameters || {};
    const action = (body.action || query.action || 'get').toLowerCase();

    if (action === 'verify') {
        return jsonResponse(200, {
            ok: true,
            hasGithubToken: Boolean(process.env.GITHUB_TOKEN),
            repo: process.env.GITHUB_REPO || 'juiceboyy/wimpie',
            branch: process.env.GITHUB_BRANCH || 'main'
        });
    }

    if (action === 'get') {
        const token = process.env.GITHUB_TOKEN;
        const repo = process.env.GITHUB_REPO || 'juiceboyy/wimpie';
        const branch = process.env.GITHUB_BRANCH || 'main';

        const releases = await loadJsonData('releases.json', repo, branch, token);
        const podcasts = await loadJsonData('podcasts.json', repo, branch, token);

        if (!releases && !podcasts) {
            return jsonResponse(500, { error: 'Kon data niet inlezen van lokale bundel of GitHub.' });
        }

        return jsonResponse(200, {
            releases: releases || {},
            podcasts: podcasts || { show: {}, episodes: [] }
        });
    }

    if (action === 'save') {
        const target = body.target;
        const data = body.data;

        if (target !== 'releases' && target !== 'podcasts') {
            return jsonResponse(400, { error: 'Ongeldig doel. Kies "releases" of "podcasts".' });
        }

        const validationError = target === 'releases' ? validateReleases(data) : validatePodcasts(data);
        if (validationError) {
            return jsonResponse(400, { error: validationError });
        }

        const filename = target === 'releases' ? 'releases.json' : 'podcasts.json';
        const relPath = `data/${filename}`;
        const formattedJson = JSON.stringify(data, null, 2) + '\n';

        const token = process.env.GITHUB_TOKEN;
        const repo = process.env.GITHUB_REPO || 'juiceboyy/wimpie';
        const branch = process.env.GITHUB_BRANCH || 'main';

        if (token) {
            try {
                const commitMsg = `Update ${relPath} via Beheerders Dashboard`;
                const ghResult = await commitToGithub(relPath, formattedJson, commitMsg, repo, branch, token);
                return jsonResponse(200, {
                    ok: true,
                    mode: 'github',
                    message: `Wijzigingen succesvol gecommit naar branch ${branch}. Netlify start nu automatisch een nieuwe build.`,
                    commit: ghResult.commit ? ghResult.commit.sha : null
                });
            } catch (ghErr) {
                return jsonResponse(502, {
                    error: `Opslaan via GitHub API mislukt: ${ghErr.message}`
                });
            }
        }

        // Lokale schijf fallback (bij lokaal testen / development)
        const localPath = resolveDataPath(filename);
        try {
            fs.writeFileSync(localPath, formattedJson, 'utf-8');
            return jsonResponse(200, {
                ok: true,
                mode: 'local',
                message: `Lokaal opgeslagen in ${relPath}. Let op: GITHUB_TOKEN ontbreekt.`
            });
        } catch (fsErr) {
            const isCloud = Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
            const error = isCloud
                ? 'GITHUB_TOKEN ontbreekt in deze Netlify omgeving. Stel GITHUB_TOKEN in bij Netlify Environment Variables.'
                : `Kon niet lokaal opslaan en GITHUB_TOKEN ontbreekt: ${fsErr.message}`;
            return jsonResponse(500, { error });
        }
    }

    return jsonResponse(400, { error: `Onbekende actie: ${action}` });
};
