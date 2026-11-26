"""Anonymous local workbook export; never writes to a source workbook or network."""
import argparse
import calendar
import json
from pathlib import Path
import sys
from artifact_tool import Workbook, SpreadsheetFile


def export_model(model, destination):
    if (model.get('kind') != 'anonymous-pc-workbook-model' or
            model.get('writeAllowed') is not False or model.get('operationAuthorized') is not False or
            model.get('complete') is not False or not model.get('sourceRevision') or
            not model.get('previewRevision') or model['sourceRevision'] == model['previewRevision']):
        raise ValueError('Anonymous preview with distinct revisions required')
    year, month = map(int, model['period'].split('-'))
    rows, headers = model['rows'], model['headers']
    if len(headers) != 17 or len(rows) != calendar.monthrange(year, month)[1]:
        raise ValueError('Unexpected model shape')
    for i, row in enumerate(rows, 1):
        if (row['date'] != f'{year:04}-{month:02}-{i:02}' or len(row['values']) != 17 or
                row['values'][0] != i or not set(row['red']) <= {4, 8, 12} or
                not set(row['operating']) <= set(range(3, 11))):
            raise ValueError('Invalid date, values or style indexes')
    destination = Path(destination)
    if destination.suffix.lower() != '.xlsx' or destination.exists():
        raise ValueError('New .xlsx destination required; overwrites forbidden')
    def safe(v):
        if isinstance(v, (dict, list)):
            v = json.dumps(v, ensure_ascii=False, separators=(',', ':'))
        return "'" + v if isinstance(v, str) and v.lstrip().startswith(('=', '+', '-', '@')) else v
    wb = Workbook.create()
    def table(name, heads, data, widths, height=24):
        ws = wb.worksheets.add(name)
        matrix = [[safe(v) for v in heads]] + [[safe(v) for v in line] for line in data]
        rg = ws.get_range_by_indexes(0, 0, len(matrix), len(heads))
        rg.values = matrix
        rg.format = {'horizontal_alignment': 'center', 'vertical_alignment': 'center', 'wrap_text': True, 'row_height': height}
        ws.get_range_by_indexes(0,0,1,len(heads)).format = {'fill':'#233E58','font':{'bold':True,'color':'#FFFFFF'},'horizontal_alignment':'center','vertical_alignment':'center','wrap_text':True,'row_height':32}
        for c, width in enumerate(widths):
            ws.get_range_by_indexes(0,c,len(matrix),1).format.column_width = width
        ws.freeze_panes.freeze_rows(1)
        return ws
    ws = table('月間予定_匿名', headers, [r['values'] for r in rows], [5,5,10,7,18,18,13,7,18,18,13,8,18,18,13,10,12], 34)
    for i, row in enumerate(rows, 1):
        for c in row['operating']:
            ws.get_cell(i,c).format.fill = '#E4EDF5'
        for c in row['red']:
            ws.get_cell(i,c).format.font.color = '#B91C1C'
    table('交換根拠', ['ID','候補日','班','期限日','期限分','期限根拠','停止枠根拠','使用量根拠','理由'],
          [[e.get(k) for k in ('id','date','team','deadlineDate','deadlineMinute','deadlineBasis','slotBasis','triggers','reason')] for e in model['evidence']], [10,14,12,14,10,32,28,48,32], 68)
    table('要確認', ['種別','ID','日付','理由','詳細原文'], [[e.get('kind'),e.get('id'),e.get('date'),e.get('reason'),e] for e in model['issues']], [22,10,14,42,55], 60)
    table('手入力原文', ['日付','班','ID','原文'], [[e.get(k) for k in ('date','team','id','text')] for e in model['manual']], [14,12,10,55], 48)
    table('交換明細', ['ID','日付','班','交換候補','分','開始分','終了分','要照合'], [[e.get(k) for k in ('id','date','team','text','minutes','startMinute','endMinute','reviewRequired')] for e in model['details']], [10,14,12,25,10,10,10,12])
    table('出力条件', ['項目','値'], [['用途','匿名試作・操業許可なし'],['対象月',model['period']],['元版',model['sourceRevision']],['出力版',model['previewRevision']],['書込許可',False],['操業許可',False]] + [['未確認',s] for s in model['limitations']], [16,75], 36)
    # Exclusive create protects existing files even if another process writes after the check.
    data = SpreadsheetFile.export_xlsx(wb)
    with destination.open('xb') as handle:
        handle.write(data.data)
    return wb


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--anonymous-only', action='store_true', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    export_model(json.load(sys.stdin), args.output)
