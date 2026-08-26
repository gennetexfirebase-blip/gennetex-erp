import React from 'react';
import { View, Text, Platform, StyleSheet } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from '../components/Map';
import { ScreenHeader } from '../components/ui';
import { colors } from '../theme/attendanceDark';
import { spacing } from '../theme';

export default function MapDetailScreen() {
  const route = useRoute();
  const {
    latitude,
    longitude,
    employeeName,
    timestamp,
    distanceM,
    workplace, // { latitude, longitude, radius_m, name }
  } = route.params || {};

  const region = { latitude, longitude, latitudeDelta: 0.006, longitudeDelta: 0.006 };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScreenHeader title="Ажилтны байршил" />
      <View style={{ flex: 1 }}>
        <MapView
          style={StyleSheet.absoluteFillObject}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={region}
        >
          {latitude != null ? <Marker coordinate={{ latitude, longitude }} title={employeeName} /> : null}
          {workplace?.latitude != null ? (
            <>
              <Marker
                coordinate={{ latitude: workplace.latitude, longitude: workplace.longitude }}
                title={workplace.name}
                pinColor="green"
              />
              <Circle
                center={{ latitude: workplace.latitude, longitude: workplace.longitude }}
                radius={workplace.radius_m || 200}
                strokeWidth={0}
                fillColor="rgba(63,207,142,0.2)"
              />
            </>
          ) : null}
        </MapView>

        <View style={[styles.card, { backgroundColor: colors.surfaceContainer }]}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>{employeeName}</Text>
          {timestamp ? (
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
              {new Date(timestamp).toLocaleString('mn-MN')}
            </Text>
          ) : null}
          {distanceM != null ? (
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
              Ажлын байрнаас {distanceM}м
            </Text>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    borderRadius: 18,
    padding: spacing.lg,
  },
});
