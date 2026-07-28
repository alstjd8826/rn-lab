import ActivityKit
import WidgetKit
import SwiftUI

// ⚠️ Nitro 모듈(ios/TimerActivityAttributes.swift)과 **이름·구조 동일**해야
//    ActivityKit 이 앱의 Activity 를 이 위젯에 매칭한다. (LA 핵심 함정)
struct TimerActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var endTime: Date
  }
  var title: String
}

struct WidgetLiveActivity: Widget {
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
      .activitySystemActionForegroundColor(Color.primary)
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
      .keylineTint(Color.accentColor)
    }
  }
}

extension TimerActivityAttributes {
  fileprivate static var preview: TimerActivityAttributes {
    TimerActivityAttributes(title: "집중 타이머")
  }
}

extension TimerActivityAttributes.ContentState {
  fileprivate static var sample: TimerActivityAttributes.ContentState {
    TimerActivityAttributes.ContentState(endTime: Date().addingTimeInterval(25 * 60))
  }
}

#Preview("Notification", as: .content, using: TimerActivityAttributes.preview) {
  WidgetLiveActivity()
} contentStates: {
  TimerActivityAttributes.ContentState.sample
}
