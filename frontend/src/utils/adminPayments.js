const toUsdAmount = (value) => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
};

const monthKeyForDate = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const monthLabelForDate = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleDateString(undefined, { month: 'short' });
};

export const formatUsd = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(toUsdAmount(value));

export const buildPaymentSummary = (requests = []) => {
  return requests.reduce(
    (summary, request) => {
      const amount = toUsdAmount(request?.feeAmountUsd);
      summary.totalAmount += amount;
      summary.totalCount += 1;

      if (request?.status === 'approved') {
        summary.approvedAmount += amount;
        summary.approvedCount += 1;
      } else if (request?.status === 'rejected') {
        summary.rejectedAmount += amount;
        summary.rejectedCount += 1;
      } else {
        summary.pendingAmount += amount;
        summary.pendingCount += 1;
      }

      if (request?.paymentStatus === 'paid') {
        summary.paidCount += 1;
      }

      return summary;
    },
    {
      totalAmount: 0,
      totalCount: 0,
      approvedAmount: 0,
      approvedCount: 0,
      pendingAmount: 0,
      pendingCount: 0,
      rejectedAmount: 0,
      rejectedCount: 0,
      paidCount: 0
    }
  );
};

export const buildPaymentTimeline = (requests = [], months = 6) => {
  const end = new Date();
  const buckets = [];

  for (let index = months - 1; index >= 0; index -= 1) {
    const date = new Date(end.getFullYear(), end.getMonth() - index, 1);
    buckets.push({
      key: monthKeyForDate(date),
      label: monthLabelForDate(date),
      approvedAmount: 0,
      pendingAmount: 0,
      rejectedAmount: 0,
      requestCount: 0
    });
  }

  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  requests.forEach((request) => {
    const key = monthKeyForDate(request?.createdAt);
    const bucket = bucketMap.get(key);
    if (!bucket) return;

    const amount = toUsdAmount(request?.feeAmountUsd);
    bucket.requestCount += 1;

    if (request?.status === 'approved') {
      bucket.approvedAmount += amount;
    } else if (request?.status === 'rejected') {
      bucket.rejectedAmount += amount;
    } else {
      bucket.pendingAmount += amount;
    }
  });

  return buckets;
};

export const buildPaymentRoleBreakdown = (requests = []) => {
  const entries = new Map();

  requests.forEach((request) => {
    const roleKey = request?.requestedRole || 'unknown';
    const current = entries.get(roleKey) || { role: roleKey, amount: 0, count: 0 };
    current.amount += toUsdAmount(request?.feeAmountUsd);
    current.count += 1;
    entries.set(roleKey, current);
  });

  return [...entries.values()].sort((first, second) => second.amount - first.amount);
};

export const getPaymentStatusPercentages = (summary) => {
  const total = summary?.totalAmount || 0;
  if (!total) {
    return {
      approved: 0,
      pending: 0,
      rejected: 0
    };
  }

  return {
    approved: (summary.approvedAmount / total) * 100,
    pending: (summary.pendingAmount / total) * 100,
    rejected: (summary.rejectedAmount / total) * 100
  };
};
