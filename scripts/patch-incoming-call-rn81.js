#!/usr/bin/env node
/**
 * react-native-full-screen-notification-incoming-call — RN 0.81 compile fix.
 * EAS build дээр npm install-ийн дараа автоматаар ажиллана.
 */
const fs = require('fs');
const path = require('path');

const file = path.join(
  __dirname,
  '../node_modules/react-native-full-screen-notification-incoming-call/android/src/main/java/com/reactnativefullscreennotificationincomingcall/IncomingCallActivity.java'
);

const MARKER = '// RN 0.81+ compatible incoming call UI';

if (!fs.existsSync(file)) {
  console.log('[patch-incoming-call] library not installed, skip');
  process.exit(0);
}

let src = fs.readFileSync(file, 'utf8');
if (src.includes(MARKER)) {
  console.log('[patch-incoming-call] already patched');
  process.exit(0);
}

const oldBlock = `    if (bundle.containsKey("mainComponent") && bundle.getString("mainComponent") != null) {
      String mainComponent = bundle.getString("mainComponent");
      setContentView(R.layout.custom_ingcoming_call_rn);
      Fragment reactNativeFragment = new ReactFragment.Builder()
        .setComponentName(mainComponent)
        .setLaunchOptions(bundle)
        .build();

      getSupportFragmentManager()
        .beginTransaction()
        .add(R.id.reactNativeFragment, reactNativeFragment)
        .commit();
      return;
    } else {
      setContentView(R.layout.activity_call_incoming);
    }`;

const newBlock = `    ${MARKER}
    setContentView(R.layout.activity_call_incoming);`;

if (!src.includes('setComponentName(mainComponent)')) {
  console.log('[patch-incoming-call] pattern not found, skip');
  process.exit(0);
}

src = src.replace(oldBlock, newBlock);
fs.writeFileSync(file, src);
console.log('[patch-incoming-call] patched IncomingCallActivity.java');
