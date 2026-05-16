import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Pixel-art Button — square edges, chunky 2px borders, beveled with inset
 * highlight + drop shadow, presses down on active. Replaces the shadcn
 * default styles app-wide so every `<Button>` gets the Minecraft look.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 select-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border-2 border-[#4a7a1e] hover:bg-[#6db535] shadow-[inset_1px_1px_0_#6db535,2px_2px_0_rgba(0,0,0,0.4)]",
        destructive:
          "bg-destructive text-destructive-foreground border-2 border-[#6e0d0d] hover:bg-[#d92424] shadow-[inset_1px_1px_0_#d92424,2px_2px_0_rgba(0,0,0,0.4)]",
        outline:
          "border-2 border-border bg-background text-foreground hover:bg-accent shadow-[inset_1px_1px_0_rgba(255,255,255,0.03),2px_2px_0_rgba(0,0,0,0.3)]",
        secondary:
          "bg-secondary text-secondary-foreground border-2 border-border hover:bg-accent shadow-[inset_1px_1px_0_rgba(255,255,255,0.03),2px_2px_0_rgba(0,0,0,0.3)]",
        ghost:
          "border-2 border-transparent text-foreground hover:bg-accent hover:border-border",
        link: "text-primary underline-offset-4 hover:underline border-0 shadow-none",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, style, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        // Force square edges even if className tries to override; allow `style` overrides if explicit
        style={{ borderRadius: 0, ...style }}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
