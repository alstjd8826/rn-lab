// ⚠️ 이 파일은 Nitro pod 이 아니라 **Widget Extension 타깃**에 들어간다.
//    (podspec source_files 는 ios/*.swift 만 → ios/widget/ 제외)
//    Expo 에선 config plugin 으로 Widget Extension 타깃을 prebuild 때 생성하고
//    이 파일 + TimerActivityAttributes.swift 를 그 타깃에 포함시킨다.
import ActivityKit
import WidgetKit
import SwiftUI

@available(iOS 16.1, *)
struct TimerLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: TimerActivityAttributes.self) { context in
      // 잠금화면 / 배너
      VStack(spacing: 8) {
        Text(context.attributes.title)
          .font(.headline)
        Text(timerInterval: Date.now...context.state.endTime, countsDown: true)
          .font(.system(size: 44, weight: .bold, design: .rounded))
          .monospacedDigit()
          .multilineTextAlignment(.center)
      }
      .padding()
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Text(context.attributes.title).font(.caption).lineLimit(1)
        }
        DynamicIslandExpandedRegion(.trailing) {
          Text(timerInterval: Date.now...context.state.endTime, countsDown: true)
            .font(.title2).monospacedDigit().frame(maxWidth: 90)
        }
      } compactLeading: {
        Image(systemName: "timer")
      } compactTrailing: {
        Text(timerInterval: Date.now...context.state.endTime, countsDown: true)
          .monospacedDigit().frame(maxWidth: 44)
      } minimal: {
        Image(systemName: "timer")
      }
    }
  }
}
