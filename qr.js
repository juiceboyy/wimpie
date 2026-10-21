/**
 * qr.js - Centrale configuratie en SVG QR-code generator voor Steun Ons (bunq.me)
 */

const BUNQ_CONFIG = {
    url: 'https://bunq.me/Wimpie',
    displayUrl: 'bunq.me/Wimpie',
    iban: 'NL81 BUNQ 2154 5934 53',
    accountHolder: "VOF Wimpie & de Domino's"
};

// QR Version 1-6 parameters voor Error Correction Level M: [totalDataBytes, ecCodewordsPerBlock, numBlocks]
const QR_VERSIONS_M = [
    null,
    [16, 10, 1], // V1: 21x21 (max 14 chars)
    [28, 16, 1], // V2: 25x25 (max 26 chars)
    [44, 26, 1], // V3: 29x29 (max 42 chars)
    [64, 18, 2], // V4: 33x33 (max 62 chars)
    [86, 24, 2], // V5: 37x37 (max 84 chars)
    [108, 16, 4] // V6: 41x41 (max 106 chars)
];

const ALIGNMENT_POS = [
    [], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34]
];

function gfMul(a, b) {
    let p = 0;
    for (let i = 0; i < 8; i++) {
        if (b & 1) p ^= a;
        const hi = a & 0x80;
        a = (a << 1) & 0xFF;
        if (hi) a ^= 0x11D;
        b >>= 1;
    }
    return p;
}

function rsEncode(data, ecLen) {
    let gen = [1];
    let root = 1;
    for (let i = 0; i < ecLen; i++) {
        const next = new Array(gen.length + 1).fill(0);
        for (let j = 0; j < gen.length; j++) {
            next[j] ^= gen[j];
            next[j + 1] ^= gfMul(gen[j], root);
        }
        gen = next;
        root = gfMul(root, 2);
    }
    const msg = new Array(ecLen).fill(0);
    for (let i = 0; i < data.length; i++) {
        const factor = data[i] ^ msg.shift();
        msg.push(0);
        for (let j = 0; j < ecLen; j++) {
            msg[j] ^= gfMul(gen[j + 1], factor);
        }
    }
    return msg;
}

function encodeQrMatrix(text) {
    const rawBytes = Array.from(new TextEncoder().encode(text));
    let ver = 1;
    while (ver < QR_VERSIONS_M.length && QR_VERSIONS_M[ver][0] - 2 < rawBytes.length) {
        ver++;
    }
    if (ver >= QR_VERSIONS_M.length) ver = QR_VERSIONS_M.length - 1;

    const [totalData, ecLen, blocks] = QR_VERSIONS_M[ver];
    const bytes = rawBytes.slice(0, totalData - 2);
    const bits = [];
    const pushBits = (val, len) => {
        for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
    };

    pushBits(0b0100, 4); // Byte mode
    pushBits(bytes.length, 8);
    bytes.forEach(b => pushBits(b, 8));
    for (let i = 0; i < 4 && bits.length < totalData * 8; i++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);

    const dataCw = [];
    for (let i = 0; i < bits.length; i += 8) {
        let byte = 0;
        for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
        dataCw.push(byte);
    }
    const pads = [0xEC, 0x11];
    let padIdx = 0;
    while (dataCw.length < totalData) {
        dataCw.push(pads[padIdx++ % 2]);
    }

    const blockSize = totalData / blocks;
    const dataBlocks = [];
    const ecBlocks = [];
    for (let b = 0; b < blocks; b++) {
        const slice = dataCw.slice(b * blockSize, (b + 1) * blockSize);
        dataBlocks.push(slice);
        ecBlocks.push(rsEncode(slice, ecLen));
    }

    const finalCw = [];
    for (let i = 0; i < blockSize; i++) {
        for (let b = 0; b < blocks; b++) finalCw.push(dataBlocks[b][i]);
    }
    for (let i = 0; i < ecLen; i++) {
        for (let b = 0; b < blocks; b++) finalCw.push(ecBlocks[b][i]);
    }

    const size = ver * 4 + 17;
    const grid = Array.from({ length: size }, () => new Array(size).fill(null));
    const reserved = Array.from({ length: size }, () => new Array(size).fill(false));

    const setMod = (r, c, val) => {
        if (r >= 0 && r < size && c >= 0 && c < size) {
            grid[r][c] = val ? 1 : 0;
            reserved[r][c] = true;
        }
    };

    const placeFinder = (row, col) => {
        for (let r = -1; r <= 7; r++) {
            for (let c = -1; c <= 7; c++) {
                const inOuter = r >= 0 && r <= 6 && c >= 0 && c <= 6;
                const onEdge = r === 0 || r === 6 || c === 0 || c === 6;
                const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
                setMod(row + r, col + c, inOuter && (onEdge || inCore));
            }
        }
    };

    placeFinder(0, 0);
    placeFinder(0, size - 7);
    placeFinder(size - 7, 0);

    for (let i = 8; i < size - 8; i++) {
        setMod(6, i, i % 2 === 0);
        setMod(i, 6, i % 2 === 0);
    }

    const aligns = ALIGNMENT_POS[ver];
    for (const r of aligns) {
        for (const c of aligns) {
            if (reserved[r][c]) continue;
            for (let dr = -2; dr <= 2; dr++) {
                for (let dc = -2; dc <= 2; dc++) {
                    setMod(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
                }
            }
        }
    }

    for (let i = 0; i < 9; i++) {
        if (!reserved[8][i]) reserved[8][i] = true;
        if (!reserved[i][8]) reserved[i][8] = true;
    }
    for (let i = 0; i < 8; i++) {
        reserved[8][size - 1 - i] = true;
        reserved[size - 1 - i][8] = true;
    }
    setMod(size - 8, 8, 1);

    const stream = [];
    finalCw.forEach(cw => {
        for (let i = 7; i >= 0; i--) stream.push((cw >> i) & 1);
    });

    let bitIdx = 0;
    let upward = true;
    for (let col = size - 1; col > 0; col -= 2) {
        if (col === 6) col--;
        for (let step = 0; step < size; step++) {
            const row = upward ? size - 1 - step : step;
            for (let dc = 0; dc < 2; dc++) {
                const c = col - dc;
                if (!reserved[row][c]) {
                    const bit = bitIdx < stream.length ? stream[bitIdx++] : 0;
                    const mask = (row + c) % 2 === 0 ? 1 : 0; // Mask 0
                    grid[row][c] = bit ^ mask;
                }
            }
        }
        upward = !upward;
    }

    // Format info voor Level M (00) + Mask 0 (000) -> BCH(15,5) = 0x5412
    const fmt = 0x5412;
    const fmtCoords1 = [
        [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
        [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]
    ];
    const fmtCoords2 = [
        [size - 1, 8], [size - 2, 8], [size - 3, 8], [size - 4, 8], [size - 5, 8], [size - 6, 8], [size - 7, 8],
        [8, size - 8], [8, size - 7], [8, size - 6], [8, size - 5], [8, size - 4], [8, size - 3], [8, size - 2], [8, size - 1]
    ];
    for (let i = 0; i < 15; i++) {
        const bit = (fmt >> (14 - i)) & 1;
        grid[fmtCoords1[i][0]][fmtCoords1[i][1]] = bit;
        grid[fmtCoords2[i][0]][fmtCoords2[i][1]] = bit;
    }

    return grid;
}

function escapeAttr(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function createQrSvg(url) {
    const safeUrl = (typeof url === 'string' && url.trim()) ? url.trim() : BUNQ_CONFIG.url;
    const matrix = encodeQrMatrix(safeUrl);
    const n = matrix.length;
    const pad = 4; // ISO/IEC 18004 Section 6.3.3 requires 4X quiet zone
    const total = n + pad * 2;
    let pathData = '';
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            if (matrix[r][c]) {
                pathData += `M${c + pad},${r + pad}h1v1h-1z`;
            }
        }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" role="img" aria-label="Scanbare QR-code voor ${escapeAttr(safeUrl)}" class="w-full h-full block" shape-rendering="crispEdges"><rect width="${total}" height="${total}" rx="1.5" fill="#FFFFFF"/><path d="${pathData}" fill="#0C0C0C"/></svg>`;
}

function copyTextWithFallback(text, onSuccess) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(onSuccess).catch(() => legacyCopyText(text, onSuccess));
    } else {
        legacyCopyText(text, onSuccess);
    }
}

function legacyCopyText(text, onSuccess) {
    const input = document.createElement('textarea');
    input.value = text;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    try {
        if (document.execCommand('copy')) onSuccess();
    } catch (_) { /* ignore */ }
    document.body.removeChild(input);
}

function initSteunOns() {
    document.querySelectorAll('[data-bunq-qr]').forEach(el => { el.innerHTML = createQrSvg(BUNQ_CONFIG.url); });
    document.querySelectorAll('[data-bunq-link]').forEach(el => { el.setAttribute('href', BUNQ_CONFIG.url); });
    document.querySelectorAll('[data-bunq-display]').forEach(el => { el.textContent = BUNQ_CONFIG.displayUrl; });

    document.querySelectorAll('[data-copy-iban]').forEach(btn => {
        const label = btn.querySelector('[data-iban-label]');
        if (label) label.textContent = BUNQ_CONFIG.iban;
        let resetTimer = null;
        btn.addEventListener('click', () => {
            copyTextWithFallback(BUNQ_CONFIG.iban, () => {
                if (!label) return;
                if (resetTimer) clearTimeout(resetTimer);
                label.textContent = 'IBAN gekopieerd';
                resetTimer = setTimeout(() => { label.textContent = BUNQ_CONFIG.iban; resetTimer = null; }, 2500);
            });
        });
    });

    document.querySelectorAll('[data-qr-toggle]').forEach(btn => {
        btn.addEventListener('click', () => {
            const panel = document.getElementById(btn.getAttribute('data-qr-toggle'));
            if (panel) btn.setAttribute('aria-expanded', String(!panel.classList.toggle('hidden')));
        });
    });
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSteunOns);
    } else {
        initSteunOns();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BUNQ_CONFIG, encodeQrMatrix, createQrSvg, initSteunOns };
}
