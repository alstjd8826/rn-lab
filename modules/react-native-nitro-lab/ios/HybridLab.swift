import Foundation
import NitroModules

// `npx nitrogen` 후 생성되는 HybridLabSpec 을 상속.
class HybridLab: HybridLabSpec {
  func hello(name: String) throws -> String {
    return "Hello, \(name)! (from Nitro/Swift)"
  }

  func add(a: Double, b: Double) throws -> Double {
    return a + b
  }

  func delay(ms: Double) throws -> Promise<Void> {
    return Promise.async {
      try await Task.sleep(nanoseconds: UInt64(ms) * 1_000_000)
    }
  }
}
