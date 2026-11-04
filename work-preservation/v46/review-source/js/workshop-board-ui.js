// Validation-only view adapter. Existing status editing remains the sole place
// to record preparation; this board only reads instructions or resumes a journal.
let formalWorkshopController = null;
let formalWorkshopState = { phase: 'idle', model: null, error: '' };
let formalWorkshopCompleted = false;
const formalWorkshopReviewDrafts = new Map();

function invalidateFormalWorkshopBoard() {
    formalWorkshopState = { ...formalWorkshopState, phase: 'stale', error: 'ロール更新後の指示は未確認です。最新の指示を取得してください。' };
    if (isWorkshopCompletionEnabled()) renderFormalWorkshopBoard();
}

function resetFormalWorkshopBoard() {
    formalWorkshopController = null;
    formalWorkshopState = { phase: 'idle', model: null, error: '' };
    formalWorkshopCompleted = false;
    formalWorkshopReviewDrafts.clear();
    const list = document.getElementById('workshop-board-list');
    if (isWorkshopCompletionEnabled() && list) list.replaceChildren();
}

async function callWorkshopBoardApi(payload) {
    const session = captureSyncSession();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);
    try {
        const response = await rollApiFetch(SHEETS_ENDPOINT, { method: 'POST', body: JSON.stringify(payload), signal: controller.signal });
        const data = await readJsonResponse(response, '工作指示確認');
        session.assertCurrent();
        if (!data || data.success !== true || !data.result) throw new Error('工作指示の確認に失敗しました。');
        return data.result;
    } finally { clearTimeout(timeout); }
}

async function refreshFormalWorkshopBoard(operationId, review) {
    if (!isWorkshopCompletionEnabled()) return;
    // Serialise with the existing status editor and ordinary roll sync.
    if (isSyncing) { showToast('同期中です。完了後に工作指示を再取得してください。'); return; }
    const session = captureSyncSession();
    if (!formalWorkshopController || !formalWorkshopController.isCurrent()) {
        resetFormalWorkshopBoard();
        formalWorkshopController = RollWorkshopBoard.create({ captureSession: () => session,
            makeId: () => 'impact-' + Array.from(crypto.getRandomValues(new Uint32Array(4)),
                value => value.toString(16).padStart(8, '0')).join(''),
            role: () => RollAuth.currentUser()?.role, call: callWorkshopBoardApi,
            publish: state => { formalWorkshopState = state; renderFormalWorkshopBoard(); } });
    }
    isSyncing = true;
    setSyncButtonBusy(true);
    try {
        if (review) {
            await formalWorkshopController.reviewDeadline(review.id, review.reason);
            session.assertCurrent();
            formalWorkshopReviewDrafts.delete(review.id);
            showToast('期限超過の対応記録を保存しました。');
        } else if (operationId) {
            // Server recovery may change rows even if its response is lost.
            // Do not overwrite the local editor or claim global sync success.
            setSyncContentPhase('unknown');
            await formalWorkshopController.resume(operationId);
            session.assertCurrent();
            setSyncMessage('工作の反映を再確認しました。端末のロール一覧は同期で確認してください。');
        } else await formalWorkshopController.refresh();
    } catch (error) {
        if (session.isCurrent()) showToast(error.message);
    } finally {
        isSyncing = false;
        isSyncQueued = false;
        setSyncButtonBusy(false);
    }
}

function renderFormalWorkshopBoard() {
    if (!isWorkshopCompletionEnabled()) return false;
    const board = document.getElementById('workshop-board');
    const list = document.getElementById('workshop-board-list');
    if (!board || !list) return true;
    board.classList.add('formal-workshop-board');
    const element = (tag, text, className) => {
        const node = document.createElement(tag);
        if (text !== undefined) node.textContent = text;
        if (className) node.className = className;
        return node;
    };
    const state = formalWorkshopState;
    const fresh = state.phase === 'ready';
    const canEdit = ['editor', 'admin'].includes(globalThis.RollAuth?.currentUser()?.role);
    board.querySelector('h2').textContent = '工作の組替指示';
    board.querySelector('.workshop-board-header p').textContent = '準備期限までに組み替える指示です。実施日・作業順は工作と相談して決めます。';
    const note = board.querySelector('.workshop-board-note');
    note.textContent = '日内の締切時刻・使用適合は別途確認が必要です。組込完了は使用開始とは別です。反映確認待ち・未解決の指示は残し、完了した指示は「完了済み」で確認できます。';
    document.getElementById('workshop-board-selected-toggle').hidden = true;
    const print = document.getElementById('workshop-board-print');
    print.disabled = !fresh;
    const select = document.getElementById('workshop-board-stand-filter');
    select.setAttribute('aria-label', '工作指示スタンド絞り込み');
    const stands = [...new Set((state.model?.items || []).map(item => item.standId))].sort((a, b) => a.localeCompare(b, 'ja', { numeric: true }));
    if (workshopBoardStandFilter !== 'all' && !stands.includes(workshopBoardStandFilter)) stands.push(workshopBoardStandFilter);
    select.replaceChildren();
    for (const stand of ['all', ...stands]) {
        const option = element('option', stand === 'all' ? '全スタンド' : '#' + stand);
        option.value = stand; select.append(option);
    }
    select.value = workshopBoardStandFilter;
    const summary = document.getElementById('workshop-board-summary');
    summary.replaceChildren(); summary.setAttribute('aria-label', '工作指示の確認状態');
    const button = (text, action, disabled = false) => {
        const node = element('button', text, 'workshop-board-print-btn');
        node.type = 'button'; node.disabled = disabled; node.addEventListener('click', action); return node;
    };
    summary.append(button(state.phase === 'loading' ? '確認中…' : '最新の指示を取得', () => refreshFormalWorkshopBoard(), state.phase === 'loading'));
    const toggle = button(formalWorkshopCompleted ? '未完了を表示' : '完了済みを見る', () => {
        formalWorkshopCompleted = !formalWorkshopCompleted; renderFormalWorkshopBoard();
    });
    toggle.setAttribute('aria-pressed', String(formalWorkshopCompleted)); summary.append(toggle);
    const checkedAt = state.model ? new Date(state.model.checkedAt).toLocaleString('ja-JP', {
        timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    }) : '';
    const message = state.phase === 'loading' ? '確認中です。前回の情報は参考表示です。'
        : state.error || (fresh ? '確認時点：' + checkedAt + '（日本時間）' : '未取得です。工作指示を取得してください。');
    summary.append(element('p', message, state.error ? 'formal-workshop-warning' : ''));
    if (state.model && (!fresh || state.error)) summary.append(element('p', '前回確認時点：' + checkedAt + '（日本時間）'));
    const items = state.model ? RollWorkshopBoard.select(state.model, { standId: workshopBoardStandFilter, completed: formalWorkshopCompleted }) : [];
    document.getElementById('workshop-board-count').textContent = state.model
        ? `${items.length}件${fresh ? '' : '（前回確認分）'}` : '未確認';
    list.replaceChildren();
    if (!items.length) list.append(element('p', fresh ? (formalWorkshopCompleted ? '完了済みの指示はありません。' : 'この表示条件の未完了指示はありません。')
        : '最新状態は未確認です。指示なし・完了とは判定していません。', 'workshop-board-empty'));
    items.forEach(item => {
        const card = element('article', undefined, 'assembly-alert-card is-selected formal-workshop-card');
        card.classList.add(item.completed ? 'formal-workshop-completed' : item.blockers.length || item.pending.some(op => op.status === 'blocked')
            ? 'formal-workshop-blocked' : item.pending.length || item.label === '反映確認待ち' ? 'formal-workshop-pending' : 'formal-workshop-active');
        card.append(element('h3', '#' + item.standId + '　' + item.label));
        card.append(element('p', 'チョック移し元：' + item.donor + ' → 組込先：' + item.recipient));
        card.append(element('p', '準備期限：' + item.readyBy + '（採用した指示）' + (item.prepared ? ' ／ 組込完了日：' + item.prepared : '')));
        const deadlineText = { due_today: '準備期限は今日です。', overdue_unconfirmed: '準備期限を過ぎています。完了と反映を確認してください。',
            completed_late: item.impactReviewed ? '準備期限後の完了と、影響確認・対応内容を記録しています。'
                : '準備期限後の完了です。予備不足などへの影響が解消したか確認が必要です。', completed_in_time: '準備期限内の組込完了・反映を確認済みです。' };
        if (deadlineText[item.deadline.state]) card.append(element('p', deadlineText[item.deadline.state],
            ['overdue_unconfirmed', 'completed_late'].includes(item.deadline.state) && !item.impactReviewed ? 'formal-workshop-warning' : ''));
        const schedule = item.workSchedule;
        if (!schedule.workDate) card.append(element('p', '作業予定日：未定（工作と相談）'));
        else {
            const night = { operating: '操業あり・実施当日の完了が必要', stopped: '休止予定', unknown: '未確認' };
            card.append(element('p', '作業予定日：' + schedule.workDate + ' ／ 予定日の夜勤：' + night[schedule.nightProduction]));
            if (schedule.state === 'past_plan') card.append(element('p', '作業予定日が過ぎています。日程・進捗を工作と確認してください。'));
        }
        item.blockers.forEach(reason => card.append(element('p', '要対応：' + reason, 'formal-workshop-warning')));
        item.pending.forEach(op => {
            card.append(element('p', op.status === 'blocked' ? '保存先と記録が一致せず停止しています。変更内容の確認が必要です。' : '表・履歴への反映確認が途中です。'));
            card.append(button('反映を再確認', () => refreshFormalWorkshopBoard(op.id), !fresh || !canEdit));
        });
        if (item.deadlineReview) {
            card.append(element('p', '対応記録（' + item.deadlineReview.on + '）：' + item.deadlineReview.reason));
        }
        if (item.canReviewDeadline && canEdit) {
            const details = element('details');
            details.open = formalWorkshopReviewDrafts.has(item.id);
            details.append(element('summary', '期限超過の対応を記録'));
            details.append(element('p', '遅れによる予備不足などの影響を確認し、解消した内容を記録してください。既読だけでは完了にしません。'));
            const reason = element('textarea');
            reason.setAttribute('aria-label', '影響確認・対応内容');
            reason.maxLength = 700; reason.rows = 3;
            reason.style = 'width:100%;box-sizing:border-box';
            reason.value = formalWorkshopReviewDrafts.get(item.id) || '';
            reason.disabled = !fresh;
            reason.addEventListener('input', () => formalWorkshopReviewDrafts.set(item.id, reason.value));
            details.append(reason);
            details.append(button('対応完了として記録', () => refreshFormalWorkshopBoard(null, { id: item.id, reason: reason.value }), !fresh));
            card.append(details);
        }
        // Do not open/overwrite an existing edit form from a second entry point.
        card.append(element('p', item.completed ? '履歴を残して完了済みに移しています。'
            : item.assemblyVerified ? '組込は完了済みです。残っている確認事項への対応が必要です。'
            : '更新する場合は「ロール一覧に戻る」から組込先ロールを編集してください。'));
        list.append(card);
    });
    print.disabled = !fresh || !items.length;
    return true;
}
