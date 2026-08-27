import { supabase } from '../lib/supabase';
import { sendPushToAll, sendPushToUsers } from './notificationService';

const TABLE = 'notification_campaigns';

/**
 * Мэдэгдэл илгээх — эхлээд `notification_campaigns`-д бүртгэж (Илгээсэн
 * мэдэгдэл жагсаалтад харагдана), дараа нь одоо байгаа send-push дэд
 * бүтцээр (sendPushToAll/sendPushToUsers) бодитоор илгээнэ.
 *
 * audience: { kind: 'all' } | { kind: 'department', departmentId, userIds }
 *         | { kind: 'users', userIds }
 * `department` сонголтыг клиент тал department-ийн гишүүдийг user id
 * жагсаалт болгож урьдчилан бодож ирнэ (`userIds`) — сервер тал зөвхөн
 * бүртгэж, тэр жагсаалтаар илгээнэ.
 */
export async function sendNotificationCampaign({
  title,
  body,
  audience,
  imageUrl,
  deepLink,
  priority = 'default',
  sentBy,
  sentByName,
}) {
  const audienceIds = audience.kind === 'all' ? [] : audience.userIds || [];

  const { data: campaign, error } = await supabase
    .from(TABLE)
    .insert({
      title,
      body,
      audience_kind: audience.kind === 'department' ? 'department' : audience.kind,
      audience_ids: audience.kind === 'department' ? [audience.departmentId] : audienceIds,
      image_url: imageUrl || null,
      deep_link: deepLink || null,
      priority,
      sent_by: sentBy,
      sent_by_name: sentByName || null,
      recipient_count: audienceIds.length,
    })
    .select()
    .single();
  if (error) throw error;

  const payload = {
    title,
    body,
    data: { type: 'admin', screen: 'NotificationCenter', deepLink: deepLink || null },
    priority,
  };

  // ⚠️ Edge function-ийн үр дүнг ХАЯХГҮЙ. Өмнө нь `await`-аад орхидог
  // байсан тул нэг ч төхөөрөмжид хүрээгүй ч UI "амжилттай илгээгдлээ"
  // гэж хэлдэг байв. Бодит шалтгаан (хүлээн авагчид push token-гүй)
  // хэзээ ч харагдахгүй тул "push ажиллахгүй байна" гэж эргэлздэг.
  const delivery =
    audience.kind === 'all'
      ? await sendPushToAll(payload)
      : await sendPushToUsers(audienceIds, payload);

  return { ...campaign, delivery: delivery || null };
}

export async function fetchNotificationCampaigns(limit = 50) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}
