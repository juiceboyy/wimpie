/**
 * admin-utils.js - Gedeelde hulpfuncties voor het Wimpie & de Domino's Dashboard
 */

window.adminUtils = (function () {
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function slugify(text) {
        return (text || '')
            .toString()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9_-]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    function extractYoutubeId(input) {
        if (!input || typeof input !== 'string') return '';
        const trimmed = input.trim();
        if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
        const patterns = [
            /(?:https?:\/\/)?(?:[a-zA-Z0-9-]+\.)?youtu\.be\/([a-zA-Z0-9_-]{11})(?=[?&#/]|$)/i,
            /(?:https?:\/\/)?(?:[a-zA-Z0-9-]+\.)?youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/|v\/)([a-zA-Z0-9_-]{11})(?=[?&#/]|$)/i
        ];
        for (const p of patterns) {
            const m = trimmed.match(p);
            if (m && m[1]) return m[1];
        }
        return '';
    }

    function readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Kon afbeeldingsbestand niet lezen.'));
            reader.readAsDataURL(file);
        });
    }

    function resizeArtworkDataUrl(dataUrl) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const maxDim = 1200;
                const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
                const w = Math.max(1, Math.round(img.width * scale));
                const h = Math.max(1, Math.round(img.height * scale));
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                if (!ctx) return resolve(null);
                ctx.drawImage(img, 0, 0, w, h);
                resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.88), scaled: scale < 1 });
            };
            img.onerror = () => resolve(null);
            img.src = dataUrl;
        });
    }

    async function prepareArtworkFile(file, preferredSlug = '') {
        if (!file || !/^image\/(jpeg|png|webp|gif)$/i.test(file.type || '')) {
            throw new Error('Kies een geldig afbeeldingsbestand (JPG, PNG, WebP of GIF).');
        }
        let dataUrl = await readFileAsDataUrl(file);
        const extMap = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
        let ext = extMap[file.type.toLowerCase()] || 'jpg';

        if (typeof Image !== 'undefined' && ext !== 'gif') {
            const resized = await resizeArtworkDataUrl(dataUrl);
            if (resized && (resized.scaled || file.size > 500 * 1024)) {
                dataUrl = resized.dataUrl;
                ext = 'jpg';
            }
        }

        const baseName = (file.name || 'cover').replace(/\.[^.]+$/, '');
        const cleanBase = slugify(preferredSlug || baseName) || 'cover';
        const contentBase64 = String(dataUrl).replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '');
        return { filename: `${cleanBase}.${ext}`, contentBase64, dataUrl };
    }

    return {
        escapeHtml,
        slugify,
        extractYoutubeId,
        prepareArtworkFile
    };
})();
