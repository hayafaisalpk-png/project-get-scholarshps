import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

/**
 * Layout primitives.
 *
 * `Section` owns the vertical rhythm and the optional heading block so every
 * page has a consistent heading hierarchy — which matters for both screen
 * readers and SEO, since these headings are how the page is summarised.
 */

export function Container({
  className,
  ...props
}: ComponentProps<'div'>) {
  return <div className={cn('container-page', className)} {...props} />
}

export function Section({
  id,
  className,
  children,
  ...props
}: ComponentProps<'section'>) {
  return (
    <section id={id} className={cn('py-12 sm:py-16', className)} {...props}>
      {children}
    </section>
  )
}

export function SectionHeading({
  title,
  description,
  action,
  as: Heading = 'h2',
  id,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  /** Choose the level to keep heading order correct on the page. */
  as?: 'h1' | 'h2' | 'h3'
  id?: string
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <Heading
          id={id}
          className="text-2xl font-bold text-ink-900 sm:text-3xl"
        >
          {title}
        </Heading>
        {description ? (
          <p className="mt-2 text-base text-ink-600">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export function Prose({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('prose-editorial', className)} {...props} />
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only-focusable">{children}</span>
}
