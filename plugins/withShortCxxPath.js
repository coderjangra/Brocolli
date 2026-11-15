// Windows: release CMake builds of codegen'd native libraries create object
// paths over 260 chars. The ninja bundled with the SDK's default CMake 3.22
// is not long-path aware; the one with CMake 3.31 (ninja 1.12) is. Pin that
// CMake on Windows and stage native builds in a short directory as well.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// brocolli: windows long-path cmake';
const CMAKE_VERSION = '3.31.6';

module.exports = function withShortCxxPath(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (process.platform !== 'win32' || cfg.modResults.contents.includes(MARKER)) return cfg;
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /\nandroid \{\n/,
      `\nandroid {\n    ${MARKER}\n    externalNativeBuild { cmake { version "${CMAKE_VERSION}"; buildStagingDirectory = new File(rootDir.absolutePath.substring(0, 3), ".bcx") } }\n`,
    );
    return cfg;
  });
};
