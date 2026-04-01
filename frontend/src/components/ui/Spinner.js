import React from 'react';

// Support spinner for this module.
const Spinner = ({ className = '' }) => (
  <div className={`animate-spin rounded-full border-2 border-gray-200 border-t-green-600 ${className}`} />
);

export default Spinner;

