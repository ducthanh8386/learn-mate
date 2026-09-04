import React from 'react';

/**
 * Basic Skeleton Box with shimmer animation
 */
export const SkeletonBox = ({
  width = '100%',
  height = '20px',
  borderRadius = 'var(--radius-sm, 6px)',
  className = '',
  style = {},
}) => {
  return (
    <div
      className={`skeleton-shimmer ${className}`}
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: 'var(--bg-subtle, #f1f5f9)',
        ...style,
      }}
    />
  );
};

/**
 * Skeleton for Stats / Metric Cards
 */
export const SkeletonStats = ({ count = 4 }) => {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(220px, 1fr))`,
        gap: '16px',
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="glass-card"
          style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <SkeletonBox width="40%" height="16px" />
            <SkeletonBox width="36px" height="36px" borderRadius="50%" />
          </div>
          <SkeletonBox width="60%" height="28px" />
          <SkeletonBox width="80%" height="14px" />
        </div>
      ))}
    </div>
  );
};

/**
 * Skeleton for Table Rows
 */
export const SkeletonTable = ({ rows = 5, columns = 4 }) => {
  return (
    <div
      className="glass-card"
      style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}
    >
      <div style={{ display: 'flex', gap: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
        {Array.from({ length: columns }).map((_, colIdx) => (
          <SkeletonBox key={colIdx} width={`${100 / columns}%`} height="18px" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {Array.from({ length: columns }).map((_, colIdx) => (
            <SkeletonBox key={colIdx} width={`${100 / columns}%`} height="24px" />
          ))}
        </div>
      ))}
    </div>
  );
};

/**
 * Skeleton for Content Cards Grid
 */
export const SkeletonCardGrid = ({ count = 6 }) => {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '20px',
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="glass-card"
          style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}
        >
          <SkeletonBox width="100%" height="140px" borderRadius="var(--radius-md, 10px)" />
          <SkeletonBox width="75%" height="20px" />
          <SkeletonBox width="50%" height="16px" />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '10px' }}>
            <SkeletonBox width="30%" height="28px" borderRadius="var(--radius-sm, 6px)" />
            <SkeletonBox width="40%" height="28px" borderRadius="var(--radius-sm, 6px)" />
          </div>
        </div>
      ))}
    </div>
  );
};
