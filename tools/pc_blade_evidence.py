"""Anonymous source evidence adapter for blade schedule, not a live workbook reader."""
from collections import defaultdict
from copy import deepcopy


def attach_blade_evidence(model):
    out = deepcopy(model)
    rows = out['rows']
    by_date = {r['date']: r for r in rows}
    grouped = defaultdict(list)
    records = out.get('bladeRecords', [])
    if not isinstance(records, list):
        out['issues'].append({'kind':'blade-source','reason':'刃替原予定の形式未確認'})
        records = []
    for r in records:
        if not isinstance(r, dict) or r.get('date') not in by_date:
            out['issues'].append({'kind':'blade-source','reason':'刃替日付が対象月と不一致','entry':r})
            continue
        grouped[r['date']].append(r)
    out['bladeEvidence'] = []
    for row in rows:
        date = row['date']; values = row['values']; matches = grouped[date]
        r = matches[0] if len(matches) == 1 else {}
        valid = (len(matches) == 1 and r.get('confirmed') is True and
                 r.get('sourceRevision') == out['sourceRevision'] and
                 r.get('sourceCell') == 'M'+str(values[0]+4) and
                 isinstance(r.get('basis'),str) and bool(r['basis'].strip()) and
                 r.get('value') in ('●','') and values[16] == '読取済')
        state = ('予定あり' if r['value'] == '●' else '予定なし') if valid else '未確認'
        row['bladeState'] = state
        values[15] = '●' if state == '予定あり' else None
        out['bladeEvidence'].append({'date':date,'state':state,'sourceCell':r.get('sourceCell'),
                                    'sourceRevision':r.get('sourceRevision'),'basis':r.get('basis')})
        if not valid:
            out['issues'].append({'kind':'blade-unconfirmed','date':date,'reason':'刃替原予定の根拠未確認（帳票は空欄）','entries':matches})
        # Holiday conflict is never erased just to show a cross.
        for key,idx in [('A',3),('B',7)]:
            if values[idx]=='×' and (values[idx+1] or values[idx+2] or values[idx+3] or idx in row['operating']):
                out['issues'].append({'kind':'rest-conflict','date':date,'team':key,'reason':'休みと作業・操業の矛盾。元記録保持・要照合'})
    return out
