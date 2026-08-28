import { supabase } from '../lib/supabase';
import * as chatApi from './chatService';

/**
 * Бензиний баримт илгээх.
 *
 * Ажилтан ШТС-ийн баримтын зургаа авч илгээхэд, БҮХ админ руу
 * тухайн ажилтны ӨӨРИЙНХ НЬ аккаунтаас чат мессеж очно.
 *
 * ⚠️ ЯАГААД ЧАТААР ВЭ: админ баримтыг хараад тодруулах зүйл гарвал
 *    тэр даруй эргэж бичих боломжтой байх ёстой. Тусдаа "баримтын
 *    жагсаалт" гаргавал асуулт хариулт нь өөр газар үлдэж, хэн юу
 *    тохирсон нь мөрдөгдөхгүй болно. Чат нь илгээгч, зураг, цаг,
 *    хариу яриа бүгдийг нэг утсанд хадгална.
 */

/** Мэдэгдэл хүлээн авах админууд (superadmin багтана). */
async function fetchAdmins() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name')
    .in('role', ['admin', 'superadmin']);
  if (error) throw error;
  return data || [];
}

/**
 * Баримтыг бүх админд илгээнэ.
 *
 * @returns {{ sent: number, failed: number, admins: number }}
 */
export async function sendFuelReceipt({ sender, imageUri, amount, plate, note }) {
  if (!sender?.id) throw new Error('Нэвтэрсэн хэрэглэгч олдсонгүй.');
  if (!imageUri) throw new Error('Баримтын зураг сонгоно уу.');

  const admins = (await fetchAdmins()).filter((a) => a.id && a.id !== sender.id);
  if (!admins.length) {
    throw new Error('Админ бүртгэгдээгүй байна.');
  }

  // Бичвэрийг урьдчилж бэлдэнэ — админ бүрт ижил очно.
  const lines = ['⛽ Бензиний баримт'];
  if (plate) lines.push(`Машин: ${plate}`);
  if (amount) lines.push(`Дүн: ${Number(amount).toLocaleString('mn-MN')}₮`);
  if (note) lines.push(note);
  const content = lines.join('\n');

  let sent = 0;
  let failed = 0;
  let uploadedUrl = null;

  for (const admin of admins) {
    try {
      const conv = await chatApi.getOrCreateDirect(
        { id: sender.id, name: sender.name },
        { id: admin.id, name: admin.name }
      );

      // ⚠️ Зургийг НЭГ УДАА л байршуулна. Админ бүрт дахин илгээвэл
      //    ижил файл олон хувь болж, сангийн хэмжээ дэмий өснө.
      if (!uploadedUrl) {
        uploadedUrl = await chatApi.uploadChatFile(imageUri, {
          room: conv.id,
          mimeType: 'image/jpeg',
          name: `benzen_barimt_${Date.now()}.jpg`,
        });
      }

      await chatApi.sendMessage({
        room: conv.id,
        senderId: sender.id,
        senderName: sender.name,
        content,
        attachmentUrl: uploadedUrl,
        attachmentType: 'image',
        attachmentName: 'Бензиний баримт',
      });
      sent++;
    } catch (e) {
      // Нэг админд илгээгдээгүй нь бусдыг зогсоох ёсгүй.
      failed++;
    }
  }

  if (!sent) throw new Error('Нэг ч админд илгээгдсэнгүй. Сүлжээгээ шалгана уу.');
  return { sent, failed, admins: admins.length };
}
