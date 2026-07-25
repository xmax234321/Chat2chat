import Foundation
import UIKit
import Capacitor
import UniformTypeIdentifiers

private struct ZipBackupSession {
    let id: String
    let stagingURL: URL
    let zipURL: URL
}

private struct ZipRestoreSession {
    let id: String
    let extractURL: URL
}

@objc(BackupExportPlugin)
public class BackupExportPlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    public let identifier = "BackupExportPlugin"
    public let jsName = "BackupExport"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "writeBackupFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "beginZipBackup", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "addZipMediaFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "finishZipBackup", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readZipMediaFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "releaseZipRestoreSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "presentShareSheet", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pickBackupFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listBackupsFolder", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readBackupsFolderFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pruneBackupsFolder", returnType: CAPPluginReturnPromise),
    ]

    private static let backupJsonName = "backup.json"
    private static let backupsFolderName = "Backups"

    private func backupsDirectory() throws -> URL {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let backups = docs.appendingPathComponent(Self.backupsFolderName, isDirectory: true)
        if !FileManager.default.fileExists(atPath: backups.path) {
            try FileManager.default.createDirectory(at: backups, withIntermediateDirectories: true)
        }
        return backups
    }

    private func installInBackupsFolder(source: URL, filename: String) throws -> URL {
        let safeName = (filename as NSString).lastPathComponent
        let dest = try backupsDirectory().appendingPathComponent(safeName)
        if FileManager.default.fileExists(atPath: dest.path) {
            try FileManager.default.removeItem(at: dest)
        }
        try FileManager.default.copyItem(at: source, to: dest)
        return dest
    }

    private func writeContentToBackups(_ content: String, filename: String) throws -> URL {
        let safeName = (filename as NSString).lastPathComponent
        let dest = try backupsDirectory().appendingPathComponent(safeName)
        if FileManager.default.fileExists(atPath: dest.path) {
            try FileManager.default.removeItem(at: dest)
        }
        try content.write(to: dest, atomically: true, encoding: .utf8)
        return dest
    }
    private var importCall: CAPPluginCall?
    private var shareCall: CAPPluginCall?
    private var zipSessions: [String: ZipBackupSession] = [:]
    private var restoreSessions: [String: ZipRestoreSession] = [:]

    @objc func writeBackupFile(_ call: CAPPluginCall) {
        guard let filename = call.getString("filename"),
              let content = call.getString("content") else {
            call.reject("filename and content required")
            return
        }

        let safeName = (filename as NSString).lastPathComponent
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let url = try self.writeContentToBackups(content, filename: safeName)
                DispatchQueue.main.async {
                    call.resolve([
                        "uri": url.absoluteString,
                        "path": "Backups/\(safeName)",
                    ])
                }
            } catch {
                DispatchQueue.main.async {
                    call.reject("Could not write backup file", nil, error)
                }
            }
        }
    }

    @objc func beginZipBackup(_ call: CAPPluginCall) {
        guard let filename = call.getString("filename") else {
            call.reject("filename required")
            return
        }

        let sessionId = UUID().uuidString
        let safeName = (filename as NSString).lastPathComponent
        let temp = FileManager.default.temporaryDirectory
        let stagingURL = temp.appendingPathComponent("backup-staging-\(sessionId)", isDirectory: true)
        let zipURL = temp.appendingPathComponent(safeName)

        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            do {
                if FileManager.default.fileExists(atPath: stagingURL.path) {
                    try FileManager.default.removeItem(at: stagingURL)
                }
                try FileManager.default.createDirectory(at: stagingURL, withIntermediateDirectories: true)
                if FileManager.default.fileExists(atPath: zipURL.path) {
                    try FileManager.default.removeItem(at: zipURL)
                }

                let session = ZipBackupSession(id: sessionId, stagingURL: stagingURL, zipURL: zipURL)
                DispatchQueue.main.async {
                    self?.zipSessions[sessionId] = session
                    call.resolve(["sessionId": sessionId])
                }
            } catch {
                DispatchQueue.main.async {
                    call.reject("Could not start backup", nil, error)
                }
            }
        }
    }

    @objc func addZipMediaFile(_ call: CAPPluginCall) {
        guard let sessionId = call.getString("sessionId"),
              let relativePath = call.getString("path"),
              let base64 = call.getString("data"),
              let session = zipSessions[sessionId] else {
            call.reject("sessionId, path, and data required")
            return
        }

        let safePath = Self.sanitizeZipPath(relativePath)
        guard let data = Data(base64Encoded: base64) else {
            call.reject("Invalid media data")
            return
        }

        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            do {
                let fileURL = session.stagingURL.appendingPathComponent(safePath)
                try FileManager.default.createDirectory(
                    at: fileURL.deletingLastPathComponent(),
                    withIntermediateDirectories: true
                )
                try data.write(to: fileURL, options: .atomic)
                DispatchQueue.main.async {
                    call.resolve()
                }
            } catch {
                DispatchQueue.main.async {
                    self?.zipSessions.removeValue(forKey: sessionId)
                    call.reject("Could not add media file", nil, error)
                }
            }
        }
    }

    @objc func finishZipBackup(_ call: CAPPluginCall) {
        guard let sessionId = call.getString("sessionId"),
              let backupJson = call.getString("backupJson"),
              let session = zipSessions.removeValue(forKey: sessionId) else {
            call.reject("sessionId and backupJson required")
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let backupURL = session.stagingURL.appendingPathComponent(Self.backupJsonName)
                try backupJson.write(to: backupURL, atomically: true, encoding: .utf8)

                let fileManager = FileManager.default
                var records: [(path: String, data: Data)] = []
                if let enumerator = fileManager.enumerator(
                    at: session.stagingURL,
                    includingPropertiesForKeys: [.isRegularFileKey]
                ) {
                    for case let fileURL as URL in enumerator {
                        let values = try fileURL.resourceValues(forKeys: [.isRegularFileKey])
                        guard values.isRegularFile == true else { continue }
                        let prefix = session.stagingURL.path + "/"
                        let relative = String(fileURL.path.dropFirst(prefix.count))
                        let data = try Data(contentsOf: fileURL)
                        records.append((relative, data))
                    }
                }

                try ZipWriter.write(records: records, to: session.zipURL)
                try? fileManager.removeItem(at: session.stagingURL)

                let installed = try self.installInBackupsFolder(source: session.zipURL, filename: session.zipURL.lastPathComponent)
                try? fileManager.removeItem(at: session.zipURL)

                DispatchQueue.main.async {
                    call.resolve([
                        "uri": installed.absoluteString,
                        "path": "Backups/\(installed.lastPathComponent)",
                    ])
                }
            } catch {
                try? FileManager.default.removeItem(at: session.stagingURL)
                DispatchQueue.main.async {
                    call.reject("Could not create backup zip", nil, error)
                }
            }
        }
    }

    @objc func readZipMediaFile(_ call: CAPPluginCall) {
        guard let extractUri = call.getString("extractUri"),
              let relativePath = call.getString("path"),
              let extractURL = resolveFileURL(extractUri) else {
            call.reject("extractUri and path required")
            return
        }

        let safePath = Self.sanitizeZipPath(relativePath)
        let fileURL = extractURL.appendingPathComponent(safePath)

        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let data = try Data(contentsOf: fileURL)
                DispatchQueue.main.async {
                    call.resolve(["data": data.base64EncodedString()])
                }
            } catch {
                DispatchQueue.main.async {
                    call.reject("Could not read media file", nil, error)
                }
            }
        }
    }

    @objc func releaseZipRestoreSession(_ call: CAPPluginCall) {
        guard let sessionId = call.getString("sessionId"),
              let session = restoreSessions.removeValue(forKey: sessionId) else {
            call.resolve()
            return
        }

        DispatchQueue.global(qos: .utility).async {
            try? FileManager.default.removeItem(at: session.extractURL)
            DispatchQueue.main.async {
                call.resolve()
            }
        }
    }

    @objc func presentShareSheet(_ call: CAPPluginCall) {
        guard let uriString = call.getString("uri") else {
            call.reject("uri required")
            return
        }

        DispatchQueue.main.async { [weak self] in
            guard let self else {
                call.reject("Plugin unavailable")
                return
            }

            guard let fileURL = self.resolveFileURL(uriString) else {
                call.reject("Could not resolve backup file")
                return
            }

            guard FileManager.default.fileExists(atPath: fileURL.path) else {
                call.reject("Backup file not found")
                return
            }

            guard let presenter = self.topViewController() else {
                call.reject("Could not open share menu")
                return
            }

            self.shareCall = call
            let activity = UIActivityViewController(activityItems: [fileURL], applicationActivities: nil)
            activity.completionWithItemsHandler = { [weak self] _, completed, _, error in
                guard let self else { return }
                let pending = self.shareCall
                self.shareCall = nil
                if let error {
                    pending?.reject("Could not share backup", nil, error)
                    return
                }
                if completed {
                    pending?.resolve(["shared": true])
                } else {
                    pending?.reject("Save canceled")
                }
            }

            if let popover = activity.popoverPresentationController {
                popover.sourceView = presenter.view
                popover.sourceRect = CGRect(
                    x: presenter.view.bounds.midX,
                    y: presenter.view.bounds.midY,
                    width: 0,
                    height: 0
                )
                popover.permittedArrowDirections = []
            }

            presenter.present(activity, animated: true)
        }
    }

    @objc func listBackupsFolder(_ call: CAPPluginCall) {
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self else {
                DispatchQueue.main.async { call.reject("Plugin unavailable") }
                return
            }
            do {
                let dir = try self.backupsDirectory()
                let urls = try FileManager.default.contentsOfDirectory(
                    at: dir,
                    includingPropertiesForKeys: [.contentModificationDateKey, .isRegularFileKey]
                )
                var files: [[String: Any]] = []
                for url in urls {
                    let values = try url.resourceValues(forKeys: [.contentModificationDateKey, .isRegularFileKey])
                    guard values.isRegularFile == true else { continue }
                    let modifiedMs = Int((values.contentModificationDate?.timeIntervalSince1970 ?? 0) * 1000)
                    files.append([
                        "name": url.lastPathComponent,
                        "uri": url.absoluteString,
                        "modifiedAt": modifiedMs,
                    ])
                }
                files.sort { ($0["modifiedAt"] as? Int ?? 0) > ($1["modifiedAt"] as? Int ?? 0) }
                DispatchQueue.main.async {
                    call.resolve(["files": files])
                }
            } catch {
                DispatchQueue.main.async {
                    call.reject("Could not list backups folder", nil, error)
                }
            }
        }
    }

    private func isEssentialBackupsFile(_ name: String) -> Bool {
        let lower = name.lowercased()
        if lower.contains(".c2backup.") || lower.hasSuffix(".c2backup.json") || lower.hasSuffix(".c2backup.zip") {
            return true
        }
        if lower.contains(".c2cproof.") || lower.hasPrefix("chat2chat-login-") {
            return true
        }
        return false
    }

    @objc func pruneBackupsFolder(_ call: CAPPluginCall) {
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self else {
                DispatchQueue.main.async { call.reject("Plugin unavailable") }
                return
            }
            do {
                let dir = try self.backupsDirectory()
                let urls = try FileManager.default.contentsOfDirectory(
                    at: dir,
                    includingPropertiesForKeys: [.isRegularFileKey],
                    options: [.skipsHiddenFiles]
                )
                var removed = 0
                for url in urls {
                    let values = try url.resourceValues(forKeys: [.isRegularFileKey])
                    guard values.isRegularFile == true else { continue }
                    let name = url.lastPathComponent
                    if self.isEssentialBackupsFile(name) { continue }
                    try FileManager.default.removeItem(at: url)
                    removed += 1
                }
                DispatchQueue.main.async {
                    call.resolve(["removed": removed])
                }
            } catch {
                DispatchQueue.main.async {
                    call.reject("Could not prune backups folder", nil, error)
                }
            }
        }
    }

    @objc func readBackupsFolderFile(_ call: CAPPluginCall) {
        guard let filename = call.getString("filename") else {
            call.reject("filename required")
            return
        }

        let safeName = (filename as NSString).lastPathComponent
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self else {
                DispatchQueue.main.async { call.reject("Plugin unavailable") }
                return
            }
            do {
                let fileURL = try self.backupsDirectory().appendingPathComponent(safeName)
                guard FileManager.default.fileExists(atPath: fileURL.path) else {
                    throw NSError(domain: "BackupExport", code: 404, userInfo: [NSLocalizedDescriptionKey: "File not found"])
                }

                let ext = fileURL.pathExtension.lowercased()
                if ext == "zip" {
                    self.handleZipImport(url: fileURL, call: call)
                    return
                }

                let data = try Data(contentsOf: fileURL)
                guard !data.isEmpty else {
                    DispatchQueue.main.async { call.reject("File is empty") }
                    return
                }
                guard let content = String(data: data, encoding: .utf8) else {
                    DispatchQueue.main.async { call.reject("File is not valid text") }
                    return
                }
                DispatchQueue.main.async {
                    call.resolve([
                        "content": content,
                        "fileName": safeName,
                    ])
                }
            } catch {
                DispatchQueue.main.async {
                    call.reject("Could not read file", nil, error)
                }
            }
        }
    }

    @objc func pickBackupFile(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self else {
                call.reject("Plugin unavailable")
                return
            }
            self.importCall = call
            let types: [UTType] = [.json, .plainText, .zip, .data, .item]
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: types, asCopy: true)
            picker.delegate = self
            picker.allowsMultipleSelection = false
            self.topViewController()?.present(picker, animated: true)
        }
    }

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        importCall?.reject("Import canceled")
        importCall = nil
    }

    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let call = importCall else { return }
        importCall = nil

        guard let url = urls.first else {
            call.reject("No file selected")
            return
        }

        let access = url.startAccessingSecurityScopedResource()
        defer {
            if access { url.stopAccessingSecurityScopedResource() }
        }

        let ext = url.pathExtension.lowercased()
        if ext == "zip" {
            handleZipImport(url: url, call: call)
            return
        }

        do {
            let data = try Data(contentsOf: url)
            guard !data.isEmpty else {
                call.reject("Backup file is empty")
                return
            }
            guard let content = String(data: data, encoding: .utf8) else {
                call.reject("Backup file is not valid text")
                return
            }
            call.resolve([
                "content": content,
                "fileName": url.lastPathComponent,
            ])
        } catch {
            call.reject("Could not read backup file", nil, error)
        }
    }

    private func handleZipImport(url: URL, call: CAPPluginCall) {
        let sessionId = UUID().uuidString
        let extractURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("backup-restore-\(sessionId)", isDirectory: true)

        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            do {
                if FileManager.default.fileExists(atPath: extractURL.path) {
                    try FileManager.default.removeItem(at: extractURL)
                }
                try ZipExtractor.extract(zipURL: url, to: extractURL)

                let backupURL = extractURL.appendingPathComponent(Self.backupJsonName)
                guard FileManager.default.fileExists(atPath: backupURL.path) else {
                    throw ZipExtractorError.invalidArchive
                }
                let content = try String(contentsOf: backupURL, encoding: .utf8)

                DispatchQueue.main.async {
                    self?.restoreSessions[sessionId] = ZipRestoreSession(id: sessionId, extractURL: extractURL)
                    call.resolve([
                        "content": content,
                        "fileName": url.lastPathComponent,
                        "extractUri": extractURL.absoluteString,
                        "restoreSessionId": sessionId,
                    ])
                }
            } catch {
                try? FileManager.default.removeItem(at: extractURL)
                DispatchQueue.main.async {
                    call.reject("Could not read backup zip", nil, error)
                }
            }
        }
    }

    private static func sanitizeZipPath(_ path: String) -> String {
        let parts = path.split(separator: "/").map(String.init).filter { part in
            !part.isEmpty && part != "." && part != ".."
        }
        return parts.joined(separator: "/")
    }

    private func resolveFileURL(_ uriString: String) -> URL? {
        if uriString.hasPrefix("file://") {
            if let url = URL(string: uriString), url.isFileURL {
                return url
            }
            return URL(fileURLWithPath: String(uriString.dropFirst("file://".count)))
        }

        if let url = URL(string: uriString), let local = bridge?.localURL(fromWebURL: url) {
            return local
        }

        if uriString.hasPrefix("/") {
            return URL(fileURLWithPath: uriString)
        }

        return nil
    }

    private func topViewController() -> UIViewController? {
        var top = bridge?.viewController
        while let presented = top?.presentedViewController {
            top = presented
        }
        return top
    }
}
