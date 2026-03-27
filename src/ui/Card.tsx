interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Card({ title, children, className = '' }: CardProps): React.ReactElement {
  return (
    <div className={`bg-[var(--tf-bg)] border border-[var(--tf-border)] rounded-[var(--tf-radius)] ${className}`}>
      {title && (
        <div className="px-6 py-4 border-b border-[var(--tf-border)]">
          <h3 className="text-base font-semibold text-[var(--tf-text)]">{title}</h3>
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}
