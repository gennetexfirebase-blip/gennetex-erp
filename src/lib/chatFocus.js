/** Одоо нээлттэй чатын өрөө — foreground мэдэгдэл давхардахгүй */
let activeChatRoom = null;

export function setActiveChatRoom(room) {
  activeChatRoom = room || null;
}

export function getActiveChatRoom() {
  return activeChatRoom;
}
