"""Render a new anonymous paper-layout view, not a live workbook mapping."""
from collections import defaultdict


def safe_text(v):
    return "'" + v if isinstance(v, str) and v.lstrip().startswith(("=", "+", "-", "@")) else v


def add_paper_layout(wb, model):
    if (model.get('kind') != 'anonymous-pc-workbook-model' or
            model.get('writeAllowed') is not False or model.get('operationAuthorized') is not False):
        raise ValueError('Read-only preview required')
    ws = wb.worksheets.add('原紙様式_匿名')
    y,m = model['period'].split('-')
    # Based on the read-only template: dates B5:B35, work E:F/H:I/K:L,
    # shift G/J, blade M. This does not change the separate input-column contract.
    ws.get_range('B2:M36').format = {'font':{'name':'Arial','size':10,'color':'#000000'},'horizontal_alignment':'center','vertical_alignment':'center','wrap_text':True}
    for col,width in zip('BCDEFGHIJKLM',[7.125,7.125,8.625,21.375,9.625,6.625,21.375,9.625,6.5,21.375,10,6.625]):
        ws.get_range(f'{col}1:{col}36').format.column_width = width
    ws.get_range('A1:A36').format.column_width=2.25
    ws.get_range('B5:M35').format.row_height=36
    ws.get_range('B4:M4').format.row_height=36
    ws.get_range('B2:M2').format.row_height=26.25
    ws.get_range('B3:M3').format.row_height=20.25
    ws.merge_cells('B2:M2');ws.get_range('B2').values=[[f'{y}年 {int(m)}月度 ロール・カリバ替予定表（匿名確認用）']]
    ws.get_range('B2').format.font.bold=True
    ws.get_range('B2').format.font.size=16
    ws.merge_cells('B3:M3');ws.get_range('B3').values=[['未承認の試作・作業指示ではありません｜詳細は交換根拠・要確認へ']]
    for r,title in [('E4:G4','操業A'),('H4:J4','操業B'),('K4:L4','常昼')]:
        ws.merge_cells(r);ws.get_range(r.split(':')[0]).values=[[title]]
    ws.get_range('B4:D4').values=[['日付','曜日','サイズ']];ws.get_range('M4').values=[['CS\n刃替']]
    ws.get_range('B4:M4').format.fill='#E7E7E7'
    ws.get_range('B4:M4').format.font.bold=True
    borders={'preset':'outside','style':'thin','color':'#333333'}
    for r in ['B4','C4','D4','E4:G4','H4:J4','K4:L4','M4']:
        ws.get_range(r).format.borders=borders
    details=defaultdict(list)
    for d in model['details']:
        details[(d['date'],d['team'])].append(d)
    mixed=[]
    for i,row in enumerate(model['rows'],5):
        v=row['values']; ws.get_range(f'B{i}:D{i}').values=[[safe_text(v[0]),safe_text(v[1]),safe_text(v[2] if v[16]=='読取済' else str(v[2])+'（要確認）')]]
        for key,start,end,shift,idx in [('A','E','F','G',3),('B','H','I','J',7),('day','K','L',None,11)]:
            work=f'{start}{i}:{end}{i}'; ws.merge_cells(work)
            ds=details[(row['date'],key)]
            # Use classified proposal text, not substring guesses. Keep review annotations black.
            roll=[d['text'] for d in ds if d['style']=='roll-red']; other=[d['text'] for d in ds if d['style']=='normal']
            notes=[]
            if v[idx+3]: notes.append('手入力あり・要照合')
            elif any(d.get('reviewRequired') for d in ds): notes.append('要照合')
            if key!='day' and v[idx]=='×': notes.insert(0,'×')
            lines=roll+other+notes
            if roll and (other or notes): mixed.append((row['date'],key))
            cell=ws.get_range(f'{start}{i}');cell.values=[[safe_text('\n'.join(lines))]]
            if len(lines)>=3: cell.format.font.size=8
            if roll and not (other or notes): cell.format.font.color='#C00000'
            if shift and v[idx]!='×':ws.get_range(f'{shift}{i}').values=[[safe_text(v[idx])]]
            if key!='day' and idx in row['operating']:
                ws.get_range(f'{start}{i}:{shift}{i}').format.fill='#E4EDF5'
            ws.get_range(work).format.borders=borders
            if shift:ws.get_range(f'{shift}{i}').format.borders=borders
        ws.get_range(f'M{i}').values=[['未確認']]
        for col in 'BCDM':ws.get_range(f'{col}{i}').format.borders=borders
    # A 30-day month has a blank day-31 row; never place a fictional date there.
    # Keep the note after the maximum calendar row so 31-day months cannot collide.
    ws.merge_cells('B36:M36');ws.get_range('B36').values=[['SD345・刃替：原予定の確認待ち。混在セルの部分赤字は未対応（交換明細で確認）。']]
    ws.get_range('B36:M36').format.row_height=24
    ws.get_range('B36').format.font.color='#666666'
    return ws,mixed
