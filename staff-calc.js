// Pure staff calculations (no DOM / network) so they can be unit-tested with `node --test`.
export const PRESENT = ['on_time', 'late'];

// Round to 2 decimals without float artifacts (1.005 -> 1.01, 0.1 + 0.2 -> 0.3).
export const round2 = v => { const n = Number(v) || 0; return Math.round(n * 100 + Math.sign(n) * 1e-7) / 100; };
export const sum2 = values => round2(values.reduce((t, v) => t + Math.round(round2(v) * 100), 0) / 100);

export function monthRange(ym) {
  const [y, m] = ym.split('-').map(Number);
  return [`${ym}-01`, `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`];
}

// Which salary month a monthly-salary payment belongs to (older rows without salary_month use their own date).
export const paymentMonth = p => String(p.salary_month || p.date || '').slice(0, 7);

// Attendance rows of one employee inside one month only (state.attendance may also hold another date being edited).
export function monthAttendance(rows, employeeId, ym) {
  const [from, to] = monthRange(ym);
  return rows.filter(a => a.employee_id === employeeId && a.date >= from && a.date <= to);
}

export function calcStaffStats(employee, attendance, advances, salaryPayments, ym) {
  const [from, to] = monthRange(ym), days = Number(to.slice(8));
  const rows = monthAttendance(attendance, employee.id, ym), count = st => rows.filter(a => a.status === st).length;
  const onTime = count('on_time'), late = count('late'), absent = count('absent'), leave = count('leave'), present = onTime + late;
  const daily = employee.salary_type === 'daily', salary = Number(employee.salary) || 0;
  const lateMins = rows.filter(a => a.status === 'late').reduce((t, a) => t + (Number(a.late_minutes) || 0), 0);
  // Monthly: absent days are deducted, leave is not. Daily: rate x present days.
  const earned = round2(daily ? salary * present : Math.max(0, salary * (days - Math.min(absent, days)) / days));
  const advance = sum2(advances.filter(a => a.employee_id === employee.id && a.date >= from && a.date <= to).map(a => a.amount));
  const dailyPaid = round2(salary * rows.filter(a => PRESENT.includes(a.status) && a.paid).length);
  const monthlyPaid = sum2(salaryPayments.filter(p => p.employee_id === employee.id && paymentMonth(p) === ym).map(p => p.amount));
  const paid = daily ? dailyPaid : monthlyPaid, balance = round2(earned - advance - paid);
  // Day-wise view: rate per day, days earned, days already paid, days still pending.
  const dayRate = daily ? salary : salary / days, earnedDays = daily ? present : Math.max(0, days - Math.min(absent, days));
  const paidDays = daily ? rows.filter(a => PRESENT.includes(a.status) && a.paid).length : (dayRate ? round2(paid / dayRate) : 0);
  const pendingDays = dayRate ? round2(balance / dayRate) : 0, markedDays = rows.length;
  return { onTime, late, absent, leave, present, daily, earned, advance, paid, balance, monthDays: days, markedDays, dayRate: round2(dayRate), earnedDays, paidDays, pendingDays,
    attPct: present + absent ? present / (present + absent) * 100 : null, onTimePct: present ? onTime / present * 100 : null, avgLate: late ? lateMins / late : null };
}

// entries: Map(employeeId -> { status, paid }) as currently shown on the Attendance page.
export function attendanceTotals(staff, entries) {
  let marked = 0, paid = 0, unpaid = 0;
  for (const e of staff) {
    const m = entries.get(e.id); if (!m || !m.status) continue;
    marked++;
    if (e.salary_type === 'daily' && PRESENT.includes(m.status)) { if (m.paid) paid += Number(e.salary) || 0; else unpaid += Number(e.salary) || 0; }
  }
  return { marked, total: staff.length, paid: round2(paid), unpaid: round2(unpaid), sum: round2(paid + unpaid) };
}

// Sum of the money columns for the Staff Report footer (one total for all employees).
export function staffTotals(list) {
  const t = { earned: 0, advance: 0, paid: 0, balance: 0, present: 0, absent: 0, leave: 0, earnedDays: 0 };
  for (const x of list) for (const k of Object.keys(t)) t[k] = round2(t[k] + x[k]);
  return t;
}
