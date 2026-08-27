import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from './Map';
import ChatAvatar from './ChatAvatar';

const UB_REGION = {
  latitude: 47.9184,
  longitude: 106.9177,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

/**
 * Ажилтны Ирц дэлгэцийн бүтэн дэлгэцийн газрын зураг.
 *
 * ⚠️ БҮХ идэвхтэй геофенс цэгийг харуулна — өмнө нь зөвхөн нэгийг
 * (хамгийн ойрхон эсвэл хуваарийнхыг) зурдаг байсан тул ажилтан бусад
 * цэг дээр ч бүртгүүлж болохоо мэдэхгүй байв.
 *
 * `activeId` (хуваарийн эсвэл хамгийн ойр цэг) нь илүү тод, бусад нь
 * бүдэг харагдана.
 */
export default function EmployeeAttendanceMap({
  mapRef,
  employeeLocation,
  workplace,
  locations = [],
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
    : workplace?.latitude != null
      ? {
          latitude: workplace.latitude,
          longitude: workplace.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }
      : UB_REGION;

  // `locations` өгөгдөөгүй хуучин дуудлагыг ч ажиллуулна.
  const points = locations.length
    ? locations
    : workplace?.latitude != null
      ? [workplace]
      : [];

  return (
    <View style={[styles.wrap, style]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion}
        showsUserLocation={false}
      >
        {points.map((loc) => {
          if (loc?.latitude == null) return null;
          const isActive = workplace?.id ? loc.id === workplace.id : true;
          return (
            <React.Fragment key={loc.id || `${loc.latitude},${loc.longitude}`}>
              <Circle
                center={{ latitude: Number(loc.latitude), longitude: Number(loc.longitude) }}
                radius={loc.radius_m || 200}
                strokeWidth={isActive ? 2 : 1}
                strokeColor={isActive ? 'rgba(0,153,219,0.55)' : 'rgba(0,153,219,0.28)'}
                fillColor={isActive ? 'rgba(0,153,219,0.16)' : 'rgba(0,153,219,0.07)'}
              />
              <Marker
                coordinate={{ latitude: Number(loc.latitude), longitude: Number(loc.longitude) }}
                title={loc.name}
                description={`Радиус: ${loc.radius_m || 200}м`}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
              >
                <View style={[styles.pin, !isActive && styles.pinDim]}>
                  <Text style={styles.pinText} numberOfLines={1}>
                    {loc.name}
                  </Text>
                </View>
              </Marker>
            </React.Fragment>
          );
        })}

        {employeeLocation?.latitude != null ? (
          <Marker
            coordinate={{
              latitude: employeeLocation.latitude,
              longitude: employeeLocation.longitude,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            title={profileName || 'Би'}
            tracksViewChanges={false}
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
  pin: {
    backgroundColor: '#0099db',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
    maxWidth: 130,
  },
  pinDim: { backgroundColor: 'rgba(0,153,219,0.65)' },
  pinText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
