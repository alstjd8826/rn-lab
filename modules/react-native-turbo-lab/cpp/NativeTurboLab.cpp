#include "NativeTurboLab.h"

#include <chrono>

namespace facebook::react {

namespace {

// 네이티브 라이브러리가 로드될 때(= 앱 시작 무렵) 한 번 초기화된다.
// 이후 모든 시각을 이 시점 기준으로 잰다.
const std::chrono::steady_clock::time_point kLoadTime =
    std::chrono::steady_clock::now();

double msSinceLoad() {
  const auto delta = std::chrono::steady_clock::now() - kLoadTime;
  return std::chrono::duration<double, std::milli>(delta).count();
}

} // namespace

// ★ 이 생성자가 언제 불리는지가 이 레슨의 핵심.
//   앱 시작 때가 아니라, JS 가 이 모듈을 처음 찾을 때 불린다.
NativeTurboLab::NativeTurboLab(std::shared_ptr<CallInvoker> jsInvoker)
    : NativeTurboLabCxxSpec(std::move(jsInvoker)),
      createdAtMs_(msSinceLoad()),
      pingCount_(0) {}

double NativeTurboLab::getCreatedAtMs(jsi::Runtime&) {
  return createdAtMs_;
}

double NativeTurboLab::getUptimeMs(jsi::Runtime&) {
  return msSinceLoad();
}

double NativeTurboLab::ping(jsi::Runtime&) {
  pingCount_ += 1;
  return pingCount_;
}

double NativeTurboLab::getPingCount(jsi::Runtime&) {
  return pingCount_;
}

// ⑧ 벤치마크용. Nitro · raw JSI 의 add 와 같은 일을 한다.
double NativeTurboLab::add(jsi::Runtime&, double a, double b) {
  return a + b;
}

} // namespace facebook::react
