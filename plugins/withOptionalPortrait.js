const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withOptionalPortrait(config) {
  return withAndroidManifest(config, (result) => {
    const manifest = result.modResults.manifest;
    const name = 'android.hardware.screen.portrait';
    const features = manifest['uses-feature'] ?? [];
    manifest['uses-feature'] = [
      ...features.filter((feature) => feature.$?.['android:name'] !== name),
      { $: { 'android:name': name, 'android:required': 'false' } },
    ];
    return result;
  });
};
