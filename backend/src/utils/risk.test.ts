import { describe, expect, it, vi } from 'vitest';

vi.mock('../db/connection', () => ({ query: vi.fn() }));

import { isTaskAtRisk } from './risk';

const daysFromToday = (days: number): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

describe('isTaskAtRisk', () => {
  it('flags an overdue active task', () => {
    expect(isTaskAtRisk({ status: 'in_progress', deadline: daysFromToday(-2) })).toBe(true);
  });

  it('flags a confirmed task due within five days', () => {
    expect(isTaskAtRisk({ status: 'confirmed', deadline: daysFromToday(3) })).toBe(true);
  });

  it('does not flag a started task that is due soon but not overdue', () => {
    expect(isTaskAtRisk({ status: 'in_progress', deadline: daysFromToday(3) })).toBe(false);
  });

  it('does not flag a confirmed task due far in the future', () => {
    expect(isTaskAtRisk({ status: 'confirmed', deadline: daysFromToday(30) })).toBe(false);
  });

  it('flags an active task marked high risk even without a deadline', () => {
    expect(isTaskAtRisk({ status: 'confirmed', risk_level: 'high', deadline: null })).toBe(true);
  });

  it('never flags drafts or completed tasks', () => {
    expect(isTaskAtRisk({ status: 'draft', risk_level: 'high', deadline: daysFromToday(-2) })).toBe(false);
    expect(isTaskAtRisk({ status: 'completed', deadline: daysFromToday(-2) })).toBe(false);
  });

  it('does not flag an active task with no deadline and no high risk', () => {
    expect(isTaskAtRisk({ status: 'confirmed', deadline: null })).toBe(false);
  });
});
