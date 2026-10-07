/**
 * Апп даяарх `Alert.alert`-ийг апп-ын загвартай цонхоор орлуулна.
 *
 * ЯАГААД: апп 400 гаруй газар `Alert.alert` дууддаг (жишээ нь «Явлаа» →
 * «Алгасах / Зураг авах»). Системийн цонх апп-ын дизайнтай огт нийцдэггүй
 * бөгөөд вэб дээр огт гардаггүй. Нэг бүрчлэн солихын оронд энд нэг удаа
 * орлуулна — дуудлагын API (title, message, buttons, options) хэвээр.
 *
 * ⚠️ iOS-д RN Modal нь өөрийгөө агуулсан view controller-оос гарч ирдэг.
 *    Root-д байрлах энэ цонх, өөр Modal (камер, хүсэлтийн цонх г.м.)
 *    нээлттэй үед гарч ЧАДАХГҮЙ — хэрэглэгч баталгаажуулалтыг харахгүй
 *    гацна. Тиймээс бүх Modal-ийг тоолж, нээлттэй байвал системийн
 *    цонхыг ашиглана.
 *
 * Энэ модулийг index.js-д React mount хийхээс ӨМНӨ импортлох ёстой.
 */
import React, { useEffect } from 'react';
import * as ReactNative from 'react-native';

const { Alert, Platform } = ReactNative;
const nativeAlert = Alert.alert.bind(Alert);
const OriginalModal = ReactNative.Modal;

let host = null;
let openModals = 0;

/** Цонх-хост (AppDialogHost) өөрийгөө бүртгэнэ. */
export function registerDialogHost(fn) {
  host = fn;
  return () => {
    if (host === fn) host = null;
  };
}

/** Хостын өөрийн Modal — тоолуургүй (өөрийгөө тоолбол үүрд native руу унана). */
export { OriginalModal };

function TrackedModal(props) {
  const visible = props.visible !== false;
  useEffect(() => {
    if (!visible) return undefined;
    openModals += 1;
    return () => {
      openModals = Math.max(0, openModals - 1);
    };
  }, [visible]);
  return React.createElement(OriginalModal, props);
}

function alertOverride(title, message, buttons, options) {
  // Хост байхгүй (React mount болоогүй) эсвэл iOS дээр өөр Modal нээлттэй
  // бол системийн цонх. Android дээр Modal давхцах асуудал байхгүй.
  const blocked = Platform.OS === 'ios' && openModals > 0;
  if (!host || blocked) return nativeAlert(title, message, buttons, options);
  host({ title, message, buttons, options });
  return undefined;
}

let installed = false;
export function installAppDialog() {
  if (installed) return;
  installed = true;
  try {
    Object.defineProperty(ReactNative, 'Modal', {
      configurable: true,
      enumerable: true,
      get: () => TrackedModal,
    });
  } catch (e) {
    // Export-ийг өөрчилж чадахгүй бол Modal тоолохгүй — тэгвэл iOS дээр
    // аюулгүйн үүднээс үргэлж системийн цонх ашиглана.
    openModals = Platform.OS === 'ios' ? Infinity : 0;
  }
  Alert.alert = alertOverride;
}

installAppDialog();
