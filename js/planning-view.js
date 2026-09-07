(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.RollPlanningView = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const STORAGE_KEY = 'rollPlanningPreview';
    const OPEN_KEY = 'autoPlanningPanelOpen';

    function asArray(value) {
        return Array.isArray(value) ? value : [];
    }

    function displayValue(value, fallback) {
        const text = String(value == null ? '' : value).trim();
        return text || fallback;
    }

    function buildPlanningViewModel(input) {
        const sizeChanges = asArray(input && input.sizeChanges);
        const caliberChanges = asArray(input && input.caliberChanges);
        const items = [];

        sizeChanges.forEach((entry, index) => {
            const change = entry && entry.change ? entry.change : entry || {};
            const recommendation = entry && entry.recommendation;
            const slot = recommendation && recommendation.slot ? recommendation.slot : null;
            items.push({
                id: `size-${index}`,
                kind: 'sizeChange',
                kindLabel: 'サイズ替',
                title: `${displayValue(change.fromSize, '未設定')} → ${displayValue(change.toSize, '未設定')}`,
                dueDate: displayValue(change.toDate, '日付未設定'),
                slotLabel: slot ? `${displayValue(slot.date, '')} ${displayValue(slot.shift, '')}`.trim() : '候補枠なし',
                status: slot ? 'candidate' : 'warning',
                statusLabel: slot ? '候補あり' : '要確認'
            });
        });

        caliberChanges.forEach((entry, index) => {
            const status = entry && entry.status;
            const slot = entry && entry.recommendation;
            const deadline = entry && entry.firstOverLimitRun;
            const hasRisk = status === 'noSafeSlot';
            const isDue = status === 'slotFound' || hasRisk;
            items.push({
                id: `caliber-${index}`,
                kind: 'caliberChange',
                kindLabel: 'カリバ替',
                title: [displayValue(entry && entry.equipmentId, '設備未設定'), displayValue(entry && entry.size, '')]
                    .filter(Boolean).join(' '),
                dueDate: deadline ? displayValue(deadline.date, '日付未設定') : '計画期間内は上限未到達',
                slotLabel: slot ? `${displayValue(slot.date, '')} ${displayValue(slot.shift, '')}`.trim() : '候補枠なし',
                status: hasRisk ? 'danger' : isDue ? 'candidate' : 'normal',
                statusLabel: hasRisk ? '安全枠なし' : isDue ? '候補あり' : '経過観察'
            });
        });

        return {
            generatedAt: input && input.generatedAt,
            summary: {
                sizeChangeCount: sizeChanges.length,
                caliberChangeCount: caliberChanges.filter(item => item && item.status === 'slotFound').length,
                riskCount: items.filter(item => item.status === 'danger' || item.status === 'warning').length
            },
            items
        };
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function render(input) {
        if (typeof document === 'undefined') return buildPlanningViewModel(input);
        const model = buildPlanningViewModel(input);
        const list = document.getElementById('auto-planning-list');
        const empty = document.getElementById('auto-planning-empty');
        const sizeCount = document.getElementById('auto-planning-size-count');
        const caliberCount = document.getElementById('auto-planning-caliber-count');
        const riskCount = document.getElementById('auto-planning-risk-count');
        if (sizeCount) sizeCount.textContent = String(model.summary.sizeChangeCount);
        if (caliberCount) caliberCount.textContent = String(model.summary.caliberChangeCount);
        if (riskCount) riskCount.textContent = String(model.summary.riskCount);
        if (!list || !empty) return model;

        empty.hidden = model.items.length > 0;
        list.innerHTML = model.items.map(item => `
            <article class="auto-planning-item is-${escapeHtml(item.status)}">
                <div class="auto-planning-item-main">
                    <span class="auto-planning-kind">${escapeHtml(item.kindLabel)}</span>
                    <strong>${escapeHtml(item.title)}</strong>
                </div>
                <div class="auto-planning-item-meta">
                    <span>期限: ${escapeHtml(item.dueDate)}</span>
                    <span>作業枠: ${escapeHtml(item.slotLabel)}</span>
                    <span class="auto-planning-status">${escapeHtml(item.statusLabel)}</span>
                </div>
            </article>
        `).join('');
        return model;
    }

    function setOpen(open) {
        if (typeof document === 'undefined') return;
        const panel = document.getElementById('auto-planning-panel');
        const body = document.getElementById('auto-planning-body');
        const button = document.getElementById('auto-planning-toggle');
        if (!panel || !body || !button) return;
        panel.classList.toggle('is-collapsed', !open);
        body.hidden = !open;
        button.setAttribute('aria-expanded', open ? 'true' : 'false');
        button.textContent = open ? '自動計画案 ▲' : '自動計画案 ▼';
        try { localStorage.setItem(OPEN_KEY, open ? 'true' : 'false'); } catch (_) {}
    }

    function toggle() {
        if (typeof document === 'undefined') return;
        const button = document.getElementById('auto-planning-toggle');
        setOpen(!(button && button.getAttribute('aria-expanded') === 'true'));
    }

    function setData(input, options) {
        const settings = { persist: true, ...(options || {}) };
        if (settings.persist && typeof localStorage !== 'undefined') {
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(input || {})); } catch (_) {}
        }
        return render(input || {});
    }

    function initialize() {
        if (typeof document === 'undefined') return;
        const button = document.getElementById('auto-planning-toggle');
        if (button) button.addEventListener('click', toggle);
        let input = {};
        let open = false;
        try {
            input = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            open = localStorage.getItem(OPEN_KEY) === 'true';
        } catch (_) {}
        render(input);
        setOpen(open);
    }

    if (typeof document !== 'undefined') {
        document.addEventListener('DOMContentLoaded', initialize);
    }

    return { buildPlanningViewModel, render, setData, setOpen, toggle, initialize };
});
