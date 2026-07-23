// Pure quota arithmetic for the AI-analyst proxy. No Firebase, no I/O — the
// caller reads the doc, calls this, and commits the returned counter state.
//
// The monthly reset is implicit: if the stored period is not the current
// month, the counter is treated as zero before this reservation. That is why
// there is no cron job — the first call of a new month rolls the period.
function reserveQuota(doc, currentPeriod, cap) {
  const samePeriod = doc && doc.analystPeriod === currentPeriod;
  const priorCalls = samePeriod ? Number(doc.analystCalls) || 0 : 0;
  if (priorCalls >= cap) {
    return { allowed: false, calls: priorCalls, period: currentPeriod };
  }
  return { allowed: true, calls: priorCalls + 1, period: currentPeriod };
}

module.exports = { reserveQuota };
