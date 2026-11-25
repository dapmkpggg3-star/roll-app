'use strict';
function selfTest(api){
 const white={red:1,green:1,blue:1}, red={red:1}, black={};
 const cell=(v,fg,bg=white)=>({formattedValue:String(v),effectiveFormat:{textFormat:{fontFamily:'sans',...(fg===undefined?{}:{foregroundColorStyle:{rgbColor:fg}})},backgroundColorStyle:{rgbColor:bg}}});
 const trip=(y,m,d,fg,bg)=>[y,m,d].map(v=>cell(v,fg,bg));
 const asOf='2027-06-15',run=(c,a=asOf)=>api.classifyRollHistoryDate(c,a);
 const actual=trip(2027,4,3),plan=trip(2027,4,3,red),mixed=actual.map((c,i)=>i===2?plan[i]:c);
 const before=JSON.stringify(actual);
 const check=(label,ok)=>[label,Boolean(ok)];
 return [
 check('default black white actual',run(actual).status==='actual'&&run(actual).date==='2027-04-03'),
 check('explicit black actual',run(trip(2027,4,3,black)).status==='actual'),
 check('red exact past still planned',run(plan).status==='planned'),
 check('red future planned',run(trip(2027,7,3,red)).status==='planned'),
 check('black future unknown',run(trip(2027,7,3)).status==='unknown'),
 check('mixed date color unknown',run(mixed).status==='unknown'),
 check('colored background black unknown',run(trip(2027,4,3,black,{blue:1})).status==='unknown'),
 check('red upper third not exact date',run(trip(2027,4,'上',red)).period==='2027-04 上旬'&&run(trip(2027,4,'上',red)).date===null),
 check('red middle third',run(trip(2027,4,'中旬',red)).period==='2027-04 中旬'),
 check('red lower third',run(trip(2027,4,'下',red)).period==='2027-04 下旬'),
 check('black approximate unknown',run(trip(2027,4,'上')).status==='unknown'),
 check('invalid day unknown',run(trip(2027,2,30,red)).status==='unknown'),
 check('leap year valid',run(trip(2024,2,29)).status==='actual'),
 check('missing value unknown',run([actual[0],actual[1],cell('',black)]).status==='unknown'),
 check('missing style unknown',run(actual.map(c=>({formattedValue:c.formattedValue}))).status==='unknown'),
 check('empty style unknown',run(actual.map(c=>({...c,effectiveFormat:{textFormat:{},backgroundColorStyle:{rgbColor:white}}}))).status==='unknown'),
 check('theme unresolved unknown',run(actual.map(c=>({...c,effectiveFormat:{...c.effectiveFormat,textFormat:{foregroundColorStyle:{themeColor:'TEXT'}}}}))).status==='unknown'),
 check('background missing unknown',run(actual.map(c=>({...c,effectiveFormat:{textFormat:{fontFamily:'sans'}}}))).status==='unknown'),
 check('legacy rgb supported',run(actual.map(c=>({...c,effectiveFormat:{textFormat:{foregroundColor:black},backgroundColor:white}}))).status==='actual'),
 check('contradictory colors unknown',run(actual.map(c=>({...c,effectiveFormat:{...c.effectiveFormat,textFormat:{foregroundColor:red,foregroundColorStyle:{rgbColor:black}}}}))).status==='unknown'),
 check('other text color unknown',run(trip(2027,4,3,{blue:1})).status==='unknown'),
 check('old era not invented',run(trip(27,4,3)).status==='unknown'),
 check('bad reference unknown',run(actual,'2027-02-30').status==='unknown'),
 check('memo is not date group',run([...actual,cell('memo',red)]).status==='unknown'),
 check('same row separate actual and plan',run(actual).status==='actual'&&run(plan).status==='planned'),
 check('input unchanged',JSON.stringify(actual)===before)
 ];
}
if(typeof module!=='undefined')module.exports={selfTest};
if(typeof require!=='undefined'&&typeof module!=='undefined'&&require.main===module){
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../../js/operating-plan.js'),'utf8'),ctx);
 const tests=selfTest(ctx);for(const [name,ok] of tests)console.log((ok?'PASS ':'FAIL ')+name);
 if(tests.some(x=>!x[1]))process.exitCode=1;
}
