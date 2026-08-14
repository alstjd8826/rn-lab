#pragma once

#include <JsiLabSpecsJSI.h>

#include <memory>

namespace facebook::react {

// Codegen 이 스펙(NativeJsiLab.ts)에서 NativeJsiLabCxxSpec 을 생성한다.
class NativeJsiLab : public NativeJsiLabCxxSpec<NativeJsiLab> {
 public:
  explicit NativeJsiLab(std::shared_ptr<CallInvoker> jsInvoker);

  // 메서드 첫 인자로 런타임이 들어온다. 이게 raw JSI 로 가는 유일한 정문.
  bool install(jsi::Runtime& rt);
};

} // namespace facebook::react
