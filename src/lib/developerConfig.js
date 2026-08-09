/** Хөгжүүлэгч / superadmin холбоо барих мэдээлэл */
export const DEVELOPER_LABEL = 'Хөгжүүлэгч';

/** .env: EXPO_PUBLIC_DEVELOPER_EMAIL — жинхэнэ Gmail/имэйлээ оруулна */
export const DEVELOPER_EMAIL =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_DEVELOPER_EMAIL?.trim()) || '';

/** Мэдээ хүлээн авах имэйл */
export const SUPERADMIN_EMAIL = DEVELOPER_EMAIL;

export const HAS_DEVELOPER_EMAIL = Boolean(DEVELOPER_EMAIL);
