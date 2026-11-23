// herdr-notify: space별로 접히는(threadIdentifier) macOS 알림 헬퍼.
//  - 인자가 있으면(--title 등) 알림을 올리고 종료한다.
//  - 알림을 클릭하면 macOS가 이 앱을 다시 띄우고, 그때 userInfo의 명령으로 에이전트에 포커스한다.
import Cocoa
import UserNotifications

let herdrBundleID = "dev.herdr.app"

func parseArgs() -> [String: String] {
    var out: [String: String] = [:]
    var it = CommandLine.arguments.dropFirst().makeIterator()
    while let k = it.next() {
        guard k.hasPrefix("--"), let v = it.next() else { continue }
        out[String(k.dropFirst(2))] = v
    }
    return out
}

final class Delegate: NSObject, NSApplicationDelegate, UNUserNotificationCenterDelegate {
    let args = parseArgs()
    let center = UNUserNotificationCenter.current()

    func applicationDidFinishLaunching(_ n: Notification) {
        center.delegate = self
        if args["title"] != nil {
            post()
        } else {
            // 클릭으로 실행된 경우: didReceive가 오기를 잠깐 기다렸다가 끝낸다.
            DispatchQueue.main.asyncAfter(deadline: .now() + 5) { exit(0) }
        }
    }

    func post() {
        center.requestAuthorization(options: [.alert, .sound]) { granted, _ in
            guard granted else { FileHandle.standardError.write(Data("notification permission denied\n".utf8)); exit(3) }
            let c = UNMutableNotificationContent()
            c.title = self.args["title"] ?? ""
            c.subtitle = self.args["subtitle"] ?? ""
            c.body = self.args["body"] ?? ""
            c.sound = .default
            if let t = self.args["thread"] { c.threadIdentifier = t }
            var info: [String: String] = [:]
            for k in ["terminal", "herdr-app"] { if let v = self.args[k] { info[k] = v } }
            c.userInfo = info
            // identifier가 같으면 이전 알림이 교체된다(에이전트당 1개).
            let id = self.args["id"] ?? UUID().uuidString
            self.center.add(UNNotificationRequest(identifier: id, content: c, trigger: nil)) { err in
                if let err = err { FileHandle.standardError.write(Data("\(err)\n".utf8)); exit(1) }
                exit(0)
            }
        }
    }

    func userNotificationCenter(_ c: UNUserNotificationCenter, willPresent n: UNNotification,
                                withCompletionHandler done: @escaping (UNNotificationPresentationOptions) -> Void) {
        done([.banner, .list, .sound])
    }

    func userNotificationCenter(_ c: UNUserNotificationCenter, didReceive r: UNNotificationResponse,
                                withCompletionHandler done: @escaping () -> Void) {
        let info = r.notification.request.content.userInfo
        if let app = info["herdr-app"] as? String, let terminal = info["terminal"] as? String {
            let p = Process()
            p.executableURL = URL(fileURLWithPath: app)
            let json = try? JSONSerialization.data(withJSONObject: ["terminal": terminal])
            p.arguments = ["do", "agent.focus", String(data: json ?? Data(), encoding: .utf8) ?? "{}"]
            try? p.run()
        }
        if let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: herdrBundleID) {
            NSWorkspace.shared.openApplication(at: url, configuration: NSWorkspace.OpenConfiguration())
        }
        done()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { exit(0) }
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let delegate = Delegate()
app.delegate = delegate
app.run()
