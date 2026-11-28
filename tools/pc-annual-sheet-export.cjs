'use strict';
// PC worksheet values, not a claim of successful physical printing.
const {previewPcStandYear}=require('./pc-stand-year-matrix.cjs');
function buildPcAnnualSheets(s={}){
 const r=previewPcStandYear(s);
 const rows=[['年間ロール計画（未確定・検証用）'],['年度',s.fiscalYear??null,'空欄は未確認を含む。発注期限は会計月ではない。'],['st','区分',...r.months]];
 const count=(a,b)=>[a===null?'':'実'+a,b===null?'':'予'+b].filter(Boolean).join(' / ')||null;
 for(const st of r.rows){
  rows.push(['#'+st.stand,'改削搬入',...st.months.map(m=>count(m.actualRework,m.forecastRework))]);
  rows.push(['#'+st.stand,'新品払出',...st.months.map(m=>count(m.actualIssue,m.forecastIssue))]);
  rows.push(['#'+st.stand,'後継発注期限',...st.months.map(m=>m.latestOrderGuidance===null?null:'予'+m.latestOrderGuidance)]);
 }
 const detail=[['根拠キー','st','個体','世代','回次','区分','実績/予測','日付','計上・期限月','搬出日','予測径mm','発注最終期限','搬入最終期限','出典・理由','年度内','集計扱い']];
 for(const d of r.detail){
  if(d.kind){
   const ev=d.evidence?.length?d.evidence:[{}];
   let counted=false;
   for(const e of ev){const selected=!counted&&(e.status??d.status)===d.status&&(e.date??d.date)===d.date;if(selected)counted=true;detail.push([d.key,d.stand,d.rollId,e.generation??null,d.cycleId,d.kind,e.status??d.status,e.date??d.date,(e.date??d.date).slice(0,7),e.dispatchDate??null,e.forecastDiameterMm??null,null,null,e.basis??d.basis?.join(' / '),d.inFiscalYear?'対象':'年度外',selected?'集計採用':'参照履歴']);}
  }else detail.push([d.key,d.stand,d.oldIdentity,null,null,'後継発注期限','forecast',d.latestOrderBy,d.month,null,null,d.latestOrderBy,d.latestArrivalBy,[d.leadBasis,d.reason].filter(Boolean).join(' / '),d.inFiscalYear?'対象':'年度外','発注期限目安']);
 }
 const checks=[['st','出典','要確認理由'],...r.held.map(h=>[h.stand??null,h.source??null,h.reason??'未確認']),...(r.pending||[]).map(h=>[h.stand??null,h.source??null,h.reason??'初回使用未確定'])];
 checks.push([null,null,'全スタンドの予測成立・実績原表・正式承認は別途確認']);
 const costs=[['st','改削単価（手入力）','購入単価（手入力）','備考'],...r.rows.map(st=>['#'+st.stand,null,null,null])];
 return {sheets:[{name:'年間計画',values:rows,print:{...r.print,range:'A1:N'+rows.length}},{name:'根拠明細',values:detail},{name:'要確認',values:checks},{name:'費用入力（印刷対象外）',values:costs}],complete:false,writeAllowed:false,operationAuthorized:false};
}
module.exports={buildPcAnnualSheets};
