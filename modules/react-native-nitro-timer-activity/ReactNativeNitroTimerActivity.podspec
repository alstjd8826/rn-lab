require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "ReactNativeNitroTimerActivity"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://example.com"
  s.license      = "MIT"
  s.authors      = "me"
  s.platforms    = { :ios => "15.1" }
  s.source       = { :git => "", :tag => "#{s.version}" }

  s.module_name  = "NitroTimerActivity"
  # ios/*.swift 만 (앱 타깃). ios/widget/** 는 Widget Extension 타깃 소속 → 제외.
  s.source_files = "ios/*.swift"

  load File.join(__dir__, "nitrogen", "generated", "ios", "NitroTimerActivity+autolinking.rb")
  add_nitrogen_files(s)

  install_modules_dependencies(s)
end
