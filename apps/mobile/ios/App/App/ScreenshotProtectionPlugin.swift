import Capacitor

@objc(ScreenshotProtectionPlugin)
public class ScreenshotProtectionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ScreenshotProtectionPlugin"
    public let jsName = "ScreenshotProtection"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setEnabled", returnType: CAPPluginReturnPromise),
    ]

    @objc func setEnabled(_ call: CAPPluginCall) {
        let enabled = call.getBool("enabled") ?? false
        DispatchQueue.main.async {
            ScreenshotProtection.shared.setProtectionEnabled(enabled)
            call.resolve()
        }
    }
}
