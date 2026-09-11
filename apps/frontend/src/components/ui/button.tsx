import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'ghost';
    children: ReactNode;
};

const VARIANTS: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary: 'bg-sky-500 text-slate-950 hover:bg-sky-400 disabled:bg-slate-700',
    ghost: 'border border-slate-700 text-slate-200 hover:border-slate-500',
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
            className={`rounded-lg px-4 py-2 font-semibold transition disabled:cursor-not-allowed disabled:text-slate-400 ${VARIANTS[variant]} ${className}`}
        >
            {children}
        </button>
    );
}
