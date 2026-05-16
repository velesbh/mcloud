import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Pixel-art Input — square, chunky 2px border, inset shadow, no rounding.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, style, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full border-2 border-border bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus:border-primary focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm transition-colors",
          className
        )}
        style={{
          borderRadius: 0,
          boxShadow: "inset 1px 1px 0 rgba(0,0,0,0.3)",
          ...style,
        }}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
