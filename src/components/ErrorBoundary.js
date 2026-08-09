import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { darkColors } from '../theme/tokens';
import { reportSystemError } from '../services/alertingService';

// Апп даяарх render алдааг барьж, цагаан дэлгэц (crash)-аас сэргийлнэ.
// Theme context ажиллахгүй байх магадлалтай тул статик dark палитр ашиглав.
const c = darkColors;

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (__DEV__) {
      console.error('[ErrorBoundary]', error, info?.componentStack);
    }
    try {
      reportSystemError(error, { title: 'Render crash', context: info?.componentStack || '' });
    } catch (_) {}
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    const message = this.state.error?.message || 'Тодорхойгүй алдаа';
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>!</Text>
          </View>
          <Text style={styles.title}>Алдаа гарлаа</Text>
          <Text style={styles.sub}>
            Апп-д санамсаргүй алдаа гарлаа. Дахин оролдоно уу. Асуудал үргэлжилвэл
            аппаа бүрэн хааж дахин нээнэ үү.
          </Text>
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{message}</Text>
          </View>
          <TouchableOpacity style={styles.btn} onPress={this.handleReset} activeOpacity={0.85}>
            <Text style={styles.btnText}>Дахин оролдох</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: c.danger + '22',
    borderWidth: 1,
    borderColor: c.danger + '55',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  icon: { color: c.danger, fontSize: 38, fontWeight: '900' },
  title: { color: c.text, fontSize: 22, fontWeight: '800', marginBottom: 8 },
  sub: { color: c.textMuted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 20 },
  errorBox: {
    alignSelf: 'stretch',
    backgroundColor: c.surfaceContainerLow,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    padding: 14,
    marginBottom: 24,
  },
  errorText: { color: c.textFaint, fontSize: 12, fontFamily: 'monospace' },
  btn: {
    backgroundColor: c.primaryContainer,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
  },
  btnText: { color: c.onPrimaryContainer, fontSize: 16, fontWeight: '800' },
});
