import React, { useEffect, useMemo, useRef, useState } from 'react';

const prefersReducedMotion = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

const ScrollReveal = ({
  as: Component = 'div',
  children,
  className = '',
  delay = 0,
  once = true,
  rootMargin = '0px 0px -12% 0px',
  style,
  threshold = 0.18,
  variant = 'up',
  ...props
}) => {
  const elementRef = useRef(null);
  const [isVisible, setIsVisible] = useState(() => prefersReducedMotion());

  useEffect(() => {
    const node = elementRef.current;

    if (!node) {
      return undefined;
    }

    if (prefersReducedMotion() || typeof IntersectionObserver !== 'function') {
      setIsVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);

          if (once) {
            observer.unobserve(node);
          }
          return;
        }

        if (!once) {
          setIsVisible(false);
        }
      },
      { rootMargin, threshold }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [once, rootMargin, threshold]);

  const mergedStyle = useMemo(
    () => ({
      ...style,
      '--scroll-reveal-delay': `${delay}ms`
    }),
    [delay, style]
  );

  return (
    <Component
      ref={elementRef}
      className={[
        'scroll-reveal',
        `scroll-reveal--${variant}`,
        isVisible ? 'is-visible' : '',
        className
      ]
        .filter(Boolean)
        .join(' ')}
      style={mergedStyle}
      {...props}
    >
      {children}
    </Component>
  );
};

export default ScrollReveal;
