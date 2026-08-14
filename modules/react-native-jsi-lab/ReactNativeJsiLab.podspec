require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "ReactNativeJsiLab"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://example.com"
  s.license      = "MIT"
  s.authors      = "me"
  s.platforms    = { :ios => "15.1" }
  s.source       = { :git => "", :tag => "#{s.version}" }

  # ObjC++ 등록부(ios/) + 순수 C++ 본체(cpp/)
  s.source_files = "ios/**/*.{h,mm}", "cpp/**/*.{h,cpp}"

  s.pod_target_xcconfig = {
    # NativeJsiLabProvider.mm 이 "NativeJsiLab.h" 를 찾을 수 있게
    "HEADER_SEARCH_PATHS" => "\"$(PODS_TARGET_SRCROOT)/cpp\"",
    "CLANG_CXX_LANGUAGE_STANDARD" => "c++20"
  }

  # React-Core / React-jsi / ReactCommon / ReactCodegen 의존성을 한 번에 붙여준다.
  # ReactCodegen 이 JsiLabSpecsJSI.h 를 제공한다.
  install_modules_dependencies(s)
end
