import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { useEffect, useId, type ButtonHTMLAttributes, type ReactNode } from 'react'
import s from './ui.module.css'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'ghost' | 'danger'
  size?: 'md' | 'sm'
  tip?: string
  side?: 'top' | 'bottom' | 'left' | 'right'
}

export function Button({ variant = 'default', size = 'md', tip, side, className, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      data-tip={tip}
      data-side={side}
      className={cx(s.btn, tip && s.tip, variant !== 'default' && s[variant], size === 'sm' && s.sm, className)}
    />
  )
}

export function IconButton({
  tip,
  side,
  active,
  small,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tip?: string; side?: 'top' | 'bottom' | 'left' | 'right'; active?: boolean; small?: boolean }) {
  return (
    <button
      {...rest}
      aria-label={rest['aria-label'] ?? tip}
      aria-pressed={active}
      data-tip={tip}
      data-side={side}
      data-active={active ? 'true' : undefined}
      className={cx(s.icon, s.tip, small && s.iconSm, className)}
    />
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size,
  full,
}: {
  value: T
  options: { value: T; label: ReactNode; tip?: string }[]
  onChange: (v: T) => void
  size?: 'sm'
  /** stretch to the container width, items share it equally */
  full?: boolean
}) {
  const id = useId()
  return (
    <div className={cx(s.seg, full && s.segFull)} role="radiogroup" style={size === 'sm' ? { transform: 'scale(0.96)' } : undefined}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          data-on={o.value === value}
          data-tip={o.tip}
          className={cx(s.segItem, o.tip && s.tip)}
          onClick={() => onChange(o.value)}
        >
          {o.value === value && (
            <motion.span layoutId={`seg-${id}`} className={s.segPill} transition={{ type: 'spring', stiffness: 520, damping: 38 }} />
          )}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  format = (v) => v.toFixed(2),
  onReset,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  format?: (v: number) => string
  onReset?: () => void
}) {
  const p = ((value - min) / (max - min)) * 100
  return (
    <label className={s.sliderRow} onDoubleClick={onReset} title={onReset ? 'Double-click to reset' : undefined}>
      <span className={s.sliderLabel}>{label}</span>
      <span className={cx(s.sliderVal, 'num')}>{format(value)}</span>
      <input
        className={s.slider}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ ['--p' as string]: `${p}%` }}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </label>
  )
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} data-on={on} className={s.switch} onClick={() => onChange(!on)} />
  )
}

export function Badge({ children, color, style, tip }: { children: ReactNode; color?: string; style?: React.CSSProperties; tip?: string }) {
  return (
    <span
      className={cx(s.badge, tip && s.tip)}
      data-tip={tip}
      style={{ ...(color ? { color, boxShadow: `inset 0 0 0 1px ${color}55`, background: `${color}14` } : null), ...style }}
    >
      {children}
    </span>
  )
}

export const Kbd = ({ children }: { children: ReactNode }) => <kbd className={s.kbd}>{children}</kbd>

export const Dot = ({ color, pulse }: { color: string; pulse?: boolean }) => (
  <span className={cx(s.dot, pulse && s.pulse)} style={{ background: color, color }} />
)

export function Section({ title, action, children, flush }: { title: ReactNode; action?: ReactNode; children: ReactNode; flush?: boolean }) {
  return (
    <section className={s.section} style={flush ? { paddingBottom: 6 } : undefined}>
      <div className={s.sectionHead}>
        <span className={s.sectionTitle}>{title}</span>
        {action}
      </div>
      {children}
    </section>
  )
}

/** Monospace number that counts toward its target on a spring (s9: waiting = progress). */
export function Ticker({ value, format = (v) => v.toFixed(0), className, style }: { value: number; format?: (v: number) => string; className?: string; style?: React.CSSProperties }) {
  const reduce = useReducedMotion()
  const mv = useMotionValue(value)
  const text = useTransform(mv, (v) => format(v))
  useEffect(() => {
    if (reduce) {
      mv.set(value)
      return
    }
    const c = animate(mv, value, { type: 'spring', stiffness: 90, damping: 20, restDelta: 0.0005 })
    return () => c.stop()
  }, [value, reduce, mv])
  return (
    <motion.span className={cx('num', className)} style={style}>
      {text}
    </motion.span>
  )
}

export function Ring({ value, size = 18, stroke = 2.4, color = 'var(--accent)', track = 'var(--bg-active)' }: { value: number; size?: number; stroke?: number; color?: string; track?: string }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} className={s.ring} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))}
        style={{ transition: 'stroke-dashoffset 240ms var(--ease)' }}
      />
    </svg>
  )
}

export { s as uiStyles }
