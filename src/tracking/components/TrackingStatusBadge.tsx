import React from 'react';
import { LocationPoint, trackingStatus } from '../utils/locationUtils';
import { Chip } from '../../components/ds';

/** Төлөвийг өнгөт chip-ээр харуулна (design: төлөв бүр chip-тэй). */
export default function TrackingStatusBadge({ point, now }: { point: LocationPoint; now: number }) {
  const status = trackingStatus(point, now);
  return status === 'online'
    ? <Chip text="Онлайн" tone="ok" icon="ellipse" />
    : status === 'weak'
      ? <Chip text="Сул холболт" tone="warn" icon="ellipse" />
      : <Chip text="Офлайн" tone="muted" icon="ellipse" />;
}