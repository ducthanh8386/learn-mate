import React from 'react';

/**
 * LearnMate Brand Logo Icon (Book + LM Monogram)
 */
export const LogoIcon = ({
  size = 32,
  color = 'currentColor',
  strokeWidth = 5.5,
  className = '',
  style = {},
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      {/* Outer Book Contour */}
      <path d="M 18 27 L 18 67 C 28 69, 40 73, 50 79 C 60 73, 72 69, 82 67 L 82 27" />

      {/* Top Right Book Curve */}
      <path d="M 50 33 C 60 24, 72 22, 82 27" />

      {/* Continuous Stroke: Top Left Curve down to Center Spine */}
      <path d="M 18 27 C 28 22, 40 24, 50 33 L 50 64" />

      {/* Letter L (Left Page) */}
      <path d="M 27 34 L 27 59 C 34 60, 42 63, 49 67" />

      {/* Letter M (Right Page) */}
      <path d="M 50 33 L 61.5 54 L 73 34 L 73 59" />
    </svg>
  );
};

/**
 * Complete Brand Badge (Icon + Rounded Background Box)
 */
export const LogoBadge = ({
  boxSize = 36,
  iconSize = 22,
  borderRadius = '10px',
  background = 'var(--primary-500, #6366f1)',
  iconColor = '#ffffff',
  style = {},
}) => {
  return (
    <div
      style={{
        width: `${boxSize}px`,
        height: `${boxSize}px`,
        borderRadius,
        background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 2px 8px rgba(99, 102, 241, 0.25)',
        ...style,
      }}
    >
      <LogoIcon size={iconSize} color={iconColor} />
    </div>
  );
};
