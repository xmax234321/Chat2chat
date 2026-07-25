import UIKit

/// Blocks screenshots and hides content while the screen is being recorded.
/// Uses the secure UITextField layer reparenting technique (iOS 17+ compatible).
final class ScreenshotProtection {
    static let shared = ScreenshotProtection()

    private var screenshotPreventionTextField: UITextField?
    private weak var screenshotProtectedWindow: UIWindow?
    private weak var originalWindowSuperlayer: CALayer?
    private weak var shieldView: UIView?
    private var captureObserver: NSObjectProtocol?
    private var resignActiveObserver: NSObjectProtocol?
    private var becomeActiveObserver: NSObjectProtocol?
    private weak var windowProvider: UIWindow?
    private var protectionEnabled = false
    private var lifecycleObserved = false

    func enable(on window: UIWindow?) {
        windowProvider = window
        if protectionEnabled {
            enableScreenshotPrevention()
        }
        observeScreenCapture()
        observeAppLifecycle()
    }

    func setProtectionEnabled(_ enabled: Bool) {
        guard protectionEnabled != enabled else { return }
        protectionEnabled = enabled
        if enabled {
            enableScreenshotPrevention()
        } else {
            teardownScreenshotPrevention()
        }
    }

    private func currentWindow() -> UIWindow? {
        if let window = windowProvider, window.windowScene != nil {
            return window
        }

        return UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first(where: \.isKeyWindow)
    }

    private func teardownScreenshotPrevention() {
        guard let textField = screenshotPreventionTextField else { return }

        if let window = screenshotProtectedWindow, let screenLayer = originalWindowSuperlayer {
            window.layer.removeFromSuperlayer()
            screenLayer.addSublayer(window.layer)
        }

        textField.layer.removeFromSuperlayer()
        screenshotPreventionTextField = nil
        screenshotProtectedWindow = nil
        originalWindowSuperlayer = nil
    }

    private func enableScreenshotPrevention() {
        guard protectionEnabled else { return }
        guard screenshotPreventionTextField == nil,
              let window = currentWindow(),
              let screenLayer = window.layer.superlayer else {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { [weak self] in
                self?.enableScreenshotPrevention()
            }
            return
        }

        let textField = UITextField()
        textField.isSecureTextEntry = true
        textField.isUserInteractionEnabled = false

        screenLayer.addSublayer(textField.layer)

        let secureSublayer: CALayer?
        if #available(iOS 17.0, *) {
            secureSublayer = textField.layer.sublayers?.last ?? textField.layer.sublayers?.first
        } else {
            secureSublayer = textField.layer.sublayers?.first ?? textField.layer.sublayers?.last
        }

        guard let secureSublayer else {
            textField.layer.removeFromSuperlayer()
            return
        }

        originalWindowSuperlayer = screenLayer
        secureSublayer.addSublayer(window.layer)
        screenshotPreventionTextField = textField
        screenshotProtectedWindow = window
    }

    private func observeScreenCapture() {
        guard captureObserver == nil else { return }

        captureObserver = NotificationCenter.default.addObserver(
            forName: UIScreen.capturedDidChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            guard let self, let window = self.currentWindow() else { return }
            self.updateRecordingShield(for: window)
        }
    }

    private func observeAppLifecycle() {
        guard !lifecycleObserved else { return }
        lifecycleObserved = true

        let center = NotificationCenter.default
        resignActiveObserver = center.addObserver(
            forName: UIApplication.willResignActiveNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            guard let self, let window = self.currentWindow() else { return }
            self.showAppSwitcherShield(on: window)
        }

        becomeActiveObserver = center.addObserver(
            forName: UIApplication.didBecomeActiveNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            guard let self else { return }
            self.hideAppSwitcherShield()
            if self.protectionEnabled {
                self.enableScreenshotPrevention()
            }
        }
    }

    private func updateRecordingShield(for window: UIWindow) {
        if UIScreen.main.isCaptured {
            if shieldView == nil {
                let shield = UIView(frame: window.bounds)
                shield.autoresizingMask = [.flexibleWidth, .flexibleHeight]
                shield.backgroundColor = .black
                shield.isUserInteractionEnabled = false
                window.addSubview(shield)
                shieldView = shield
            }
            shieldView?.frame = window.bounds
            shieldView?.isHidden = false
            if let shieldView {
                window.bringSubviewToFront(shieldView)
            }
        } else {
            shieldView?.isHidden = true
        }
    }

    private func showAppSwitcherShield(on window: UIWindow) {
        guard shieldView == nil else { return }
        let shield = UIView(frame: window.bounds)
        shield.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        shield.backgroundColor = UIColor(red: 11 / 255, green: 11 / 255, blue: 12 / 255, alpha: 1)
        shield.isUserInteractionEnabled = false
        window.addSubview(shield)
        shieldView = shield
    }

    private func hideAppSwitcherShield() {
        shieldView?.removeFromSuperview()
        shieldView = nil
    }

    deinit {
        let center = NotificationCenter.default
        [captureObserver, resignActiveObserver, becomeActiveObserver].forEach { observer in
            if let observer {
                center.removeObserver(observer)
            }
        }
        hideAppSwitcherShield()
    }
}
