require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "ReactNativeFabricLab"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://example.com"
  s.license      = "MIT"
  s.authors      = "me"
  s.platforms    = { :ios => "15.1" }
  s.source       = { :git => "", :tag => "#{s.version}" }

  # Fabric 컴포넌트 구현은 ObjC++ 여야 한다 (C++ 생성 헤더를 쓰므로)
  s.source_files = "ios/**/*.{h,mm}"

  s.pod_target_xcconfig = {
    "CLANG_CXX_LANGUAGE_STANDARD" => "c++20"
  }

  # ReactCodegen(생성된 컴포넌트 헤더) 포함 의존성 일괄 연결
  install_modules_dependencies(s)
end
