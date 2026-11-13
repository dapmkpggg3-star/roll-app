// Explicit offline recovery. Nothing here runs on load, syncs, or contacts a server.
const OFFLINE_RECOVERY_KIND = 'roll-app-offline-recovery';
const OFFLINE_RECOVERY_VERSION = 1;
const OFFLINE_RECOVERY_ROLLBACK_KEY = 'roles_offline_recovery_rollback_v1';
const SENSITIVE_RECOVERY_KEY = /token|secret|password|authorization|apiendpoint|credential/i;

function cloneRecoveryValue(value) {
    if (Array.isArray(value)) {
        return value.map(cloneRecoveryValue);
    }
    if (!value || typeof value !== 'object') {
        return value;
    }
    const copy = {};
    Object.keys(value).forEach(key => {
        if (SENSITIVE_RECOVERY_KEY.test(key)) {
            return;
        }
        copy[key] = cloneRecoveryValue(value[key]);
    });
    return copy;
}

function canonicalRecoveryJson(value) {
    if (Array.isArray(value)) {
        return `[${value.map(canonicalRecoveryJson).join(',')}]`;
    }
    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalRecoveryJson(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}

function recoveryChecksum(payload) {
    const text = canonicalRecoveryJson(payload);
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function recoveryArray(value) {
    return Array.isArray(value) ? cloneRecoveryValue(value) : null;
}

function normalizeRecoveryGenerations(value) {
    if (value == null) {
        return [];
    }
    if (!Array.isArray(value)) {
        return null;
    }
    const generations = [];
    for (const item of value.slice(0, 5)) {
        if (!item || !Array.isArray(item.localOriginal) || !Array.isArray(item.remoteOriginal)) {
            return null;
        }
        generations.push({
            savedAt: String(item.savedAt || ''),
            localOriginal: cloneRecoveryValue(item.localOriginal),
            remoteOriginal: cloneRecoveryValue(item.remoteOriginal)
        });
    }
    return generations;
}

function buildOfflineRecoveryPackage(snapshot) {
    const roles = recoveryArray(snapshot && snapshot.roles);
    const localOriginal = recoveryArray(snapshot && snapshot.localOriginal);
    const remoteOriginal = recoveryArray(snapshot && snapshot.remoteOriginal);
    const generations = normalizeRecoveryGenerations(snapshot && snapshot.generations);
    if (!roles || !localOriginal || !remoteOriginal || !generations) {
        return null;
    }
    const payload = {
        kind: OFFLINE_RECOVERY_KIND,
        version: OFFLINE_RECOVERY_VERSION,
        savedAt: snapshot && snapshot.savedAt ? String(snapshot.savedAt) : new Date().toISOString(),
        roles,
        localOriginal,
        remoteOriginal,
        generations
    };
    payload.checksum = recoveryChecksum(payload);
    return payload;
}

function verifyOfflineRecoveryPackage(pkg) {
    if (!pkg || pkg.kind !== OFFLINE_RECOVERY_KIND || pkg.version !== OFFLINE_RECOVERY_VERSION) {
        return { ok: false, reason: '復旧ファイルの形式が違います。' };
    }
    if (!Array.isArray(pkg.roles) || !Array.isArray(pkg.localOriginal) || !Array.isArray(pkg.remoteOriginal)) {
        return { ok: false, reason: '復旧ファイルのロール一覧が不正です。' };
    }
    if (pkg.generations !== undefined && !normalizeRecoveryGenerations(pkg.generations)) {
        return { ok: false, reason: '復旧ファイルの世代が不正です。' };
    }
    const { checksum, ...payload } = pkg;
    if (checksum !== recoveryChecksum(payload)) {
        return { ok: false, reason: '復旧ファイルの検証に失敗したため中止しました。' };
    }
    return { ok: true, roleCount: pkg.roles.length };
}

function readStoredRecoveryArray(storage, key) {
    const raw = storage.getItem(key);
    if (raw === null || raw === undefined || raw === '') {
        return [];
    }
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : null;
    } catch (error) {
        return null;
    }
}

function buildRollbackFromStorage(storage) {
    const roles = readStoredRecoveryArray(storage, 'roles');
    if (roles === null) {
        return { ok: false, reason: '現在の保存データが壊れているため、取り消し用の控えを作れません。' };
    }
    let localOriginal = [];
    let remoteOriginal = [];
    let generations = [];
    try {
        const pair = JSON.parse(storage.getItem('roles_sync_original_pair_v1') || 'null');
        if (pair && Array.isArray(pair.localOriginal) && Array.isArray(pair.remoteOriginal)) {
            localOriginal = pair.localOriginal;
            remoteOriginal = pair.remoteOriginal;
        }
        generations = normalizeRecoveryGenerations(JSON.parse(storage.getItem('roles_sync_original_generations_v1') || '[]'));
        if (!generations) {
            return { ok: false, reason: '世代の控えが壊れているため、取り消し用の控えを作れません。' };
        }
    } catch (error) {
        return { ok: false, reason: '同期前の控えが壊れているため、取り消し用の控えを作れません。' };
    }
    const rollback = buildOfflineRecoveryPackage({
        roles,
        localOriginal,
        remoteOriginal,
        generations,
        savedAt: new Date().toISOString()
    });
    return rollback ? { ok: true, package: rollback } : { ok: false, reason: '取り消し用の控えを作れません。' };
}

function writeRecoveryOriginals(storage, pkg) {
    const savedAt = pkg.savedAt || new Date().toISOString();
    storage.setItem('roles_sync_original_pair_v1', JSON.stringify({
        savedAt,
        localOriginal: pkg.localOriginal,
        remoteOriginal: pkg.remoteOriginal
    }));
    storage.setItem('roles_original_local_before_sync', JSON.stringify(pkg.localOriginal));
    storage.setItem('roles_original_remote_before_sync', JSON.stringify(pkg.remoteOriginal));
    storage.setItem('roles_original_local_before_sync_saved_at', savedAt);
    storage.setItem('roles_original_remote_before_sync_saved_at', savedAt);
    storage.setItem('roles_sync_original_generations_v1', JSON.stringify(normalizeRecoveryGenerations(pkg.generations) || []));
}

function applyOfflineRecoveryPackage(storage, pkg, options) {
    if (!options || options.confirmed !== true || options.rollbackAcknowledged !== true) {
        return { applied: false, reason: 'confirmation-required' };
    }
    const verified = verifyOfflineRecoveryPackage(pkg);
    if (!verified.ok) {
        return { applied: false, reason: verified.reason };
    }
    const rollback = buildRollbackFromStorage(storage);
    if (!rollback.ok) {
        return { applied: false, reason: rollback.reason };
    }
    storage.setItem(OFFLINE_RECOVERY_ROLLBACK_KEY, JSON.stringify(rollback.package));
    const roles = cloneRecoveryValue(pkg.roles);
    storage.setItem('roles', JSON.stringify(roles));
    writeRecoveryOriginals(storage, pkg);
    return { applied: true, roles, rollback: rollback.package };
}

function rollbackOfflineRecovery(storage, options) {
    if (!options || options.confirmed !== true) {
        return { applied: false, reason: 'confirmation-required' };
    }
    const raw = storage.getItem(OFFLINE_RECOVERY_ROLLBACK_KEY);
    if (!raw) {
        return { applied: false, reason: '取り消す復旧操作がありません。' };
    }
    let pkg;
    try {
        pkg = JSON.parse(raw);
    } catch (error) {
        return { applied: false, reason: '取り消し用の控えが壊れているため中止しました。' };
    }
    const verified = verifyOfflineRecoveryPackage(pkg);
    if (!verified.ok) {
        return { applied: false, reason: verified.reason };
    }
    const roles = cloneRecoveryValue(pkg.roles);
    storage.setItem('roles', JSON.stringify(roles));
    writeRecoveryOriginals(storage, pkg);
    storage.removeItem(OFFLINE_RECOVERY_ROLLBACK_KEY);
    return { applied: true, roles };
}

function downloadRecoveryJson(value, filename) {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function exportOfflineRecoveryFile() {
    const currentRoles = typeof roles !== 'undefined' && Array.isArray(roles) ? roles : [];
    const originals = typeof readIndependentSyncOriginals === 'function'
        ? readIndependentSyncOriginals()
        : { localOriginal: [], remoteOriginal: [] };
    let generations = [];
    try {
        const stored = JSON.parse(localStorage.getItem('roles_sync_original_generations_v1') || '[]');
        generations = Array.isArray(stored) ? stored : [];
    } catch (error) {
        alert('世代の控えが壊れているため、復旧ファイルを作れません。');
        return;
    }
    const pkg = buildOfflineRecoveryPackage({
        roles: currentRoles,
        localOriginal: originals.localOriginal || [],
        remoteOriginal: originals.remoteOriginal || [],
        generations,
        savedAt: new Date().toISOString()
    });
    if (!pkg) {
        alert('復旧ファイルを作れません。');
        return;
    }
    downloadRecoveryJson(pkg, 'roll-offline-recovery.json');
}

function handleOfflineRecoveryFile(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) {
        return;
    }
    const reader = new FileReader();
    reader.onload = () => {
        let parsed;
        try {
            parsed = JSON.parse(String(reader.result || ''));
        } catch (error) {
            alert('復旧ファイルを読めないため、何も変更していません。');
            return;
        }
        const preview = verifyOfflineRecoveryPackage(parsed);
        if (!preview.ok) {
            alert(preview.reason);
            return;
        }
        const proceed = confirm(`復旧ファイルは${preview.roleCount}件です。適用前に、今のデータを取り消し用ファイルとして保存します。続行しますか？`);
        if (!proceed) {
            return;
        }
        const rollback = buildRollbackFromStorage(localStorage);
        if (!rollback.ok) {
            alert(rollback.reason);
            return;
        }
        downloadRecoveryJson(rollback.package, 'roll-offline-recovery-rollback.json');
        const applyNow = confirm('取り消し用ファイルの保存を開始しました。復旧ファイルを適用しますか？');
        if (!applyNow) {
            return;
        }
        const result = applyOfflineRecoveryPackage(localStorage, parsed, {
            confirmed: true,
            rollbackAcknowledged: true
        });
        if (!result.applied) {
            alert(result.reason || '適用を中止しました。');
            return;
        }
        roles = result.roles;
        if (typeof renderRoles === 'function') {
            renderRoles();
        }
        alert('復旧ファイルを適用しました。戻すときは「直前の復旧を取り消す」を押してください。');
    };
    reader.readAsText(file, 'UTF-8');
}

function undoOfflineRecovery() {
    const ok = confirm('直前に適用した復旧を取り消し、適用前のデータへ戻しますか？');
    if (!ok) {
        return;
    }
    const result = rollbackOfflineRecovery(localStorage, { confirmed: true });
    if (!result.applied) {
        alert(result.reason || '取り消していません。');
        return;
    }
    roles = result.roles;
    if (typeof renderRoles === 'function') {
        renderRoles();
    }
    alert('適用前のデータへ戻しました。');
}
