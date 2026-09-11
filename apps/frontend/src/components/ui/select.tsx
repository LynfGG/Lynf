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
            <label htmlFor={id} className="text-xs font-medium text-slate-400">
                {label}
            </label>
            <select
                {...rest}
                id={id}
                className={`rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-sky-500 ${className}`}
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
