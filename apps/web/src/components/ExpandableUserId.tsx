import { useState } from 'react';

export function formatUserIdShort(userId: string, expanded: boolean): string {
  if (expanded || userId.length <= 10) return userId;
  return `${userId.slice(0, 10)}…`;
}

export function ExpandableUserId({
  userId,
  className,
}: {
  userId: string;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = userId.length > 10;

  return (
    <button
      type="button"
      className={`expandable-user-id${expanded ? ' expandable-user-id--expanded' : ''}${className ? ` ${className}` : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        if (canExpand) setExpanded((v) => !v);
      }}
      disabled={!canExpand}
      aria-expanded={expanded}
    >
      {formatUserIdShort(userId, expanded)}
    </button>
  );
}
