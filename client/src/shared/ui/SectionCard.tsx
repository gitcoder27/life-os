import type { PropsWithChildren } from "react";

type SectionCardProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  className?: string;
}>;

export function SectionCard({
  children,
  className,
  title,
  subtitle,
}: SectionCardProps) {
  return (
    <section className={className ? `section-card ${className}` : "section-card"}>
      <div className="section-card__header">
        <h2 className="section-card__title">{title}</h2>
        {subtitle ? (
          <p className="section-card__subtitle">{subtitle}</p>
        ) : null}
      </div>
      <div className="section-card__body">{children}</div>
    </section>
  );
}
