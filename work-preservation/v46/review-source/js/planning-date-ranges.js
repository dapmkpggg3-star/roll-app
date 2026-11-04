/* Calendar timing review only. Month boundaries are bounds, never adopted dates. */
(function(root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./preparation-forecast'));
    else root.RollPlanningDateRanges = factory(root.RollPreparationForecast);
})(typeof globalThis !== 'undefined' ? globalThis : this, function(dates) {
    'use strict';
    const blank = v => v == null || (typeof v === 'string' && !v.trim());
    const integer = v => typeof v === 'number' ? (Number.isSafeInteger(v) ? v : null)
        : typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v.trim()) : null;
    const iso = (y,m,d) => `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    function parseCalendarParts(parts) {
        const raw = { year: parts?.year ?? null, month: parts?.month ?? null, day: parts?.day ?? null };
        const result = { raw, state: 'unknown', precision: null, date: null, earliest: null, latest: null, reason: '' };
        if (blank(raw.year) || blank(raw.month)) {
            result.reason = '年または月が未記入です'; return result;
        }
        const year = integer(raw.year), month = integer(raw.month), day = integer(raw.day);
        if (year == null || year < 1000 || year > 9999 || month == null || month < 1 || month > 12) {
            result.state = 'invalid'; result.reason = '西暦年・月が不正または年の表記が未確認です'; return result;
        }
        if (blank(raw.day)) {
            result.state = 'known'; result.precision = 'month';
            result.earliest = iso(year,month,1);
            result.latest = iso(year,month,new Date(Date.UTC(year,month,0)).getUTCDate());
            return result;
        }
        const date = iso(year,month,day);
        if (day == null || !dates.validDate(date)) {
            result.state = 'invalid'; result.reason = '日付が不正です'; return result;
        }
        return { ...result, state: 'known', precision: 'day', date, earliest: date, latest: date };
    }
    function windowRelation(range, asOf) {
        const through = dates.horizonEnd(asOf);
        if (range.state !== 'known') return 'unknown';
        if (range.latest < asOf) return 'before';
        if (range.earliest > through) return 'after';
        if (range.earliest >= asOf && range.latest <= through) return 'inside';
        return 'overlaps_boundary';
    }
    function assessCalendarPreparation(job, asOf) {
        const through = dates.horizonEnd(asOf);
        if (!job || job.recordType !== 'plan' || !['reference','tentative','confirmed'].includes(job.certainty)) {
            throw new Error('予定と確定区分を明示してください。実績はこの関数で判定しません');
        }
        if (job.completedOn != null || job.completionReflected != null) throw new Error('完了実績は日付範囲の予定に混入できません');
        const inputs = {}, missing = [];
        for (const [key,label] of [['needed','必要時期'],['rollReady','ロール整備完了予定'],['donorReleased','チョック利用可能時期']]) {
            inputs[key] = parseCalendarParts(job[key]);
            if (inputs[key].state !== 'known') missing.push(label + '：' + inputs[key].reason);
        }
        if (job.assemblyNotBefore != null) {
            inputs.assemblyNotBefore = parseCalendarParts(job.assemblyNotBefore);
            if (inputs.assemblyNotBefore.state !== 'known') missing.push('組替着手可能時期：' + inputs.assemblyNotBefore.reason);
        }
        const daysKnown = v => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
        if (!daysKnown(job.assemblyDays)) missing.push('組替所要日数');
        if (!daysKnown(job.bufferDays)) missing.push('準備余裕日数');
        if (job.durationBasis !== 'calendar_days') missing.push('暦日で確認された所要日数（稼働日計算は未対応）');
        const result = { asOf, through, scope:'calendar-timing-only', certainty:job.certainty, inputs,
            windowRelations:Object.fromEntries(Object.entries(inputs).map(([k,v])=>[k,windowRelation(v,asOf)])),
            state:'unknown', missing, readyRange:null, startDeadlineRange:null, preparationDueRange:null,
            timingIssues:[], readinessAssessed:false };
        const need = inputs.needed;
        const prerequisites = Object.entries(inputs).filter(([key])=>key!=='needed');
        if (need.state === 'known') {
            for (const [key,r] of prerequisites) {
                if (r.state === 'known' && r.earliest > need.latest) result.timingIssues.push({field:key,
                    earliestAvailable:r.earliest, latestNeeded:need.latest, reason:'最も早い利用可能日でも必要時期の末日を過ぎます'});
            }
        }
        const calendarDays = job.durationBasis === 'calendar_days';
        if (need.state === 'known' && daysKnown(job.assemblyDays) && daysKnown(job.bufferDays) && calendarDays) {
            result.preparationDueRange = { earliest:dates.addDays(need.earliest,-job.bufferDays), latest:dates.addDays(need.latest,-job.bufferDays) };
            result.startDeadlineRange = { earliest:dates.addDays(need.earliest,-job.bufferDays-job.assemblyDays), latest:dates.addDays(need.latest,-job.bufferDays-job.assemblyDays) };
        }
        if (prerequisites.every(([,r])=>r.state==='known') && daysKnown(job.assemblyDays) && calendarDays) {
            const earliest = [asOf,...prerequisites.map(([,r])=>r.earliest)].sort().at(-1);
            const latest = [asOf,...prerequisites.map(([,r])=>r.latest)].sort().at(-1);
            result.readyRange = { earliest:dates.addDays(earliest,job.assemblyDays), latest:dates.addDays(latest,job.assemblyDays) };
            if (need.state === 'known' && result.readyRange.earliest > need.latest) result.timingIssues.push({field:'readyRange',
                earliestAvailable:result.readyRange.earliest,latestNeeded:need.latest,reason:'最も早い組替完了でも必要時期に間に合いません'});
        }
        if (result.timingIssues.length) result.state = 'late_for_all_dates';
        else if (!missing.length) {
            result.state = result.readyRange.latest <= result.preparationDueRange.earliest ? 'within_supplied_ranges'
                : result.readyRange.latest <= need.earliest ? 'buffer_not_assured' : 'needs_date_confirmation';
        }
        return result;
    }
    return { parseCalendarParts, windowRelation, assessCalendarPreparation };
});
