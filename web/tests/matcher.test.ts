import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from '../src/lib/content';
import { inferScenario, matchRole } from '../src/lib/matcher';

test('CSV parser preserves quoted commas', () => {
  const rows = parseCsv('period,summary\n秦,"郡县、财政与军制"');
  assert.equal(rows[0].summary, '郡县、财政与军制');
});

test('role matcher returns primary plus two alternatives', async () => {
  const result = await matchRole('县公安局长');
  assert.equal(result.candidates.length, 3);
  assert.equal(result.candidates[0].ancient_candidate, '县尉（秦汉）');
  assert.ok(result.candidates.every((candidate) => candidate.source_ids.length > 0));
});

test('scenario inference distinguishes frontier work', () => {
  assert.equal(inferScenario('边疆驻防军分区主官').location, '边疆驻防或边镇');
});

test('all acceptance examples produce three evidence-backed candidates', async () => {
  const queries = ['财政厅厅长', '县公安局长', '军分区主官', '医院负责人', '企业技术人员', '教育部门负责人', '法院院长', '边疆事务负责人'];
  for (const query of queries) {
    const result = await matchRole(query);
    assert.equal(result.candidates.length, 3, query);
    assert.ok(result.candidates[0].similarity > 0, query);
    assert.ok(result.candidates.every((candidate) => candidate.source_ids.length), query);
  }
});
