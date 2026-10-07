import { Alert, Linking } from 'react-native';

export const LEGAL_LINKS = [
  { key: 'privacy', title: 'Нууцлалын бодлого', url: 'https://gennetex.com/privacy' },
  { key: 'terms', title: 'Үйлчилгээний нөхцөл', url: 'https://gennetex.com/terms' },
  { key: 'delete-account', title: 'Бүртгэл устгах заавар', url: 'https://gennetex.com/delete-account' },
];

export async function openLegalLink(link) {
  try {
    await Linking.openURL(link.url);
  } catch {
    Alert.alert('Холбоос нээгдсэнгүй', `Интернет холболтоо шалгаад дахин оролдоно уу. Хөтчөөр энэ хаягийг нээж болно:\n\n${link.url}`);
  }
}
