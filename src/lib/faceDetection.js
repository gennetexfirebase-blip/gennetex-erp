import React from 'react';

// Expo Go does not bundle this project's ML Kit native module. Requiring the
// package behind a guard lets the rest of the app run there, while development
// builds and APKs continue to use the real provider and hook.
let NativeFaceDetectionProvider = ({ children }) => children;
let useNativeFaceDetection = () => null;

try {
  const nativeFaceDetection = require('@infinitered/react-native-mlkit-face-detection');
  NativeFaceDetectionProvider = nativeFaceDetection.FaceDetectionProvider;
  useNativeFaceDetection = nativeFaceDetection.useFaceDetection;
} catch (_error) {
  // faceService shows a user-facing APK-build message if detection is invoked.
}

export function FaceDetectionProvider(props) {
  return <NativeFaceDetectionProvider {...props} />;
}

export function useFaceDetection() {
  return useNativeFaceDetection();
}
