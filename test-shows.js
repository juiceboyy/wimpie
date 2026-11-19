#!/usr/bin/env node
/**
 * test-shows.js - Automated tests for Live Shows, bunq.me Ticketing & Admin Shows Tab
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const adminApi = require('./netlify/functions/admin-api').handler;
const { formatEuro, buildShows } = require('./build-shows');
const { buildBunqTicketUrl, generateRefCode } = require('./tickets');
const { createQrSvg } = require('./qr');

async function runTests() {
    console.log('--- Starting Shows & Ticketing Test Suite ---');

    const originalEnv = { ...process.env };
    process.env.ADMIN_PIN = 'test-secret-pin-123';
    process.env.GITHUB_REPO = 'juiceboyy/wimpie';
    process.env.GITHUB_BRANCH = 'test';
    delete process.env.GITHUB_TOKEN;

    // 1. Test build-shows.js formatting and generation
    console.log('1. Testing formatEuro and build-shows.js output...');
    assert.strictEqual(formatEuro(7.5), '€ 7,50');
    assert.strictEqual(formatEuro(5), '€ 5,00');
    buildShows();
    const ticketsHtml = fs.readFileSync(path.join(__dirname, 'tickets.html'), 'utf-8');
    const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
    assert.ok(ticketsHtml.includes('8 januari 2027') && ticketsHtml.includes('€ 7,50'), 'tickets.html must contain 8 jan show');
    assert.ok(!ticketsHtml.includes('6 februari 2027'), 'tickets.html must hide 6 feb show while status is hidden');
    assert.ok(ticketsHtml.includes('name="tickets"') && ticketsHtml.includes('bijzonderheden'), 'tickets.html must contain Netlify form & accessibility field');
    assert.ok(indexHtml.includes('<!-- SHOWS_FEATURE_START -->') && indexHtml.includes('8 januari 2027') && !indexHtml.includes('6 februari 2027'), 'index.html must show 8 jan and hide 6 feb');

    // 2. Test bunq.me URL builder & QR SVG compatibility
    console.log('2. Testing bunq.me URL generation and qr.js SVG encoding...');
    const ref = generateRefCode('show-8-januari');
    assert.ok(/^WIM-[A-Z0-9]+-\d{3}$/.test(ref), `Ref code should match format, got ${ref}`);

    const urlSingle = buildBunqTicketUrl({
        amount: 7.5,
        refCode: 'WIM-8JAN-123',
        quantity: 1,
        showDate: '8 januari 2027',
        buyerName: 'Jan Jansen'
    });
    assert.ok(urlSingle.startsWith('https://bunq.me/Wimpie/7.50/'), 'Must start with bunq.me/Wimpie/7.50/');
    assert.ok(urlSingle.length <= 98, `URL length ${urlSingle.length} must fit within 98 chars`);

    const urlLong = buildBunqTicketUrl({
        amount: 15,
        refCode: 'WIM-8JAN-999',
        quantity: 2,
        showDate: '8 januari 2027',
        buyerName: 'Maximiliaan Van Der Langenaam Tot Amsterdam Zuidoost'
    });
    assert.ok(urlLong.startsWith('https://bunq.me/Wimpie/15.00/'), 'Must format 15.00 properly');
    assert.ok(urlLong.length <= 98, `Long buyer name URL (${urlLong.length}) must stay <= 98 bytes for qr.js`);

    const qrSvg = createQrSvg(urlLong);
    assert.ok(qrSvg.startsWith('<svg') && qrSvg.includes('<path d="M'), 'qr.js must generate valid SVG for bunq ticket URL');

    // 3. Test admin-api GET & validation for shows
    console.log('3. Testing admin-api GET and validation for shows...');
    let res = await adminApi({
        httpMethod: 'GET',
        headers: { 'x-admin-pin': 'test-secret-pin-123' },
        queryStringParameters: { action: 'get' }
    }, {});
    assert.strictEqual(res.statusCode, 200);
    const getBody = JSON.parse(res.body);
    assert.ok(getBody.shows && Array.isArray(getBody.shows.shows), 'GET must return shows array');
    assert.strictEqual(getBody.shows.shows.length, 2, 'Should have 2 initial shows');

    res = await adminApi({
        httpMethod: 'POST',
        headers: { 'x-admin-pin': 'test-secret-pin-123' },
        body: JSON.stringify({
            action: 'save',
            target: 'shows',
            data: { shows: [{ slug: 'bad-price', title: 'Test', date: '1 maart', price: -5 }] }
        })
    }, {});
    assert.strictEqual(res.statusCode, 400, 'Should reject negative ticket price');

    res = await adminApi({
        httpMethod: 'POST',
        headers: { 'x-admin-pin': 'test-secret-pin-123' },
        body: JSON.stringify({
            action: 'save',
            target: 'shows',
            data: { shows: [{ slug: 'dup', title: 'A', date: '1 maart', price: 5 }, { slug: 'dup', title: 'B', date: '2 maart', price: 5 }] }
        })
    }, {});
    assert.strictEqual(res.statusCode, 400, 'Should reject duplicate show slugs');

    // 4. Test save & restore shows.json locally + mocked GitHub commit
    console.log('4. Testing shows save locally and via mocked GitHub API...');
    const showsFile = path.join(__dirname, 'data', 'shows.json');
    const originalShowsRaw = fs.readFileSync(showsFile, 'utf-8');
    const originalShows = JSON.parse(originalShowsRaw);

    const updatedShows = {
        shows: [
            ...originalShows.shows,
            { slug: 'test-show', title: 'Test Show', date: '1 april 2027', time: '20:00', location: 'Testzaal', address: 'Amsterdam', price: 10, status: 'few_left', description: 'Test' }
        ]
    };
    res = await adminApi({
        httpMethod: 'POST',
        headers: { 'x-admin-pin': 'test-secret-pin-123' },
        body: JSON.stringify({ action: 'save', target: 'shows', data: updatedShows })
    }, {});
    assert.strictEqual(res.statusCode, 200, 'Local save of shows must succeed');
    const diskShows = JSON.parse(fs.readFileSync(showsFile, 'utf-8'));
    assert.strictEqual(diskShows.shows.length, 3);
    fs.writeFileSync(showsFile, originalShowsRaw, 'utf-8');

    process.env.GITHUB_TOKEN = 'ghp_fake_test_token';
    const originalFetch = global.fetch;
    global.fetch = async (url, opts) => {
        if (opts && opts.method === 'PUT') {
            return { ok: true, status: 200, json: async () => ({ commit: { sha: 'mock-shows-sha' } }) };
        }
        return { ok: true, status: 200, json: async () => ({ sha: 'prev-shows-sha' }) };
    };
    res = await adminApi({
        httpMethod: 'POST',
        headers: { 'x-admin-pin': 'test-secret-pin-123' },
        body: JSON.stringify({ action: 'save', target: 'shows', data: originalShows })
    }, {});
    global.fetch = originalFetch;
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(JSON.parse(res.body).mode, 'github');

    // 5. Test admin-shows.js module initialization
    console.log('5. Testing admin-shows.js module integrity...');
    const utilsCode = fs.readFileSync(path.join(__dirname, 'admin-utils.js'), 'utf-8');
    const showsUiCode = fs.readFileSync(path.join(__dirname, 'admin-shows-ui.js'), 'utf-8');
    const showsCode = fs.readFileSync(path.join(__dirname, 'admin-shows.js'), 'utf-8');
    const mockElements = {};
    const makeMockEl = () => ({
        value: '', textContent: '', innerHTML: '', dataset: {},
        reset: () => {}, addEventListener: () => {}, querySelectorAll: () => [],
        classList: { add: () => {}, remove: () => {}, toggle: () => {} }
    });
    const mockDoc = {
        readyState: 'complete',
        getElementById: (id) => (mockElements[id] || (mockElements[id] = makeMockEl())),
        querySelectorAll: () => []
    };
    const mockWin = { document: mockDoc };
    new Function('window', utilsCode)(mockWin);
    new Function('window', showsUiCode)(mockWin);
    new Function('window', 'document', showsCode)(mockWin, mockDoc);
    assert.ok(mockWin.adminShows, 'window.adminShows must be defined');
    mockWin.adminShows.init(originalShows, { 'show-8-januari': 4 });
    assert.strictEqual(mockWin.adminShows.getData().shows.length, 2);
    assert.ok(mockElements['shows-list'].innerHTML.includes('8 januari 2027'));
    assert.ok(mockElements['shows-list'].innerHTML.includes('Verkocht: 4 / 100'));

    execSync('node build-shows.js', { stdio: 'pipe' });
    process.env = originalEnv;
    console.log('--- All Shows & Ticketing Tests Passed! ---');
}

runTests().catch(err => {
    console.error('Shows test suite failed:', err);
    process.exit(1);
});
