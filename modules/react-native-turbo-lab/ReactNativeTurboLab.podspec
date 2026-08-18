require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "ReactNativeTurboLab"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://example.com"
  s.license      = "MIT"
  s.authors      = "me"
  s.platforms    = { :ios => "15.1" }
  s.source       = { :git => "", :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,mm}", "cpp/**/*.{h,cpp}"

  s.pod_target_xcconfig = {
    "HEADER_SEARCH_PATHS" => "\"$(PODS_TARGET_SRCROOT)/cpp\"",
    "CLANG_CXX_LANGUAGE_STANDARD" => "c++20"
  }

  install_modules_dependencies(s)
end
