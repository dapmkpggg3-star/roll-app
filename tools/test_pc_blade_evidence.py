"""Pure anonymous regression for blade evidence; no file or network writes."""
import copy
import unittest
from pc_blade_evidence import attach_blade_evidence


class BladeEvidenceTest(unittest.TestCase):
    def fixture(self):
        rows = []
        for day in range(1, 11):
            values = [day,'木','D13','Ⅰ','','','','×','','','','常昼','','','','未確認','読取済']
            rows.append({'date':f'2027-04-{day:02}', 'values':values,'operating':[3,4,5,6], 'red':[]})
        m = {'sourceRevision':'source-1','rows':rows,'issues':[],'details':[],'evidence':[]}
        def record(day, value):
            return {'date':rows[day-1]['date'],'sourceRevision':'source-1','sourceCell':f'M{day+4}','confirmed':True,'basis':'anonymous test source','value':value}
        m['bladeRecords'] = [record(1,'●'),record(2,''),record(3,'●'),record(3,'●'),
            {**record(4,'●'),'sourceRevision':'old'}, {**record(5,'●'),'sourceCell':'N9'},
            {**record(6,'●'),'basis':''}, {**record(7,'●'),'value':'○'}, {**record(8,'●'),'confirmed':False}]
        m['rows'][9]['values'][8]='#4 ロール替'
        return m

    def test_evidence_and_conflict(self):
        m=self.fixture()
        before=copy.deepcopy(m)
        o=attach_blade_evidence(m)
        self.assertEqual([r['bladeState'] for r in o['rows']],['予定あり','予定なし']+['未確認']*8)
        self.assertEqual([r['values'][15] for r in o['rows']],['●']+[None]*9)
        self.assertEqual(len(o['bladeEvidence']),10)
        self.assertEqual(m,before)
        self.assertEqual(o['details'],m['details'])
        self.assertEqual(o['evidence'],m['evidence'])
        self.assertTrue(any(i['kind']=='rest-conflict' for i in o['issues']))

    def test_unknown_schedule_row(self):
        m=self.fixture()
        m['rows'][0]['values'][16]='未確認'
        self.assertEqual(attach_blade_evidence(m)['rows'][0]['bladeState'],'未確認')

    def test_wrong_month(self):
        m=self.fixture()
        m['bladeRecords'].append({**m['bladeRecords'][0],'date':'2027-05-01'})
        self.assertTrue(any(i['kind']=='blade-source' for i in attach_blade_evidence(m)['issues']))

    def test_missing_records(self):
        m=self.fixture()
        del m['bladeRecords']
        self.assertTrue(all(r['bladeState']=='未確認' for r in attach_blade_evidence(m)['rows']))


if __name__ == '__main__':
    unittest.main()
