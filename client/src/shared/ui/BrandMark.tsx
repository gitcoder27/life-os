type BrandMarkProps = {
  className?: string;
  alt?: string;
};

export const BrandMark = ({ className = "", alt = "Life OS logo" }: BrandMarkProps) => {
  const resolvedClassName = className ? `brand-mark ${className}` : "brand-mark";

  return (
    <img
      className={resolvedClassName}
      src="/life-os-logo.png"
      alt={alt}
      width={1280}
      height={1280}
      loading="eager"
      decoding="async"
    />
  );
};
