const { withInfoPlist } = require('@expo/config-plugins')

/**
 * ⑦ Expo 레슨용 config plugin.
 *
 * 네이티브 파일(Info.plist)을 직접 손으로 고치는 대신, **코드로 조작**한다.
 * 이렇게 해두면 ios/ 를 통째로 지우고 prebuild 로 다시 만들어도
 * 이 설정이 자동으로 복원된다. 그게 CNG(Continuous Native Generation)다.
 *
 * 손으로 Info.plist 를 고치면 다음 prebuild 에서 날아간다.
 */
module.exports = function withLearnMarker(config, props = {}) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.LearnLabMarker =
      props.marker ?? 'config-plugin 이 넣은 값'
    cfg.modResults.LearnLabGeneratedAt = new Date().toISOString().slice(0, 10)
    return cfg
  })
}
