import React from 'react';

const tones = {
  gray: 'bg-gray-100 text-gray-800',
  green: 'bg-green-100 text-green-800',
  blue: 'bg-blue-100 text-blue-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  red: 'bg-red-100 text-red-800',
  purple: 'bg-purple-100 text-purple-800'
};

// Support badge for this module.
const Badge = ({ children, tone = 'gray', className = '' }) => {
  const t = tones[tone] || tones.gray;
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-3 py-1 text-[11px] sm:text-xs font-semibold leading-none ${t} ${className}`}
    >
      {children}
    </span>
  );
};

export default Badge;

