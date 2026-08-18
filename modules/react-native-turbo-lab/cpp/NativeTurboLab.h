#pragma once

#include <TurboLabSpecsJSI.h>

#include <memory>

namespace facebook::react {

class NativeTurboLab : public NativeTurboLabCxxSpec<NativeTurboLab> {
 public:
  explicit NativeTurboLab(std::shared_ptr<CallInvoker> jsInvoker);

  double getCreatedAtMs(jsi::Runtime& rt);
  double getUptimeMs(jsi::Runtime& rt);
  double ping(jsi::Runtime& rt);
  double getPingCount(jsi::Runtime& rt);

 private:
  // 생성자에서 한 번 기록된다. 이 값이 이 실험의 전부다.
  double createdAtMs_;
  double pingCount_;
};

} // namespace facebook::react
