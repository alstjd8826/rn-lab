#include "NativeJsiLab.h"

#include <chrono>
#include <cstdint>
#include <cstring>
#include <sstream>
#include <thread>
#include <vector>

namespace facebook::react {

namespace {

// ───────────────────────────────────────────────────────────────────
// jsi::HostObject
//   C++ 객체를 JS 에서 "평범한 객체"처럼 보이게 만드는 물건.
//   JS 가 프로퍼티에 접근할 때마다 get() 이 호출된다.
//
//   여기엔 Codegen 이 없다. 브릿지도, JSON 직렬화도, 메시지 큐도 없다.
//   JS 의 함수 호출이 곧바로 아래 람다다.
// ───────────────────────────────────────────────────────────────────
class JsiLabHostObject : public jsi::HostObject {
 public:
  jsi::Value get(jsi::Runtime& rt, const jsi::PropNameID& name) override {
    const auto prop = name.utf8(rt);

    // ── 프로퍼티: 함수 호출이 아니라 값 읽기도 동기다
    if (prop == "kind") {
      return jsi::String::createFromAscii(rt, "raw-jsi-host-object");
    }

    // ── ① 동기 호출: await 없이 즉시 값이 돌아온다
    if (prop == "add") {
      return jsi::Function::createFromHostFunction(
          rt,
          jsi::PropNameID::forAscii(rt, "add"),
          2,
          [](jsi::Runtime& rt,
             const jsi::Value&,
             const jsi::Value* args,
             size_t count) -> jsi::Value {
            if (count < 2 || !args[0].isNumber() || !args[1].isNumber()) {
              throw jsi::JSError(rt, "add(a: number, b: number) 형태로 호출하세요");
            }
            // args 를 역직렬화하는 단계가 없다. 그냥 double 로 꺼낸다.
            return jsi::Value(args[0].asNumber() + args[1].asNumber());
          });
    }

    // ── ② 제로카피: JS 가 만든 ArrayBuffer 의 실제 메모리 주소
    //     같은 버퍼를 두 번 넘겨도 주소가 같으면 = 복사가 없었다는 증거
    if (prop == "bufferAddress") {
      return jsi::Function::createFromHostFunction(
          rt,
          jsi::PropNameID::forAscii(rt, "bufferAddress"),
          1,
          [](jsi::Runtime& rt,
             const jsi::Value&,
             const jsi::Value* args,
             size_t count) -> jsi::Value {
            auto buffer = requireArrayBuffer(rt, args, count);
            std::ostringstream oss;
            oss << "0x" << std::hex
                << reinterpret_cast<std::uintptr_t>(buffer.data(rt));
            return jsi::String::createFromUtf8(rt, oss.str());
          });
    }

    // ── ③ 제로카피 쓰기: C++ 이 JS 의 메모리를 직접 채운다
    if (prop == "fillBuffer") {
      return jsi::Function::createFromHostFunction(
          rt,
          jsi::PropNameID::forAscii(rt, "fillBuffer"),
          2,
          [](jsi::Runtime& rt,
             const jsi::Value&,
             const jsi::Value* args,
             size_t count) -> jsi::Value {
            auto buffer = requireArrayBuffer(rt, args, count);
            if (count < 2 || !args[1].isNumber()) {
              throw jsi::JSError(rt, "fillBuffer(buffer, byte) 형태로 호출하세요");
            }
            const auto byte =
                static_cast<std::uint8_t>(args[1].asNumber());
            const auto size = buffer.size(rt);
            // 반환값으로 넘기는 게 아니라 원본을 그 자리에서 덮어쓴다
            std::memset(buffer.data(rt), byte, size);
            return jsi::Value(static_cast<double>(size));
          });
    }

    // ── ④ 제로카피 읽기: 큰 버퍼를 넘겨도 전달 비용이 상수
    if (prop == "sumBuffer") {
      return jsi::Function::createFromHostFunction(
          rt,
          jsi::PropNameID::forAscii(rt, "sumBuffer"),
          1,
          [](jsi::Runtime& rt,
             const jsi::Value&,
             const jsi::Value* args,
             size_t count) -> jsi::Value {
            auto buffer = requireArrayBuffer(rt, args, count);
            const auto* raw = buffer.data(rt);
            const auto size = buffer.size(rt);
            std::uint64_t sum = 0;
            for (size_t i = 0; i < size; i++) {
              sum += raw[i];
            }
            return jsi::Value(static_cast<double>(sum));
          });
    }

    // ── ⑤ 동기 호출의 대가: JS 스레드가 실제로 멈추는 걸 체험
    //     JSI 는 동기 호출을 가능하게 해줬을 뿐, 안전하게 만들어주진 않는다
    if (prop == "blockJsThread") {
      return jsi::Function::createFromHostFunction(
          rt,
          jsi::PropNameID::forAscii(rt, "blockJsThread"),
          1,
          [](jsi::Runtime& rt,
             const jsi::Value&,
             const jsi::Value* args,
             size_t count) -> jsi::Value {
            if (count < 1 || !args[0].isNumber()) {
              throw jsi::JSError(rt, "blockJsThread(ms: number) 형태로 호출하세요");
            }
            const auto ms = static_cast<long long>(args[0].asNumber());
            const auto start = std::chrono::steady_clock::now();
            std::this_thread::sleep_for(std::chrono::milliseconds(ms));
            const auto elapsed =
                std::chrono::duration_cast<std::chrono::milliseconds>(
                    std::chrono::steady_clock::now() - start)
                    .count();
            return jsi::Value(static_cast<double>(elapsed));
          });
    }

    return jsi::Value::undefined();
  }

  std::vector<jsi::PropNameID> getPropertyNames(jsi::Runtime& rt) override {
    std::vector<jsi::PropNameID> names;
    for (const auto* prop : {"kind",
                             "add",
                             "bufferAddress",
                             "fillBuffer",
                             "sumBuffer",
                             "blockJsThread"}) {
      names.push_back(jsi::PropNameID::forAscii(rt, prop));
    }
    return names;
  }

 private:
  static jsi::ArrayBuffer requireArrayBuffer(
      jsi::Runtime& rt,
      const jsi::Value* args,
      size_t count) {
    if (count < 1 || !args[0].isObject()) {
      throw jsi::JSError(rt, "첫 인자로 ArrayBuffer 가 필요합니다");
    }
    auto obj = args[0].asObject(rt);
    if (!obj.isArrayBuffer(rt)) {
      throw jsi::JSError(rt, "첫 인자가 ArrayBuffer 가 아닙니다");
    }
    return obj.getArrayBuffer(rt);
  }
};

} // namespace

NativeJsiLab::NativeJsiLab(std::shared_ptr<CallInvoker> jsInvoker)
    : NativeJsiLabCxxSpec(std::move(jsInvoker)) {}

bool NativeJsiLab::install(jsi::Runtime& rt) {
  // HostObject 를 JS 전역에 꽂는다. 이 한 줄이 JSI 의 전부다.
  rt.global().setProperty(
      rt,
      "__jsiLab",
      jsi::Object::createFromHostObject(
          rt, std::make_shared<JsiLabHostObject>()));
  return true;
}

} // namespace facebook::react
