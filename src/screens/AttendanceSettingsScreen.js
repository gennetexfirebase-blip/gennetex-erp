import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader, ListGroup, ListRow, GroupLabel } from '../components/ui';
import { colors } from '../theme/attendanceDark';
import { spacing } from '../theme';

/** Admin Ирц модулийн тохиргооны төв — Байршил/Wi-Fi/Алба хэлтэс/Мэдэгдэл/Илгээсэн байршил. */
export default function AttendanceSettingsScreen({ navigation }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScreenHeader title="Ирцийн тохиргоо" />
      <View style={{ padding: spacing.lg }}>
        <GroupLabel>Байгууллагын тохиргоо</GroupLabel>
        <ListGroup>
          <ListRow icon="📍" label="Байршил" onPress={() => navigation.navigate('AttendanceLocations')} />
          <ListRow icon="📶" label="Wi-Fi" onPress={() => navigation.navigate('AttendanceWifi')} />
          <ListRow icon="🏢" label="Алба хэлтэс" onPress={() => navigation.navigate('Departments')} />
        </ListGroup>

        <GroupLabel>Байгууллагын дотоод цэс</GroupLabel>
        <ListGroup>
          <ListRow icon="📤" label="Илгээсэн байршил" onPress={() => navigation.navigate('AttendanceLocationSubmissions')} />
          <ListRow icon="🔔" label="Мэдэгдэл илгээх" onPress={() => navigation.navigate('AttendanceNotificationComposer')} />
        </ListGroup>
      </View>
    </SafeAreaView>
  );
}
