/* Review foundation only. No production data adapter or automatic instructions. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.RollPreparationForecast = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const DAY = 86400000;
    function validDate(value) {
        return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
            && Number.isFinite(Date.parse(value + 'T00:00:00Z'))
            && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
    }
    function addDays(value, days) {
        if (!validDate(value) || !Number.isSafeInteger(days)) return null;
        const date = new Date(Date.parse(value + 'T00:00:00Z') + days * DAY);
        if (!Number.isFinite(date.getTime())) return null;
        const result = date.toISOString().slice(0, 10);
        return validDate(result) ? result : null;
    }
    function horizonEnd(asOf) {
        if (!validDate(asOf)) throw new Error('基準日が不正です');
        const date = new Date(asOf + 'T00:00:00Z');
        const year = date.getUTCFullYear() + 1, month = date.getUTCMonth();
        const day = Math.min(date.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
        return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
    }
    function nonnegativeDays(value) {
        return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
    }
    function resolveDiameterCriterion({ rollId, standId, asOf, criteria }) {
        if (!validDate(asOf)) throw new Error('基準日が不正です');
        const result = { state: 'unknown', criterion: null, missing: [] };
        if (typeof rollId !== 'string' || !rollId.trim() || typeof standId !== 'string' || !standId.trim()) {
            result.missing.push('ロール・スタンドの個体ID'); return result;
        }
        if (!Array.isArray(criteria)) { result.missing.push('廃却径の基準一覧'); return result; }
        const individual = criteria.filter(r => r && r.scope === 'roll' && r.targetId === rollId);
        const selected = individual.length ? individual : criteria.filter(r => r && r.scope === 'stand' && r.targetId === standId);
        // An explicit individual rule must never silently fall back to the stand default.
        if (selected.length !== 1) {
            result.missing.push(selected.length ? '適用する廃却径基準の重複・矛盾の解消' : '適用する廃却径基準');
            return result;
        }
        const rule = selected[0];
        result.criterion = { ...rule };
        if (typeof rule.id !== 'string' || !rule.id.trim()) result.missing.push('廃却径基準ID');
        if (typeof rule.valueMm !== 'number' || !Number.isFinite(rule.valueMm) || rule.valueMm <= 0) result.missing.push('廃却径');
        if (rule.confirmed !== true || !validDate(rule.confirmedOn) || rule.confirmedOn > asOf) result.missing.push('廃却径基準の確認');
        if (typeof rule.source !== 'string' || !rule.source.trim()) result.missing.push('廃却径基準の根拠');
        if (!result.missing.length) result.state = 'resolved';
        return result;
    }
    function assessDiameterEvidence({ rollId, standId, asOf, criteria, measurement }) {
        const selection = resolveDiameterCriterion({ rollId, standId, asOf, criteria });
        const missing = [...selection.missing];
        if (!measurement || measurement.rollId !== rollId || measurement.currentCycleConfirmed !== true) missing.push('今回のロール・改削サイクルに対応する径');
        if (!measurement || typeof measurement.valueMm !== 'number' || !Number.isFinite(measurement.valueMm) || measurement.valueMm <= 0) missing.push('実測径');
        if (!measurement || !validDate(measurement.measuredOn) || measurement.measuredOn > asOf) missing.push('実測日');
        if (!measurement || typeof measurement.source !== 'string' || !measurement.source.trim()) missing.push('実測径の根拠');
        const result = { state: 'unknown', criterion: selection.criterion, criterionState: selection.state,
            missing, currentDiameterMm: null, marginMm: null, readinessAssessed: false };
        if (missing.length) return result;
        result.currentDiameterMm = measurement.valueMm;
        result.marginMm = Math.round((measurement.valueMm - selection.criterion.valueMm) * 1e6) / 1e6;
        // A geometric comparison alone cannot approve use, regrinding, or a rotation.
        result.state = result.marginMm > 0 ? 'above_limit' : result.marginMm < 0 ? 'below_limit' : 'at_limit';
        return result;
    }
    function assessPreparation(job, asOf) {
        if (!validDate(asOf)) throw new Error('基準日が不正です');
        const missing = [];
        for (const [key, label] of [['neededOn', '必要日'], ['rollReadyOn', 'ロールの整備完了予定'], ['donorReleasedOn', 'チョック移し元の使用終了・利用可能日']]) {
            if (!validDate(job[key])) missing.push(label);
        }
        for (const [key, label] of [['assemblyDays', '組替所要日数'], ['bufferDays', '準備の余裕日数']]) {
            if (!nonnegativeDays(job[key])) missing.push(label);
        }
        for (const [key, label] of [['diameterChecked', '径・改削可否'], ['machiningHistoryChecked', '加工履歴・今回サイクルとの対応'], ['usageKnown', '使用量'], ['calibersChecked', '残カリバ・使用条件'], ['donorCompatible', 'チョック移し元との適合']]) {
            if (job[key] !== true) missing.push(label);
        }
        if (!job.rollId || !job.donorId || job.rollId === job.donorId) missing.push('移し元・移し先の別ID');
        if (job.assemblyNotBefore != null && !validDate(job.assemblyNotBefore)) missing.push('組替着手予定');
        if (job.completedOn != null && (!validDate(job.completedOn) || job.completedOn > asOf)) missing.push('組替完了実績日');
        const completionClaimed = job.completedOn != null;
        if (completionClaimed && job.completionReflected !== true) missing.push('組替完了の反映確認');
        if (job.completionReflected === true && !completionClaimed) missing.push('組替完了実績日');
        const actualConflict = validDate(job.completedOn) && [job.rollReadyOn, job.donorReleasedOn, job.assemblyNotBefore]
            .some(date => validDate(date) && job.completedOn < date);
        if (actualConflict) missing.push('完了実績とロール・チョック・着手可能日の整合');
        const result = { ...job, missing, readyOn: null, deadline: null, preparationDueOn: null,
            timingState: 'unknown', timingIssues: [], state: 'unknown', reason: '' };
        if (validDate(job.neededOn) && nonnegativeDays(job.assemblyDays) && nonnegativeDays(job.bufferDays)) {
            result.preparationDueOn = addDays(job.neededOn, -job.bufferDays);
            result.deadline = addDays(result.preparationDueOn, -job.assemblyDays);
            if (!result.preparationDueOn || !result.deadline) missing.push('準備期限を計算できる日付・所要日数');
        }
        // Keep a known late prerequisite visible even when unrelated data is missing.
        // Never use an unverified/contradictory completion as either an actual or a new forecast.
        let readyOn = null;
        const actualVerified = completionClaimed && validDate(job.completedOn) && job.completedOn <= asOf
            && job.completionReflected === true && !actualConflict;
        if (actualVerified) readyOn = job.completedOn;
        else if (!completionClaimed && job.completionReflected !== true) {
            const availability = [['rollReadyOn', 'ロールの整備完了予定'], ['donorReleasedOn', 'チョックの利用可能日'],
                ['assemblyNotBefore', '組替着手可能日']];
            if (validDate(job.neededOn)) {
                for (const [key, label] of availability) {
                    if (validDate(job[key]) && job[key] > job.neededOn) {
                        result.timingIssues.push({ field: key, availableOn: job[key], neededOn: job.neededOn,
                            reason: label + 'が必要日を過ぎています' });
                    }
                }
            }
            if (validDate(job.rollReadyOn) && validDate(job.donorReleasedOn) && nonnegativeDays(job.assemblyDays)
                && (job.assemblyNotBefore == null || validDate(job.assemblyNotBefore))) {
                const earliestStart = [asOf, job.rollReadyOn, job.donorReleasedOn, job.assemblyNotBefore || asOf].sort().at(-1);
                readyOn = addDays(earliestStart, job.assemblyDays);
                if (!readyOn) missing.push('組替完了予定を計算できる日付・所要日数');
            }
        }
        if (validDate(job.neededOn) && readyOn && readyOn > job.neededOn) {
            result.timingIssues.push({ field: actualVerified ? 'completedOn' : 'projectedReadyOn',
                availableOn: readyOn, neededOn: job.neededOn, reason: '組替後の準備完了が必要日を過ぎています' });
        }
        result.timingState = result.timingIssues.length ? 'shortage'
            : !readyOn || !result.preparationDueOn ? 'unknown'
            : readyOn > result.preparationDueOn ? 'tight' : 'feasible';
        if (missing.length) {
            result.state = result.timingState === 'shortage' ? 'shortage' : 'unknown';
            result.reason = (result.state === 'shortage' ? '既知の条件だけでも必要日に間に合いません。' : '')
                + '判定に必要な情報が不足・未確認：' + missing.join('、');
            return result;
        }
        result.readyOn = readyOn;
        result.state = result.timingState;
        if (result.state === 'shortage') {
            result.reason = '必要日までに組替後のロールを準備できません';
        } else if (result.state === 'tight') {
            result.reason = '必要日には間に合う計算ですが、準備の余裕を確保できません';
        } else if (result.state === 'feasible') {
            result.reason = '入力条件上は準備が間に合う見込み';
        } else {
            result.reason = '入力条件から準備完了日を確定できません';
        }
        return result;
    }
    function assessWindow({ asOf, coverageThrough, jobs }) {
        const through = horizonEnd(asOf);
        const rows = [], known = new Map(), ids = new Set();
        const source = Array.isArray(jobs) ? jobs : [];
        for (const job of [...source].sort((a, b) => String(a.neededOn || '').localeCompare(String(b.neededOn || '')))) {
            if (!job.id || ids.has(job.id)) throw new Error('準備予定IDが未設定または重複しています');
            ids.add(job.id);
            if (validDate(job.neededOn) && (job.neededOn < asOf || job.neededOn > through)) continue;
            const row = assessPreparation(job, asOf);
            const blocked = (job.dependsOn || []).filter(id => !known.has(id) || ['shortage', 'unknown', 'blocked'].includes(known.get(id).state));
            if (blocked.length) {
                // Dependency uncertainty must not hide this job's proven lateness.
                if (row.state !== 'shortage') row.state = 'blocked';
                row.readyOn = null;
                row.reason = (row.state === 'shortage' ? row.reason + '。' : '')
                    + '前の交換・準備が成立していないため、以降の循環を再計画する必要があります';
                row.blockedBy = blocked;
            }
            rows.push(row); known.set(job.id, row);
        }
        const coverageComplete = validDate(coverageThrough) && coverageThrough >= through && rows.length > 0;
        return { asOf, through, rows, coverageComplete,
            scope: 'supplied-preparation-jobs-only', annualReadiness: 'not_assessed',
            state: rows.some(r => r.state === 'shortage') ? 'shortage'
                : !coverageComplete || rows.some(r => ['unknown', 'blocked'].includes(r.state)) ? 'unknown'
                : rows.some(r => r.state === 'tight') ? 'tight' : 'feasible' };
    }
    function taskState(task) {
        // An acknowledgement has no effect on resolution. Absent prerequisites stay unknown.
        const conditionsResolved = Array.isArray(task.requirements) && task.requirements.length > 0
            && task.requirements.every(r => r.done === true);
        if (!conditionsResolved || task.unresolvedAlert === true) return 'open';
        return task.reflection === 'verified' ? 'completed' : 'pending_confirmation';
    }
    function assessSameDayAssembly(job, asOf) {
        if (!validDate(asOf)) throw new Error('基準日が不正です');
        const nightKnown = job.nightProduction === 'operating' || job.nightProduction === 'stopped';
        const dueOn = validDate(job.workDate) ? job.workDate : null;
        const missing = [];
        if (!dueOn) missing.push('組替作業日');
        if (!nightKnown) missing.push('組替日の夜勤操業予定');
        const hasCompletion = job.completedOn != null;
        const validCompletion = hasCompletion && validDate(job.completedOn) && job.completedOn <= asOf;
        if (hasCompletion && !validCompletion) missing.push('組替完了実績日');
        if (hasCompletion && job.completionReflected !== true) missing.push('組替完了の反映確認');
        if (!hasCompletion && job.completionReflected === true) missing.push('反映確認に対応する組替完了実績');
        const conflicts = validCompletion && dueOn && job.completedOn < dueOn;
        if (conflicts) missing.push('組替作業日より前の完了実績との整合');
        const result = { scope:'same-workday-completion-only', dueOn, deadlineTime:null,
            requirement: job.nightProduction === 'operating' ? 'required_for_night_operation'
                : job.nightProduction === 'stopped' ? 'same_day_target' : 'night_schedule_unknown',
            state:'unknown', missing, assemblyCompletionVerified:false, sameDayMet:null,
            needsAttention:true, readinessAssessed:false, reason:'' };
        if (!dueOn || (hasCompletion && !validCompletion) || conflicts || (!hasCompletion && job.completionReflected === true)) {
            result.reason = '当日完了を判定する情報が不足・矛盾しています'; return result;
        }
        // A recorded event is not proof until reflection is verified. A missed day remains visible.
        if (hasCompletion && job.completionReflected === true) {
            result.assemblyCompletionVerified = true;
            result.sameDayMet = job.completedOn === dueOn;
            if (!result.sameDayMet) {
                result.state = 'completed_late';
                result.reason = '組替完了は確認済みですが、当日完了条件を満たしていません';
            } else if (!nightKnown) {
                result.state = 'night_schedule_unknown';
                result.reason = '当日完了は確認済みですが、その夜の操業予定は未確認です';
            } else {
                result.state = 'completed_same_day'; result.needsAttention = false;
                result.reason = '当日の組替完了と反映を確認済み。夜勤への使用適合・時刻は別途確認が必要です';
            }
        } else if (dueOn < asOf) {
            result.state = 'overdue_unconfirmed';
            result.reason = '組替日を過ぎていますが、当日の完了を確認できていません';
        } else if (hasCompletion) {
            result.state = 'pending_confirmation';
            result.reason = '組替完了の反映確認待ちです';
        } else if (!nightKnown) {
            result.state = 'night_schedule_unknown';
            result.reason = '夜勤操業予定を確認し、当日完了の必須条件を判定してください';
        } else {
            result.state = dueOn === asOf ? 'due_today' : 'planned';
            result.reason = job.nightProduction === 'operating'
                ? '当夜の予備確保に向け、組替を作業日のうちに完了する必要があります'
                : '夜勤休止でも、通常の組替目標は当日完了です';
        }
        return result;
    }
    function partitionTasks(tasks) {
        const active = [], completed = [], ids = new Set();
        for (const task of tasks) {
            if (!task.id || ids.has(task.id)) throw new Error('タスクIDが未設定または重複しています');
            ids.add(task.id);
            const row = { ...task, state: taskState(task) };
            (row.state === 'completed' ? completed : active).push(row);
        }
        active.sort((a, b) => (a.priority ?? 9) - (b.priority ?? 9)
            || String(a.deadline || '9999').localeCompare(String(b.deadline || '9999')) || a.id.localeCompare(b.id));
        return { active, completed, count: active.length };
    }
    return { validDate, addDays, horizonEnd, resolveDiameterCriterion, assessDiameterEvidence,
        assessPreparation, assessWindow, assessSameDayAssembly, taskState, partitionTasks };
});
