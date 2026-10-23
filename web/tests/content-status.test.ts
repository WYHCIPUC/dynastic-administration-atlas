import test from 'node:test';
import assert from 'node:assert/strict';
import { asContentStatus, assertTransitionLegal, IllegalTransitionError, LEGAL_TRANSITIONS, type ContentAction, type ContentStatusValue } from '../src/lib/content-status';

test('LEGAL_TRANSITIONS 与发布闭环约定一致', () => {
  assert.deepEqual(LEGAL_TRANSITIONS['submit-review'], ['DRAFT']);
  assert.deepEqual(LEGAL_TRANSITIONS.publish, ['REVIEW']);
  assert.deepEqual(LEGAL_TRANSITIONS.archive, ['PUBLISHED', 'REVIEW']);
});

test('合法迁移全部放行', () => {
  const legal: Array<[ContentStatusValue, ContentAction]> = [
    ['DRAFT', 'submit-review'],
    ['REVIEW', 'publish'],
    ['PUBLISHED', 'archive'],
    ['REVIEW', 'archive'],
  ];
  for (const [from, action] of legal) {
    assert.doesNotThrow(() => assertTransitionLegal(from, action), `${from} -> ${action}`);
  }
});

test('非法迁移逐条抛出 IllegalTransitionError', () => {
  const illegal: Array<[ContentStatusValue, ContentAction]> = [
    ['DRAFT', 'publish'],
    ['DRAFT', 'archive'],
    ['REVIEW', 'submit-review'],
    ['PUBLISHED', 'submit-review'],
    ['PUBLISHED', 'publish'],
    ['ARCHIVED', 'submit-review'],
    ['ARCHIVED', 'publish'],
    ['ARCHIVED', 'archive'],
  ];
  for (const [from, action] of illegal) {
    assert.throws(
      () => assertTransitionLegal(from, action),
      (error: unknown) => error instanceof IllegalTransitionError && /非法的内容状态迁移/.test(error.message),
      `${from} -> ${action}`,
    );
  }
});

test('asContentStatus 仅接受合法状态值', () => {
  assert.equal(asContentStatus('DRAFT'), 'DRAFT');
  assert.equal(asContentStatus('PUBLISHED'), 'PUBLISHED');
  assert.equal(asContentStatus('draft'), null);
  assert.equal(asContentStatus(''), null);
  assert.equal(asContentStatus(undefined), null);
  assert.equal(asContentStatus(42), null);
});
