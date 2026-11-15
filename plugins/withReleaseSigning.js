// Sign release builds with the Play upload key when its properties exist
// (in ~/.gradle/gradle.properties, never in the repo). Pass
// -PbrocolliDebugSigning=true to sign with the debug key instead, e.g. to
// update a sideloaded install without losing its data.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// brocolli: release signing';

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (src.includes(MARKER)) return cfg;

    src = src.replace(
      /signingConfigs \{\n/,
      `signingConfigs {
        ${MARKER}
        release {
            if (findProperty('BROCOLLI_UPLOAD_STORE_FILE')) {
                storeFile file(findProperty('BROCOLLI_UPLOAD_STORE_FILE'))
                storePassword findProperty('BROCOLLI_UPLOAD_STORE_PASSWORD')
                keyAlias findProperty('BROCOLLI_UPLOAD_KEY_ALIAS')
                keyPassword findProperty('BROCOLLI_UPLOAD_KEY_PASSWORD')
            }
        }
`,
    );
    const releaseType = src.indexOf('release {', src.indexOf('buildTypes {'));
    const debugSign = src.indexOf('signingConfig signingConfigs.debug', releaseType);
    if (releaseType < 0 || debugSign < 0) {
      throw new Error('withReleaseSigning: could not find the release build type');
    }
    src =
      src.slice(0, debugSign) +
      "signingConfig((findProperty('BROCOLLI_UPLOAD_STORE_FILE') && !findProperty('brocolliDebugSigning')) ? signingConfigs.release : signingConfigs.debug)" +
      src.slice(debugSign + 'signingConfig signingConfigs.debug'.length);
    cfg.modResults.contents = src;
    return cfg;
  });
};
