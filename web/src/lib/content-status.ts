export type ContentStatusValue = 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED';

export type ContentAction = 'submit-review' | 'publish' | 'archive';

export const LEGAL_TRANSITIONS: Record<ContentAction, readonly ContentStatusValue[]> = {
  'submit-review': ['DRAFT'],
  publish: ['REVIEW'],
  archive: ['PUBLISHED', 'REVIEW'],
};

export class IllegalTransitionError extends Error {
  readonly from: ContentStatusValue;
  readonly action: string;

  constructor(from: ContentStatusValue, action: string) {
    super(`非法的内容状态迁移：当前状态 ${from} 不允许执行 ${action}`);
    this.name = 'IllegalTransitionError';
    this.from = from;
    this.action = action;
  }
}

export function assertTransitionLegal(from: ContentStatusValue, action: ContentAction): void {
  if (!LEGAL_TRANSITIONS[action].includes(from)) throw new IllegalTransitionError(from, action);
}

export function asContentStatus(value: unknown): ContentStatusValue | null {
  return value === 'DRAFT' || value === 'REVIEW' || value === 'PUBLISHED' || value === 'ARCHIVED' ? value : null;
}
