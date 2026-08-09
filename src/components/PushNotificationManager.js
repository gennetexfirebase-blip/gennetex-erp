import { useEffect, useRef } from 'react';
import { Platform, AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useApp } from '../context/AppContext';
import * as notifyApi from '../services/notificationService';
import { startIncomingCallAlert, stopIncomingCallAlert } from '../services/callAlertService';
import { navigateFromNotification } from '../lib/navigationRef';
import { getActiveChatRoom } from '../lib/chatFocus';
import { supabase } from '../lib/supabase';
import { registerBackgroundCallTask } from '../services/incomingCallBackgroundTask';
import {
  isNativeIncomingCallAvailable,
  showNativeIncomingCallFromPush,
} from '../services/nativeIncomingCallService';

export default function PushNotificationManager() {
  const { isCloud, currentUser } = useApp();
  const tokenRef = useRef(null);
  const responseSub = useRef(null);
  const receivedSub = useRef(null);
  const chatSub = useRef(null);
  const memberRooms = useRef(new Set());
  const tokenRefreshSub = useRef(null);

  useEffect(() => {
    if (!isCloud || !currentUser?.id || Platform.OS === 'web') return;

    let active = true;

    (async () => {
      try {
        const res = await notifyApi.enablePushForUser(currentUser.id);
        if (!active || !res.ok) return;
        tokenRef.current = res.token;
        tokenRefreshSub.current = notifyApi.listenForTokenRefresh(currentUser.id, (error) => console.warn('[push] token refresh:', error?.message || error));
      } catch (e) {}
    })();

    // App хаалттай/background үед дуудлагын push ирвэл утасны native
    // дуудлагын дэлгэц гаргах background task-ийг бүртгэнэ.
    registerBackgroundCallTask();

    // Миний ярианууд — foreground чат мэдэгдэл
    (async () => {
      const { data } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', currentUser.id);
      memberRooms.current = new Set((data || []).map((m) => m.conversation_id));
    })();

    chatSub.current = supabase
      .channel(`chat-push-${currentUser.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages'}, async (payload) => {
        const msg = payload.new;
        if (!msg || msg.sender_id === currentUser.id) return;
        if (!memberRooms.current.has(msg.room)) return;
        if (msg.room === getActiveChatRoom()) return;
        if (AppState.currentState !== 'active') return;

        const preview =
          msg.content ||
          (msg.attachment_type === 'image'
            ? 'Зураг'
            : msg.attachment_type === 'video'
            ? 'Видео'
            : msg.attachment_type === 'file'
            ? 'Файл'
            : 'Шинэ мессеж');
        await notifyApi.showLocalNotification({
          title: msg.sender_name || 'Чат',
          body: preview,
          data: { type: 'chat', room: msg.room, senderName: msg.sender_name },
          channelId: 'chat',
        });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversation_members'}, async () => {
        const { data } = await supabase
          .from('conversation_members')
          .select('conversation_id')
          .eq('user_id', currentUser.id);
        memberRooms.current = new Set((data || []).map((m) => m.conversation_id));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, async (payload) => {
        const post = payload.new;
        if (!post || post.author_id === currentUser.id) return;
        if (AppState.currentState !== 'active') return;
        await notifyApi.showLocalNotification({
          title: `${post.author_name || 'Ажилтан'} шинэ пост тавилаа`,
          body: post.content || 'Зурагтай пост',
          data: { type: 'feed', postId: post.id },
          channelId: 'feed',
        });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'post_comments' }, async (payload) => {
        const comment = payload.new;
        if (!comment || comment.user_id === currentUser.id) return;
        if (AppState.currentState !== 'active') return;
        const { data: post } = await supabase
          .from('posts')
          .select('author_id')
          .eq('id', comment.post_id)
          .maybeSingle();
        if (post?.author_id !== currentUser.id) return;
        await notifyApi.showLocalNotification({
          title: `${comment.user_name || 'Ажилтан'} сэтгэгдэл бичлээ`,
          body: comment.content,
          data: { type: 'feed', postId: comment.post_id },
          channelId: 'feed',
        });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'service_calls' }, async (payload) => {
        const call = payload.new;
        if (!call || call.engineer_id !== currentUser.id) return;
        if (AppState.currentState !== 'active') return;
        const name = call.engineer_name || currentUser.name || 'Ажилтан';
        const kind = call.site_kind === 'baiguulga' ? 'Байгууллага' : 'Айл';
        const details = [call.customer, call.problem, call.phone].filter(Boolean).join(' · ');
        await notifyApi.showLocalNotification({
          title: `${name}, танд шинээр дуудлага ирлээ`,
          body: details ? `${kind}: ${details}` : `${kind} дээрх шинэ дуудлага`,
          data: { type: 'service_call', callId: call.id, siteKind: call.site_kind || 'ail' },
          channelId: 'chat',
        });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'meetings' }, async (payload) => {
        const meeting = payload.new;
        if (!meeting || meeting.status !== 'active') return;
        if (meeting.host_id === currentUser.id) return;
        // kind=meeting → зөвхөн хурал; kind=live эсвэл бусад → live
        const isMeeting =
          meeting.kind === 'meeting' ||
          (meeting.kind !== 'live' && /хурал/i.test(meeting.title || ''));
        if (isMeeting) {
          await notifyApi.showLocalNotification({
            title: 'Хурал эхэллээ',
            body: `${meeting.host_name || 'Админ'} хурал эхлүүллээ — Нүүр → Хурал дээр дарж орно уу`,
            data: {
              type: 'meeting',
              kind: 'meeting',
              meetingId: meeting.id,
              hostName: meeting.host_name,
              hostId: meeting.host_id,
              screen: 'Meeting',
            },
            channelId: 'chat',
          });
        } else {
          await notifyApi.showLocalNotification({
            title: 'Live эхэллээ',
            body: `${meeting.host_name || 'Ажилтан'} live хийж эхэллээ — Пост цэсээр үзнэ үү`,
            data: {
              type: 'live',
              kind: 'live',
              meetingId: meeting.id,
              hostName: meeting.host_name,
              hostId: meeting.host_id,
              screen: 'Feed',
            },
            channelId: 'chat',
          });
        }
      })
      .subscribe();

    receivedSub.current = Notifications.addNotificationReceivedListener(async (notification) => {
      const data = notification.request.content.data;
      if (data?.type === 'call') {
        // Апп идэвхтэй (foreground) үед Supabase realtime (IncomingCallManager)
        // өөрөө дуудлагыг гаргана — давхардуулахгүй.
        if (AppState.currentState === 'active') return;
        if (isNativeIncomingCallAvailable()) {
          showNativeIncomingCallFromPush({ ...data, type: 'call' });
        } else {
          await startIncomingCallAlert(data.callerName || notification.request.content.title);
        }
      }
    });

    responseSub.current = Notifications.addNotificationResponseReceivedListener(async (response) => {
      await stopIncomingCallAlert();
      const data = response.notification.request.content.data;
      navigateFromNotification(data);
    });

    Notifications.getLastNotificationResponseAsync().then((response) => {
      const data = response?.notification?.request?.content?.data;
      if (data) navigateFromNotification(data);
    }).catch(() => {});

    return () => {
      active = false;
      receivedSub.current?.remove();
      responseSub.current?.remove();
      tokenRefreshSub.current?.();
      if (chatSub.current) supabase.removeChannel(chatSub.current);
      stopIncomingCallAlert();
    };
  }, [isCloud, currentUser?.id]);

  return null;
}
