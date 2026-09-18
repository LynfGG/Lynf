import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'ghost';
    children: ReactNode;
};

const VARIANTS: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary: 'bg-gold text-ground hover:brightness-110 disabled:bg-surface-raised',
    ghost: 'border border-line text-ink hover:border-ink-muted',
};

export default function Button({
    variant = 'primary',
    className = '',
    children,
    ...rest
}: ButtonProps) {
    return (
        <button
            {...rest}
            className={`rounded-lg px-4 py-2 font-semibold transition disabled:cursor-not-allowed disabled:text-ink-muted ${VARIANTS[variant]} ${className}`}
        >
            {children}
        </button>
    );
}
