import type { InputHTMLAttributes } from 'react';
import { useId } from 'react';

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
    label: string;
};

/** A labelled text input. The label is always rendered — never a bare placeholder. */
export default function Field({ label, className = '', ...rest }: FieldProps) {
    const id = useId();

    return (
        <div className="flex flex-col gap-1">
            <label htmlFor={id} className="text-xs font-medium text-slate-400">
                {label}
            </label>
            <input
                {...rest}
                id={id}
                className={`rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-sky-500 ${className}`}
            />
        </div>
    );
}
