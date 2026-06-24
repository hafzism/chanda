import Link from 'next/link';

interface BrandProps {
  compact?: boolean;
}

export function Brand({ compact = false }: BrandProps) {
  return (
    <Link className="brand" href="/" aria-label="Suppline AI home">
      <span className="brand-mark" aria-hidden="true" />
      {!compact && <span>Suppline AI</span>}
    </Link>
  );
}
