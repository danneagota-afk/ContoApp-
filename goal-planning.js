/* Calcoli locali: le previsioni non trasferiscono denaro e non sono rendimenti garantiti. */
export function euroNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}
export function monthsToDate(today, deadline) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(deadline || ''))) return null;
  const end = new Date(`${deadline}T12:00:00`);
  if (!Number.isFinite(end.getTime()) || end.toISOString().slice(0, 10) !== deadline) return null;
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (end.getTime() <= new Date(current.getFullYear(), current.getMonth(), current.getDate(), 23, 59, 59, 999).getTime()) return 0;
  const difference = (end.getFullYear() - current.getFullYear()) * 12 + end.getMonth() - current.getMonth();
  // Round up partial months, so an approaching deadline still requires saving.
  return Math.max(1, difference + (end.getDate() > current.getDate() ? 1 : 0));
}
export function addMonthsClamped(now, count) {
  const first = new Date(now.getFullYear(), now.getMonth() + count, 1);
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  first.setDate(Math.min(now.getDate(), lastDay));
  return first;
}
export function calculateGoalPlan(goal, today = new Date()) {
  const target = Math.max(0, euroNumber(goal?.target));
  const saved = Math.max(0, euroNumber(goal?.amount));
  const monthly = Math.max(0, euroNumber(goal?.monthlyContribution));
  const missing = Math.max(0, Math.round((target - saved) * 100) / 100);
  const completed = missing === 0;
  const months = completed ? 0 : monthly > 0 ? Math.ceil(missing / monthly) : null;
  const projectedDate = months === null ? null : addMonthsClamped(today, months);
  const deadline = typeof goal?.targetDate === 'string' ? goal.targetDate : '';
  const deadlineMonths = monthsToDate(today, deadline);
  const requiredMonthly = completed ? 0 : deadlineMonths === null || deadlineMonths === 0 ? null : Math.ceil((missing / deadlineMonths) * 100) / 100;
  return { target, saved, monthly, missing, completed, months, projectedDate, deadline, deadlineMonths, requiredMonthly, onTrack: completed || (deadlineMonths !== null && months !== null && months <= deadlineMonths) };
}
