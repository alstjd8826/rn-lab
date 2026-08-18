#import <Foundation/Foundation.h>
#import <ReactCommon/RCTTurboModule.h>

NS_ASSUME_NONNULL_BEGIN

// package.json 의 codegenConfig.ios.modulesProvider 가 이 클래스를 가리킨다.
// 앱 시작 시 등록되는 건 "이름 → 이 클래스" 매핑뿐이고,
// getTurboModule 은 JS 가 모듈을 처음 찾을 때 호출된다.
@interface NativeTurboLabProvider : NSObject <RCTModuleProvider>
@end

NS_ASSUME_NONNULL_END
