#import <Foundation/Foundation.h>
#import <ReactCommon/RCTTurboModule.h>

NS_ASSUME_NONNULL_BEGIN

// package.json 의 codegenConfig.ios.modulesProvider 가 이 클래스를 가리킨다.
@interface NativeJsiLabProvider : NSObject <RCTModuleProvider>
@end

NS_ASSUME_NONNULL_END
