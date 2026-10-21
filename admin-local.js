#!/usr/bin/env node
/**
 * admin-local.js
 * Lokale ontwikkelserver voor het Wimpie & de Domino's Beheerders Dashboard.
 * Start een zero-dependency HTTP-server en voert automatisch builds uit bij opslaan.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;

// Lees optioneel lokaal .env bestand in
const envPath = path.join(ROOT_DIR, '.env');
if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            const val = trimmed.slice(eqIdx + 1).trim();
            if (!process.env[key]) {
                process.env[key] = val;
            }
        }
    }
}

// Stel een standaard ADMIN_PIN in voor lokaal gemak indien nog niet gezet
if (!process.env.ADMIN_PIN) {
    process.env.ADMIN_PIN = 'wimpie2026';
    console.log('Let op: Geen ADMIN_PIN gevonden in .env. Voor lokaal testen ingesteld op: wimpie2026');
}

const adminApiHandler = require('./netlify/functions/admin-api').handler;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.mp3': 'audio/mpeg'
};

function runLocalBuild() {
    try {
        console.log('Uitvoeren build-releases.js en build-podcasts.js...');
        execSync('node build-releases.js && node build-podcasts.js', { stdio: 'inherit', cwd: ROOT_DIR });
        console.log('Lokale build succesvol afgerond.');
    } catch (err) {
        console.error('Fout bij uitvoeren van lokale build:', err.message);
    }
}

const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let pathname = decodeURIComponent(parsedUrl.pathname);

    // Redirect /admin naar /admin.html
    if (pathname === '/admin' || pathname === '/admin/') {
        pathname = '/admin.html';
    }

    // Serverless API intercept
    if (pathname === '/api/admin-api' || pathname === '/.netlify/functions/admin-api') {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', async () => {
            const rawBody = Buffer.concat(chunks).toString('utf-8');
            const event = {
                httpMethod: req.method,
                headers: req.headers,
                queryStringParameters: Object.fromEntries(parsedUrl.searchParams.entries()),
                body: rawBody
            };

            try {
                const response = await adminApiHandler(event, {});
                
                // Als het een save actie was en succesvol, voer meteen lokale build uit
                if (req.method === 'POST' && response.statusCode === 200) {
                    try {
                        const parsed = JSON.parse(rawBody);
                        if (parsed.action === 'save') {
                            runLocalBuild();
                        }
                    } catch (e) {}
                }

                res.writeHead(response.statusCode, response.headers || {});
                res.end(response.body);
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    // Statische bestanden serveren
    let relativePath = pathname.replace(/^\//, '');
    if (!relativePath) relativePath = 'index.html';

    const safePath = path.normalize(path.join(ROOT_DIR, relativePath));
    if (!safePath.startsWith(ROOT_DIR)) {
        res.writeHead(403);
        res.end('Verboden toegang');
        return;
    }

    fs.stat(safePath, (err, stats) => {
        if (err || !stats.isFile()) {
            // Check of het een directory met index.html is
            const subIndex = path.join(safePath, 'index.html');
            if (fs.existsSync(subIndex)) {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                fs.createReadStream(subIndex).pipe(res);
                return;
            }
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 Niet Gevonden');
            return;
        }

        const ext = path.extname(safePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(safePath).pipe(res);
    });
});

server.listen(PORT, () => {
    console.log('----------------------------------------------------');
    console.log(`Wimpie & de Domino's - Lokale Dashboard Server`);
    console.log(`Open in de browser: http://localhost:${PORT}/admin`);
    console.log(`PIN: ${process.env.ADMIN_PIN}`);
    console.log('----------------------------------------------------');
});
