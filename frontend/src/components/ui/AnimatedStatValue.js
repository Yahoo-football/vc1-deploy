import React, { useEffect, useState } from 'react';

const formatNumber = (value, locale) => Math.round(Number(value || 0)).toLocaleString(locale);

const formatCurrency = (value, currency = 'USD', locale) => {
  const amount = Number(value || 0);
  return amount.toLocaleString(locale, { style: 'currency', currency });
};

const AnimatedStatValue = ({ value, type = 'number', currency = 'USD', locale, className = '' }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const target = Number(value || 0);
    let frameId;
    let startTime;
    const duration = 900;

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easedProgress = 1 - (1 - progress) * (1 - progress);
      setDisplayValue(target * easedProgress);

      if (progress < 1) {
        frameId = window.requestAnimationFrame(step);
      }
    };

    setDisplayValue(0);
    frameId = window.requestAnimationFrame(step);

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, [value, type, currency, locale]);

  const formattedValue = type === 'currency' ? formatCurrency(displayValue, currency, locale) : formatNumber(displayValue, locale);

  return (
    <div className={className} data-i18n-ignore="true">
      {formattedValue}
    </div>
  );
};

export default AnimatedStatValue;
