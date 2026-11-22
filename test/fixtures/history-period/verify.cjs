const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const names = ['#16-901', '#16-902'];
function run(file) {
  const rows = names.map((name, i) => {
    const row = Array(17).fill('');
    row.splice(11, 6, '2031','05','10','2031','05', i ? '12' : '01');
    return [row];
  });
  const defs = names.map((roleName, i) => ({
    roleName, standNumber:16, startColumn:1 + i*17, endColumn:17 + i*17,
    roleIdRow:22,headerRow:21,bannerRow:20
  }));
  const sheet = {
    getName: () => '16,17', getLastRow: () => 22,
    getRange: (_, col) => ({getDisplayValues:()=>rows[(col-1)/17],getFontColors:()=>[]})
  };
  const before = names.map((name,i)=>({name,id:i+1,isActiveThreeSet:true,status:'オンライン',
    useStartDate:'2031-05-10',useEndDate:i?'2031-05-12':'2031-05-01'}));
  const after = before.map(role=>({...role,useEndDate:''}));
  const keyed = roles=>new Map(roles.map(role=>[role.name,role]));
  const ctx = vm.createContext({});
  vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
  let saved;
  Object.assign(ctx,{
    getRollHistoryStatusDefinitions:()=>defs,
    openRollManagementSpreadsheet_:()=>({getSheetByName:()=>sheet}),
    fetchRoles:()=>after,
    updateChangedRolesRows:(roles,names)=>{saved=Array.from(names)},
    refreshRollManagementView:()=>{},refreshFieldRollManagementView:()=>{},
    SpreadsheetApp:{flush(){}}
  });
  const clear = ctx.syncRollHistoryActualsFromRolesSheet(sheet,keyed(after),keyed(before),{dryRun:true});
  const bulk = ctx.syncRollHistoryActualsToRolesAll(['16,17']);
  return {cleared:Array.from(clear.written.filter(x=>x.field==='useEndDate' && x.value===''),x=>x.roleName),
    clearConflicts:Array.from(clear.conflicts,x=>x.roleName), saved,
    bulkConflicts:Array.from(bulk.conflicts || [],x=>x.roleName), success:bulk.success};
}
const original=run(process.argv[2]), candidate=run(process.argv[3]);
console.log({original,candidate});
assert.deepEqual(original.saved,names);
assert.deepEqual(original.cleared,names);
assert.deepEqual(candidate,{cleared:names.slice(1),clearConflicts:names.slice(0,1),saved:names.slice(1),
  bulkConflicts:names.slice(0,1),success:false});

require('./direct-edit.cjs');
