'use strict';
// Legacy WorkHistory is registration history, not a confirmed cycle/measurement ledger.
function collectWorkHistoryCandidates({spreadsheetId,sheetName,readRange,header,rows,roles}) {
    const required=['履歴ID','ロールID','ロール名','イベント種別','日時','現在径','改削量','有効'];
    if (!spreadsheetId || !sheetName || !readRange || !Array.isArray(header) || !Array.isArray(rows) || !Array.isArray(roles))
        throw new Error('読取り元と行データが必要です');
    const indexes={};
    for(const key of required) {
        const matches=header.map((value,index)=>value===key?index:-1).filter(index=>index>=0);
        if(matches.length!==1) throw new Error('作業履歴の見出しが不足または重複しています：'+key);
        indexes[key]=matches[0];
    }
    const selected=new Map();
    for(const role of roles) {
        if(!role || typeof role.id!=='string' || !role.id || !role.name || selected.has(role.id))
            throw new Error('対象ロールのID対応を確認してください');
        selected.set(role.id,role.name);
    }
    const candidates=[],ignoredInactive=[];
    for(const row of rows) {
        if(!row || !Number.isSafeInteger(row.rowNumber) || row.rowNumber<2 || !Array.isArray(row.values))
            throw new Error('作業履歴の出典行が不正です');
        const get=key=>row.values[indexes[key]];
        const roleId=String(get('ロールID')??'');
        if(!selected.has(roleId)) continue;
        const source={spreadsheetId,sheetName,rowNumber:row.rowNumber};
        if(get('有効')===false || get('有効')==='FALSE') {ignoredInactive.push(source);continue;}
        const issues=['実サイクルID未確認','実際の加工完了日未確認','測定日未確認',
            '通常改削・フラット加工の区分未確認','基準日までの履歴照合未確認'];
        if(get('ロール名')!==selected.get(roleId)) issues.push('ロールIDと名称の不一致');
        if(get('有効')!==true && get('有効')!=='TRUE') issues.push('履歴の有効性未確認');
        if(typeof get('履歴ID')!=='string' || !get('履歴ID').trim()) issues.push('履歴ID未確認');
        if(get('イベント種別')!=='改削') issues.push('改削以外のイベント');
        const number=value=>typeof value==='number' && Number.isFinite(value) && value>0?value:null;
        const diameter=number(get('現在径')),loss=number(get('改削量'));
        if(diameter===null) issues.push('数値型の記録径未確認');
        if(loss===null) issues.push('数値型の記録改削量未確認');
        candidates.push({recordKind:'unverified_history_candidate',eventId:get('履歴ID')||null,
            rollId:roleId,rollName:get('ロール名'),eventType:get('イベント種別'),
            recordedAt:get('日時')||null,completedOn:null,measuredOn:null,cycleId:null,
            recordedDiameterMm:diameter,recordedLossMm:loss,kind:'unknown',
            confirmed:false,canPromoteToForecast:false,source,issues});
    }
    for(const candidate of candidates) if(candidate.eventId && candidates.filter(c=>c.eventId===candidate.eventId).length>1)
        candidate.issues.push('履歴ID重複');
    return {scope:'bounded-legacy-history-read',readRange,candidates,ignoredInactive,
        fullHistoryVerified:false,readinessAssessed:false};
}
module.exports={collectWorkHistoryCandidates};
