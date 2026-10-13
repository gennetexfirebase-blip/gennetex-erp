import Foundation
import CoreLocation
import WidgetKit

/// Апп ↔ widget-ийн App Group (app.json `ios.entitlements`).
let gxAppGroup = "group.com.gennetex.erp"

/// Апп бичдэг тохиргоо (src/services/attendanceWidgetService.js).
struct WidgetConfig: Codable {
  let token: String
  let url: String
}

/// `widget-attendance` edge function-ийн буцаадаг өнөөдрийн төлөв.
struct AttendanceState: Codable {
  var name: String?
  var status: String          // none | working | done
  var checkInAt: String?
  var checkOutAt: String?
  var pending: Bool?
  var shiftStart: String      // "09:00"
  var shiftEnd: String        // "18:00"
  var locationName: String?
}

struct WidgetResponse: Codable {
  var ok: Bool?
  var reason: String?
  var distance: Int?
  var error: String?
  var state: AttendanceState?
}

enum WidgetStore {
  static var defaults: UserDefaults? { UserDefaults(suiteName: gxAppGroup) }

  private static func decode<T: Decodable>(_ key: String) -> T? {
    guard let text = defaults?.string(forKey: key), let data = text.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(T.self, from: data)
  }

  static func config() -> WidgetConfig? { decode("attendanceWidgetConfig") }
  static func state() -> AttendanceState? { decode("attendanceWidgetState") }

  static func save(_ state: AttendanceState) {
    guard let data = try? JSONEncoder().encode(state), let text = String(data: data, encoding: .utf8) else { return }
    defaults?.set(text, forKey: "attendanceWidgetState")
  }

  /// Товч дарсны дараах түр мессеж (2 минутын дараа арилна).
  static func setMessage(_ text: String?) {
    if let text {
      defaults?.set(text, forKey: "attendanceWidgetMessage")
      defaults?.set(Date().timeIntervalSince1970, forKey: "attendanceWidgetMessageAt")
    } else {
      defaults?.removeObject(forKey: "attendanceWidgetMessage")
    }
  }

  static func message(now: Date = Date()) -> String? {
    guard let text = defaults?.string(forKey: "attendanceWidgetMessage") else { return nil }
    let at = defaults?.double(forKey: "attendanceWidgetMessageAt") ?? 0
    return now.timeIntervalSince1970 - at < 120 ? text : nil
  }
}

enum WidgetAPI {
  static func call(_ action: String, location: CLLocation? = nil) async throws -> WidgetResponse {
    guard let cfg = WidgetStore.config(), let url = URL(string: "\(cfg.url)/functions/v1/widget-attendance") else {
      return WidgetResponse(ok: false, reason: "not_configured")
    }
    var body: [String: Any] = ["token": cfg.token, "action": action]
    if let location {
      body["latitude"] = location.coordinate.latitude
      body["longitude"] = location.coordinate.longitude
      body["accuracy"] = location.horizontalAccuracy
    }
    var request = URLRequest(url: url, timeoutInterval: 15)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try JSONSerialization.data(withJSONObject: body)
    let (data, _) = try await URLSession.shared.data(for: request)
    return (try? JSONDecoder().decode(WidgetResponse.self, from: data)) ?? WidgetResponse(ok: false, error: "bad_response")
  }
}

/// Нэг удаагийн GPS. Widget-д байршлын зөвшөөрөл байхгүй бол `nil` —
/// сервер аппын сүүлийн байршлыг ашиглах эсвэл аппыг нээлгэнэ.
@MainActor
final class OneShotLocation: NSObject, CLLocationManagerDelegate {
  private let manager = CLLocationManager()
  private var continuation: CheckedContinuation<CLLocation?, Never>?

  func get(timeout: TimeInterval = 8) async -> CLLocation? {
    let status = manager.authorizationStatus
    guard status == .authorizedAlways || status == .authorizedWhenInUse else { return nil }
    return await withCheckedContinuation { (c: CheckedContinuation<CLLocation?, Never>) in
      continuation = c
      manager.delegate = self
      manager.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
      manager.requestLocation()
      Task { @MainActor [weak self] in
        try? await Task.sleep(nanoseconds: UInt64(timeout * 1_000_000_000))
        self?.finish(nil)
      }
    }
  }

  private func finish(_ location: CLLocation?) {
    guard let c = continuation else { return }
    continuation = nil
    c.resume(returning: location)
  }

  nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    let last = locations.last
    Task { @MainActor in self.finish(last) }
  }

  nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    Task { @MainActor in self.finish(nil) }
  }
}

// MARK: - Цагийн туслах

enum WidgetTime {
  static let iso: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f
  }()
  static let isoPlain = ISO8601DateFormatter()

  static func parse(_ text: String?) -> Date? {
    guard let text else { return nil }
    return iso.date(from: text) ?? isoPlain.date(from: text)
  }

  static let ub: Calendar = {
    var c = Calendar(identifier: .gregorian)
    c.timeZone = TimeZone(identifier: "Asia/Ulaanbaatar") ?? .current
    return c
  }()

  /// Өнөөдрийн "09:00" → Date (Улаанбаатарын цагаар).
  static func today(_ hhmm: String, now: Date = Date()) -> Date {
    let parts = hhmm.split(separator: ":").compactMap { Int($0) }
    return ub.date(bySettingHour: parts.first ?? 9, minute: parts.count > 1 ? parts[1] : 0, second: 0, of: now) ?? now
  }

  static func hhmm(_ date: Date?) -> String {
    guard let date else { return "--:--" }
    let c = ub.dateComponents([.hour, .minute], from: date)
    return String(format: "%02d:%02d", c.hour ?? 0, c.minute ?? 0)
  }

  /// 3ц 05м
  static func duration(_ seconds: TimeInterval) -> String {
    let m = max(0, Int(seconds) / 60)
    return "\(m / 60)ц \(String(format: "%02d", m % 60))м"
  }
}

func reasonMessage(_ reason: String?) -> String? {
  switch reason {
  case nil: return nil
  case "outside"?: return "Ажлын бүсээс гадуур байна — апп нээж бүртгэнэ үү"
  case "no_location"?: return "Байршил тодорхойгүй — апп нээж бүртгэнэ үү"
  case "already"?: return "Аль хэдийн бүртгэгдсэн"
  case "not_checked_in"?: return "Эхлээд ирснээ бүртгэнэ үү"
  case "not_configured"?: return "Апп-д нэвтэрнэ үү"
  default: return "Бүртгэж чадсангүй — апп нээнэ үү"
  }
}
