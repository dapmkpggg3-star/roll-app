'use strict';
const {fixture,selfTest:sheetTests}=require('./test-pc-annual-sheet-export.cjs');
const {buildPcAnnualSheets}=require('./pc-annual-sheet-export.cjs');
const {exportPcAnnualXlsx,renderPcAnnualXlsx}=require('./pc-annual-xlsx.cjs');
// Independently read central directory, local entries and check CRC-32.
function decode(b){return decodeURIComponent(Array.from(b,x=>'%'+x.toString(16).padStart(2,'0')).join(''));}
function crc(bytes){let n=0xffffffff;for(let i=0;i<bytes.length;i++){n^=bytes[i];for(let k=0;k<8;k++)n=(n&1)?(n>>>1)^0xedb88320:n>>>1;}return (~n)>>>0;}
function readZip(bytes){
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),u16=p=>v.getUint16(p,true),u32=p=>v.getUint32(p,true),end=bytes.length-22;
 if(u32(end)!==0x06054b50||u16(end+20)!==0)throw Error('Invalid EOCD');
 const count=u16(end+10),start=u32(end+16);let p=start;const parts={};
 for(let i=0;i<count;i++){
  if(u32(p)!==0x02014b50||u16(p+10)!==0)throw Error('Invalid central entry');
  const n=u16(p+28),len=u32(p+24),off=u32(p+42),name=decode(bytes.slice(p+46,p+46+n));
  if(u32(off)!==0x04034b50||u32(off+18)!==len||u32(off+22)!==len)throw Error('Invalid local entry');
  const at=off+30+u16(off+26)+u16(off+28),body=bytes.slice(at,at+len);
  if(decode(bytes.slice(off+30,off+30+u16(off+26)))!==name||crc(body)!==u32(p+16)||crc(body)!==u32(off+14)||Object.hasOwn(parts,name))throw Error('ZIP integrity failure');
  parts[name]=decode(body);p+=46+n+u16(p+30)+u16(p+32);
 }
 if(p!==end||p-start!==u32(end+12))throw Error('Central size mismatch');
 return parts;
}
function selfTest(){
 const x=fixture();x.asOf='2027-11-26';x.actualEvents.push({...x.actualEvents[0],rollId:'E',cycleId:'c2',date:'2027-11-25'});
 const before=JSON.stringify(x),model=buildPcAnnualSheets(x),bytes=exportPcAnnualXlsx(x),parts=readZip(bytes);
 const a=parts['xl/worksheets/sheet1.xml'],d=parts['xl/worksheets/sheet2.xml'],idx=parts['xl/worksheets/sheet6.xml'],w=parts['xl/workbook.xml'];
 const reject=fn=>{try{fn();return false;}catch{return true;}};
 const altered=()=>JSON.parse(JSON.stringify(model));
 const bad=altered();bad.cellLinks=bad.cellLinks.filter(l=>l.row!==22||l.column!==10);
 const wrong=altered();wrong.cellLinks.find(l=>l.row===22&&l.column===10).detailNo=wrong.cellLinks.find(l=>l.row===23).detailNo;
 const count=altered();count.sheets[0].values[21][9]='実3';
 const text=altered();text.sheets[3].values.push([null,null,'=1+1 < &']);
 const injected=readZip(renderPcAnnualXlsx(text))['xl/worksheets/sheet4.xml'];
 const rangeRows=idx.match(/<row r="\d+"/g)||[];
 const annualIndex=a.match(/<hyperlink ref="J22" location="&apos;根拠索引&apos;!A(\d+)"/);
 const first=annualIndex?Number(annualIndex[1]):0;
 return [...sheetTests(),['ZIP central/local and CRC validation',Object.keys(parts).length===11],
 ['A3 landscape fit 1x1',a.includes('paperSize="8" orientation="landscape" fitToWidth="1" fitToHeight="1"')&&a.includes('fitToPage="1"')],
 ['Print area excludes other sheets',w.includes('name="_xlnm.Print_Area" localSheetId="0"')&&w.includes('$A$1:$N$51')&&!parts['xl/worksheets/sheet5.xml'].includes('<pageSetup')],
 ['Hidden raw sheet only',w.includes('name="照合用原始情報" sheetId="3" r:id="rId3" state="hidden"')&&(w.match(/state="hidden"/g)||[]).length===1],
 ['Title merges',a.includes('mergeCell ref="A1:N1"')&&a.includes('mergeCell ref="C2:N2"')],
 ['Two actual events in same cell',model.sheets[0].values[21][9]==='実2'&&a.includes('>実2</t>')],
 ['One annual link for both events',!!first&&(a.match(/<hyperlink ref="J22"/g)||[]).length===1],
 ['Both current events and prior forecast listed',first>0&&rangeRows.length>=6&&[first,first+1,first+2].every(n=>idx.includes('ref="G'+n+'" location="&apos;根拠明細&apos;!A'))&&idx.includes('参照履歴')&&idx.includes('集計採用')&&d.includes('>E</t>')],
 ['Links back to original annual cell', (idx.match(/location="&apos;年間計画&apos;!J22"/g)||[]).length===3],
 ['Unknown cells remain absent',!a.includes('r="C4"')],
 ['No formulas from untrusted text',injected.includes('=1+1 &lt; &amp;')&&!injected.includes('<f>')],
 ['Missing link rejected',reject(()=>renderPcAnnualXlsx(bad))],
 ['Wrong evidence rejected',reject(()=>renderPcAnnualXlsx(wrong))],
 ['Count mismatch rejected',reject(()=>renderPcAnnualXlsx(count))],
 ['Invalid fiscal preview rejected',reject(()=>exportPcAnnualXlsx({...x,fiscalYear:null}))],
 ['Input untouched',JSON.stringify(x)===before]];
}
module.exports={selfTest,readZip};
if(require.main===module){const t=selfTest();for(const [n,ok] of t)console.log((ok?'PASS ':'FAIL ')+n);if(t.some(x=>!x[1]))process.exitCode=1;}
