import Capacitor
import LocalAuthentication

@objc(BiometricAuthPlugin)
public class BiometricAuthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BiometricAuthPlugin"
    public let jsName = "BiometricAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "authenticate", returnType: CAPPluginReturnPromise),
    ]

    @objc func isAvailable(_ call: CAPPluginCall) {
        let context = LAContext()
        var error: NSError?
        let canEvaluate = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
        call.resolve([
            "available": canEvaluate,
            "biometryType": biometryTypeName(for: context.biometryType, available: canEvaluate),
            "error": canEvaluate ? NSNull() : (error?.localizedDescription ?? "unavailable"),
        ])
    }

    @objc func authenticate(_ call: CAPPluginCall) {
        let reason = call.getString("reason") ?? "Unlock Chat2Chat"
        let mode = call.getString("mode") ?? ""
        let context = LAContext()
        context.localizedCancelTitle = "Cancel"

        let useDeviceAuth = mode == "unlock" || reason.localizedCaseInsensitiveContains("unlock")
        let policy: LAPolicy = useDeviceAuth
            ? .deviceOwnerAuthentication
            : .deviceOwnerAuthenticationWithBiometrics

        var error: NSError?
        guard context.canEvaluatePolicy(policy, error: &error) else {
            call.resolve([
                "success": false,
                "error": "unavailable",
            ])
            return
        }

        context.evaluatePolicy(policy, localizedReason: reason) { success, evaluateError in
            DispatchQueue.main.async {
                if success {
                    call.resolve(["success": true])
                    return
                }

                let nsError = evaluateError as NSError?
                call.resolve([
                    "success": false,
                    "error": self.errorName(for: nsError),
                    "code": nsError?.code ?? -1,
                ])
            }
        }
    }

    private func biometryTypeName(for type: LABiometryType, available: Bool) -> String {
        guard available else { return "none" }
        switch type {
        case .faceID, .opticID:
            return "face"
        case .touchID:
            return "touch"
        default:
            return "none"
        }
    }

    private func errorName(for error: NSError?) -> String {
        guard let error else { return "failed" }
        if error.domain == LAError.errorDomain {
            switch LAError.Code(rawValue: error.code) {
            case .userCancel, .appCancel, .systemCancel:
                return "cancelled"
            case .biometryNotAvailable, .biometryNotEnrolled, .biometryLockout:
                return "unavailable"
            default:
                return "failed"
            }
        }
        return "failed"
    }
}
