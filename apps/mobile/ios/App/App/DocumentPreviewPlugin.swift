import Foundation
import Capacitor
import QuickLook

@objc(DocumentPreviewPlugin)
public class DocumentPreviewPlugin: CAPPlugin, CAPBridgedPlugin, QLPreviewControllerDataSource, QLPreviewControllerDelegate {
    public let identifier = "DocumentPreviewPlugin"
    public let jsName = "DocumentPreview"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "preview", returnType: CAPPluginReturnPromise),
    ]

    private var previewCall: CAPPluginCall?
    private var previewURL: URL?

    @objc func preview(_ call: CAPPluginCall) {
        guard let path = call.getString("path"), !path.isEmpty else {
            call.reject("path required")
            return
        }

        let url = URL(fileURLWithPath: path)
        guard FileManager.default.fileExists(atPath: url.path) else {
            call.reject("file not found")
            return
        }

        DispatchQueue.main.async {
            self.previewCall = call
            self.previewURL = url
            let controller = QLPreviewController()
            controller.dataSource = self
            controller.delegate = self
            self.bridge?.viewController?.present(controller, animated: true)
        }
    }

    public func numberOfPreviewItems(in controller: QLPreviewController) -> Int {
        previewURL == nil ? 0 : 1
    }

    public func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> QLPreviewItem {
        previewURL! as QLPreviewItem
    }

    public func previewControllerDidDismiss(_ controller: QLPreviewController) {
        previewCall?.resolve()
        previewCall = nil
        previewURL = nil
    }
}
