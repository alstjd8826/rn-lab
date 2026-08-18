#import "NativeTurboLabProvider.h"

#import <ReactCommon/CallInvoker.h>
#import <ReactCommon/TurboModule.h>

#import "NativeTurboLab.h"

@implementation NativeTurboLabProvider

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  // 여기서 처음으로 인스턴스가 만들어진다.
  return std::make_shared<facebook::react::NativeTurboLab>(params.jsInvoker);
}

@end
