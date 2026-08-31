import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();
let pendingNotification = null;

/**
 * Дэлгэц рүү шилжих — компонентээс гадуур (сервис, tracker) ашиглана.
 *
 * Навигац бэлэн болоогүй үед ЧИМЭЭГҮЙ өнгөрнө: апп ачаалж дуусаагүй
 * байхад дуудагдвал алдаа шидэх нь утгагүй, дараагийн боломжид
 * дуудагдана.
 */
export function navigate(name, params) {
  if (!navigationRef.isReady()) return false;
  navigationRef.navigate(name, params);
  return true;
}

export function flushPendingNotification() {
  if (!pendingNotification || !navigationRef.isReady()) return;
  const data = pendingNotification;
  pendingNotification = null;
  navigateFromNotification(data);
}

export function navigateFromNotification(data) {
  if (!data) return;
  if (!navigationRef.isReady()) { pendingNotification = data; return; }

  const requested = data.screen || data.route;
  if (requested) {
    const mainTabs = new Set(['Home', 'Attendance', 'Feed', 'Chat', 'Profile', 'Notifications']);
    if (mainTabs.has(requested)) navigationRef.navigate('MainTabs', { screen: requested, params: { ...data, entityId: data.entityId } });
    else navigationRef.navigate(requested, { ...data, entityId: data.entityId });
    return;
  }
  if (!data.type) return;

  switch (data.type) {
    case 'chat' :
      navigationRef.navigate('Conversation', {
        conversationId: data.room,
        title: 'Чат',
      });
      break;
    case 'jitsi_call':
      /**
       * Jitsi өрөөгөөр залгасан дуудлага.
       *
       * Залгагч тал нь native WebRTC-гүй орчинд (Expo Go) байгаа тул
       * хоёулаа НЭГ Jitsi өрөөнд уулзана. Мэдэгдэл дарахад чатыг нээж,
       * дуудлагын цонхыг ШУУД нээнэ — хэрэглэгч дахин товч хайх
       * шаардлагагүй.
       */
      navigationRef.navigate('Conversation', {
        conversationId: data.room,
        title: data.callerName || 'Дуудлага',
        autoJoinCall: true,
      });
      break;
    case 'call':
      // Хуучин Jitsi дуудлагын мэдэгдэл — чат руу
      navigationRef.navigate('MainTabs', { screen: 'Chat' });
      break;
    case 'incoming_call':
    case 'missed_call':
      // Дуудлага өөрөө CallProvider дээр гарна. Мэдэгдэл дарсан үед
      // хэрэглэгчийн хүсэж буй зүйл нь "хэн залгасныг харах" тул түүх рүү.
      navigationRef.navigate('CallHistory');
      break;
    case 'attendance_pending' :
      navigationRef.navigate('Attendance');
      break;
    case 'service_call':
    case 'service_call_sla':
      navigationRef.navigate('Calls');
      break;
    case 'order':
    case 'new_order':
    case 'order_status':
      navigationRef.navigate('MainTabs', { screen: 'Home', params: { entityId: data.entityId || data.orderId } });
      break;
    case 'payment':
    case 'payment_success':
    case 'payment_failed':
      navigationRef.navigate('MainTabs', { screen: 'Home', params: { entityId: data.entityId || data.paymentId } });
      break;
    case 'task':
    case 'task_deadline':
      navigationRef.navigate('MainTabs', { screen: 'Home', params: { entityId: data.entityId || data.taskId } });
      break;
    case 'job_application':
      navigationRef.navigate('AdminApplications', { applicationId: data.applicationId || data.entityId });
      break;
    case 'admin':
    case 'system':
      navigationRef.navigate('MainTabs', { screen: 'Notifications' });
      break;
    case 'feed':
      if (data.postId) {
        navigationRef.navigate('FeedPost', { postId: data.postId });
      } else {
        navigationRef.navigate('MainTabs', { screen: 'Feed' });
      }
      break;
    case 'live':
    case 'live_invite':
      navigationRef.navigate('MainTabs', {
        screen: 'Feed',
        params: {
          openLiveId: data.meetingId || data.liveId || data.live_id,
          openLiveHost: data.hostName || data.host_name,
          openLiveHostId: data.hostId || data.host_id,
        },
      });
      break;
    case 'meeting':
      // Live push хурал руу орохгүй
      if (data.kind === 'live') {
        navigationRef.navigate('MainTabs', {
          screen: 'Feed',
          params: {
            openLiveId: data.meetingId || data.liveId,
            openLiveHost: data.hostName,
            openLiveHostId: data.hostId,
          },
        });
        break;
      }
      navigationRef.navigate('Meeting', {
        openMeetingId: data.meetingId || data.meeting_id,
        openMeetingHost: data.hostName || data.host_name,
        openMeetingHostId: data.hostId || data.host_id,
        openMeetingKind: 'meeting',
      });
      break;
    case 'telegram_chat':
      navigationRef.navigate('TelegramChat');
      break;
    case 'telegram_broadcast':
      navigationRef.navigate('MainTabs', { screen: 'Chat' });
      break;
  }
}
