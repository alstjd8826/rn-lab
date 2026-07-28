import Foundation
import ActivityKit
import NitroModules

// `npx nitrogen` 후 생성되는 HybridTimerActivitySpec 상속.
class HybridTimerActivity: HybridTimerActivitySpec {

  func isSupported() throws -> Bool {
    if #available(iOS 16.2, *) {
      return ActivityAuthorizationInfo().areActivitiesEnabled
    }
    return false
  }

  func start(state: TimerActivityState) throws -> Promise<String> {
    return Promise.async {
      guard #available(iOS 16.2, *) else {
        throw NSError(domain: "NitroTimerActivity", code: 1,
                      userInfo: [NSLocalizedDescriptionKey: "Live Activities require iOS 16.2+"])
      }
      guard ActivityAuthorizationInfo().areActivitiesEnabled else {
        throw NSError(domain: "NitroTimerActivity", code: 2,
                      userInfo: [NSLocalizedDescriptionKey: "Live Activities are disabled by the user"])
      }
      let end = Date(timeIntervalSince1970: state.endTimeEpochMs / 1000.0)
      let attributes = TimerActivityAttributes(title: state.title)
      let content = TimerActivityAttributes.ContentState(endTime: end)
      let activity = try Activity.request(
        attributes: attributes,
        content: .init(state: content, staleDate: end)
      )
      return activity.id
    }
  }

  func update(id: String, state: TimerActivityState) throws -> Promise<Void> {
    return Promise.async {
      guard #available(iOS 16.2, *) else { return }
      let end = Date(timeIntervalSince1970: state.endTimeEpochMs / 1000.0)
      if let activity = Activity<TimerActivityAttributes>.activities.first(where: { $0.id == id }) {
        await activity.update(
          .init(state: .init(endTime: end), staleDate: end)
        )
      }
    }
  }

  func end(id: String) throws -> Promise<Void> {
    return Promise.async {
      guard #available(iOS 16.2, *) else { return }
      if let activity = Activity<TimerActivityAttributes>.activities.first(where: { $0.id == id }) {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
    }
  }
}
