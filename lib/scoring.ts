export const V_GRADES = ['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12', 'V13+'];

export function computeCHI(sessions: any, checkIns: any, injuryAlerts: any[]) {
  const today = new Date();

  // 1. Body Readiness (35%)
  let readiness = 65;
  let recentSoreness = 0;
  for (let i = 0; i <= 2; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ci = checkIns[d.toISOString().split('T')[0]];
    if (!ci) continue;
    if (ci.isRestDay) { readiness = 100; break; }
    let score = 100;
    const s = parseInt(ci.soreness || '0');
    recentSoreness = s;
    if (s >= 9) score -= 60; else if (s >= 7) score -= 40; else if (s >= 5) score -= 20; else if (s >= 3) score -= 8;
    const p = ci.painAreas?.length || 0;
    if (p >= 3) score -= 30; else if (p >= 2) score -= 20; else if (p >= 1) score -= 10;
    const f = ci.affectedFingers?.length || 0;
    if (f >= 3) score -= 20; else if (f >= 1) score -= 10;
    readiness = Math.max(0, Math.min(100, score));
    break;
  }

  // 2. Load Balance (35%)
  let load = 100;
  let sessionCount = 0, totalRES = 0, restCount = 0, consec = 0, maxConsec = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    if (sessions[ds]) {
      sessionCount++; totalRES += sessions[ds].res;
      if (sessions[ds].res > 70) { consec++; maxConsec = Math.max(maxConsec, consec); } else consec = 0;
    } else consec = 0;
    if (checkIns[ds]?.isRestDay) restCount++;
  }
  if (sessionCount === 0) {
    load = 100;
  } else {
    for (let i = 0; i < 3; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const recentSess = sessions[d.toISOString().split('T')[0]];
      if (recentSess) {
        if (recentSess.res >= 85) load -= 35; else if (recentSess.res >= 70) load -= 20;
        break;
      }
    }
    if (totalRES >= 300) load -= 30; else if (totalRES >= 240) load -= 15;
    if (maxConsec >= 3) load -= 25; else if (maxConsec >= 2) load -= 10;
    if (restCount === 0 && sessionCount >= 4) load -= 15;
    else if (restCount >= 1) load += 5;
  }
  load = Math.max(0, Math.min(100, load));

  // 3. Injury Status (30%)
  let injury = 100 - injuryAlerts.length * 25;
  if (recentSoreness >= 8) injury -= 20;
  for (let i = 0; i <= 2; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ci = checkIns[d.toISOString().split('T')[0]];
    if (!ci || ci.isRestDay) continue;
    const p = ci.painAreas?.length || 0;
    const f = ci.affectedFingers?.length || 0;
    if (p >= 3) injury -= 30; else if (p >= 2) injury -= 18; else if (p >= 1) injury -= 8;
    if (f >= 3) injury -= 20; else if (f >= 1) injury -= 10;
    break;
  }
  let fingerLoad = 0, shoulderLoad = 0, recentHighRES = false;
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const sess = sessions[d.toISOString().split('T')[0]];
    if (!sess) continue;
    if (i < 3 && sess.res >= 85) recentHighRES = true;
    sess.holdTypes?.forEach((h: string) => {
      if (h === 'crimps' || h === 'pockets') fingerLoad++;
      if (h === 'slopers') shoulderLoad++;
    });
    sess.movementTypes?.forEach((m: string) => {
      if (m === 'dynos') shoulderLoad++;
    });
  }
  if (fingerLoad >= 3) injury -= 18; else if (fingerLoad >= 2) injury -= 10; else if (fingerLoad >= 1) injury -= 5;
  if (shoulderLoad >= 3) injury -= 12; else if (shoulderLoad >= 2) injury -= 6;
  if (recentHighRES) injury -= 8;
  injury = Math.max(0, injury);

  const chi = Math.round(readiness * 0.35 + load * 0.35 + injury * 0.30);
  return { chi, readiness: Math.round(readiness), load: Math.round(load), injury: Math.round(injury) };
}

export function computeProjectReadiness({ chiData, sessions, checkIns, progressCount, progressMax, projectGrade, maxGrade }: {
  chiData: any; sessions: any; checkIns: any;
  progressCount: number; progressMax: number;
  projectGrade: string; maxGrade: string;
}) {
  if (!chiData || !projectGrade || !maxGrade) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { chi, injury } = chiData;

  // ── Health gate (always primary) ──────────────────────────────────────
  let healthDays = chi >= 80 ? 0 : chi >= 65 ? 1 : chi >= 45 ? 3 : 5;

  for (let i = 0; i <= 1; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ci = checkIns[d.toISOString().split('T')[0]];
    if (!ci || ci.isRestDay) continue;
    const fingers = ci.affectedFingers?.length || 0;
    const pain = ci.painAreas?.length || 0;
    if (fingers >= 2) healthDays += 2;
    else if (fingers >= 1) healthDays += 1;
    if (pain >= 2) healthDays += 1;
    break;
  }

  if (injury < 40) healthDays = Math.max(healthDays, 6);
  else if (injury < 60) healthDays = Math.max(healthDays, 3);

  const sortedDates = Object.keys(sessions).sort().reverse();
  if (sortedDates.length > 0) {
    const lastDate = sortedDates[0];
    const lastD = new Date(lastDate + 'T00:00:00');
    const daysSince = Math.round((today.getTime() - lastD.getTime()) / (1000 * 60 * 60 * 24));
    const lastRES = sessions[lastDate].res;
    if (daysSince <= 2 && lastRES >= 85) healthDays = Math.max(healthDays, 2);
    else if (daysSince <= 1 && lastRES >= 70) healthDays = Math.max(healthDays, 1);
  }

  healthDays = Math.min(healthDays, 14);

  // ── Progress gate — grade gap + completion rate ────────────────────────
  // Base days at 0% sends by grade gap (real-world progression timelines):
  // 1 grade: ~30 days | 2 grades: ~90 days | 3 grades: ~180 days
  // 4 grades: ~270 days | 5+ grades: ~365 days
  const gradeGap = Math.max(0, V_GRADES.indexOf(projectGrade) - V_GRADES.indexOf(maxGrade));
  const BASE_DAYS_BY_GAP = [7, 30, 90, 180, 270, 365];
  const baseDays = BASE_DAYS_BY_GAP[Math.min(gradeGap, BASE_DAYS_BY_GAP.length - 1)];

  const rate = progressMax > 0 ? Math.min(progressCount / progressMax, 1) : 0;
  const progressDays = Math.round(baseDays * (1 - rate));

  const remaining = progressMax - progressCount;
  let progressReason = '';
  if (rate >= 1.0) progressReason = 'Project sends complete';
  else if (gradeGap === 0) progressReason = `${remaining} more send${remaining !== 1 ? 's' : ''} to unlock`;
  else if (rate >= 0.7) progressReason = `Almost there — ${remaining} more send${remaining !== 1 ? 's' : ''} at this grade`;
  else if (rate >= 0.3) progressReason = `Keep logging ${projectGrade} sends — building the base`;
  else if (gradeGap >= 3) progressReason = `${projectGrade} is ${gradeGap} grades above your max — consistent training needed`;
  else progressReason = `Build volume at ${projectGrade} before a serious attempt`;

  // ── Combine — health always wins ───────────────────────────────────────
  const totalDays = Math.max(healthDays, progressDays);
  const primaryFactor: 'health' | 'progress' | 'ready' =
    totalDays === 0 ? 'ready' :
    healthDays >= progressDays ? 'health' : 'progress';

  let reason = '';
  if (primaryFactor === 'ready') reason = 'Health and progress look good — go send it!';
  else if (primaryFactor === 'health') {
    if (injury < 50) reason = 'Let your body heal before a max effort';
    else if (chi < 45) reason = 'Prioritize recovery before projecting';
    else reason = 'A few more recovery days before a project attempt';
  } else {
    reason = progressReason;
  }

  const recommendedDate = new Date(today);
  recommendedDate.setDate(recommendedDate.getDate() + totalDays);

  return { totalDays, healthDays, progressDays, primaryFactor, recommendedDate, reason, progressRate: rate, gradeGap, baseDays };
}
