#!/usr/bin/env node
/**
 * test-admin.js - Automated tests for Wimpie & de Domino's Beheerders Dashboard
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const adminApi = require('./netlify/functions/admin-api').handler;

async function runTests() {
    console.log('--- Starting Admin Dashboard Test Suite ---');

    const originalEnv = { ...process.env };
    process.env.ADMIN_PIN = 'test-secret-pin-123';
    process.env.GITHUB_REPO = 'juiceboyy/wimpie';
    process.env.GITHUB_BRANCH = 'test';
    delete process.env.GITHUB_TOKEN; // Test local fallback path first

    // 1. Test Auth verification with missing PIN
    console.log('1. Testing auth failure with missing PIN...');
    let res = await adminApi({
        httpMethod: 'POST',
        headers: {},
        body: JSON.stringify({ action: 'verify' })
    }, {});
    assert.strictEqual(res.statusCode, 401, 'Should return 401 when PIN is missing');
    let data = JSON.parse(res.body);
    assert.ok(data.error, 'Should contain error message');

    // 2. Test Auth verification with incorrect PIN (including different lengths)
    console.log('2. Testing auth failure with incorrect PIN (different lengths)...');
    res = await adminApi({
        httpMethod: 'POST',
        headers: { 'x-admin-pin': 'short' },
        body: JSON.stringify({ action: 'verify' })
    }, {});
    assert.strictEqual(res.statusCode, 401, 'Should return 401 on short PIN');

    res = await adminApi({
        httpMethod: 'POST',
        headers: { 'x-admin-pin': 'a-very-long-wrong-pin-that-exceeds-the-length-of-the-correct-pin' },
        body: JSON.stringify({ action: 'verify' })
    }, {});
    assert.strictEqual(res.statusCode, 401, 'Should return 401 on long incorrect PIN without throwing');

    // 3. Test Auth verification with correct PIN in header
    console.log('3. Testing auth success with correct PIN...');
    res = await adminApi({
        httpMethod: 'POST',
        headers: { 'x-admin-pin': 'test-secret-pin-123' },
        body: JSON.stringify({ action: 'verify' })
    }, {});
    assert.strictEqual(res.statusCode, 200, 'Should return 200 on correct PIN');
    data = JSON.parse(res.body);
    assert.strictEqual(data.ok, true);

    // 4. Test Data Retrieval (GET action)
    console.log('4. Testing data retrieval (get action)...');
    res = await adminApi({
        httpMethod: 'GET',
        headers: { 'authorization': 'Bearer test-secret-pin-123' },
        queryStringParameters: { action: 'get' }
    }, {});
    assert.strictEqual(res.statusCode, 200, 'Should return 200 for data fetch');
    data = JSON.parse(res.body);
    assert.ok(data.releases, 'Should have releases object');
    assert.ok(data.podcasts, 'Should have podcasts object');
    assert.ok(data.releases.rozen, 'Should have existing "rozen" single');
    assert.ok(Array.isArray(data.podcasts.episodes), 'Podcasts should have episodes array');

    // 5. Test Validation on Releases
    console.log('5. Testing releases validation...');
    res = await adminApi({
        httpMethod: 'POST',
        headers: { 'x-admin-pin': 'test-secret-pin-123' },
        body: JSON.stringify({
            action: 'save',
            target: 'releases',
            data: {}
        })
    }, {});
    assert.strictEqual(res.statusCode, 400, 'Should reject empty releases object to prevent data loss');

    res = await adminApi({
        httpMethod: 'POST',
        headers: { 'x-admin-pin': 'test-secret-pin-123' },
        body: JSON.stringify({
            action: 'save',
            target: 'releases',
            data: {
                'invalid slug with spaces': { title: 'Test' }
            }
        })
    }, {});
    assert.strictEqual(res.statusCode, 400, 'Should reject invalid slug format');

    res = await adminApi({
        httpMethod: 'POST',
        headers: { 'x-admin-pin': 'test-secret-pin-123' },
        body: JSON.stringify({
            action: 'save',
            target: 'releases',
            data: {
                'valid-slug': { title: 'Test' } // missing artist
            }
        })
    }, {});
    assert.strictEqual(res.statusCode, 400, 'Should reject release missing artist');

    // 6. Test Validation on Podcasts
    console.log('6. Testing podcasts validation...');
    res = await adminApi({
        httpMethod: 'POST',
        headers: { 'x-admin-pin': 'test-secret-pin-123' },
        body: JSON.stringify({
            action: 'save',
            target: 'podcasts',
            data: { show: 'invalid-string' }
        })
    }, {});
    assert.strictEqual(res.statusCode, 400, 'Should reject invalid show object');

    // 7. Test Save & Local Restore
    console.log('7. Testing releases save to local file...');
    const originalReleasesRaw = fs.readFileSync(path.join(__dirname, 'data', 'releases.json'), 'utf-8');
    const originalReleases = JSON.parse(originalReleasesRaw);

    const testReleases = {
        ...originalReleases,
        'test-single': {
            title: 'Test Single',
            artist: "Wimpie & de Domino's",
            badge: 'Test Badge',
            description: 'Testomschrijving',
            artwork: '/single-cover.jpg',
            platforms: {
                spotify: 'https://open.spotify.com/test'
            }
        }
    };

    res = await adminApi({
        httpMethod: 'POST',
        headers: { 'x-admin-pin': 'test-secret-pin-123' },
        body: JSON.stringify({
            action: 'save',
            target: 'releases',
            data: testReleases
        })
    }, {});
    assert.strictEqual(res.statusCode, 200, 'Should succeed saving release');

    // Verify it was written to disk
    const savedReleases = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'releases.json'), 'utf-8'));
    assert.ok(savedReleases['test-single'], 'Saved release must exist on disk');

    // Restore original file
    fs.writeFileSync(path.join(__dirname, 'data', 'releases.json'), originalReleasesRaw, 'utf-8');
    console.log('Releases restored to original state.');

    // 8. Test GitHub API Commit flow (mocking global fetch)
    console.log('8. Testing GitHub commit flow via API...');
    process.env.GITHUB_TOKEN = 'ghp_fake_test_token';
    const originalFetch = global.fetch;
    let githubCalls = [];

    global.fetch = async (url, opts) => {
        githubCalls.push({ url, opts });
        if (opts.method === 'PUT') {
            return {
                ok: true,
                status: 200,
                json: async () => ({ commit: { sha: 'mock-commit-sha-456' } })
            };
        }
        // GET contents
        return {
            ok: true,
            status: 200,
            json: async () => ({ sha: 'mock-prev-sha-123' })
        };
    };

    res = await adminApi({
        httpMethod: 'POST',
        headers: { 'x-admin-pin': 'test-secret-pin-123' },
        body: JSON.stringify({
            action: 'save',
            target: 'podcasts',
            data: JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'podcasts.json'), 'utf-8'))
        })
    }, {});

    global.fetch = originalFetch;
    assert.strictEqual(res.statusCode, 200, 'GitHub commit flow should return 200');
    data = JSON.parse(res.body);
    assert.strictEqual(data.mode, 'github', 'Mode should be github');
    assert.strictEqual(data.commit, 'mock-commit-sha-456');
    assert.strictEqual(githubCalls.length, 2, 'Should make 2 GitHub API calls (GET sha, PUT commit)');
    assert.strictEqual(githubCalls[1].opts.method, 'PUT');
    console.log('GitHub API commit flow verified successfully.');

    // 9. Test Shared Utilities
    console.log('9. Testing shared admin utilities (YouTube extraction & diacritics slugify)...');
    const utilsCode = fs.readFileSync(path.join(__dirname, 'admin-utils.js'), 'utf-8');
    const mockWindow = {};
    const fn = new Function('window', utilsCode);
    fn(mockWindow);
    const u = mockWindow.adminUtils;
    assert.strictEqual(u.slugify('Comment Ça Va'), 'comment-ca-va', 'Should handle diacritics ç');
    assert.strictEqual(u.slugify('Eén Twee Drie!'), 'een-twee-drie', 'Should handle é');
    assert.strictEqual(u.extractYoutubeId('https://youtu.be/2va192QwBOA'), '2va192QwBOA');
    assert.strictEqual(u.extractYoutubeId('https://www.youtube.com/watch?v=2va192QwBOA'), '2va192QwBOA');
    assert.strictEqual(u.extractYoutubeId('https://m.youtube.com/watch?feature=share&v=2va192QwBOA&t=10'), '2va192QwBOA');
    assert.strictEqual(u.extractYoutubeId('https://www.youtube.com/shorts/2va192QwBOA'), '2va192QwBOA');
    assert.strictEqual(u.extractYoutubeId('https://youtube.com/live/2va192QwBOA'), '2va192QwBOA');
    assert.strictEqual(u.escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    console.log('Admin utilities verified successfully.');

    // 10. Test Existing Build Scripts
    console.log('10. Running build-releases.js and build-podcasts.js...');
    execSync('node build-releases.js', { stdio: 'pipe' });
    execSync('node build-podcasts.js', { stdio: 'pipe' });
    console.log('Build scripts completed successfully.');

    // Restore environment
    process.env = originalEnv;

    console.log('--- All Admin Dashboard Tests Passed! ---');
}

runTests().catch(err => {
    console.error('Test suite failed:', err);
    process.exit(1);
});
