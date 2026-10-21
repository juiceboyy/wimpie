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

    return {
        escapeHtml,
        slugify,
        extractYoutubeId
    };
})();
