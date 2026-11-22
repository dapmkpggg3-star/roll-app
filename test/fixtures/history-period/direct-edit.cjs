const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const startRow = 22;
function cycle(start, end) {
  const row = Array(17).fill('');
  for (const [offset, date] of [[11, start], [14, end]]) {
    if (date) row.splice(offset, 3, ...date.split('-'));
  }
  return row;
}
const april = cycle('2031-04-01','2031-04-09');
const march = cycle('2031-03-01','2031-03-09');
const open = cycle('2031-05-10','');
const reversed = cycle('2031-05-10','2031-05-01');
const corrected = cycle('2031-05-10','2031-05-12');

function edit(source, rows, index, appEnd = '', column = 15, appStart = '2031-05-10') {
  const name = '#16-901';
  const role = {id:1, name, isActiveThreeSet:true, status:'オンライン',useStartDate:appStart,useEndDate:appEnd};
  const saves = [];
  const sheet = {
    getName:()=> '16,17', getLastRow:()=>startRow+rows.length-1, getParent:()=>({toast(){}}),
    getRange(row, col, height, width) {
      const cells = rows.slice(row-startRow,row-startRow+height).map(line=>line.slice(col-1,col-1+width));
      return {getDisplayValues:()=>cells, getFontColors:()=>cells.map(line=>line.map(()=>'')),setFontColor(){}};
    }
  };
  const ctx = vm.createContext({});
  vm.runInContext(source,ctx);
  Object.assign(ctx,{
    getRollHistoryStatusDefinitions:()=>[{roleName:name,standNumber:16,startColumn:1,endColumn:17,headerRow:21,roleIdRow:startRow}],
    LockService:{getScriptLock:()=>({waitLock(){},hasLock:()=>true,releaseLock(){}})},
    SpreadsheetApp:{flush(){}}, Logger:{log(){}}, fetchRoles:()=>[role],
    updateChangedRolesRows:(roles,names)=>{assert.deepEqual(Array.from(names),[name]);saves.push(roles[0].useEndDate)},
    refreshRollManagementView(){},refreshFieldRollManagementView(){},
    updateRollHistoryIncompleteCycleWarning:()=>({missingFields:[]})
  });
  const range = {getSheet:()=>sheet,getRow:()=>startRow+index,getLastRow:()=>startRow+index,
    getColumn:()=>column,getLastColumn:()=>column};
  const result = ctx.handleRollHistoryActualEdit({range});
  return {reason:result.reason || '',handled:result.handled,saves};
}

const old = fs.readFileSync(process.argv[2],'utf8');
const fix = fs.readFileSync(process.argv[3],'utf8');
const held = {reason:'end-before-start',handled:true,saves:[]};
const ignored = {reason:'',handled:false,saves:[]};
const saved = date=>({reason:'',handled:true,saves:[date]});
const history = [march,april];
assert.deepEqual(edit(old,[...history,reversed],2),saved('2031-05-01'));
assert.deepEqual(edit(fix,[...history,reversed],2),held);
assert.deepEqual(edit(fix,[...history,corrected],2),saved('2031-05-12'));
assert.deepEqual(edit(fix,[...history,open],2,'2031-05-12'),saved(''));
assert.deepEqual(edit(fix,[...history,open],0),ignored);
assert.deepEqual(edit(fix,[...history,corrected],1),ignored);
assert.deepEqual(edit(fix,[march,reversed,open],2,'2031-05-12'),held);
assert.deepEqual(edit(fix,[...history,reversed],2,'',1),ignored);
assert.deepEqual(edit(fix,[...history,corrected],2,'',15,'2031-06-01'),held);
console.log('旧版の逆転転記を再現。修正候補の直接編集8条件に合格。');
