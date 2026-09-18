import type { SelectHTMLAttributes } from 'react';
import { useId } from 'react';

type Option = {
    value: string;
    label: string;
};

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
    label: string;
    options: readonly Option[];
};

export default function Select({ label, options, className = '', ...rest }: SelectProps) {
    const id = useId();

    return (
        <div className="flex flex-col gap-1">
            <label htmlFor={id} className="text-xs font-medium text-ink-muted">
                {label}
            </label>
            <select
                {...rest}
                id={id}
                className={`rounded-lg border border-line bg-surface px-3 py-2 text-ink outline-none focus:border-gold ${className}`}
            >
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </div>
    );
}
