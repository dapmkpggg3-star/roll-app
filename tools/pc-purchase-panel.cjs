'use strict';
// Standalone read-only PC preview; no writes, network calls, notifications or actual purchase actions.
const {previewPcPurchaseWarnings}=require('./pc-purchase-warning.cjs');
const esc=x=>String(x??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const display=x=>esc(x??'未確認');
function level(r){
 if(r.warnings.some(w=>/期限超過|確定納期遅延|期限当日|確定納期超過/.test(w)))return 0;
 if(r.warnings.some(w=>/未確認|未回答|競合|遅延見込|発注注意/.test(w)))return 1;
 if(r.warnings.some(w=>/購入準備|発注準備確認/.test(w)))return 2;
 return 3;
}
function buildPcPurchasePanel(input={}){
 const r=previewPcPurchaseWarnings(input);
 const rows=r.rows.slice().sort((a,b)=>level(a)-level(b)||(a.daysRemaining??Infinity)-(b.daysRemaining??Infinity)||Number(a.stand)-Number(b.stand));
 return {...r,rows,asOf:input.asOf??null,sourceRevision:input.sourceRevision??null,title:'ロール購入・納期管理（匿名確認用）'};
}
function renderPcPurchasePanel(input={}){
 const p=buildPcPurchasePanel(input);
 const counts=[0,0,0,0];for(const r of p.rows)counts[level(r)]++;
 const table=p.rows.map(r=>{
  let roll='未確認';try{roll=JSON.parse(r.oldIdentity)[1]??roll;}catch{}
  const status=r.warnings.length?r.warnings.join('／'):'追加警告なし';
  const remaining=r.daysRemaining===null?'未確認':r.daysRemaining<0?Math.abs(r.daysRemaining)+'日超過':r.daysRemaining+'日前';
  const dates=[r.confirmedDeliveryDate?'確定 '+r.confirmedDeliveryDate:null,r.estimatedDeliveryDate?'見込 '+r.estimatedDeliveryDate:null,r.actualArrivalDate?'実績 '+r.actualArrivalDate:null].filter(Boolean).join('／');
  return '<tr class="p'+level(r)+'"><td>#'+esc(r.stand)+'</td><td>'+esc(roll)+'</td><td>'+display(r.deadline)+'</td><td>'+esc(remaining)+'</td><td>'+display(r.requiredArrival)+'</td><td>'+esc(r.state)+'</td><td>'+display(r.orderDate)+'</td><td>'+display(dates||null)+'</td><td>'+esc(status)+'</td><td>'+esc(r.spareStatus)+'</td></tr><tr class="evidence"><td colspan="10"><details><summary>購入期限の根拠・購買照合</summary><p>'+r.evidence.map(e=>esc([e.reason,e.leadBasis,e.latestOrderBy,e.latestArrivalBy].filter(Boolean).join('／'))).join('<br>')+'</p><p>購買出典：'+display(r.basis)+'／照合日：'+display(r.checkedOn)+'</p><p>警告日数（未承認）：'+display(r.warningDays?.join('・'))+'</p></details></td></tr>';
 }).join('');
 const safety=p.held.filter(h=>h.forecastOnly===true&&(h.requiredExchange===true||h.requiredExchange===null||typeof h.oldReserveRetained==='boolean'||h.warnings?.length||h.assemblyDeadline||h.dispatchDeadline));
 const alertRows=safety.map(h=>'<tr><td>'+display(h.stand==null?null:'#'+h.stand)+'</td><td>'+esc(h.reason)+'</td><td>'+display(h.exchangeStatus)+'</td><td>'+display(h.spareStatus)+'</td><td>'+display(h.exchangeDate??h.date)+'</td><td>'+display(h.assemblyDeadline)+'</td><td>'+display(h.dispatchDeadline)+'</td><td>'+esc((h.warnings||[]).join('／'))+'</td></tr>').join('');
 const alerts='<h2>交換需要・工作期限・予備保持の警告</h2><p>循環予測の保留情報。実際の予備不足・現物状態は別途確認。旧予備のバラシや交換を許可するものではありません。</p><div class="scroll"><table><thead><tr>'+['st','理由','交換需要','予備保持','交換関連日','組替完了期限','搬出期限','詳細警告'].map(t=>'<th>'+t+'</th>').join('')+'</tr></thead><tbody>'+(alertRows||'<tr><td colspan="8">表示可能な警告根拠なし（安全確定ではありません）</td></tr>')+'</tbody></table></div>';
 const held=p.held.map(h=>'<li>'+esc(h.reason??'未確認')+(h.stand?'／#'+esc(h.stand):'')+(h.records?.length?'／未接続購買記録 '+h.records.length+'件':'')+'</li>').join('');
 return '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'"><title>'+esc(p.title)+'</title><style>body{font-family:system-ui,sans-serif;background:#f4f6f8;color:#202b36;margin:24px}h1{font-size:24px}h2{font-size:18px}.stats{display:flex;gap:12px;flex-wrap:wrap}.stats div{background:white;border:1px solid #ccd4dc;padding:12px;min-width:120px}.stats strong{display:block;font-size:24px}.scroll{overflow:auto}table{border-collapse:collapse;width:100%;background:white;font-size:14px}td,th{padding:10px;border:1px solid #d6dce2;text-align:left;vertical-align:top}th{background:#304e65;color:white;white-space:nowrap}.p0 td:first-child{border-left:5px solid #b91c1c}.p1 td:first-child{border-left:5px solid #b45309}.p2 td:first-child{border-left:5px solid #2563eb}.evidence td{background:#f6f8fa}summary{cursor:pointer}small{color:#465563}</style></head><body><h1>'+esc(p.title)+'</h1><p>基準日：'+display(p.asOf)+'　計画版：'+display(p.sourceRevision)+'</p><p><strong>検証専用・現場使用未承認</strong>　発注・通知は実行しません。予備の組込適合は別確認。購入費計上月は未確認。</p><section class="stats" aria-label="表示区分">'+['期限・遅延重要','照合・注意','準備','その他'].map((t,i)=>'<div>'+t+'<strong>'+counts[i]+'</strong></div>').join('')+'</section>'+alerts+'<h2>購入需要一覧（年度をまたぐものを含む）</h2><div class="scroll"><table><thead><tr>'+['st','後継対象の旧ロール','発注期限','期限まで','必要搬入','発注状況','発注実績日','納期・搬入','警告','予備状況'].map(t=>'<th>'+t+'</th>').join('')+'</tr></thead><tbody>'+(table||'<tr><td colspan="10">表示可能な需要なし（需要ゼロの確定ではありません）</td></tr>')+'</tbody></table></div><h2>要確認</h2><ul>'+(held||'<li>追加の保留記録なし（全体確認完了ではありません）</li>')+'</ul></body></html>';
}
module.exports={buildPcPurchasePanel,renderPcPurchasePanel};
if(require.main===module){
 const fs=require('node:fs'),[input,output]=process.argv.slice(2);
 if(!input||!output||!/\.html$/i.test(output))throw Error('Usage: node tools/pc-purchase-panel.cjs input.json new-output.html');
 fs.writeFileSync(output,renderPcPurchasePanel(JSON.parse(fs.readFileSync(input,'utf8'))),{flag:'wx'});
}
