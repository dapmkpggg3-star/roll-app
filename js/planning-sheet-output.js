(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.RollPlanningSheetOutput = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

    function dateParts(value) {
        if (typeof value !== 'string') return null;
        const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) return null;
        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        const date = new Date(Date.UTC(year, month - 1, day));
        if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
        return { year, month, day, date };
    }

    function productionAmountState(amount) {
        if (typeof amount === 'number' && Number.isFinite(amount) && amount >= 0) return amount > 0 ? 'positive' : 'zero';
        return 'unknown';
    }

    function laterAmountUnconfirmed(schedule, period) {
        if (!period || !Number.isInteger(period.year) || !Number.isInteger(period.month)) return true;
        return (Array.isArray(schedule) ? schedule : []).some(row => {
            const parts = dateParts(row && row.date);
            // An unparseable date cannot establish that unknown production belongs to a safe month.
            if (!parts && productionAmountState(row && row.productionAmount) === 'unknown') return true;
            const raw = row && row.date;
            // Malformed future-month rows must not conceal unknown production.
            const prefix = typeof raw === 'string' ? raw.match(/^(\d{4})-(\d{1,2})-/) : null;
            const year = parts ? parts.year : prefix ? Number(prefix[1]) : null;
            const month = parts ? parts.month : prefix ? Number(prefix[2]) : null;
            const later = year !== null && (year > period.year || (year === period.year && month > period.month));
            return later && (!parts || productionAmountState(row && row.productionAmount) === 'unknown');
        });
    }

    function latestPeriod(schedule) {
        const rows = (Array.isArray(schedule) ? schedule : [])
            .map(row => ({ row, parts: dateParts(row && row.date) }))
            .filter(item => item.parts)
            .sort((left, right) => left.parts.date - right.parts.date);
        let lastPositive = null;
        let unknownLaterMonth = false;
        rows.forEach(item => {
            const state = productionAmountState(item.row.productionAmount);
            if (state === 'unknown') {
                if (lastPositive && (item.parts.year !== lastPositive.year || item.parts.month !== lastPositive.month)) {
                    unknownLaterMonth = true;
                }
                return;
            }
            if (state === 'positive' && displaySize(item.row.size) !== '休止') {
                lastPositive = item.parts;
                unknownLaterMonth = false;
            }
        });
        if (!lastPositive || unknownLaterMonth) return null;
        return { year: lastPositive.year, month: lastPositive.month };
    }

    function samePeriod(value, period) {
        const parts = dateParts(value);
        return Boolean(parts && period && parts.year === period.year && parts.month === period.month);
    }

    function normalizeTeam(value) {
        if (typeof value !== 'string') return '';
        const token = value.normalize('NFKC').trim().toUpperCase();
        return token === 'A' || token === 'B' ? token : '';
    }

    function shiftForTeam(row, team) {
        const requested = normalizeTeam(team);
        if (!requested) return '';
        if (normalizeTeam(row && row.shift1Team) === requested) return 'Ⅰ';
        if (normalizeTeam(row && row.shift3Team) === requested) return 'Ⅲ';
        return '';
    }

    function displaySize(value) {
        if (typeof value !== 'string') return '';
        const token = String(value || '').normalize('NFKC').trim().toUpperCase();
        if (token === 'STOP' || token === '休止' || token === '休み') return '休止';
        return /^D\d+$/.test(token) ? token : '';
    }

    function invalidPeriodReason(period) {
        if (!period || !Number.isInteger(period.year) || !Number.isInteger(period.month)) return '出力する年月の指定が不正です。';
        if (period.month < 1 || period.month > 12) return '出力する年月の指定が不正です。';
        return '';
    }

    function claimsPeriod(raw, period) {
        const text = String(raw || '').normalize('NFKC');
        if (text.startsWith(`${period.year}-${String(period.month).padStart(2, '0')}`)) return true;
        const match = text.match(/^(\d{4})(?:[-/._:\s]|年)\s*(\d{1,2})(?=[-/._:\s]|月|$)/);
        return Boolean(match && Number(match[1]) === period.year && Number(match[2]) === period.month);
    }

    function outputMonthReason(schedule, period) {
        const rows = (Array.isArray(schedule) ? schedule : []).filter(row => claimsPeriod(row && row.date, period));
        const seen = new Set();
        const days = [];
        for (const row of rows) {
            const parts = dateParts(row && row.date);
            if (!parts || parts.year !== period.year || parts.month !== period.month) {
                return '出力対象月の日付を確認できない行があるので、出力する年月を確定できません。';
            }
            if (seen.has(parts.day)) return '同じ日付が重なっているので、出力する年月を確定できません。';
            seen.add(parts.day);
            days.push(parts.day);
            if (productionAmountState(row.productionAmount) === 'unknown') {
                return '出力対象月の生産量が未確認なので、出力する年月を確定できません。';
            }
            if (!displaySize(row.size)) return '出力対象月のサイズが未確認なので、出力する年月を確定できません。';
            if (!normalizeTeam(row.shift1Team) && !normalizeTeam(row.shift3Team)) {
                return '出力対象月の班が未確認なので、出力する年月を確定できません。';
            }
        }
        days.sort((left, right) => left - right);
        for (let index = 1; index < days.length; index += 1) {
            if (days[index] !== days[index - 1] + 1) {
                return '出力対象月の日付行が抜けているので、出力する年月を確定できません。';
            }
        }
        return '';
    }

    function buildCalendarRows(schedule, period) {
        return (Array.isArray(schedule) ? schedule : [])
            .filter(row => samePeriod(row && row.date, period))
            .map(row => {
                const parts = dateParts(row.date);
                return {
                    date: row.date,
                    day: parts.day,
                    weekday: WEEKDAYS[parts.date.getUTCDay()],
                    size: displaySize(row.size),
                    operationAShift: shiftForTeam(row, 'A'),
                    operationBShift: shiftForTeam(row, 'B')
                };
            })
            .sort((left, right) => left.day - right.day);
    }

    // Work-column mapping is not approved. Never emit an E/H/K proposal.
    function buildSizeChangeSuggestions() {
        return [];
    }

    function requestId(now, random) {
        const timestamp = Number.isFinite(now) ? now : Date.now();
        const suffix = Math.floor((Number.isFinite(random) ? random : Math.random()) * 0xFFFFFF)
            .toString(16).padStart(6, '0');
        return `planning-${timestamp}-${suffix}`;
    }

    function buildExportPayload(parsed, options) {
        const schedule = Array.isArray(parsed && parsed.schedule) ? parsed.schedule : [];
        const period = options && options.period ? options.period : latestPeriod(schedule);
        if (!period) throw new Error('出力する生産予定の年月を確認できませんでした。');
        const invalidPeriod = invalidPeriodReason(period);
        if (invalidPeriod) throw new Error(invalidPeriod);
        if (laterAmountUnconfirmed(schedule, period)) {
            throw new Error('後の月の生産量が未確認なので、出力する年月を確定できません。');
        }
        const monthReason = outputMonthReason(schedule, period);
        if (monthReason) throw new Error(monthReason);
        const planning = parsed && parsed.planning ? parsed.planning : {};
        const calendarRows = buildCalendarRows(schedule, period);
        if (!calendarRows.length) throw new Error('出力対象月の生産予定がありません。');
        const generatedAt = planning.generatedAt || new Date().toISOString();
        return {
            requestId: requestId(options && options.now, options && options.random),
            year: period.year,
            month: period.month,
            sheetName: `${period.year}.${period.month} ロールカリバ替予定`,
            generatedAt,
            sourceSheets: Array.isArray(parsed.importedSheets) ? parsed.importedSheets.slice(0, 24) : [],
            calendarRows,
            // Column mapping for work suggestions is not verified: E/H contain team data.
            // Fail closed at the payload boundary until an approved cell contract exists.
            suggestions: [],
            capabilities: {
                sizeChangeConnected: true,
                caliberConnected: Boolean(planning.caliberConnected)
            }
        };
    }


    // Read-only logical monthly sheet. No physical column mapping and no export.
    // Manual notes stay separate from generated proposals; no row is overwritten.
    function buildMonthlyExchangePreview(input) {
        const s=input||{}, period=s.period;
        const result={status:'preview',complete:false,operationAuthorized:false,writeAllowed:false,rows:[],issues:[],evidence:[]};
        const issue=(kind,reason,extra={})=>result.issues.push({kind,reason,...extra});
        const nonblank=v=>typeof v==='string'&&v.trim().length>0;
        const periodError=invalidPeriodReason(period);
        if(periodError||!nonblank(s.sourceRevision)||!nonblank(s.previewRevision)||s.sourceRevision===s.previewRevision){
            issue('source','対象月・原版・別のプレビュー版IDが未確認');return result;
        }
        const ym=String(period.year).padStart(4,'0')+'-'+String(period.month).padStart(2,'0');
        result.period=ym;result.sourceRevision=s.sourceRevision;result.previewRevision=s.previewRevision;
        const schedule=Array.isArray(s.schedule)?s.schedule:[], dates=new Map();
        for(const row of schedule){
            if(!claimsPeriod(row?.date,period))continue;
            if(!samePeriod(row.date,period)){issue('source','不正な日付行',{date:row.date});continue;}
            if(!dates.has(row.date))dates.set(row.date,[]);
            dates.get(row.date).push(row);
        }
        const days=new Date(Date.UTC(period.year,period.month,0)).getUTCDate(), byDate=new Map();
        for(let day=1;day<=days;day++){
            const date=ym+'-'+String(day).padStart(2,'0'), matches=dates.get(date)||[];
            const source=matches.length===1?matches[0]:null, parsed=source?buildCalendarRows([source],period)[0]:null;
            const row={date,day,productionState:source?productionAmountState(source.productionAmount):'unknown',weekday:WEEKDAYS[dateParts(date).date.getUTCDay()],size:parsed?.size||null,sourceState:'unconfirmed',teams:{A:{shift:null,operating:null,manual:[],proposals:[]},B:{shift:null,operating:null,manual:[],proposals:[]},day:{shift:'常昼',operating:null,manual:[],proposals:[]}}};
            if(source){
                const a=normalizeTeam(source.shift1Team),b=normalizeTeam(source.shift3Team);
                const raw=[source.shift1Team,source.shift3Team];
                const invalid=raw.some(x=>x!=null&&String(x).trim()&&!normalizeTeam(x))||(a&&a===b);
                const state=productionAmountState(source.productionAmount);
                if(parsed.size&&state!=='unknown'&&!invalid&&!(parsed.size==='休止'&&state==='positive')){
                    row.sourceState='read';
                    for(const k of ['A','B']){
                        const team=row.teams[k],shift=shiftForTeam(source,k),value=source.productionByTeam?.[k];
                        team.shift=shift||null;
                        // No assignment is not evidence of a holiday. Only explicit roster evidence marks ×.
                        team.operating=shift&&productionAmountState(value)!=='unknown'?value>0:null;
                        if(source.teamRest?.[k]===true&&nonblank(source.teamRestBasis)&&!shift&&value===0)team.rest=true;
                    }
                }
            }
            if(row.sourceState!=='read')issue('source',matches.length>1?'日付重複':'日別予定未確認',{date});
            result.rows.push(row);byDate.set(date,row);
        }
        const teamKey=t=>t==='常昼'?'day':/^[ⅠⅢ]勤[AB]$/.test(t||'')?t.slice(-1):null;
        const manual=Array.isArray(s.manualEntries)?s.manualEntries:[], manualIds=new Map();
        for(const e of manual)manualIds.set(e?.id,(manualIds.get(e?.id)||0)+1);
        for(const e of manual){
            const k=teamKey(e?.team),row=byDate.get(e?.date);
            if(!row||!k||!nonblank(e.id)||manualIds.get(e.id)!==1||!nonblank(e.text)){
                issue('manual','手入力の所属またはID未確認。元記録を保持',{entry:e});continue;
            }
            row.teams[k].manual.push({id:e.id,text:e.text,team:e.team});
            if(k!=='day'&&row.teams[k].shift!==e.team[0])issue('manual','手入力と班割の照合が必要',{date:e.date,id:e.id});
        }
        const p=s.plan;
        if(!p||p.status!=='usage-linked-first-exchange-preview'||p.operationAuthorized!==false||!Array.isArray(p.allocations)||!Array.isArray(p.forecasts)||!Array.isArray(p.unresolved)||!Array.isArray(p.unresolvedUsage)||!Array.isArray(p.warnings)){
            issue('plan','交換予測の接続未確認');
            if(p?.status==='source-unresolved'){for(const w of p.warnings||[])issue('planning-warning',w.reason||'要確認',{label:w.kind});for(const u of p.unresolvedUsage||[])issue('usage-unresolved',u.reason,{id:u.id,stands:u.stands,requiredExchange:u.requiredExchange});}
            return result;
        }
        for(const w of p.warnings)issue('planning-warning',w?.reason||'要確認',{id:w?.id??null,label:w?.kind??null});
        for(const u of p.unresolved)issue('exchange-unresolved',u.reason,{id:u.id,stands:u.stands,latestDate:u.latestDate});
        for(const u of p.unresolvedUsage)issue('usage-unresolved',u.reason,{id:u.id,stands:u.stands,requiredExchange:u.requiredExchange});
        const counts=new Map();for(const a of p.allocations)counts.set(a?.id,(counts.get(a?.id)||0)+1);
        for(const a of p.allocations){
            const k=teamKey(a?.team),row=byDate.get(a?.date),fs=p.forecasts.filter(f=>f?.id===a?.id&&f.status==='required'&&f.demand);
            const validStand=Array.isArray(a?.stands)&&a.stands.length>0&&a.stands.every(n=>/^(?:[2-9]|1[0-7])$/.test(String(n)))&&new Set(a.stands.map(String)).size===a.stands.length;
            const valid=nonblank(a?.id)&&counts.get(a.id)===1&&fs.length===1&&row?.sourceState==='read'&&row.productionState==='zero'&&k&&validStand&&['rollChange','caliberChange'].includes(a.workType)&&a.status==='proposal'&&a.operationAuthorized===false&&Number.isInteger(a.startMinute)&&Number.isInteger(a.endMinute)&&a.startMinute>=0&&a.endMinute<=1440&&a.endMinute>a.startMinute&&a.minutes===a.endMinute-a.startMinute&&nonblank(a.slotBasis)&&nonblank(a.deadlineBasis);
            if(!valid){issue('allocation','候補の元日程・根拠・対象未確認。候補を別欄に保持',{entry:a});continue;}
            const f=fs[0],d=f.demand;
            if(a.workType!==d.workType||!Array.isArray(d.stands)||a.stands.map(String).sort().join(',')!==d.stands.map(String).sort().join(',')||a.date<d.earliestDate||a.date>d.latestDate||(a.date===d.latestDate&&a.endMinute>d.latestMinute)||a.deadlineBasis!==d.deadlineBasis||
                (k!=='day'&&(row.teams[k].shift!==a.team[0]||row.teams[k].rest===true))){
                issue('allocation','交換期限・対象または勤務班不一致',{entry:a});continue;
            }
            const overlaps=p.allocations.some(b=>b!==a&&b?.date===a.date&&Number.isInteger(b.startMinute)&&Number.isInteger(b.endMinute)&&a.startMinute<b.endMinute&&b.startMinute<a.endMinute);
            if(overlaps){issue('allocation','作業時間の重複',{entry:a});continue;}
            const label='#'+a.stands.join('・')+' '+(a.workType==='rollChange'?'ロール替':'カリバ替');
            const cell=row.teams[k];
            cell.proposals.push({id:a.id,text:label,style:a.workType==='rollChange'?'roll-red':'normal',minutes:a.minutes,startMinute:a.startMinute,endMinute:a.endMinute,reviewRequired:cell.manual.length>0,operationAuthorized:false});
            if(cell.manual.length)issue('manual-conflict','手入力あり。自動上書きせず候補を併記',{date:a.date,id:a.id});
            result.evidence.push({id:a.id,date:a.date,team:a.team,deadlineDate:d.latestDate,deadlineMinute:d.latestMinute,deadlineBasis:a.deadlineBasis,slotBasis:a.slotBasis,triggers:Array.isArray(f.triggers)?f.triggers:[],reason:f.reason});
        }
        for(const f of p.forecasts)if(f?.status==='required'&&!result.evidence.some(e=>e.id===f.id)&&!p.unresolved.some(u=>u.id===f.id))issue('exchange-unresolved','必要交換の割当または未解決記録が不足',{id:f.id,stands:f.stands});
        result.complete=p.complete===true&&result.issues.length===0;
        return result;
    }


    // HTML preview only. All text is escaped, including source and manual notes.
    function renderMonthlyExchangePreviewHtml(preview){
        const p=preview||{}, esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
        const cell=t=>{
            if(!t)return '<td>未確認</td>';
            const manual=(Array.isArray(t.manual)?t.manual:[]).map(e=>'<span class="manual">手入力：'+esc(e.text)+'</span>');
            const proposals=(Array.isArray(t.proposals)?t.proposals:[]).map(e=>'<span class="'+(e.style==='roll-red'?'roll-red':'normal')+'">'+esc(e.text)+(e.reviewRequired?'（要照合）':'')+'</span>');
            return '<td'+(t.operating===true?' class="operating"':'')+'><span class="shift">'+esc(t.rest===true?'×':t.shift||'')+'</span>'+manual.concat(proposals).join('')+'</td>';
        };
        const rows=(Array.isArray(p.rows)?p.rows:[]).map(r=>'<tr><td>'+esc(r.day)+' '+esc(r.weekday)+'</td><td>'+esc(r.size||'未確認')+(r.sourceState!=='read'?'（要確認）':'')+'</td>'+cell(r.teams?.A)+cell(r.teams?.B)+cell(r.teams?.day)+'</tr>').join('');
        const issues=(Array.isArray(p.issues)?p.issues:[]).map(i=>'<li>'+esc([i.date,i.id,i.reason].filter(Boolean).join(' / '))+'</li>').join('');
        const evidence=(Array.isArray(p.evidence)?p.evidence:[]).map(e=>'<li>'+esc(e.id)+'：'+esc(e.date)+' '+esc(e.team)+'／期限 '+esc(e.deadlineDate)+'／'+esc(e.deadlineBasis)+'／'+esc(e.slotBasis)+'</li>').join('');
        return '<section class="monthly-exchange-preview"><style>.monthly-exchange-preview table{border-collapse:collapse;width:100%;table-layout:fixed}.monthly-exchange-preview th,.monthly-exchange-preview td{border:1px solid #aaa;text-align:center;vertical-align:middle;padding:4px}.monthly-exchange-preview tbody tr{height:54px}.monthly-exchange-preview .operating{background:#e4edf5}.monthly-exchange-preview .roll-red{color:#b91c1c}.monthly-exchange-preview .manual,.monthly-exchange-preview .shift,.monthly-exchange-preview .roll-red,.monthly-exchange-preview .normal{display:block;white-space:pre-wrap;overflow-wrap:anywhere}</style><h3>'+esc(p.period)+' ロール・カリバ替予定（確認用）</h3><p>原版 '+esc(p.sourceRevision)+' ／ プレビュー '+esc(p.previewRevision)+' ／ 書き込みなし・作業許可ではありません</p><table><thead><tr><th>日付</th><th>サイズ</th><th>A班</th><th>B班</th><th>常昼</th></tr></thead><tbody>'+rows+'</tbody></table><h4>未解決・要確認</h4><ul>'+issues+'</ul><h4>交換根拠</h4><ul>'+evidence+'</ul></section>';
    }

    return {
        renderMonthlyExchangePreviewHtml,
        buildMonthlyExchangePreview,
        dateParts,
        latestPeriod,
        laterAmountUnconfirmed,
        displaySize,
        buildCalendarRows,
        buildSizeChangeSuggestions,
        buildExportPayload
    };
});

