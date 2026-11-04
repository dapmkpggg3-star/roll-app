// Local visual QA only. Synthetic fixture records; no credentials, live endpoint,
// production data, or real authentication. Never copy this into deployed dist.
const fs = require('node:fs');
const path = require('node:path');
const { fixture } = require('../test/helpers/workshop-api-fixture.cjs');
const root = path.join(__dirname, '..');
const destination = process.argv[2];
if (!destination || !path.isAbsolute(destination) || destination === root) throw new Error('Specify a separate absolute preview directory.');
fs.mkdirSync(path.join(destination, '.openai'), { recursive: true });
fs.writeFileSync(path.join(destination, '.openai/hosting.json'), JSON.stringify({ static: { directory: 'dist' } }));
const dist = path.join(destination, 'dist');
fs.mkdirSync(dist, { recursive: true });
for (const file of ['css/styles.css', 'js/workshop-instructions.js', 'js/preparation-forecast.js', 'js/workshop-board.js', 'js/workshop-board-ui.js']) {
    fs.copyFileSync(path.join(root, file), path.join(dist, path.basename(file)));
}
const schedule = { workDate: '2026-10-25', nightProduction: 'operating', source: '画面試験の架空採用予定' };
const h = fixture(), issued = h.issue({ assemblySchedule: schedule });
const snapshot = instance => ({ ...instance.ok({ action: 'fetchworkshop' }), checkedAt: '2026-10-25T09:00:00Z' });
const fetch = () => snapshot(h);
const snapshots = { issued: fetch() };
h.state.stale = true;
if (h.post({ action: 'completeworkshop', request: issued.request }).success) throw new Error('Expected pending reflection.');
snapshots.pending = fetch();
h.state.stale = false;
snapshots.receipt = h.ok({ action: 'resumeworkshop', operationId: snapshots.pending.pendingOperations[0].id });
snapshots.completed = fetch();
snapshots.missing = structuredClone(snapshots.completed);
snapshots.missing.roles = snapshots.missing.roles.filter(role => role.id !== 'C');
for (const [key, changes] of [['late', { workDate: '2026-10-24' }], ['unknown', { nightProduction: 'unknown' }], ['unscheduled', { workDate: null, nightProduction: 'unknown' }], ['moved', { workDate: '2026-10-24' }]]) {
    const example = fixture(), task = example.issue({ ...(key === 'late' ? { readyBy: '2026-10-24' } : {}), assemblySchedule: { ...schedule, ...changes } });
    if (key !== 'unscheduled') example.ok({ action: 'completeworkshop', request: task.request });
    snapshots[key] = snapshot(example);
}
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const section = html.slice(html.indexOf('<section id="workshop-board"'), html.indexOf('</section>', html.indexOf('<section id="workshop-board"')) + 10);
const harness = `
const snapshots = ${JSON.stringify(snapshots)};
const reviewReason = '予備の使用可否と準備完了を工作と確認した。';
let scenario = 'issued', generation = 0, permission = 'editor';
let isSyncing = false, isSyncQueued = false, workshopBoardStandFilter = 'all';
const SHEETS_ENDPOINT = 'isolated-fixture';
globalThis.RollAuth = {currentUser: () => ({id:'fixture',role:permission})};
function isWorkshopCompletionEnabled(){return true;}
function captureSyncSession(){const start=generation;return {isCurrent:()=>start===generation,assertCurrent(){if(start!==generation)throw new Error('ログアウト済み');}};}
function setSyncButtonBusy(){}
function setSyncContentPhase(){}
function setSyncMessage(message){document.getElementById('qa-message').textContent=message;}
function showToast(message){setSyncMessage(message);}
async function readJsonResponse(response){return response;}
async function rollApiFetch(endpoint, options){
 if(endpoint!==SHEETS_ENDPOINT)throw new Error('Live access prohibited');
 if(scenario==='error')throw new Error('試験：通信に失敗しました。');
 const payload=JSON.parse(options.body);
 if(payload.action==='fetchworkshop')return {success:true,result:snapshots[scenario==='reader'?'pending':scenario]};
 if(payload.action==='reviewworkshopdeadline' && scenario==='late' && permission==='editor'){
  const request=payload.request, record=snapshots.late.instructions[0];
  const effects=['roles','rollHistory'].map(target=>({target,instructionId:record.id,instructionRevision:RollWorkshopInstructions.reflectionRevision(record),state:'verified'}));
  const result=RollWorkshopInstructions.apply(record,{instructionId:request.instructionId,requestId:request.requestId,expectedRevision:request.expectedRevision,kind:'review_deadline_impact',payload:{reason:request.reason}},
   {actor:{id:'fixture',role:'editor'},today:'2026-10-25',now:'2026-10-25T09:00:00Z',effectReceipts:effects});
  snapshots.late.instructions=[result.record];
  snapshots.late.tasks=[RollWorkshopInstructions.taskView(result.record,result.record,'2026-10-25',effects)];
  return {success:true,result};
 }
 if(payload.action==='resumeworkshop' && permission==='editor' && payload.operationId===snapshots.receipt.operationId){scenario='completed';return {success:true,result:snapshots.receipt};}
 throw new Error('Unsupported fixture request');
}
function changeWorkshopBoardStandFilter(event){workshopBoardStandFilter=event.target.value;renderFormalWorkshopBoard();}
function toggleWorkshopBoardSelectedOnly(){}
function closeWorkshopBoard(){setSyncMessage('画面試験です。実際のロール一覧には接続していません。');}
function printWorkshopBoard(){if(formalWorkshopState.phase==='ready')window.print();}
async function chooseScenario(value){
 scenario=value;permission=value==='reader'?'reader':'editor';
 if(value!=='error'){generation++;resetFormalWorkshopBoard();workshopBoardStandFilter='all';}
 document.getElementById('qa-message').textContent='';
 await refreshFormalWorkshopBoard();
}
document.getElementById('qa-scenario').addEventListener('change',event=>chooseScenario(event.target.value));
refreshFormalWorkshopBoard();
`;
fs.writeFileSync(path.join(dist, 'harness.js'), harness);
fs.writeFileSync(path.join(dist, 'board.html'), `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>工作ボード・隔離画面試験</title><link rel="stylesheet" href="styles.css"><style>body{padding:12px;background:#edf2f7}.qa-controls{padding:12px;background:#fff;border:2px solid #b45309;margin-bottom:16px}.qa-controls select{max-width:100%;padding:8px}#qa-message{color:#9a3412}@media print{.qa-controls{display:none}}</style><body class="workshop-board-mode"><div class="qa-controls"><strong>画面試験用・架空データ／実環境へは接続しません</strong><p><label>試験状態 <select id="qa-scenario"><option value="issued">未完了の正式指示</option><option value="pending">反映確認待ち</option><option value="completed">完了・反映確認済み</option><option value="late">準備期限を超えて完了・要確認</option><option value="unscheduled">作業日未定・指示済み</option><option value="moved">作業日変更・期限内完了</option><option value="unknown">夜勤未確認・組込済み</option><option value="missing">対象ロール情報不足</option><option value="error">通信失敗（前回表示を保持）</option><option value="reader">閲覧者・反映確認待ち</option></select></label></p><p id="qa-message" role="status"></p></div>${section}<script src="workshop-instructions.js"></script><script src="preparation-forecast.js"></script><script src="workshop-board.js"></script><script src="workshop-board-ui.js"></script><script src="harness.js"></script></body></html>`);
fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><html lang="ja"><meta charset="utf-8"><title>工作ボード画面試験</title><style>body{margin:12px;background:#cbd5e1;font-family:sans-serif}iframe{display:block;border:0;height:1500px;background:white;max-width:100%;margin:12px auto}button{padding:10px}</style><button onclick="document.querySelector(\'iframe\').style.width=\'100%\'">PC幅</button> <button onclick="document.querySelector(\'iframe\').style.width=\'390px\'">スマホ幅390px</button> <button onclick="document.querySelector(\'iframe\').style.width=\'768px\'">タブレット幅768px</button><iframe title="工作ボード試験" src="board.html" style="width:100%"></iframe></html>');
console.log(destination);
