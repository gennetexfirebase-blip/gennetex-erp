// Admin "Ирц" модулийн ФИКСЛЭГДСЭН dark palette.
//
// Яагаад тусдаа файл: хэрэглэгчийн апп даяарх Dark/Light/System сонголт
// (`ThemeContext`) хувийн тохиргоо хэвээрээ үлдэнэ, гэхдээ Admin-ийн Ирц
// дэлгэцүүд ямагт dark байх ёстой (reference screenshot-ийн загвар). Тиймээс
// эндээс шууд импортолж ашиглана, `useTheme()`-ээр ДАМЖУУЛАХГҮЙ.
//
// Утгуудаа шинээр зохиохгүй, `theme/tokens.js`-ийн `darkColors`/`brand`-аас
// шууд авна — цорын ганц ялгаа нь энд `primary`-г цэвэр брэнд өнгө
// (`brand[500] = #0099DB`) болгож тогтмолжуулсан (админ reference зураг дээрх
// цэнхэр өнгөтэй нэгддэг тул тусад нь өөр цэнхэр зохиох шаардлагагүй).
import { brand, darkColors, makeGradients, makeShadow } from './tokens';

export const colors = {
  ...darkColors,
  primary: brand[500],
  primaryDark: brand[600],
};

export const gradients = makeGradients(colors);
export const shadow = makeShadow(colors, true);
export const isDark = true;

export default { colors, gradients, shadow, isDark };
