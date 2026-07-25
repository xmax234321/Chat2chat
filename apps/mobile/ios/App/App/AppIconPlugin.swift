import Capacitor
import UIKit

@objc(AppIconPlugin)
public class AppIconPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppIconPlugin"
    public let jsName = "AppIcon"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setAlternateIcon", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getAlternateIcon", returnType: CAPPluginReturnPromise),
    ]

    private let styleToIconName: [String: String?] = [
        "mono-dark": nil,
        "mono-light": "MonoLightIcon",
    ]

    @objc func setAlternateIcon(_ call: CAPPluginCall) {
        guard let style = call.getString("style") else {
            call.reject("Missing style")
            return
        }
        guard styleToIconName.keys.contains(style) else {
            call.reject("Unknown style")
            return
        }

        guard UIApplication.shared.supportsAlternateIcons else {
            call.reject("Alternate icons are not supported on this device")
            return
        }

        let iconName = styleToIconName[style] ?? nil
        DispatchQueue.main.async {
            UIApplication.shared.setAlternateIconName(iconName) { error in
                if let error = error {
                    call.reject(error.localizedDescription, nil, error)
                    return
                }
                call.resolve([
                    "style": style,
                    "iosName": UIApplication.shared.alternateIconName as Any,
                ])
            }
        }
    }

    @objc func getAlternateIcon(_ call: CAPPluginCall) {
        let iosName = UIApplication.shared.alternateIconName
        let style = iosName == "MonoLightIcon" ? "mono-light" : "mono-dark"
        call.resolve([
            "style": style,
            "iosName": iosName as Any,
        ])
    }
}
