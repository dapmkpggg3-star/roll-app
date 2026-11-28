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
 // Display labels are separate from raw identity and evidence. Do not invent missing life/usage values.
 const readable=[['明細番号','スタンド','対象ロール','工程','実績・予測','対象日','対象月','なぜこの月か','搬出予定日','改削後予測径（mm）','発注最終期限','搬入最終期限','確認状況','集計扱い']];
 const raw=[['明細番号',...detail[0]]],refs=new Map();
 for(const v of detail.slice(1)){
  if(!refs.has(v[0]))refs.set(v[0],'明細'+String(refs.size+1).padStart(3,'0'));
  const no=refs.get(v[0]),kind=v[5],status=v[6],actual=status==='actual',type=kind==='rework-inbound'?'改削搬入':kind==='first-use'?'新品払出':kind==='後継発注期限'?'後継発注期限':'工程未確認';
  let roll=v[2];
  if(kind==='後継発注期限'){try{roll=JSON.parse(v[2])[1];}catch{roll=null;}}
  const why=kind==='rework-inbound'?(actual?'改削後の搬入実績月に計上':v[9]?'搬出予定日から改削LTを加算した搬入予定月':'搬入予定月に計上'):kind==='first-use'?(actual?'新品の初回使用実績月に計上':'新品の初回使用予定月に計上'):kind==='後継発注期限'?'最終使用径の後継確保に必要な発注期限（購入費の会計月ではない）':'工程根拠未確認';
  readable.push([no,'#'+v[1],roll,type,actual?'実績':status==='forecast'?'予測':'未確認',v[7],v[8],why,v[9],v[10],v[11],v[12],kind==='後継発注期限'?'購入費計上月未確認':actual?'実績の出典照合が必要':'条件付き予測・寿命等の詳細根拠は別途確認',v[15]]);
  raw.push([no,...v]);
 }
 const cellLinks=r.rows.flatMap((st,i)=>st.months.flatMap((m,j)=>m.detailKeys.map(key=>({stand:st.stand,month:m.month,column:j+3,detailNo:refs.get(key),row:4+i*3+(r.detail.find(d=>d.key===key)?.kind==='first-use'?1:r.detail.find(d=>d.key===key)?.kind==='rework-inbound'?0:2)}))));
 const checks=[['st','出典','要確認理由'],...r.held.map(h=>[h.stand??null,h.source??null,h.reason??'未確認']),...(r.pending||[]).map(h=>[h.stand??null,h.source??null,h.reason??'初回使用未確定'])];
 checks.push([null,null,'全スタンドの予測成立・実績原表・正式承認は別途確認']);
 const costs=[['st','改削単価（手入力）','購入単価（手入力）','備考'],...r.rows.map(st=>['#'+st.stand,null,null,null])];
 return {sheets:[{name:'年間計画',values:rows,print:{...r.print,range:'A1:N'+rows.length}},{name:'根拠明細',values:readable},{name:'照合用原始情報',values:raw,hiddenByDefault:true},{name:'要確認',values:checks},{name:'費用入力（印刷対象外）',values:costs}],cellLinks,complete:false,writeAllowed:false,operationAuthorized:false};
}
module.exports={buildPcAnnualSheets};
