import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useApp } from '../context/AppContext';
import { Card, Button, Field } from './ui';
import { spacing } from '../theme';
import { useStyles } from '../context/ThemeContext';

// Профайл байхгүй үед нэрээ оруулах карт
export default function ProfileSetup({ title = 'Та хэн бэ?'}) {
  const { saveProfile } = useApp();
  const [name, setName] = useState('');
  const styles = useStyles(makeStyles);

  return (
    <View style={styles.wrap}>
      <Card>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>
          Ирц болон чат ашиглахын тулд нэрээ оруулна уу.
        </Text>
        <Field
          label="Таны нэр"
          placeholder="Таны нэр"
          value={name}
          onChangeText={setName}
        />
        <Button
          title="Хадгалах"
          onPress={() => name.trim() && saveProfile(name)}
        />
      </Card>
    </View>
  );
}

const makeStyles = ({ colors }) => StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  title: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: spacing.xs },
  sub: { color: colors.textMuted, marginBottom: spacing.lg },
});
