'use strict';
// Isolated PC workbook exporter. No external services, formulas or overwrite.
// An explicitly provided report is exported as data, not operational approval.
function xml(s){
 const t=String(s);
 if(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFE\uFFFF]/.test(t))throw Error('Invalid XML character');
 return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
function col(n){let a='';while(n>0){n--;a=String.fromCharCode(65+n%26)+a;n=Math.floor(n/26);}return a;}
function address(row,column){return col(column)+row;}
function utf8(s){const p=encodeURIComponent(s),a=[];for(let i=0;i<p.length;i++){if(p[i]==='%'){a.push(parseInt(p.slice(i+1,i+3),16));i+=2;}else a.push(p.charCodeAt(i));}return Uint8Array.from(a);}
function crc(a){let c=0xffffffff;for(const x of a){c^=x;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function join(a){const out=new Uint8Array(a.reduce((s,b)=>s+b.length,0));let p=0;for(const b of a){out.set(b,p);p+=b.length;}return out;}
function header(n,fields){const a=new Uint8Array(n),d=new DataView(a.buffer);for(const [p,len,v] of fields){if(len===2)d.setUint16(p,v,true);else d.setUint32(p,v,true);}return a;}
function zip(parts){
 const local=[],central=[];let offset=0;
 for(const [name,body] of Object.entries(parts)){
  const n=utf8(name),b=utf8(body),c=crc(b),len=b.length;
  const l=header(30,[[0,4,0x04034b50],[4,2,20],[6,2,0x800],[12,2,33],[14,4,c],[18,4,len],[22,4,len],[26,2,n.length]]);
  central.push(header(46,[[0,4,0x02014b50],[4,2,20],[6,2,20],[8,2,0x800],[14,2,33],[16,4,c],[20,4,len],[24,4,len],[28,2,n.length],[42,4,offset]]),n);
  local.push(l,n,b);offset+=l.length+n.length+len;
 }
 const cd=join(central),count=Object.keys(parts).length;
 return join([...local,cd,header(22,[[0,4,0x06054b50],[8,2,count],[10,2,count],[12,4,cd.length],[16,4,offset]])]);
}
const mainNS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const relNS='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const pkgNS='http://schemas.openxmlformats.org/package/2006/relationships';
const decl='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const expected=['年間計画','根拠明細','照合用原始情報','要確認','費用入力（印刷対象外）'];
function prepare(report){
 if(!report||report.writeAllowed!==false||report.operationAuthorized!==false||report.complete!==false)throw Error('Expected a non-authorized preview');
 if(report.sheets?.length!==5||report.sheets.some((s,i)=>s.name!==expected[i]||!Array.isArray(s.values)))throw Error('Unexpected report sheets');
 const sheets=report.sheets.map(s=>({...s,values:s.values.map(r=>r.slice()),links:new Map()}));
 const [annual,detail,raw]=sheets;
 if(annual.values.length!==51||annual.values.slice(2).some(r=>r.length!==14)||annual.print?.range!=='A1:N51'||annual.print?.paper!=='A3'||annual.print?.orientation!=='landscape'||annual.print?.pagesWide!==1||annual.print?.pagesTall!==1||annual.print?.includeCost!==false||raw.hiddenByDefault!==true)throw Error('Unconfirmed annual print contract');
 const byId=new Map();
 for(let i=1;i<detail.values.length;i++){const id=detail.values[i][0];if(typeof id!=='string'||!id)throw Error('Missing detail id');if(!byId.has(id))byId.set(id,[]);byId.get(id).push(i+1);}
 const groups=new Map();
 if(!Array.isArray(report.cellLinks))throw Error('Missing cell links');
 for(const l of report.cellLinks){
  const {row,column,detailNo}=l;
  if(!Number.isInteger(row)||row<4||row>51||!Number.isInteger(column)||column<3||column>14||!byId.has(detailNo)||annual.values[row-1][column-1]==null||annual.values[row-1][0]!=='#'+l.stand||annual.values[2][column-1]!==l.month)throw Error('Invalid evidence link');
  const ref=address(row,column);
  if(!groups.has(ref))groups.set(ref,{row,column,ids:new Set()});
  groups.get(ref).ids.add(detailNo);
 }
 const index={name:'根拠索引',values:[['年間セル','スタンド','区分','対象月','明細番号','集計扱い','根拠明細へ']],links:new Map()};
 for(let r=4;r<=51;r++)for(let c=3;c<=14;c++){
  const value=annual.values[r-1][c-1],ref=address(r,c);
  if(value==null)continue;
  const group=groups.get(ref);if(!group)throw Error('Nonempty annual cell lacks evidence: '+ref);
  const counted=[...group.ids].map(id=>{
   const candidates=byId.get(id).map(dr=>detail.values[dr-1]).filter(d=>d[1]===annual.values[r-1][0]&&d[3]===annual.values[r-1][1]&&d[6]===annual.values[2][c-1]&&['集計採用','発注期限目安'].includes(d[13]));
   if(candidates.length!==1)throw Error('Evidence does not match annual cell: '+ref);
   return candidates[0][4];
  });
  const actual=counted.filter(v=>v==='実績').length,forecast=counted.filter(v=>v==='予測').length;
  const expectedValue=[actual?'実'+actual:'',forecast?'予'+forecast:''].filter(Boolean).join(' / ');
  if(value!==expectedValue||actual+forecast!==group.ids.size)throw Error('Evidence count mismatch: '+ref);
  const first=index.values.length+1;
  annual.links.set(ref,"'根拠索引'!A"+first);
  for(const id of group.ids)for(const dr of byId.get(id)){
   const ir=index.values.length+1;
   index.values.push([ref,annual.values[r-1][0],annual.values[r-1][1],annual.values[2][c-1],id,detail.values[dr-1][13], '明細を開く']);
   index.links.set('A'+ir,"'年間計画'!"+ref);
   index.links.set('G'+ir,"'根拠明細'!A"+dr);
  }
 }
 sheets.push(index);
 return sheets;
}
function cell(ref,v,style){if(v==null)return '';if(typeof v==='number'){if(!Number.isFinite(v))throw Error('Nonfinite number');return '<c r="'+ref+'" s="'+style+'"><v>'+v+'</v></c>';}
 if(typeof v!=='string'&&typeof v!=='boolean')throw Error('Unsupported cell value');
 return '<c r="'+ref+'" s="'+style+'" t="inlineStr"><is><t xml:space="preserve">'+xml(v)+'</t></is></c>';
}
function sheetXml(s,i){
 const annual=i===0, widths=annual?[9,18,...Array(12).fill(10)]:i===1?[13,12,18,17,13,13,13,38,15,17,16,16,42,16]:i===5?[12,12,19,14,15,17,18]:i===4?[10,22,22,30]:Array(Math.max(...s.values.map(r=>r.length),1)).fill(22);
 const rows=s.values.map((r,j)=>'<row r="'+(j+1)+'" ht="'+(annual?(j===0?25:19):(j===0?32:i===1?48:25))+'" customHeight="1">'+r.map((v,k)=>{const ref=address(j+1,k+1);return cell(ref,v,s.links.has(ref)?3:((annual?j===0||j===2:j===0)?1:2));}).join('')+'</row>').join('');
 const links=s.links.size?'<hyperlinks>'+[...s.links].map(([ref,loc])=>'<hyperlink ref="'+ref+'" location="'+xml(loc)+'" tooltip="根拠を確認"/>').join('')+'</hyperlinks>':'';
 return decl+'<worksheet xmlns="'+mainNS+'" xmlns:r="'+relNS+'">'+(annual?'<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>':'')+'<sheetViews><sheetView workbookViewId="0"><pane ySplit="'+(annual?3:1)+'" topLeftCell="A'+(annual?4:2)+'" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="19"/><cols>'+widths.map((w,k)=>'<col min="'+(k+1)+'" max="'+(k+1)+'" width="'+w+'" customWidth="1"/>').join('')+'</cols><sheetData>'+rows+'</sheetData>'+(annual?'<mergeCells count="2"><mergeCell ref="A1:N1"/><mergeCell ref="C2:N2"/></mergeCells>':'')+links+(annual?'<pageMargins left="0.25" right="0.25" top="0.35" bottom="0.35" header="0.1" footer="0.1"/><pageSetup paperSize="8" orientation="landscape" fitToWidth="1" fitToHeight="1"/>':'')+'</worksheet>';
}
const styles=decl+'<styleSheet xmlns="'+mainNS+'"><fonts count="3"><font><sz val="10"/><name val="Yu Gothic"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Yu Gothic"/></font><font><u/><sz val="10"/><color rgb="FF0563C1"/><name val="Yu Gothic"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF304E65"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
function renderPcAnnualXlsx(report){
 const sheets=prepare(report),parts={};
 parts['[Content_Types].xml']=decl+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+sheets.map((s,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+'</Types>';
 parts['_rels/.rels']=decl+'<Relationships xmlns="'+pkgNS+'"><Relationship Id="rId1" Type="'+relNS+'/officeDocument" Target="xl/workbook.xml"/></Relationships>';
 parts['xl/workbook.xml']=decl+'<workbook xmlns="'+mainNS+'" xmlns:r="'+relNS+'"><bookViews><workbookView activeTab="0"/></bookViews><sheets>'+sheets.map((s,i)=>'<sheet name="'+xml(s.name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"'+(s.hiddenByDefault?' state="hidden"':'')+'/>').join('')+'</sheets><definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">\'年間計画\'!$A$1:$N$51</definedName></definedNames></workbook>';
 parts['xl/_rels/workbook.xml.rels']=decl+'<Relationships xmlns="'+pkgNS+'">'+sheets.map((s,i)=>'<Relationship Id="rId'+(i+1)+'" Type="'+relNS+'/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+'<Relationship Id="rId'+(sheets.length+1)+'" Type="'+relNS+'/styles" Target="styles.xml"/></Relationships>';
 parts['xl/styles.xml']=styles;
 sheets.forEach((s,i)=>parts['xl/worksheets/sheet'+(i+1)+'.xml']=sheetXml(s,i));
 return zip(parts);
}
function exportPcAnnualXlsx(input){
 return renderPcAnnualXlsx(require('./pc-annual-sheet-export.cjs').buildPcAnnualSheets(input));
}
module.exports={renderPcAnnualXlsx,exportPcAnnualXlsx};
if(require.main===module){
 const fs=require('node:fs'),[input,output]=process.argv.slice(2);
 if(!input||!output||!/\.xlsx$/i.test(output))throw Error('Usage: node tools/pc-annual-xlsx.cjs input.json new-output.xlsx');
 const bytes=exportPcAnnualXlsx(JSON.parse(fs.readFileSync(input,'utf8')));
 fs.writeFileSync(output,bytes,{flag:'wx'});
}
