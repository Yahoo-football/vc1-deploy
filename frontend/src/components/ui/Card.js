import React from 'react';

// Support card for this module.
const Card = ({ className = '', children }) => (
  <div className={`rounded-[24px] border border-slate-200 bg-white shadow-sm shadow-slate-200/50 ${className}`}>{children}</div>
);

export const CardHeader = ({ className = '', children }) => (
  <div className={`border-b border-slate-200 bg-white/90 px-6 py-5 ${className}`}>{children}</div>
);

export const CardBody = ({ className = '', children }) => <div className={`p-6 ${className}`}>{children}</div>;

export default Card;

