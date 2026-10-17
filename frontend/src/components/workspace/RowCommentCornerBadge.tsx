import React from "react";

export interface RowCommentCornerBadgeProps {
  comments?: any[];
  count?: number;
  id?: string | number;
  onClick: (e: React.MouseEvent) => void;
  title?: string;
  className?: string;
  position?: "left" | "right";
}

/**
 * Modern curved purple corner comment indicator matching Ventilation and Preliminary Cooling Load.
 * Designed to be placed inside a relative container (e.g., table row number cell or card corner).
 * By default positioned on the top-left corner ("left").
 */
export function RowCommentCornerBadge({
  comments,
  count,
  id = "badge",
  onClick,
  title,
  className = "",
  position = "left",
}: RowCommentCornerBadgeProps) {
  const commentCount = count !== undefined ? count : (Array.isArray(comments) ? comments.length : 0);
  if (commentCount <= 0) return null;

  const cleanId = String(id).replace(/[^a-zA-Z0-9_-]/g, "_");
  const isLeft = position === "left";

  return (
    <button
      type="button"
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      title={title || `${commentCount} comment(s)/task(s) assigned. Click to view.`}
      className={`absolute top-0 ${isLeft ? "left-0 justify-start" : "right-0 justify-end"} w-5 h-5 flex items-start p-0 cursor-pointer z-20 hover:scale-125 active:scale-95 transition-all duration-150 focus:outline-none group/comment-mark pointer-events-auto ${className}`}
    >
      <svg width="13" height="13" viewBox="0 0 10 10" className="overflow-visible drop-shadow-[0_1px_2px_rgba(99,102,241,0.35)]">
        <defs>
          <linearGradient id={`commentCornerGrad-${cleanId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
        <path
          d={isLeft ? "M 10 0 H 0 V 10 C 0 5.5 4.5 0 10 0 Z" : "M 0 0 H 10 V 10 C 10 5.5 5.5 0 0 0 Z"}
          fill={`url(#commentCornerGrad-${cleanId})`}
          className="group-hover/comment-mark:opacity-90 transition-opacity"
        />
      </svg>
    </button>
  );
}
