import SwiftUI
import WidgetKit
import AppIntents

// MARK: - Өнгө (src/theme/tokens.js-тэй ижил)

extension UIColor {
  convenience init(hex: UInt32) {
    self.init(red: CGFloat((hex >> 16) & 0xff) / 255, green: CGFloat((hex >> 8) & 0xff) / 255,
              blue: CGFloat(hex & 0xff) / 255, alpha: 1)
  }
}

extension Color {
  init(light: UInt32, dark: UInt32) {
    self.init(UIColor { t in UIColor(hex: t.userInterfaceStyle == .dark ? dark : light) })
  }
}

enum Theme {
  static let bg = Color(light: 0xFFFFFF, dark: 0x171B22)
  static let ink = Color(light: 0x0F1722, dark: 0xF1F4F8)
  static let muted = Color(light: 0x677284, dark: 0x9AA4B2)
  static let line = Color(light: 0xE6E9EE, dark: 0x2A303A)
  static let brand = Color(light: 0x0B6E4F, dark: 0x1F9D74)
  static let ok = Color(light: 0x15924A, dark: 0x3FCB7C)
  static let okSoft = Color(light: 0xE3F4EA, dark: 0x12291C)
  static let warn = Color(light: 0xB86E00, dark: 0xF2B13E)
  static let warnSoft = Color(light: 0xFFF2D6, dark: 0x2E2412)
  static let bad = Color(light: 0xD23A2F, dark: 0xFF7366)
}

// MARK: - Timeline

struct AttendanceEntry: TimelineEntry {
  let date: Date
  let state: AttendanceState?
  let configured: Bool
  let message: String?
}

extension AttendanceState {
  static let sample = AttendanceState(name: "Батболд", status: "none", checkInAt: nil, checkOutAt: nil,
                                      pending: false, shiftStart: "09:00", shiftEnd: "18:00", locationName: "Төв оффис")
}

struct AttendanceProvider: TimelineProvider {
  func placeholder(in context: Context) -> AttendanceEntry {
    AttendanceEntry(date: Date(), state: .sample, configured: true, message: nil)
  }

  func getSnapshot(in context: Context, completion: @escaping (AttendanceEntry) -> Void) {
    completion(AttendanceEntry(date: Date(), state: WidgetStore.state() ?? .sample, configured: true, message: nil))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<AttendanceEntry>) -> Void) {
    Task {
      // Өөр замаар (апп, өөр утас) бүртгэсэн байж болох тул серверээс шинэчилнэ.
      if WidgetStore.config() != nil, let res = try? await WidgetAPI.call("status"), let state = res.state {
        WidgetStore.save(state)
      }
      let now = Date()
      let state = WidgetStore.state()
      let configured = WidgetStore.config() != nil
      let message = WidgetStore.message(now: now)
      var entries = [AttendanceEntry(date: now, state: state, configured: configured, message: message)]
      // 15 минут тутам хувь, үлдсэн цагийг шинэчилнэ.
      for i in 1...8 {
        entries.append(AttendanceEntry(date: now.addingTimeInterval(Double(i) * 900), state: state,
                                       configured: configured, message: nil))
      }
      let next = now.addingTimeInterval(message != nil ? 120 : 1800)
      completion(Timeline(entries: entries, policy: .after(next)))
    }
  }
}

// MARK: - Тооцоо

struct AttendanceModel {
  let entry: AttendanceEntry

  var state: AttendanceState { entry.state ?? .sample }
  var status: String { entry.state?.status ?? "none" }
  var checkIn: Date? { WidgetTime.parse(state.checkInAt) }
  var checkOut: Date? { WidgetTime.parse(state.checkOutAt) }
  var shiftStart: Date { WidgetTime.today(state.shiftStart, now: entry.date) }
  var shiftEnd: Date { WidgetTime.today(state.shiftEnd, now: entry.date) }
  var shiftLength: TimeInterval { max(3600, shiftEnd.timeIntervalSince(shiftStart)) }

  var worked: TimeInterval {
    guard let checkIn else { return 0 }
    return max(0, (checkOut ?? entry.date).timeIntervalSince(checkIn))
  }
  var fraction: Double { min(1, worked / shiftLength) }
  var percent: Int { Int((fraction * 100).rounded()) }

  var dayFraction: Double {
    min(1, max(0, entry.date.timeIntervalSince(shiftStart) / shiftLength))
  }

  var remainingText: String {
    if status == "done" { return "Ажилласан \(WidgetTime.duration(worked))" }
    let left = shiftEnd.timeIntervalSince(max(entry.date, shiftStart))
    return left > 0 ? "\(WidgetTime.duration(left)) үлдсэн" : "Ээлж дууссан"
  }

  var locationSuffix: String {
    guard let loc = state.locationName, !loc.isEmpty else { return "" }
    return " · " + loc
  }

  var shiftText: String {
    let base = "Ээлж \(state.shiftStart) – \(state.shiftEnd)"
    if let loc = state.locationName, !loc.isEmpty { return "\(base) · \(loc)" }
    return base
  }

  var pill: (text: String, fg: Color, bg: Color) {
    switch status {
    case "working": return (state.pending == true ? "Хүлээгдэж буй" : "Ажил дээр", Theme.ok, Theme.okSoft)
    case "done": return ("Дууссан", Theme.muted, Theme.line)
    default: return ("Бүртгүүлээгүй", Theme.warn, Theme.warnSoft)
    }
  }

  var action: String? {
    switch status {
    case "none": return "check_in"
    case "working": return "check_out"
    default: return nil
    }
  }
}

// MARK: - Жижиг хэсгүүд

struct Ring: View {
  let fraction: Double
  var lineWidth: CGFloat = 6
  var color: Color = Theme.ok

  var body: some View {
    ZStack {
      Circle().stroke(Theme.line, lineWidth: lineWidth)
      Circle()
        .trim(from: 0, to: max(0.001, min(1, fraction)))
        .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
        .rotationEffect(.degrees(-90))
    }
  }
}

struct StatusPill: View {
  let model: AttendanceModel
  var body: some View {
    let p = model.pill
    HStack(spacing: 4) {
      Circle().fill(p.fg).frame(width: 6, height: 6)
      Text(p.text).font(.system(size: 11, weight: .bold)).foregroundStyle(p.fg).lineLimit(1)
    }
    .padding(.horizontal, 8).padding(.vertical, 4)
    .background(Capsule().fill(p.bg))
  }
}

struct ActionButton: View {
  let model: AttendanceModel
  var compact = false

  var body: some View {
    if let action = model.action {
      let out = action == "check_out"
      Button(intent: AttendanceActionIntent(action: action)) {
        HStack(spacing: 6) {
          Image(systemName: out ? "rectangle.portrait.and.arrow.right" : "arrow.right.to.line")
            .font(.system(size: 13, weight: .bold))
          Text(out ? "Явлаа" : "Ирлээ").font(.system(size: 14, weight: .bold))
        }
        .foregroundStyle(.white)
        .frame(maxWidth: compact ? .infinity : nil)
        .padding(.horizontal, 16).padding(.vertical, 10)
        .background(Capsule().fill(out ? Theme.bad : Theme.brand))
      }
      .buttonStyle(.plain)
    }
  }
}

struct Header: View {
  let model: AttendanceModel
  var showName = true
  var body: some View {
    HStack(spacing: 6) {
      Image("gxlogo").resizable().scaledToFit().frame(width: 16, height: 16)
      if showName {
        Text("Gennetex ERP").font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.muted)
      }
      Spacer(minLength: 4)
      StatusPill(model: model)
    }
  }
}

/// Ажилласан цаг: ажил дээр бол тоологдоно, бусад үед тогтмол.
struct WorkedText: View {
  let model: AttendanceModel
  var body: some View {
    if model.status == "working", let checkIn = model.checkIn {
      Text(checkIn, style: .timer).monospacedDigit()
    } else {
      Text(model.status == "done" ? WidgetTime.duration(model.worked) : "0:00").monospacedDigit()
    }
  }
}

// MARK: - Нүүр дэлгэц

struct MediumView: View {
  let model: AttendanceModel
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Header(model: model)
      HStack(alignment: .center, spacing: 10) {
        VStack(alignment: .leading, spacing: 3) {
          Text(model.status == "none" ? "--:--" : WidgetTime.hhmm(model.checkIn))
            .font(.system(size: 26, weight: .bold)).monospacedDigit().foregroundStyle(Theme.ink)
          if let message = model.entry.message {
            Text(message).font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.warn).lineLimit(2)
          } else {
            Text(model.shiftText).font(.system(size: 11)).foregroundStyle(Theme.muted).lineLimit(2)
          }
        }
        Spacer(minLength: 6)
        ZStack {
          Ring(fraction: model.fraction, lineWidth: 6)
          Text("\(model.percent)%").font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.ink)
        }
        .frame(width: 50, height: 50)
      }
      HStack(alignment: .bottom, spacing: 10) {
        VStack(spacing: 3) {
          ProgressView(value: model.dayFraction).tint(Theme.ok)
          HStack {
            Text(model.state.shiftStart)
            Spacer()
            Text(model.remainingText).foregroundStyle(Theme.ink)
            Spacer()
            Text(model.state.shiftEnd)
          }
          .font(.system(size: 9, weight: .medium)).foregroundStyle(Theme.muted)
        }
        ActionButton(model: model)
      }
    }
  }
}

struct SmallView: View {
  let model: AttendanceModel
  var body: some View {
    VStack(spacing: 8) {
      HStack {
        Image("gxlogo").resizable().scaledToFit().frame(width: 16, height: 16)
        Spacer()
        Circle().fill(model.pill.fg).frame(width: 7, height: 7)
      }
      ZStack {
        Ring(fraction: model.fraction, lineWidth: 6)
        WorkedText(model: model)
          .font(.system(size: 15, weight: .bold)).foregroundStyle(Theme.ink)
          .minimumScaleFactor(0.6).lineLimit(1).padding(.horizontal, 8)
      }
      .frame(width: 66, height: 66)
      if model.action != nil {
        ActionButton(model: model, compact: true)
      } else {
        Text(model.entry.message ?? model.remainingText)
          .font(.system(size: 11, weight: .semibold)).foregroundStyle(Theme.muted).lineLimit(2)
          .multilineTextAlignment(.center)
      }
    }
  }
}

struct SignedOutView: View {
  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Image("gxlogo").resizable().scaledToFit().frame(width: 22, height: 22)
      Text("Gennetex ERP").font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.ink)
      Text("Ирцээ widget-ээс бүртгэхийн тулд апп-д нэвтэрнэ үү")
        .font(.system(size: 11)).foregroundStyle(Theme.muted)
      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

// MARK: - Түгжээтэй дэлгэц

struct CircularView: View {
  let model: AttendanceModel
  var body: some View {
    Gauge(value: model.fraction) {
      Text("Ажил")
    } currentValueLabel: {
      Text("\(model.percent)%")
    }
    .gaugeStyle(.accessoryCircularCapacity)
  }
}

struct RectangularView: View {
  let model: AttendanceModel
  var body: some View {
    VStack(alignment: .leading, spacing: 1) {
      switch model.status {
      case "working":
        Text("Ажил дээр" + model.locationSuffix).font(.headline).lineLimit(1)
        Text("Ирсэн \(WidgetTime.hhmm(model.checkIn))").font(.caption).lineLimit(1)
        WorkedText(model: model).font(.caption.bold())
      case "done":
        Text("Ажил дууссан").font(.headline)
        Text("\(WidgetTime.hhmm(model.checkIn)) – \(WidgetTime.hhmm(model.checkOut))").font(.caption)
        Text("Ажилласан \(WidgetTime.duration(model.worked))").font(.caption)
      default:
        Text("Ирцээ бүртгээгүй").font(.headline).lineLimit(1)
        Text("Ээлж " + model.state.shiftStart + model.locationSuffix).font(.caption).lineLimit(1)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

// MARK: - Widget

struct AttendanceWidgetView: View {
  @Environment(\.widgetFamily) var family
  let entry: AttendanceEntry

  var body: some View {
    let model = AttendanceModel(entry: entry)
    Group {
      switch family {
      case .accessoryCircular: CircularView(model: model)
      case .accessoryRectangular: RectangularView(model: model)
      case .accessoryInline:
        Text(model.status == "none" ? "Ирц: бүртгээгүй" : "Ирсэн \(WidgetTime.hhmm(model.checkIn))")
      case .systemSmall:
        if entry.configured { SmallView(model: model) } else { SignedOutView() }
      default:
        if entry.configured { MediumView(model: model) } else { SignedOutView() }
      }
    }
    .widgetURL(URL(string: "gennetex-erp://attendance"))
    .containerBackground(for: .widget) {
      if family == .systemSmall || family == .systemMedium { Theme.bg } else { Color.clear }
    }
  }
}

struct AttendanceWidget: Widget {
  let kind = "AttendanceWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: AttendanceProvider()) { entry in
      AttendanceWidgetView(entry: entry)
    }
    .configurationDisplayName("Ирц")
    .description("Апп нээлгүйгээр ирсэн, явснаа бүртгэнэ.")
    .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline])
  }
}

@main
struct AttendanceWidgetBundle: WidgetBundle {
  var body: some Widget {
    AttendanceWidget()
  }
}
