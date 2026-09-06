import * as React from "react";

/**
 * 3D glass button — milky white interior, faint seafoam/dusty-blue rim.
 * This project has no Tailwind and no class-variance-authority, so the
 * variants are plain class names and every visual is in app/a2.css under
 * .glass-button-wrap / .glass-button / .glass-button-text /
 * .glass-button-shadow. The component API (children, size, contentClassName,
 * all button props, forwarded ref) matches the original.
 */
function cn(...inputs: (string | undefined | null | false)[]): string {
  return inputs.filter(Boolean).join(" ");
}

export type GlassButtonSize = "default" | "sm" | "lg" | "icon";

export interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: GlassButtonSize;
  contentClassName?: string;
}

const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, children, size = "default", contentClassName, ...props }, ref) => (
    <div className={cn("glass-button-wrap", className)}>
      <button className={cn("glass-button", `glass-button-${size}`)} ref={ref} {...props}>
        <span className={cn("glass-button-text", `glass-button-text-${size}`, contentClassName)}>
          {children}
        </span>
      </button>
      <div className="glass-button-shadow" />
    </div>
  ),
);
GlassButton.displayName = "GlassButton";

export { GlassButton };
