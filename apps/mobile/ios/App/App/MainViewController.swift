import Capacitor
import WebKit

class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(PhotoGalleryPlugin())
        bridge?.registerPluginInstance(BiometricAuthPlugin())
        bridge?.registerPluginInstance(SecureStoragePlugin())
        bridge?.registerPluginInstance(DesktopLinkPlugin())
        bridge?.registerPluginInstance(BackupExportPlugin())
        bridge?.registerPluginInstance(AppIconPlugin())
        bridge?.registerPluginInstance(DocumentPreviewPlugin())
        bridge?.registerPluginInstance(ScreenshotProtectionPlugin())
        bridge?.registerPluginInstance(NetworkStatusPlugin())
    }

    override open func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        ScreenshotProtection.shared.enable(on: view.window)
        if let webView = bridge?.webView as? WKWebView {
            webView.allowsBackForwardNavigationGestures = false
        }
    }

    override open func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        ScreenshotProtection.shared.enable(on: view.window)
    }
}
