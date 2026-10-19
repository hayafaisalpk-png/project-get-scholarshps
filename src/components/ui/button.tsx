import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

/**
 * Button.
 *
 * Renders a real `<button>`, or a `<Link>` when `href` is supplied. A styled
 * `<div onClick>` would be unreachable by keyboard and invisible to assistive
 * technology, so the element is always chosen to match the behaviour.
 */

export type ButtonVariant =
  | 'primary'
  | 'brand'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'

export type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANTS: Record<ButtonVariant, string> = {
  // The reference fills buttons with the primary itself (500) and only
  // darkens on hover; it does not start on a darker step.
  primary:
    'bg-navy text-white hover:bg-navy/90 active:bg-navy/80 shadow-xs',
  brand:
    'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-xs',
  secondary:
    'bg-accent-600 text-white hover:bg-accent-700 active:bg-accent-800 shadow-xs',
  outline:
    'border border-ink-200 bg-white text-ink-800 hover:bg-ink-50 hover:border-ink-300 active:bg-ink-100',
  ghost: 'text-ink-700 hover:bg-ink-100 active:bg-ink-200',
  danger: 'bg-red-700 text-white hover:bg-red-800 active:bg-red-900',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5',
  md: 'h-11 px-5 text-sm gap-2',
  lg: 'h-13 px-7 text-base gap-2.5',
}

const BASE =
  // `rounded-md` (8px) for controls: the reference uses 8px on buttons and
  // 4px on surfaces. See the radii note in globals.css.
  'inline-flex items-center justify-center rounded-md font-normal transition-colors duration-200 ' +
  'disabled:pointer-events-none disabled:opacity-55 select-none whitespace-nowrap'

export function buttonClasses({
  variant = 'primary',
  size = 'md',
  className,
}: {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
} = {}): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], className)
}

type ButtonProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  children: ReactNode
}

export function Button({
  variant,
  size,
  className,
  children,
  ...props
}: ButtonProps & ComponentProps<'button'>) {
  return (
    <button className={buttonClasses({ variant, size, className })} {...props}>
      {children}
    </button>
  )
}

export function ButtonLink({
  variant,
  size,
  className,
  children,
  ...props
}: ButtonProps & ComponentProps<typeof Link>) {
  return (
    <Link
      className={buttonClasses({ variant, size, className })}
      {...props}
    >
      {children}
    </Link>
  )
}

/**
 * Button styling for an external link.
 *
 * External links get `rel="noopener noreferrer"` so the opened page cannot
 * reach back through `window.opener`.
 */
export function ButtonExternal({
  variant,
  size,
  className,
  children,
  ...props
}: ButtonProps & ComponentProps<'a'>) {
  return (
    <a
      className={buttonClasses({ variant, size, className })}
      rel="noopener noreferrer sponsored"
      {...props}
    >
      {children}
    </a>
  )
}
