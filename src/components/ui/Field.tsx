import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./Icon";

/*
 * حقل الإدخال: التسمية ظاهرة دائما فوق الحقل، والتركيز إطار ذهبي بهالة 3 بكسل،
 * والخطأ حد danger-500 واهتزاز ورسالة نصية مربوطة بـ aria-describedby.
 */
interface FieldShellProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  icon?: IconName;
  /** عنصر في نهاية الحقل (زر إظهار كلمة المرور مثلا). */
  trailing?: ReactNode;
  className?: string;
}

function FieldShell({
  id, label, hint, error, required, icon, trailing, className, children,
}: FieldShellProps & { id: string; children: ReactNode }) {
  return (
    <div className={cn("nz-field", error && "nz-field--error", className)}>
      {label && (
        <label className="nz-field__label" htmlFor={id}>
          {label}
          {required && <span className="nz-req" aria-hidden>*</span>}
        </label>
      )}
      <div className="nz-field__box">
        {icon && <Icon name={icon} size={20} label={false} />}
        {children}
        {trailing}
      </div>
      {error ? (
        <p className="nz-field__msg" id={`${id}-msg`} role="alert">{error}</p>
      ) : hint ? (
        <p className="nz-field__hint" id={`${id}-msg`}>{hint}</p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, error?: string | null, hint?: ReactNode) {
  return error || hint ? `${id}-msg` : undefined;
}

export interface InputProps extends FieldShellProps, Omit<InputHTMLAttributes<HTMLInputElement>, "className"> {
  inputClassName?: string;
}

export function Input({ label, hint, error, icon, trailing, className, inputClassName, id, required, ...rest }: InputProps) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldShell id={fid} label={label} hint={hint} error={error} required={required} icon={icon} trailing={trailing} className={className}>
      <input
        id={fid}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fid, error, hint)}
        className={inputClassName}
        {...rest}
      />
    </FieldShell>
  );
}

export interface SelectProps extends FieldShellProps, Omit<SelectHTMLAttributes<HTMLSelectElement>, "className"> {}

export function Select({ label, hint, error, icon, className, id, required, children, ...rest }: SelectProps) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldShell id={fid} label={label} hint={hint} error={error} required={required} icon={icon} className={className}>
      <select
        id={fid}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fid, error, hint)}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
}

export interface TextareaProps extends FieldShellProps, Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> {}

export function Textarea({ label, hint, error, className, id, required, ...rest }: TextareaProps) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldShell id={fid} label={label} hint={hint} error={error} required={required} className={className}>
      <textarea
        id={fid}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fid, error, hint)}
        {...rest}
      />
    </FieldShell>
  );
}
