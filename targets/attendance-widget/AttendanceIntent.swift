import AppIntents
import WidgetKit

/// Widget-ийн «Ирлээ / Явлаа» товч — апп нээлгүйгээр серверт бүртгэнэ.
///
/// Байршлыг widget-ээс авна (зөвшөөрөлгүй бол сервер аппын сүүлийн
/// байршлыг ашиглана). Бүсээс гадуур бол бүртгэхгүй, widget дээр
/// «апп нээж бүртгэнэ үү» гэж гарна — widget-ийг дарахад апп нээгдэнэ.
struct AttendanceActionIntent: AppIntent {
  static var title: LocalizedStringResource = "Ирц бүртгэх"
  static var description = IntentDescription("Апп нээлгүйгээр ирсэн, явснаа бүртгэнэ.")
  static var isDiscoverable: Bool = false

  @Parameter(title: "Үйлдэл")
  var action: String

  init() {
    self.action = "check_in"
  }

  init(action: String) {
    self.action = action
  }

  func perform() async throws -> some IntentResult {
    guard WidgetStore.config() != nil else {
      WidgetStore.setMessage(reasonMessage("not_configured"))
      WidgetCenter.shared.reloadAllTimelines()
      return .result()
    }

    let location = await OneShotLocation().get()
    do {
      let res = try await WidgetAPI.call(action, location: location)
      if let state = res.state { WidgetStore.save(state) }
      if res.ok == true {
        WidgetStore.setMessage(action == "check_out" ? "Явсан бүртгэгдлээ" : "Ирц бүртгэгдлээ")
      } else {
        WidgetStore.setMessage(reasonMessage(res.reason ?? res.error ?? "error"))
      }
    } catch {
      WidgetStore.setMessage("Сүлжээ алга — дахин оролдоно уу")
    }
    WidgetCenter.shared.reloadAllTimelines()
    return .result()
  }
}
