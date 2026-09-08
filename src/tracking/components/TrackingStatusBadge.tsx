import React from 'react';
import { Text } from 'react-native';
import { LocationPoint, trackingStatus } from '../utils/locationUtils';
export default function TrackingStatusBadge({ point, now }: { point: LocationPoint; now: number }) {
  const status = trackingStatus(point, now);
  return <Text style={{ color: status === 'online' ? '#16a34a' : status === 'weak' ? '#ca8a04' : '#64748b', fontWeight: '700' }}>
    ● {status === 'online' ? 'Online' : status === 'weak' ? 'Weak connection' : 'Offline'}</Text>;
}
