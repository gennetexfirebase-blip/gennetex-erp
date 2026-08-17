/**
 * Чирж зөөж болдог хавтангийн сүлжээ (grid).
 *
 * ХЭРЭГЛЭЭ: хавтанг УДААН ДАРААД чирнэ → бусад хавтангууд зайгаа
 * тавьж өгнө → тавихад шинэ дараалал хадгалагдана. Богино дарвал
 * энгийн товч шиг нээгдэнэ.
 *
 * ЯАГААД PanResponder + Animated ВЭ:
 *   Төсөлд `react-native-reanimated` байхгүй тул `draggable-flatlist`
 *   төрлийн сан нэмбэл native dev-client-ийг ДАХИН БҮТЭЭХ шаардлагатай
 *   болно. RN-ийн үндсэн `PanResponder`/`Animated` нь нэмэлт хамааралгүй,
 *   одоогийн build дээр шууд ажиллана.
 *
 * ScrollView-ТЭЙ ХАМТ АЖИЛЛАХ:
 *   Хүрэх үед л responder-ыг авна, гэхдээ удаан дарж "чирэх горим"
 *   идэвхжих хүртэл ScrollView-д responder-оо буцааж өгнө
 *   (`onPanResponderTerminationRequest`). Тиймээс энгийн гүйлгэлт
 *   хэвийн ажиллаж, зөвхөн удаан дарсны дараа чирэлт эхэлнэ.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Vibration, View } from 'react-native';

/** Удаан дарах хугацаа — чирэх горим идэвхжих босго. */
const LONG_PRESS_MS = 260;
/** Идэвхжихээс өмнө энэ хэмжээнээс их хөдөлбөл гүйлгэлт гэж үзнэ. */
const MOVE_SLOP = 8;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function moveItem(arr, from, to) {
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

const sameOrder = (a, b) => a.length === b.length && a.every((k, i) => k === b[i]);

export default function DraggableTileGrid({
  items,
  keyExtractor = (m) => m.key,
  columns = 3,
  tileWidth,
  tileHeight,
  gap = 12,
  renderItem,
  onPressItem,
  onOrderChange,
  style,
}) {
  const [order, setOrder] = useState(() => (items || []).map(keyExtractor));
  const [draggingKey, setDraggingKey] = useState(null);

  // Гэсэн үзүүлэлтүүдийг gesture дундуур уншихад `state` хоцордог тул
  // ref-ээр давхар хөтөлнө.
  const orderRef = useRef(order);
  const positions = useRef(new Map()); // key → Animated.ValueXY

  const byKey = useMemo(() => {
    const map = new Map();
    (items || []).forEach((it) => map.set(keyExtractor(it), it));
    return map;
  }, [items, keyExtractor]);

  /**
   * Модулийн жагсаалт өөрчлөгдвөл (эрх солигдох, шүүлт) дарааллыг
   * шинэчилнэ: байхгүй болсныг хасч, шинийг АРД нь залгана.
   */
  useEffect(() => {
    const keys = (items || []).map(keyExtractor);
    const kept = orderRef.current.filter((k) => keys.includes(k));
    const added = keys.filter((k) => !kept.includes(k));
    const next = [...kept, ...added];
    if (!sameOrder(next, orderRef.current)) {
      orderRef.current = next;
      setOrder(next);
    }
  }, [items, keyExtractor]);

  const slot = useCallback(
    (index) => ({
      x: (index % columns) * (tileWidth + gap),
      y: Math.floor(index / columns) * (tileHeight + gap),
    }),
    [columns, tileWidth, tileHeight, gap]
  );

  const posFor = useCallback(
    (key, index) => {
      let value = positions.current.get(key);
      if (!value) {
        value = new Animated.ValueXY(slot(index));
        positions.current.set(key, value);
      }
      return value;
    },
    [slot]
  );

  /** Чирэгдээгүй хавтангуудыг шинэ нүд рүү нь гүйлгэнэ. */
  useEffect(() => {
    order.forEach((key, index) => {
      if (key === draggingKey) return;
      const value = posFor(key, index);
      Animated.spring(value, {
        toValue: slot(index),
        useNativeDriver: false,
        speed: 20,
        bounciness: 6,
      }).start();
    });
  }, [order, draggingKey, slot, posFor]);

  const rows = Math.max(1, Math.ceil(order.length / columns));
  const height = rows * tileHeight + (rows - 1) * gap;

  const handleDrop = useCallback(() => {
    const next = orderRef.current;
    setDraggingKey(null);
    onOrderChange?.(next);
  }, [onOrderChange]);

  return (
    <View style={[{ height, width: '100%' }, style]}>
      {order.map((key, index) => {
        const item = byKey.get(key);
        if (!item) return null;
        return (
          <DraggableTile
            key={key}
            itemKey={key}
            item={item}
            index={index}
            value={posFor(key, index)}
            width={tileWidth}
            height={tileHeight}
            gap={gap}
            columns={columns}
            total={order.length}
            dragging={draggingKey === key}
            anyDragging={draggingKey !== null}
            slot={slot}
            orderRef={orderRef}
            setOrder={setOrder}
            onDragStart={setDraggingKey}
            onDrop={handleDrop}
            onPress={() => onPressItem?.(item)}
            renderItem={renderItem}
          />
        );
      })}
    </View>
  );
}

function DraggableTile({
  itemKey,
  item,
  index,
  value,
  width,
  height,
  gap,
  columns,
  total,
  dragging,
  anyDragging,
  slot,
  orderRef,
  setOrder,
  onDragStart,
  onDrop,
  onPress,
  renderItem,
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const active = useRef(false);      // чирэх горим идэвхтэй юу
  const timer = useRef(null);
  const start = useRef({ x: 0, y: 0, at: 0 });
  const moved = useRef(false);

  const cancelTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  useEffect(() => cancelTimer, []);

  const responder = useMemo(
    () =>
      PanResponder.create({
        // Хүрэхэд responder-ыг авна — гэхдээ доорх `TerminationRequest`
        // нь чирээгүй үед ScrollView-д замыг нь тавьж өгнө.
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => active.current,
        onPanResponderTerminationRequest: () => !active.current,
        onShouldBlockNativeResponder: () => false,

        onPanResponderGrant: () => {
          moved.current = false;
          const from = orderRef.current.indexOf(itemKey);
          start.current = { ...slot(from < 0 ? index : from), at: Date.now() };
          cancelTimer();
          timer.current = setTimeout(() => {
            active.current = true;
            onDragStart(itemKey);
            // Богино чичиргээ — "авлаа" гэсэн мэдрэмж.
            try {
              Vibration.vibrate(10);
            } catch {}
            Animated.spring(scale, {
              toValue: 1.08,
              useNativeDriver: false,
              speed: 24,
              bounciness: 8,
            }).start();
          }, LONG_PRESS_MS);
        },

        onPanResponderMove: (_evt, gesture) => {
          if (Math.abs(gesture.dx) > MOVE_SLOP || Math.abs(gesture.dy) > MOVE_SLOP) {
            moved.current = true;
            // Хараахан идэвхжээгүй байхад хөдөлбөл гүйлгэлт гэж үзэж
            // удаан дарах тоолуурыг цуцална.
            if (!active.current) cancelTimer();
          }
          if (!active.current) return;

          const x = start.current.x + gesture.dx;
          const y = start.current.y + gesture.dy;
          value.setValue({ x, y });

          // Хуруу аль нүдэн дээр байна вэ — тэр байрлал руу оруулна.
          const col = clamp(Math.floor((x + width / 2) / (width + gap)), 0, columns - 1);
          const row = Math.max(0, Math.floor((y + height / 2) / (height + gap)));
          const target = clamp(row * columns + col, 0, total - 1);
          const current = orderRef.current.indexOf(itemKey);
          if (current !== -1 && target !== current) {
            const next = moveItem(orderRef.current, current, target);
            orderRef.current = next;
            setOrder(next);
          }
        },

        onPanResponderRelease: (_evt, gesture) => {
          cancelTimer();
          const wasActive = active.current;
          active.current = false;

          if (wasActive) {
            const final = orderRef.current.indexOf(itemKey);
            Animated.parallel([
              Animated.spring(value, {
                toValue: slot(final < 0 ? index : final),
                useNativeDriver: false,
                speed: 20,
                bounciness: 8,
              }),
              Animated.spring(scale, { toValue: 1, useNativeDriver: false, speed: 24 }),
            ]).start();
            onDrop();
            return;
          }

          // Чирээгүй + бараг хөдөлгөөнгүй + богино дарсан = энгийн товшилт
          const quick = Date.now() - start.current.at < 600;
          if (!moved.current && quick && Math.abs(gesture.dx) < MOVE_SLOP && Math.abs(gesture.dy) < MOVE_SLOP) {
            onPress?.();
          }
        },

        onPanResponderTerminate: () => {
          cancelTimer();
          if (active.current) {
            active.current = false;
            const final = orderRef.current.indexOf(itemKey);
            Animated.spring(value, {
              toValue: slot(final < 0 ? index : final),
              useNativeDriver: false,
              speed: 20,
            }).start();
            Animated.spring(scale, { toValue: 1, useNativeDriver: false, speed: 24 }).start();
            onDrop();
          }
        },
      }),
    [itemKey, index, value, width, height, gap, columns, total, slot, orderRef, setOrder, onDragStart, onDrop, onPress, scale]
  );

  return (
    <Animated.View
      {...responder.panHandlers}
      style={{
        position: 'absolute',
        width,
        height,
        transform: [...value.getTranslateTransform(), { scale }],
        zIndex: dragging ? 20 : 1,
        elevation: dragging ? 12 : 0,
        opacity: anyDragging && !dragging ? 0.85 : 1,
      }}
      accessibilityRole="button"
      accessibilityLabel={item.label}
      accessibilityHint="Зөөх бол удаан дараад чирнэ."
    >
      {renderItem(item, { dragging })}
    </Animated.View>
  );
}
