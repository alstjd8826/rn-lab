import Foundation
import ActivityKit

// ⚠️ 앱 타깃(이 pod) + Widget Extension 타깃 양쪽 멤버십 필요.
@available(iOS 16.1, *)
struct TimerActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    /// 카운트다운 종료 시각. SwiftUI Text(timerInterval:) 로 렌더.
    var endTime: Date
  }

  /// 정적 타이틀
  var title: String
}
