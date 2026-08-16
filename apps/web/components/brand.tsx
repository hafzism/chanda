import Link from 'next/link';

import { PRODUCT_NAME } from '../lib/product';

interface BrandProps {
  compact?: boolean;
}

export function Brand({ compact = false }: BrandProps) {
  return (
    <Link className="brand" href="/" aria-label={`${PRODUCT_NAME} home`}>
      <span className="brand-mark" aria-hidden="true" />
      {!compact && <span>{PRODUCT_NAME}</span>}
    </Link>
  );
}
