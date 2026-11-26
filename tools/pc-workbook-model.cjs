'use strict';
// Anonymous PC workbook adapter. No Sheets/GAS, app mounting or write authorization.
// Requirements: R15/R24 (PC output), R10 (keep unresolved needs), R16/R17 (read-only).
function buildPcWorkbookModel(sheet) {
  if (!sheet || sheet.status !== 'preview' || sheet.writeAllowed !== false ||
      sheet.operationAuthorized !== false || !/^\d{4}-(0[1-9]|1[0-2])$/.test(sheet.period || '') ||
      typeof sheet.sourceRevision !== 'string' || !sheet.sourceRevision.trim() ||
      typeof sheet.previewRevision !== 'string' || !sheet.previewRevision.trim() ||
      sheet.sourceRevision === sheet.previewRevision ||
      !Array.isArray(sheet.rows) || !Array.isArray(sheet.issues) || !Array.isArray(sheet.evidence)) {
    throw new Error('Read-only monthly preview and distinct revision IDs required');
  }
  const [year,month] = sheet.period.split('-').map(Number);
  const count = new Date(Date.UTC(year,month,0)).getUTCDate();
  if (sheet.rows.length !== count || sheet.rows.some((r,i) => r.date !== sheet.period+'-'+String(i+1).padStart(2,'0') || r.day !== i+1))
    throw new Error('Calendar dates incomplete, duplicated or out of order');
  const copy = x => JSON.parse(JSON.stringify(x));
  const lines = ps => ps.map(p => p.text + (p.reviewRequired ? '（要照合）' : '')).join('\n');
  const rows = [], manual = [], details = [];
  for (const r of sheet.rows) {
    const values = [r.day,r.weekday,r.size || '未確認'];
    const red = [], operating = [];
    for (const key of ['A','B','day']) {
      const t = r.teams?.[key];
      if (!t || !Array.isArray(t.manual) || !Array.isArray(t.proposals))
        throw new Error('Missing logical team cell: '+r.date+' '+key);
      if (t.proposals.some(p => p.operationAuthorized !== false || !['roll-red','normal'].includes(p.style)))
        throw new Error('Invalid proposal permission or work style');
      const index = values.length;
      values.push(t.rest === true ? '×' : (t.shift || ''),
        lines(t.proposals.filter(p=>p.style==='roll-red')),
        lines(t.proposals.filter(p=>p.style==='normal')),
        t.manual.length ? '手入力あり・別紙確認' : '');
      if (t.proposals.some(p=>p.style==='roll-red')) red.push(index+1);
      if (key !== 'day' && r.sourceState === 'read' && t.operating === true) operating.push(index,index+1,index+2,index+3);
      for (const m of t.manual) manual.push({date:r.date,team:key,...copy(m)});
      for (const p of t.proposals) details.push({date:r.date,team:key,...copy(p)});
    }
    // Blade marks/SD345 are absent from #70. Never infer them from size/date.
    values.push('未確認',r.sourceState==='read'?'読取済':'要確認');
    rows.push({date:r.date,values,red,operating});
  }
  return {kind:'anonymous-pc-workbook-model',period:sheet.period,
    sourceRevision:sheet.sourceRevision,previewRevision:sheet.previewRevision,
    complete:false,writeAllowed:false,operationAuthorized:false,
    sourcePreviewComplete:sheet.complete===true,
    headers:['日','曜','サイズ','A班 勤','A班 ロール替','A班 カリバ替','A班 手入力','B班 勤','B班 ロール替','B班 カリバ替','B班 手入力','常昼','常昼 ロール替','常昼 カリバ替','常昼 手入力','刃替','日程読取'],
    rows,manual,details,evidence:copy(sheet.evidence),issues:copy(sheet.issues),
    limitations:['匿名試作の論理列。原表への物理列対応・書込は未承認','ロール替とカリバ替を暫定別列に分離。原紙の同一セル部分赤字は未対応','刃替・SD345は入力根拠未接続。予定を自動確定しない','原紙印刷・罫線・日付行位置の完全再現は未確認']};
}
module.exports={buildPcWorkbookModel};
if(require.main===module){
  if(process.argv[2]!=='--anonymous-only')throw new Error('Explicit --anonymous-only flag required');
  const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
  const ctx=vm.createContext({});
  for(const file of ['planning-sheet-output.js','operating-plan.js'])
    vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js',file),'utf8'),ctx);
  const input=JSON.parse(fs.readFileSync(0,'utf8'));
  const preview=ctx.previewImportedMonthlyExchangeSheet(input);
  if(preview.writeAllowed!==false || preview.operationAuthorized!==false)throw new Error('Unsafe preview');
  const model = buildPcWorkbookModel(preview.sheet);
  if (Object.prototype.hasOwnProperty.call(input,'bladeRecords')) model.bladeRecords = input.bladeRecords;
  process.stdout.write(JSON.stringify(model,null,2)+'\n');
}
