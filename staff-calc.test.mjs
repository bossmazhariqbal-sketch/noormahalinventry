import test from 'node:test';
import assert from 'node:assert/strict';
import { round2, sum2, monthRange, paymentMonth, calcStaffStats, attendanceTotals } from './staff-calc.js';

const att = (employee_id, date, status, extra = {}) => ({ employee_id, date, status, late_minutes: 0, paid: false, ...extra });

test('rounding to 2 decimals', () => {
  assert.equal(round2(1.005), 1.01); assert.equal(round2(0.1 + 0.2), 0.3); assert.equal(round2(-1.005), -1.01);
  assert.equal(sum2([0.1, 0.2, 0.3]), 0.6);
});
test('monthRange handles leap years', () => { assert.deepEqual(monthRange('2024-02'), ['2024-02-01', '2024-02-29']); assert.deepEqual(monthRange('2026-09'), ['2026-09-01', '2026-09-30']); });

test('monthly: absent deducted, leave not deducted, 2 decimals', () => {
  const e = { id: 'm', salary: 30000, salary_type: 'monthly' }; // September = 30 days
  const rows = [att('m', '2026-09-01', 'on_time'), att('m', '2026-09-02', 'late', { late_minutes: 15 }), att('m', '2026-09-03', 'absent'), att('m', '2026-09-04', 'leave')];
  const s = calcStaffStats(e, rows, [], [], '2026-09');
  assert.equal(s.earned, 29000); assert.equal(s.absent, 1); assert.equal(s.leave, 1); assert.equal(s.present, 2);
  const odd = calcStaffStats({ id: 'm', salary: 25000, salary_type: 'monthly' }, [att('m', '2026-09-03', 'absent'), att('m', '2026-09-05', 'absent'), att('m', '2026-09-06', 'absent')], [], [], '2026-09');
  assert.equal(odd.earned, 22500);
  assert.equal(calcStaffStats({ id: 'm', salary: 10000, salary_type: 'monthly' }, [att('m', '2026-08-03', 'absent')], [], [], '2026-08').earned, 9677.42); // 31 days
});

test('daily: present x rate, paid days counted, other months/employees ignored', () => {
  const e = { id: 'd', salary: 1500, salary_type: 'daily' };
  const rows = [att('d', '2026-09-01', 'on_time', { paid: true }), att('d', '2026-09-02', 'late', { paid: false }), att('d', '2026-09-03', 'absent'), att('d', '2026-10-01', 'on_time', { paid: true }), att('x', '2026-09-01', 'on_time', { paid: true })];
  const s = calcStaffStats(e, rows, [], [], '2026-09');
  assert.equal(s.earned, 3000); assert.equal(s.paid, 1500); assert.equal(s.balance, 1500);
});

test('monthly payments, advances and balance (partial + full, by salary month)', () => {
  const e = { id: 'm', salary: 30000, salary_type: 'monthly' };
  const pays = [{ employee_id: 'm', date: '2026-09-10', salary_month: '2026-09-01', amount: '10000.10' }, { employee_id: 'm', date: '2026-10-01', salary_month: '2026-09-01', amount: '5000.20' }, { employee_id: 'm', date: '2026-09-20', salary_month: '2026-08-01', amount: '999' }, { employee_id: 'other', date: '2026-09-10', salary_month: '2026-09-01', amount: '1' }, { employee_id: 'm', date: '2026-09-12', amount: '100' }];
  const adv = [{ employee_id: 'm', date: '2026-09-05', amount: '2000' }, { employee_id: 'm', date: '2026-10-05', amount: '777' }];
  const s = calcStaffStats(e, [], adv, pays, '2026-09');
  assert.equal(s.paid, 15100.3); assert.equal(s.advance, 2000); assert.equal(s.balance, round2(30000 - 2000 - 15100.3));
  assert.equal(paymentMonth({ date: '2026-09-12' }), '2026-09');
});

test('attendance footer totals follow current selections', () => {
  const staff = [{ id: 'a', salary: 1000, salary_type: 'daily' }, { id: 'b', salary: 1200, salary_type: 'daily' }, { id: 'c', salary: 30000, salary_type: 'monthly' }, { id: 'd', salary: 900, salary_type: 'daily' }];
  const t = attendanceTotals(staff, new Map([['a', { status: 'on_time', paid: true }], ['b', { status: 'late', paid: false }], ['c', { status: 'on_time', paid: false }], ['d', { status: 'absent', paid: false }]]));
  assert.deepEqual(t, { marked: 4, total: 4, paid: 1000, unpaid: 1200, sum: 2200 });
});

import { staffTotals } from './staff-calc.js';
test('day-wise: salary days, paid days, pending days', () => {
  const m = { id: 'm', salary: 30000, salary_type: 'monthly' }; // 31-day month
  const s = calcStaffStats(m, [att('m', '2026-10-03', 'absent')], [{ employee_id: 'm', date: '2026-10-05', amount: 2000 }], [{ employee_id: 'm', date: '2026-10-31', salary_month: '2026-10-01', amount: 15000 }], '2026-10');
  assert.equal(s.monthDays, 31); assert.equal(s.earnedDays, 30); assert.equal(s.dayRate, 967.74);
  assert.equal(s.earned, 29032.26); assert.equal(s.paid, 15000); assert.equal(s.paidDays, 15.5); assert.equal(s.balance, 12032.26); assert.equal(s.pendingDays, 12.43);
  const d = { id: 'd', salary: 1000, salary_type: 'daily' };
  const r = calcStaffStats(d, [att('d', '2026-10-01', 'on_time', { paid: true }), att('d', '2026-10-02', 'on_time'), att('d', '2026-10-03', 'late')], [], [], '2026-10');
  assert.deepEqual([r.earnedDays, r.paidDays, r.pendingDays, r.balance], [3, 1, 2, 2000]);
  const tot = staffTotals([s, r]); assert.equal(tot.earned, 32032.26); assert.equal(tot.balance, 14032.26); assert.equal(tot.present, 3);
});
test('advance bigger than earnings gives negative balance (not hidden)', () => {
  const e = { id: 'x', salary: 900, salary_type: 'daily' };
  const s = calcStaffStats(e, [], [{ employee_id: 'x', date: '2026-09-30', amount: 1400 }], [], '2026-09');
  assert.equal(s.balance, -1400); assert.equal(s.pendingDays, -1.56);
});
