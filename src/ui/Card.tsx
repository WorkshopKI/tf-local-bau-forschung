interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Card({ title, children, className = '' }: CardProps): React.ReactElement {
  return (
    <div className={`bg-[var(--tf-bg)] rounded-[var(--tf-radius-lg)] p-[18px] ${className}`}
      style={{ border: '0.5px solid var(--tf-border)' }}>
      {title && (
        <div className="mb-4">
          <h3 className="text-[14px] font-medium text-[var(--tf-text)]">{title}</h3>
        </div>
      )}
      {children}
    </div>
  );
}
