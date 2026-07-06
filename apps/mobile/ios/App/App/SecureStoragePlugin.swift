import Foundation
import Security
import Capacitor

@objc(SecureStoragePlugin)
public class SecureStoragePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SecureStoragePlugin"
    public let jsName = "SecureStorage"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getItem", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setItem", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeItem", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setBiometricProtectedItem", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getBiometricProtectedItem", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeBiometricProtectedItem", returnType: CAPPluginReturnPromise),
    ]

    private let service = "org.chat2chat.secure-storage"
    private let biometricService = "org.chat2chat.secure-storage.biometric"

    @objc func getItem(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else {
            call.reject("key required")
            return
        }

        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)

        if status == errSecItemNotFound {
            call.resolve(["value": NSNull()])
            return
        }

        guard status == errSecSuccess, let data = item as? Data, let value = String(data: data, encoding: .utf8) else {
            call.reject("Keychain read failed", nil, NSError(domain: NSOSStatusErrorDomain, code: Int(status)))
            return
        }

        call.resolve(["value": value])
    }

    @objc func setItem(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), let value = call.getString("value") else {
            call.reject("key and value required")
            return
        }

        guard let data = value.data(using: .utf8) else {
            call.reject("invalid value encoding")
            return
        }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]

        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
        ]

        let updateStatus = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if updateStatus == errSecSuccess {
            call.resolve()
            return
        }

        if updateStatus != errSecItemNotFound {
            call.reject("Keychain update failed", nil, NSError(domain: NSOSStatusErrorDomain, code: Int(updateStatus)))
            return
        }

        var addQuery = query
        addQuery[kSecValueData as String] = data
        addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly

        let addStatus = SecItemAdd(addQuery as CFDictionary, nil)
        guard addStatus == errSecSuccess else {
            call.reject("Keychain write failed", nil, NSError(domain: NSOSStatusErrorDomain, code: Int(addStatus)))
            return
        }

        call.resolve()
    }

    @objc func removeItem(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else {
            call.reject("key required")
            return
        }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]

        SecItemDelete(query as CFDictionary)
        call.resolve()
    }

    @objc func setBiometricProtectedItem(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), let value = call.getString("value") else {
            call.reject("key and value required")
            return
        }

        guard let data = value.data(using: .utf8) else {
            call.reject("invalid value encoding")
            return
        }

        var accessError: Unmanaged<CFError>?
        guard let accessControl = SecAccessControlCreateWithFlags(
            nil,
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            .biometryCurrentSet,
            &accessError
        ) else {
            let message = accessError?.takeRetainedValue().localizedDescription ?? "access control failed"
            call.reject(message)
            return
        }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: biometricService,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)

        let addQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: biometricService,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessControl as String: accessControl,
        ]

        let addStatus = SecItemAdd(addQuery as CFDictionary, nil)
        guard addStatus == errSecSuccess else {
            call.reject("Keychain write failed", nil, NSError(domain: NSOSStatusErrorDomain, code: Int(addStatus)))
            return
        }

        call.resolve()
    }

    @objc func getBiometricProtectedItem(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else {
            call.reject("key required")
            return
        }

        let prompt = call.getString("prompt") ?? "Unlock Chat2Chat"

        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: biometricService,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
            kSecUseOperationPrompt as String: prompt,
        ]

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)

        if status == errSecItemNotFound {
            call.resolve(["value": NSNull()])
            return
        }

        if status == errSecUserCanceled || status == errSecAuthFailed {
            call.resolve(["value": NSNull(), "cancelled": true])
            return
        }

        guard status == errSecSuccess, let data = item as? Data, let value = String(data: data, encoding: .utf8) else {
            call.reject("Keychain read failed", nil, NSError(domain: NSOSStatusErrorDomain, code: Int(status)))
            return
        }

        call.resolve(["value": value])
    }

    @objc func removeBiometricProtectedItem(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else {
            call.reject("key required")
            return
        }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: biometricService,
            kSecAttrAccount as String: key,
        ]

        SecItemDelete(query as CFDictionary)
        call.resolve()
    }
}
