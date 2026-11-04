const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function harness() {
    const context = vm.createContext({});
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/save-replay-diagnostic.js'), 'utf8'), context);
    return context.RollSaveReplayDiagnostic;
}
const config = { validationSaveReplay: true, workshopCompletion: 'validation' };
const payload = JSON.stringify({action:'save', requestId:'roles-fixture', expectedRevision:'before', roles:[{id:70}]});
function input(overrides={}) {
    return { config, payload, selected:()=>true, consume(){}, session:{assertCurrent(){}},
        send:async()=>({json:async()=>({success:true,result:{requestId:'roles-fixture',state:'complete'}})}), ...overrides };
}
test('replay remains off without explicit validation config and checkbox', async()=>{
    const d=harness(); let calls=0;
    for (const cfg of [{}, {validationSaveReplay:true}, {workshopCompletion:'validation'}]) {
        assert.equal(await d.run(input({config:cfg,send:()=>calls++})), 'skipped');
    }
    assert.equal(await d.run(input({selected:()=>false,send:()=>calls++})), 'skipped');
    assert.equal(calls,0);
});
test('replay sends byte-identical pre-auth payload once and consumes selection', async()=>{
    const d=harness(); let selected=true,calls=0;
    const i=input({selected:()=>selected,consume:()=>selected=false,send:async body=>{
        calls++; assert.equal(body,payload); return {json:async()=>({success:true,result:{requestId:'roles-fixture',state:'complete'}})};
    }});
    assert.equal(await d.run(i),'complete'); assert.equal(await d.run(i),'skipped'); assert.equal(calls,1);
});
test('replay accepts only matching revision rejection and never labels partial writes complete',async()=>{
    const d=harness(); const result={requestId:'roles-fixture',state:'error',rolesSaved:false,error:'取得後にスプレッドシートが更新されました。上書きせず停止しました。再度同期してください。'};
    const i=input({send:async()=>({json:async()=>({success:false,result})})});
    assert.equal(await d.run(i),'revision-rejected');
    result.rolesSaved=true; assert.equal(await d.run(i),'unknown');
    result.rolesSaved=false; result.requestId='different'; assert.equal(await d.run(i),'unknown');
});
test('replay rejects extra authentication fields and expired sessions before transmission',async()=>{
    const d=harness(); let calls=0;
    assert.equal(await d.run(input({payload:JSON.stringify({...JSON.parse(payload),authToken:'fixture'}),send:()=>calls++})),'invalid');
    await assert.rejects(d.run(input({session:{assertCurrent(){throw Error('expired');}},send:()=>calls++})),/expired/);
    assert.equal(calls,0);
});
