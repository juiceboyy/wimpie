#!/usr/bin/env node
/**
 * test-ticket-caps.js - Automated tests for per-show ticket caps & live counters
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const adminApi = require('./netlify/functions/admin-api').handler;
const ticketsApi = require('./netlify/functions/tickets-api').handler;
const { validateShows, validateTicketCountUpdate } = require('./netlify/functions/admin-validators');
const { resolveLocalStatePath, resolveEnvironmentKey, STATE_BRANCH } = require('./netlify/functions/ticket-store');

const LOCAL_EVENT = { headers: { host: 'localhost:3000' } };

function cleanLocalStateFiles() {
    ['test', 'production'].forEach(envKey => {
        const p = resolveLocalStatePath(envKey);
        if (fs.existsSync(p)) fs.unlinkSync(p);
    });
}

async function runTests() {
    console.log('--- Starting Ticket Cap & Counter Test Suite ---');
    const originalEnv = { ...process.env };
    process.env.ADMIN_PIN = 'test-secret-pin-123';
    process.env.GITHUB_REPO = 'juiceboyy/wimpie';
    process.env.GITHUB_BRANCH = 'test';
    delete process.env.GITHUB_TOKEN;
    delete process.env.CONTEXT;
    cleanLocalStateFiles();

    try {
        // 1. Check shows.json caps & environment isolation
        console.log('1. Testing shows.json initial caps and environment key resolution...');
        const showsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'shows.json'), 'utf-8'));
        const showJan = showsData.shows.find(s => s.slug === 'show-8-januari');
        const showFeb = showsData.shows.find(s => s.slug === 'show-6-februari');
        assert.strictEqual(showJan.maxTickets, 100, '8 januari must have maxTickets 100');
        assert.strictEqual(showFeb.maxTickets, 60, '6 februari must have maxTickets 60');
        assert.strictEqual(resolveEnvironmentKey({ headers: { host: 'localhost:3000' } }), 'test');
        assert.strictEqual(resolveEnvironmentKey({ headers: { host: 'test--wimpie.netlify.app' } }), 'test');
        assert.strictEqual(resolveEnvironmentKey({ headers: { host: 'wimpieendedominos.nl' } }), 'production');

        // 2. Test validator rules for maxTickets & set_ticket_count
        console.log('2. Testing admin-validators for maxTickets and ticket counts...');
        assert.strictEqual(validateShows({ shows: [{ slug: 'a', title: 'T', date: 'D', price: 5, maxTickets: 0 }] }), null);
        assert.strictEqual(validateShows({ shows: [{ slug: 'a', title: 'T', date: 'D', price: 5, maxTickets: 100 }] }), null);
        assert.strictEqual(validateShows({ shows: [{ slug: 'a', title: 'T', date: 'D', price: 5 }] }), null);
        assert.ok(validateShows({ shows: [{ slug: 'a', title: 'T', date: 'D', price: 5, maxTickets: -1 }] }));
        assert.ok(validateShows({ shows: [{ slug: 'a', title: 'T', date: 'D', price: 5, maxTickets: 12.5 }] }));
        assert.ok(validateShows({ shows: [{ slug: 'a', title: 'T', date: 'D', price: 5, maxTickets: '100' }] }));
        assert.strictEqual(validateTicketCountUpdate({ slug: 'show-8-januari', sold: 0 }), null);
        assert.ok(validateTicketCountUpdate({ slug: 'show-8-januari', sold: -2 }));
        assert.ok(validateTicketCountUpdate({ slug: 'show-8-januari', sold: 2.5 }));

        // 3. Test GET availability, reserve, idempotency, lowStock, cap enforcement & release
        console.log('3. Testing tickets-api reserve, idempotency, lowStock, 409 cap and release...');
        let res = await ticketsApi({ ...LOCAL_EVENT, httpMethod: 'GET' });
        assert.strictEqual(res.statusCode, 200);
        let body = JSON.parse(res.body);
        assert.strictEqual(body.shows['show-8-januari'].maxTickets, 100);
        assert.strictEqual(body.shows['show-8-januari'].remaining, 100);
        assert.strictEqual(body.shows['show-8-januari'].lowStock, false);
        assert.strictEqual(body.shows['show-8-januari'].soldOut, false);
        assert.strictEqual(body.shows['show-6-februari'], undefined, 'Hidden show must not appear in public API');

        res = await ticketsApi({
            ...LOCAL_EVENT,
            httpMethod: 'POST',
            body: JSON.stringify({ action: 'reserve', showSlug: 'show-8-januari', quantity: 3, refCode: 'WIM-8JAN-101' })
        });
        assert.strictEqual(res.statusCode, 200);
        body = JSON.parse(res.body);
        assert.strictEqual(body.availability.sold, 3);
        assert.strictEqual(body.availability.remaining, 97);

        // Idempotent repeat
        res = await ticketsApi({
            ...LOCAL_EVENT,
            httpMethod: 'POST',
            body: JSON.stringify({ action: 'reserve', showSlug: 'show-8-januari', quantity: 3, refCode: 'WIM-8JAN-101' })
        });
        body = JSON.parse(res.body);
        assert.strictEqual(body.alreadyCounted, true);
        assert.strictEqual(body.availability.sold, 3);

        // Admin sets sold to 88 -> 12 remaining -> lowStock true
        res = await adminApi({
            ...LOCAL_EVENT,
            httpMethod: 'POST',
            headers: { ...LOCAL_EVENT.headers, 'x-admin-pin': 'test-secret-pin-123' },
            body: JSON.stringify({ action: 'set_ticket_count', slug: 'show-8-januari', sold: 88 })
        });
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(JSON.parse(res.body).sold, 88);

        res = await ticketsApi({ ...LOCAL_EVENT, httpMethod: 'GET' });
        body = JSON.parse(res.body);
        assert.strictEqual(body.shows['show-8-januari'].remaining, 12);
        assert.strictEqual(body.shows['show-8-januari'].lowStock, true);

        // Reserve 13 (> 12 remaining) -> 409
        res = await ticketsApi({
            ...LOCAL_EVENT,
            httpMethod: 'POST',
            body: JSON.stringify({ action: 'reserve', showSlug: 'show-8-januari', quantity: 10, refCode: 'WIM-8JAN-202' })
        });
        assert.strictEqual(res.statusCode, 200);
        res = await ticketsApi({
            ...LOCAL_EVENT,
            httpMethod: 'POST',
            body: JSON.stringify({ action: 'reserve', showSlug: 'show-8-januari', quantity: 5, refCode: 'WIM-8JAN-203' })
        });
        assert.strictEqual(res.statusCode, 409, 'Exceeding cap must return 409');
        body = JSON.parse(res.body);
        assert.strictEqual(body.remaining, 2);
        assert.strictEqual(body.soldOut, false);

        // Reserve final 2 -> soldOut true, next fails with 409
        res = await ticketsApi({
            ...LOCAL_EVENT,
            httpMethod: 'POST',
            body: JSON.stringify({ action: 'reserve', showSlug: 'show-8-januari', quantity: 2, refCode: 'WIM-8JAN-204' })
        });
        assert.strictEqual(res.statusCode, 200);
        body = JSON.parse(res.body);
        assert.strictEqual(body.availability.remaining, 0);
        assert.strictEqual(body.availability.soldOut, true);

        res = await ticketsApi({
            ...LOCAL_EVENT,
            httpMethod: 'POST',
            body: JSON.stringify({ action: 'reserve', showSlug: 'show-8-januari', quantity: 1, refCode: 'WIM-8JAN-205' })
        });
        assert.strictEqual(res.statusCode, 409);
        assert.strictEqual(JSON.parse(res.body).soldOut, true);

        // Release refCode WIM-8JAN-204 -> back to 98 sold, 2 remaining
        res = await ticketsApi({
            ...LOCAL_EVENT,
            httpMethod: 'POST',
            body: JSON.stringify({ action: 'release', showSlug: 'show-8-januari', refCode: 'WIM-8JAN-204' })
        });
        assert.strictEqual(res.statusCode, 200);
        body = JSON.parse(res.body);
        assert.strictEqual(body.released, true);
        assert.strictEqual(body.availability.sold, 98);
        assert.strictEqual(body.availability.remaining, 2);

        // 4. Test GitHub API branch creation, [skip ci] commit, and 409 retry
        console.log('4. Testing GitHub branch auto-create, [skip ci] commit, and 409 SHA retry...');
        process.env.GITHUB_TOKEN = 'ghp_fake_test_token';
        const originalFetch = global.fetch;
        let putAttempts = 0;
        let branchCreated = false;
        const ghCalls = [];
        let storedFileContent = null;

        global.fetch = async (url, opts = {}) => {
            ghCalls.push({ url, method: opts.method || 'GET', body: opts.body ? JSON.parse(opts.body) : null });
            if (url.includes(`/git/ref/heads/${STATE_BRANCH}`)) {
                return branchCreated
                    ? { ok: true, status: 200, json: async () => ({ object: { sha: 'base-sha' } }) }
                    : { ok: false, status: 404, text: async () => 'Not Found' };
            }
            if (url.includes('/git/ref/heads/test')) {
                return { ok: true, status: 200, json: async () => ({ object: { sha: 'base-sha-123' } }) };
            }
            if (url.endsWith('/git/refs') && opts.method === 'POST') {
                branchCreated = true;
                return { ok: true, status: 201, json: async () => ({ ref: `refs/heads/${STATE_BRANCH}` }) };
            }
            if (url.includes('/contents/.ticket-state/') && (!opts.method || opts.method === 'GET')) {
                if (!storedFileContent) return { ok: false, status: 404, text: async () => 'Not Found' };
                return { ok: true, status: 200, json: async () => ({ content: storedFileContent, sha: 'sha-1' }) };
            }
            if (url.includes('/contents/.ticket-state/') && opts.method === 'PUT') {
                putAttempts++;
                if (putAttempts === 1) {
                    storedFileContent = Buffer.from(JSON.stringify({ counts: { 'show-8-januari': 5 }, recentRefs: [] })).toString('base64');
                    return { ok: false, status: 409, text: async () => 'Conflict' };
                }
                const sent = JSON.parse(opts.body);
                assert.ok(sent.message.includes('[skip ci]'), 'Commit message must include [skip ci]');
                assert.strictEqual(sent.branch, STATE_BRANCH);
                return { ok: true, status: 200, json: async () => ({ content: { sha: 'sha-2' } }) };
            }
            return { ok: false, status: 500, text: async () => 'Unexpected URL' };
        };

        res = await ticketsApi({
            ...LOCAL_EVENT,
            httpMethod: 'POST',
            body: JSON.stringify({ action: 'reserve', showSlug: 'show-8-januari', quantity: 2, refCode: 'WIM-8JAN-777' })
        });
        global.fetch = originalFetch;

        assert.strictEqual(res.statusCode, 200, 'Should succeed after 409 SHA retry');
        assert.strictEqual(branchCreated, true, 'Should auto-create ticket-counts branch');
        assert.strictEqual(putAttempts, 2, 'Should retry PUT once on 409 conflict');
        assert.strictEqual(JSON.parse(res.body).availability.sold, 7, 'Retried write must read updated count 5 + 2 = 7');

        console.log('--- All Ticket Cap & Counter Tests Passed! ---');
    } finally {
        cleanLocalStateFiles();
        process.env = originalEnv;
    }
}

runTests().catch(err => {
    console.error('Ticket cap test suite failed:', err);
    process.exit(1);
});
