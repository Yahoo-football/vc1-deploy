import React from 'react';

const base =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 ' +
  'disabled:opacity-50 disabled:pointer-events-none';

const variants = {
  primary: 'bg-green-600 text-white hover:bg-green-700',
  secondary: 'bg-green-50 text-green-800 hover:bg-green-100',
  neutral: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
  outline: 'border border-gray-300 text-gray-900 hover:bg-gray-50',
  warning: 'bg-amber-500 text-white hover:bg-amber-600',
  danger: 'bg-red-600 text-white hover:bg-red-700'
};

const sizes = {
  sm: 'h-8 px-3',
  md: 'h-10 px-4',
  lg: 'h-11 px-5'
};

const Button = React.forwardRef(
  ({ as: Comp = 'button', className = '', variant = 'primary', size = 'md', ...props }, ref) => {
    const v = variants[variant] || variants.primary;
    const s = sizes[size] || sizes.md;
    return <Comp ref={ref} className={`${base} ${v} ${s} ${className}`} {...props} />;
  }
);

Button.displayName = 'Button';

export default Button;

