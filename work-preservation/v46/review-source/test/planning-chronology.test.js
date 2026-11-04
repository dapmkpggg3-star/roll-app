const test=require('node:test'), assert=require('node:assert/strict');
const {compareEventOrder:compare}=require('../js/planning-chronology');
const day=x=>({earliest:x,latest:x});
test('historical return cannot fulfill future dispatch',()=>assert.equal(compare(day('2030-12-01'),day('2030-06-15')).state,'conflict'));
test('month overlap is uncertain',()=>{const m={earliest:'2030-10-01',latest:'2030-10-31'};assert.equal(compare(m,m).state,'unknown');assert.equal(compare(m,day('2030-11-01')).state,'ordered');});
test('same-day dates only establish date-level order',()=>assert.equal(compare(day('2030-10-01'),day('2030-10-01')).state,'ordered'));
test('invalid ranges stay unknown',()=>{for(const x of [null,day('2030-02-30'),{earliest:'2030-10-31',latest:'2030-10-01'}])assert.equal(compare(x,day('2030-11-01')).state,'unknown');});
