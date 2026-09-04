import React from 'react';
import { SkeletonBox, SkeletonStats, SkeletonTable } from './SkeletonLoader';

/**
 * Global Page Loading Fallback for Suspense Code-Splitting
 */
export const PageLoadingFallback = () => {
  return (
    <div
      style={{
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto',
        animation: 'fadeIn 0.2s ease-in-out',
      }}
    >
      {/* Header Skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '300px' }}>
          <SkeletonBox width="100%" height="28px" borderRadius="var(--radius-md, 8px)" />
          <SkeletonBox width="60%" height="16px" />
        </div>
        <SkeletonBox width="120px" height="38px" borderRadius="var(--radius-md, 8px)" />
      </div>

      {/* Metric Cards Skeleton */}
      <SkeletonStats count={4} />

      {/* Main Content Area Skeleton */}
      <SkeletonTable rows={4} columns={4} />
    </div>
  );
};
