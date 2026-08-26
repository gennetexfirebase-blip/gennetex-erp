import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from './Map';
import ChatAvatar from './ChatAvatar';

const UB_REGION = {
  latitude: 47.9184,
  longitude: 106.9177,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

/**
 * Ажилтны Ирц дэлгэцийн бүтэн дэлгэцийн газрын зураг — ажлын байрны геофенс
 * (Circle) болон ажилтны одоогийн байршлыг (avatar marker) харуулна.
 *
 * `react-native-maps`-ийг шууд ашиглахгүй, `../components/Map` дундаа
 * ашигладаг wrapper-ээр л дамжина (LiveLocationScreen-тэй ижил конвенц) —
 * веб дээр автоматаар placeholder-т шилждэг.
 */
export default function EmployeeAttendanceMap({
  mapRef,
  employeeLocation,
  workplace,
  profileUri,
  profileName,
  style,
}) {
  const initialRegion = employeeLocation?.latitude != null
    ? {
        latitude: employeeLocation.latitude,
        longitude: employeeLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : UB_REGION;

  return (
    <View style={[styles.wrap, style]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion}
        showsUserLocation={false}
      >
        {workplace?.latitude != null ? (
          <Circle
            center={{ latitude: workplace.latitude, longitude: workplace.longitude }}
            radius={workplace.radius_m || 200}
            strokeWidth={0}
            fillColor="rgba(0,153,219,0.15)"
          />
        ) : null}

        {employeeLocation?.latitude != null ? (
          <Marker
            coordinate={{ latitude: employeeLocation.latitude, longitude: employeeLocation.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            title={profileName || 'Би'}
          >
            <ChatAvatar name={profileName} uri={profileUri} size={44} />
          </Marker>
        ) : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFillObject },
  map: { ...StyleSheet.absoluteFillObject },
});
