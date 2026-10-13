/**
 * `@expo/vector-icons` → дизайны Lucide icon (DESIGN_HANDOFF §2: «UI icon:
 * Lucide, stroke 1.9»).
 *
 * metro.config.js нь апп доторх бүх `@expo/vector-icons` импортыг энэ файл
 * руу чиглүүлнэ. `Ionicons`-ийн нэрийг тохирох Lucide icon-оор зурна; жагсаалтад
 * байхгүй нэр (logo-apple г.м) жинхэнэ Ionicons хэвээр. Бусад багц
 * (MaterialCommunityIcons…) өөрчлөгдөхгүй.
 */
import React from 'react';
import { Ionicons as RealIonicons } from '@expo/vector-icons';

import Activity from 'lucide-react-native/icons/activity';
import AlarmClock from 'lucide-react-native/icons/alarm-clock';
import Archive from 'lucide-react-native/icons/archive';
import ArrowDown from 'lucide-react-native/icons/arrow-down';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import ArrowLeftRight from 'lucide-react-native/icons/arrow-left-right';
import ArrowRight from 'lucide-react-native/icons/arrow-right';
import ArrowUp from 'lucide-react-native/icons/arrow-up';
import Banknote from 'lucide-react-native/icons/banknote';
import Bed from 'lucide-react-native/icons/bed';
import Bell from 'lucide-react-native/icons/bell';
import Box from 'lucide-react-native/icons/box';
import Briefcase from 'lucide-react-native/icons/briefcase';
import Building from 'lucide-react-native/icons/building';
import Calendar from 'lucide-react-native/icons/calendar';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import Camera from 'lucide-react-native/icons/camera';
import Car from 'lucide-react-native/icons/car';
import CarFront from 'lucide-react-native/icons/car-front';
import ChartColumn from 'lucide-react-native/icons/chart-column';
import ChartNoAxesColumn from 'lucide-react-native/icons/chart-no-axes-column';
import ChartPie from 'lucide-react-native/icons/chart-pie';
import Check from 'lucide-react-native/icons/check';
import CheckCheck from 'lucide-react-native/icons/check-check';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import ChevronUp from 'lucide-react-native/icons/chevron-up';
import Circle from 'lucide-react-native/icons/circle';
import CircleAlert from 'lucide-react-native/icons/circle-alert';
import CircleCheck from 'lucide-react-native/icons/circle-check';
import CirclePlay from 'lucide-react-native/icons/circle-play';
import CirclePlus from 'lucide-react-native/icons/circle-plus';
import CircleQuestionMark from 'lucide-react-native/icons/circle-question-mark';
import CircleUser from 'lucide-react-native/icons/circle-user';
import CircleX from 'lucide-react-native/icons/circle-x';
import Clipboard from 'lucide-react-native/icons/clipboard';
import Clock from 'lucide-react-native/icons/clock';
import CloudOff from 'lucide-react-native/icons/cloud-off';
import CloudUpload from 'lucide-react-native/icons/cloud-upload';
import Copy from 'lucide-react-native/icons/copy';
import Delete from 'lucide-react-native/icons/delete';
import Download from 'lucide-react-native/icons/download';
import Ellipsis from 'lucide-react-native/icons/ellipsis';
import Expand from 'lucide-react-native/icons/expand';
import ExternalLink from 'lucide-react-native/icons/external-link';
import Eye from 'lucide-react-native/icons/eye';
import EyeOff from 'lucide-react-native/icons/eye-off';
import File from 'lucide-react-native/icons/file';
import FileText from 'lucide-react-native/icons/file-text';
import FingerprintPattern from 'lucide-react-native/icons/fingerprint-pattern';
import Flashlight from 'lucide-react-native/icons/flashlight';
import Folder from 'lucide-react-native/icons/folder';
import FolderOpen from 'lucide-react-native/icons/folder-open';
import Funnel from 'lucide-react-native/icons/funnel';
import Fuel from 'lucide-react-native/icons/fuel';
import Droplet from 'lucide-react-native/icons/droplet';
import GitBranch from 'lucide-react-native/icons/git-branch';
import Globe from 'lucide-react-native/icons/globe';
import Grid3x3 from 'lucide-react-native/icons/grid-3x3';
import Hammer from 'lucide-react-native/icons/hammer';
import Heart from 'lucide-react-native/icons/heart';
import House from 'lucide-react-native/icons/house';
import ImageIcon from 'lucide-react-native/icons/image';
import Images from 'lucide-react-native/icons/images';
import Inbox from 'lucide-react-native/icons/inbox';
import Info from 'lucide-react-native/icons/info';
import Languages from 'lucide-react-native/icons/languages';
import Layers from 'lucide-react-native/icons/layers';
import LayoutGrid from 'lucide-react-native/icons/layout-grid';
import LinkIcon from 'lucide-react-native/icons/link';
import List from 'lucide-react-native/icons/list';
import LocateFixed from 'lucide-react-native/icons/locate-fixed';
import Lock from 'lucide-react-native/icons/lock';
import LogIn from 'lucide-react-native/icons/log-in';
import LogOut from 'lucide-react-native/icons/log-out';
import Mail from 'lucide-react-native/icons/mail';
import MailOpen from 'lucide-react-native/icons/mail-open';
import MapIcon from 'lucide-react-native/icons/map';
import MapPin from 'lucide-react-native/icons/map-pin';
import Maximize2 from 'lucide-react-native/icons/maximize-2';
import Megaphone from 'lucide-react-native/icons/megaphone';
import Menu from 'lucide-react-native/icons/menu';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import MessageCircleMore from 'lucide-react-native/icons/message-circle-more';
import MessagesSquare from 'lucide-react-native/icons/messages-square';
import Mic from 'lucide-react-native/icons/mic';
import Minus from 'lucide-react-native/icons/minus';
import Moon from 'lucide-react-native/icons/moon';
import Navigation from 'lucide-react-native/icons/navigation';
import Newspaper from 'lucide-react-native/icons/newspaper';
import Paperclip from 'lucide-react-native/icons/paperclip';
import Pencil from 'lucide-react-native/icons/pencil';
import Phone from 'lucide-react-native/icons/phone';
import Plane from 'lucide-react-native/icons/plane';
import Play from 'lucide-react-native/icons/play';
import Plus from 'lucide-react-native/icons/plus';
import QrCode from 'lucide-react-native/icons/qr-code';
import Receipt from 'lucide-react-native/icons/receipt';
import Redo2 from 'lucide-react-native/icons/redo-2';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import Scan from 'lucide-react-native/icons/scan';
import ScanBarcode from 'lucide-react-native/icons/scan-barcode';
import Search from 'lucide-react-native/icons/search';
import Send from 'lucide-react-native/icons/send';
import SendHorizontal from 'lucide-react-native/icons/send-horizontal';
import Settings from 'lucide-react-native/icons/settings';
import Share from 'lucide-react-native/icons/share';
import Shield from 'lucide-react-native/icons/shield';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import Shirt from 'lucide-react-native/icons/shirt';
import SlidersHorizontal from 'lucide-react-native/icons/sliders-horizontal';
import Square from 'lucide-react-native/icons/square';
import SquarePen from 'lucide-react-native/icons/square-pen';
import Star from 'lucide-react-native/icons/star';
import Sun from 'lucide-react-native/icons/sun';
import SwitchCamera from 'lucide-react-native/icons/switch-camera';
import Tag from 'lucide-react-native/icons/tag';
import ThumbsUp from 'lucide-react-native/icons/thumbs-up';
import Timer from 'lucide-react-native/icons/timer';
import Trash from 'lucide-react-native/icons/trash';
import TrendingUp from 'lucide-react-native/icons/trending-up';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import User from 'lucide-react-native/icons/user';
import UserPlus from 'lucide-react-native/icons/user-plus';
import UserX from 'lucide-react-native/icons/user-x';
import UserCheck from 'lucide-react-native/icons/user-check';
import ClockAlert from 'lucide-react-native/icons/clock-alert';
import Users from 'lucide-react-native/icons/users';
import Video from 'lucide-react-native/icons/video';
import Wifi from 'lucide-react-native/icons/wifi';
import Wrench from 'lucide-react-native/icons/wrench';
import X from 'lucide-react-native/icons/x';

// Апп зөвхөн `Ionicons` ашигладаг (бусад багц хэрэгтэй бол энд дамжуулна).
export { MaterialCommunityIcons, MaterialIcons, FontAwesome, Feather } from '@expo/vector-icons';

/** Ionicons-ийн суурь нэр (-outline/-sharp-гүй) → Lucide. */
const MAP = {
  add: Plus, 'add-circle': CirclePlus, airplane: Plane, alarm: AlarmClock,
  // Ирцийн үзүүлэлт (prototype): тасалсан / ирсэн / хоцорсон.
  'person-remove': UserX, 'person-check': UserCheck, 'time-alert': ClockAlert,
  'alert-circle': CircleAlert, apps: LayoutGrid, archive: Archive,
  'arrow-back': ArrowLeft, 'arrow-down': ArrowDown, 'arrow-forward': ArrowRight,
  'arrow-redo': Redo2, 'arrow-up': ArrowUp, attach: Paperclip, backspace: Delete,
  'bar-chart': ChartColumn, barcode: ScanBarcode, bed: Bed, briefcase: Briefcase,
  business: Building, calendar: Calendar, 'calendar-clear': Calendar, 'calendar-number': CalendarDays,
  call: Phone, camera: Camera, 'camera-reverse': SwitchCamera, car: Car, 'car-sport': CarFront,
  cash: Banknote, chatbubble: MessageCircle, 'chatbubble-ellipses': MessageCircleMore,
  chatbubbles: MessagesSquare, checkmark: Check, 'checkmark-circle': CircleCheck,
  'checkmark-done': CheckCheck, 'chevron-back': ChevronLeft, 'chevron-down': ChevronDown,
  'chevron-forward': ChevronRight, 'chevron-up': ChevronUp, clipboard: Clipboard,
  close: X, 'close-circle': CircleX, 'cloud-offline': CloudOff, 'cloud-upload': CloudUpload,
  construct: Wrench, copy: Copy, create: SquarePen, cube: Box, document: File,
  'document-text': FileText, download: Download, earth: Globe,
  'ellipsis-horizontal': Ellipsis, expand: Expand, eye: Eye, 'eye-off': EyeOff,
  'file-tray': Inbox, 'file-tray-full': Inbox, 'finger-print': FingerprintPattern,
  flashlight: Flashlight, folder: Folder, 'folder-open': FolderOpen, funnel: Funnel,
  filter: Funnel, 'gas-pump': Fuel, fuel: Fuel, water: Droplet, 'git-branch': GitBranch, grid: LayoutGrid, hammer: Hammer, heart: Heart,
  'help-circle': CircleQuestionMark, home: House, image: ImageIcon, images: Images,
  'information-circle': Info, keypad: Grid3x3, language: Languages, layers: Layers,
  link: LinkIcon, list: List, locate: LocateFixed, location: MapPin, 'lock-closed': Lock,
  'log-in': LogIn, 'log-out': LogOut, mail: Mail, 'mail-unread': MailOpen, map: MapIcon,
  megaphone: Megaphone, menu: Menu, mic: Mic, moon: Moon, navigate: Navigation,
  newspaper: Newspaper, notifications: Bell, open: ExternalLink, options: SlidersHorizontal,
  'paper-plane': Send, pencil: Pencil, people: Users, person: User, 'person-add': UserPlus,
  'person-circle': CircleUser, 'pie-chart': ChartPie, play: Play, 'play-circle': CirclePlay,
  pricetag: Tag, pulse: Activity, 'qr-code': QrCode, receipt: Receipt, refresh: RefreshCw,
  remove: Minus, resize: Maximize2, scan: Scan, search: Search, send: SendHorizontal,
  settings: Settings, share: Share, 'shield-checkmark': ShieldCheck, 'shield-half': Shield,
  shirt: Shirt, square: Square, star: Star, 'stats-chart': ChartNoAxesColumn, sunny: Sun,
  'swap-horizontal': ArrowLeftRight, 'thumbs-up': ThumbsUp, time: Clock, timer: Timer,
  trash: Trash, 'trending-up': TrendingUp, videocam: Video, warning: TriangleAlert, wifi: Wifi,
};

/** Дүүргэлттэй хэвээр байх ёстой (төлөвийн цэг). */
const FILLED = new Set(['ellipse']);

function baseName(name) {
  return String(name || '').replace(/-(outline|sharp)$/, '');
}

export function Ionicons({ name, size = 24, color = '#000', style, ...rest }) {
  if (FILLED.has(name)) {
    return <Circle size={size * 0.8} color={color} fill={color} strokeWidth={0} style={style} />;
  }
  const Icon = MAP[baseName(name)];
  if (!Icon) return <RealIonicons name={name} size={size} color={color} style={style} {...rest} />;
  return (
    <Icon
      size={size}
      color={color}
      strokeWidth={1.9}
      style={style}
      accessibilityLabel={rest.accessibilityLabel}
      testID={rest.testID}
    />
  );
}
Ionicons.glyphMap = RealIonicons.glyphMap;
Ionicons.font = RealIonicons.font;
Ionicons.loadFont = RealIonicons.loadFont;
