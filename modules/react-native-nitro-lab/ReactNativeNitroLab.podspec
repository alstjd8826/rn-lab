require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "ReactNativeNitroLab"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://example.com"
  s.license      = "MIT"
  s.authors      = "me"
  s.platforms    = { :ios => "15.1" }
  s.source       = { :git => "", :tag => "#{s.version}" }

  # ⚠️ module_name = nitro.json iosModuleName. podspec 은 반드시 모듈 ROOT 에.
  s.module_name  = "NitroLab"
  s.source_files = "ios/**/*.{swift}"

  load File.join(__dir__, "nitrogen", "generated", "ios", "NitroLab+autolinking.rb")
  add_nitrogen_files(s)

  install_modules_dependencies(s)
end
