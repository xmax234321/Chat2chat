import UIKit
import Foundation
import Capacitor
import Photos
import PhotosUI
import UniformTypeIdentifiers
import AVFoundation
import AVFAudio

@objc(PhotoGalleryPlugin)
public class PhotoGalleryPlugin: CAPPlugin, CAPBridgedPlugin, PHPickerViewControllerDelegate, UIDocumentPickerDelegate, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
    public let identifier = "PhotoGalleryPlugin"
    public let jsName = "PhotoGallery"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "pickPhoto", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pickVideo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pickMedia", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pickFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "captureMedia", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readPick", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "persistMedia", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "persistMediaChunk", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "compressVideo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "videoThumbnail", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveToGallery", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listGalleryAssets", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "galleryThumbnail", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "exportGalleryAssets", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "galleryAuthorizationStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestGalleryAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cameraAuthorizationStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestCameraAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "microphoneAuthorizationStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestMicrophoneAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getPermissionStatuses", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openAppSettings", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startVoiceRecord", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopVoiceRecord", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelVoiceRecord", returnType: CAPPluginReturnPromise),
    ]

    private var audioRecorder: AVAudioRecorder?
    private var voiceRecordStartedAt: Date?
    private var voiceRecordUrl: URL?

    private enum PickMode {
        case photo
        case video
        case media
        case file
    }

    private var pickCall: CAPPluginCall?
    private var pickMode: PickMode = .photo

    @objc func pickPhoto(_ call: CAPPluginCall) {
        presentPicker(mode: .photo, call: call)
    }

    @objc func pickVideo(_ call: CAPPluginCall) {
        presentPicker(mode: .video, call: call)
    }

    @objc func pickMedia(_ call: CAPPluginCall) {
        presentPicker(mode: .media, call: call)
    }

    @objc func pickFile(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.pickMode = .file
            self.pickCall = call
            let types: [UTType] = [.item, .data, .content, .pdf, .plainText, .zip]
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: types, asCopy: true)
            picker.delegate = self
            picker.allowsMultipleSelection = true
            self.bridge?.viewController?.present(picker, animated: true)
        }
    }

    @objc func captureMedia(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard UIImagePickerController.isSourceTypeAvailable(.camera) else {
                call.reject("Camera unavailable")
                return
            }
            let status = AVCaptureDevice.authorizationStatus(for: .video)
            if status == .denied || status == .restricted {
                call.reject("Camera access denied")
                return
            }
            if status == .notDetermined {
                AVCaptureDevice.requestAccess(for: .video) { granted in
                    DispatchQueue.main.async {
                        if granted {
                            self.presentCameraPicker(call: call)
                        } else {
                            call.reject("Camera access denied")
                        }
                    }
                }
                return
            }
            self.presentCameraPicker(call: call)
        }
    }

    private func activePresenter() -> UIViewController? {
        guard var top = bridge?.viewController else { return nil }
        while let presented = top.presentedViewController, !presented.isBeingDismissed {
            top = presented
        }
        return top
    }

    private func presentCameraPicker(call: CAPPluginCall, attempt: Int = 0) {
        if let existing = pickCall, existing !== call {
            call.reject("Another picker is already open")
            return
        }
        pickCall = call

        guard let presenter = activePresenter() else {
            pickCall = nil
            call.reject("Camera unavailable")
            return
        }

        if presenter.presentedViewController != nil {
            if attempt < 10 {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in
                    self?.presentCameraPicker(call: call, attempt: attempt + 1)
                }
                return
            }
            pickCall = nil
            call.reject("Could not open camera")
            return
        }

        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.mediaTypes = UIImagePickerController.availableMediaTypes(for: .camera)
            ?? [UTType.image.identifier, UTType.movie.identifier]
        picker.videoQuality = .typeMedium
        picker.delegate = self
        picker.modalPresentationStyle = .fullScreen
        presenter.present(picker, animated: true) { [weak self] in
            guard let self = self else { return }
            if presenter.presentedViewController !== picker {
                if attempt < 10 {
                    self.pickCall = call
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                        self.presentCameraPicker(call: call, attempt: attempt + 1)
                    }
                    return
                }
                self.pickCall = nil
                call.reject("Could not open camera")
            }
        }
    }

    @objc func readPick(_ call: CAPPluginCall) {
        guard let rawPath = call.getString("path") else {
            call.reject("path required")
            return
        }
        let path = Self.normalizePath(rawPath)
        let offset = call.getInt("offset") ?? 0
        let maxBytes = call.getInt("maxBytes")
        DispatchQueue.global(qos: .userInitiated).async {
            guard FileManager.default.fileExists(atPath: path) else {
                DispatchQueue.main.async { call.reject("File not found") }
                return
            }
            let attrs = try? FileManager.default.attributesOfItem(atPath: path)
            let fileSize = attrs?[.size] as? Int ?? 0
            guard let handle = FileHandle(forReadingAtPath: path) else {
                DispatchQueue.main.async { call.reject("File not found") }
                return
            }
            defer { try? handle.close() }
            do {
                if offset > 0 {
                    try handle.seek(toOffset: UInt64(offset))
                }
                let remaining = max(0, fileSize - offset)
                let readLen = maxBytes.map { min($0, remaining) } ?? remaining
                let data = readLen > 0 ? handle.readData(ofLength: readLen) : Data()
                DispatchQueue.main.async {
                    call.resolve([
                        "base64": data.base64EncodedString(),
                        "size": fileSize,
                        "offset": offset,
                        "read": data.count,
                    ])
                }
            } catch {
                DispatchQueue.main.async { call.reject("Could not read file") }
            }
        }
    }

    @objc func persistMedia(_ call: CAPPluginCall) {
        guard let rawPath = call.getString("path"),
              let messageId = call.getString("messageId"),
              let mime = call.getString("mime") else {
            call.reject("path, messageId, mime required")
            return
        }
        let sourcePath = Self.normalizePath(rawPath)
        DispatchQueue.global(qos: .utility).async {
            do {
                let dest = try Self.mediaCacheFile(messageId: messageId)
                let meta = try Self.mediaCacheMeta(messageId: messageId)
                let sourceUrl = URL(fileURLWithPath: sourcePath)
                guard FileManager.default.fileExists(atPath: sourcePath) else {
                    DispatchQueue.main.async { call.reject("File not found") }
                    return
                }
                if FileManager.default.fileExists(atPath: dest.path) {
                    try FileManager.default.removeItem(at: dest)
                }
                try FileManager.default.copyItem(at: sourceUrl, to: dest)
                let metaObj: [String: Any] = [
                    "messageId": messageId,
                    "mime": mime,
                    "encoding": "raw",
                ]
                let metaData = try JSONSerialization.data(withJSONObject: metaObj)
                try metaData.write(to: meta, options: .atomic)
                let attrs = try FileManager.default.attributesOfItem(atPath: dest.path)
                let size = attrs[.size] as? Int ?? 0
                DispatchQueue.main.async { call.resolve(["ok": true, "size": size]) }
            } catch {
                DispatchQueue.main.async { call.reject("Could not cache media") }
            }
        }
    }

    @objc func persistMediaChunk(_ call: CAPPluginCall) {
        guard let messageId = call.getString("messageId"),
              let base64 = call.getString("base64") else {
            call.reject("messageId and base64 required")
            return
        }
        let offset = call.getInt("offset") ?? 0
        let mime = call.getString("mime")
        let complete = call.getBool("complete") ?? false

        DispatchQueue.global(qos: .utility).async {
            do {
                guard let chunk = Data(base64Encoded: base64) else {
                    DispatchQueue.main.async { call.reject("Invalid chunk") }
                    return
                }
                let dest = try Self.mediaCacheFile(messageId: messageId)
                if offset == 0 {
                    if FileManager.default.fileExists(atPath: dest.path) {
                        try FileManager.default.removeItem(at: dest)
                    }
                    try chunk.write(to: dest, options: .atomic)
                    if let mime {
                        let meta = try Self.mediaCacheMeta(messageId: messageId)
                        let metaObj: [String: Any] = [
                    "messageId": messageId,
                    "mime": mime,
                    "encoding": "raw",
                ]
                        try JSONSerialization.data(withJSONObject: metaObj).write(to: meta, options: .atomic)
                    }
                } else {
                    guard FileManager.default.fileExists(atPath: dest.path) else {
                        DispatchQueue.main.async { call.reject("Cache file missing") }
                        return
                    }
                    let handle = try FileHandle(forUpdating: dest)
                    try handle.seek(toOffset: UInt64(offset))
                    try handle.write(contentsOf: chunk)
                    try handle.close()
                }

                let attrs = try FileManager.default.attributesOfItem(atPath: dest.path)
                let size = attrs[.size] as? Int ?? 0
                DispatchQueue.main.async {
                    call.resolve(["ok": true, "size": size, "complete": complete])
                }
            } catch {
                DispatchQueue.main.async { call.reject("Could not cache media") }
            }
        }
    }

    private static func mediaCacheDir() -> URL {
        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        let dir = caches.appendingPathComponent("chat2chat-media", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var mutable = dir
        try? mutable.setResourceValues(values)
        return dir
    }

    private static func safeMessageId(_ messageId: String) -> String {
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "_-"))
        return String(messageId.unicodeScalars.map { allowed.contains($0) ? Character($0) : "_" })
    }

    private static func mediaCacheFile(messageId: String) throws -> URL {
        let dir = mediaCacheDir()
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("\(safeMessageId(messageId)).bin")
    }

    private static func mediaCacheMeta(messageId: String) throws -> URL {
        let dir = mediaCacheDir()
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("\(safeMessageId(messageId)).json")
    }

    @objc func compressVideo(_ call: CAPPluginCall) {
        guard let rawPath = call.getString("path") else {
            call.reject("path required")
            return
        }
        let path = Self.normalizePath(rawPath)
        DispatchQueue.global(qos: .userInitiated).async {
            let sourceUrl = URL(fileURLWithPath: path)
            if let compressed = Self.compressVideo(at: sourceUrl, force: true) {
                DispatchQueue.main.async {
                    call.resolve([
                        "path": compressed.path,
                        "mime": "video/mp4",
                    ])
                }
                return
            }
            let ext = sourceUrl.pathExtension.lowercased()
            let mime = ext == "mp4" || ext == "m4v" ? "video/mp4" : "video/quicktime"
            DispatchQueue.main.async {
                call.resolve([
                    "path": path,
                    "mime": mime,
                ])
            }
        }
    }

    @objc func videoThumbnail(_ call: CAPPluginCall) {
        guard let rawPath = call.getString("path") else {
            call.reject("path required")
            return
        }
        let path = Self.normalizePath(rawPath)
        let maxSize = call.getInt("maxSize") ?? 720
        let timeSec = call.getDouble("timeSec") ?? 1.0

        DispatchQueue.global(qos: .userInitiated).async {
            let url = URL(fileURLWithPath: path)
            let asset = AVURLAsset(url: url)
            let generator = AVAssetImageGenerator(asset: asset)
            generator.appliesPreferredTrackTransform = true
            generator.maximumSize = CGSize(width: maxSize, height: maxSize)

            let duration = CMTimeGetSeconds(asset.duration)
            let seekSec: Double
            if duration.isFinite && duration > 0 {
                seekSec = min(max(timeSec, 0.05), max(0.05, duration * 0.08))
            } else {
                seekSec = timeSec
            }
            let time = CMTime(seconds: seekSec, preferredTimescale: 600)

            do {
                var actual = CMTime.zero
                let cgImage = try generator.copyCGImage(at: time, actualTime: &actual)
                let uiImage = UIImage(cgImage: cgImage)
                let side = min(uiImage.size.width, uiImage.size.height)
                let originX = (uiImage.size.width - side) / 2
                let originY = (uiImage.size.height - side) / 2
                let cropRect = CGRect(x: originX, y: originY, width: side, height: side)
                guard let cropped = uiImage.cgImage?.cropping(to: cropRect) else {
                    DispatchQueue.main.async { call.reject("crop failed") }
                    return
                }
                let square = UIImage(cgImage: cropped)
                let dest = FileManager.default.temporaryDirectory
                    .appendingPathComponent("vthumb-\(UUID().uuidString).jpg")
                guard let data = square.jpegData(compressionQuality: 0.88) else {
                    DispatchQueue.main.async { call.reject("encode failed") }
                    return
                }
                try data.write(to: dest)
                DispatchQueue.main.async {
                    call.resolve([
                        "path": dest.path,
                        "mime": "image/jpeg",
                    ])
                }
            } catch {
                DispatchQueue.main.async {
                    call.reject("thumbnail failed", nil, error)
                }
            }
        }
    }

    private static func normalizePath(_ path: String) -> String {
        if path.hasPrefix("file://") {
            return URL(string: path)?.path ?? path.replacingOccurrences(of: "file://", with: "")
        }
        return path
    }

    private func presentPicker(mode: PickMode, call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.pickMode = mode
            self.pickCall = call
            var config = PHPickerConfiguration(photoLibrary: .shared())
            switch mode {
            case .photo:
                config.filter = .images
            case .video:
                config.filter = .videos
            case .media:
                config.filter = .any(of: [.images, .videos])
            case .file:
                return
            }
            config.selectionLimit = 0
            let picker = PHPickerViewController(configuration: config)
            picker.delegate = self
            self.bridge?.viewController?.present(picker, animated: true)
        }
    }

    public func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true)
        guard let call = pickCall else { return }
        pickCall = nil

        guard !results.isEmpty else {
            call.reject("User cancelled")
            return
        }

        var items: [[String: Any]] = []
        let group = DispatchGroup()
        let lock = NSLock()

        for result in results {
            let provider = result.itemProvider
            let resolved = resolveMediaType(for: provider)
            guard let typeId = resolved.typeId else {
                continue
            }
            let isVideo = resolved.isVideo

            group.enter()
            provider.loadFileRepresentation(forTypeIdentifier: typeId) { url, error in
                defer { group.leave() }
                if error != nil || url == nil {
                    return
                }
                guard let sourceUrl = url else {
                    return
                }
                // URL is valid only for the duration of this callback — copy synchronously.
                if let dict = self.copyPickToTemp(sourceUrl: sourceUrl, isVideo: isVideo) {
                    lock.lock()
                    items.append(dict)
                    lock.unlock()
                }
            }
        }

        group.notify(queue: .main) {
            if items.isEmpty {
                call.reject("Could not read file")
            } else {
                call.resolve(["items": items])
            }
        }
    }

    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let call = pickCall else { return }
        pickCall = nil

        guard !urls.isEmpty else {
            call.reject("Nothing selected")
            return
        }

        var items: [[String: Any]] = []
        let group = DispatchGroup()
        let lock = NSLock()

        for sourceUrl in urls {
            group.enter()
            let didStart = sourceUrl.startAccessingSecurityScopedResource()

            copyAndResolve(sourceUrl: sourceUrl, isVideo: false, isFile: true) { dict in
                if didStart { sourceUrl.stopAccessingSecurityScopedResource() }
                if let dict = dict {
                    lock.lock()
                    items.append(dict)
                    lock.unlock()
                }
                group.leave()
            }
        }

        group.notify(queue: .main) {
            if items.isEmpty {
                call.reject("Could not read file")
            } else {
                call.resolve(["items": items])
            }
        }
    }

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        guard let call = pickCall else { return }
        pickCall = nil
        call.reject("User cancelled")
    }

    public func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        picker.dismiss(animated: true)
        guard let call = pickCall else { return }
        pickCall = nil
        call.reject("User cancelled")
    }

    public func imagePickerController(
        _ picker: UIImagePickerController,
        didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
    ) {
        picker.dismiss(animated: true)
        guard let call = pickCall else { return }
        pickCall = nil

        if let mediaUrl = info[.mediaURL] as? URL {
            copyAndResolve(sourceUrl: mediaUrl, isVideo: true) { dict in
                if let dict = dict {
                    call.resolve(["items": [dict]])
                } else {
                    call.reject("Could not read video")
                }
            }
            return
        }

        if let image = info[.originalImage] as? UIImage,
           let data = image.jpegData(compressionQuality: 0.92) {
            let dest = FileManager.default.temporaryDirectory
                .appendingPathComponent("capture-\(UUID().uuidString).jpg")
            do {
                try data.write(to: dest)
                call.resolve([
                    "items": [[
                        "path": dest.path,
                        "mime": "image/jpeg",
                        "fileName": "photo.jpg",
                        "isFile": false,
                    ]],
                ])
            } catch {
                call.reject("Could not save photo")
            }
            return
        }

        call.reject("Nothing captured")
    }

    private struct ResolvedMediaType {
        let typeId: String?
        let isVideo: Bool
    }

    private func resolveMediaType(for provider: NSItemProvider) -> ResolvedMediaType {
        if pickMode == .video {
            return ResolvedMediaType(typeId: firstMatchingType(for: provider, types: videoTypeIds()), isVideo: true)
        }
        if pickMode == .photo {
            return ResolvedMediaType(typeId: firstMatchingType(for: provider, types: imageTypeIds()), isVideo: false)
        }

        if let videoType = firstMatchingType(for: provider, types: videoTypeIds()) {
            return ResolvedMediaType(typeId: videoType, isVideo: true)
        }
        if let imageType = firstMatchingType(for: provider, types: imageTypeIds()) {
            return ResolvedMediaType(typeId: imageType, isVideo: false)
        }
        return ResolvedMediaType(typeId: nil, isVideo: false)
    }

    private func imageTypeIds() -> [String] {
        [
            UTType.image.identifier,
            UTType.jpeg.identifier,
            UTType.png.identifier,
            UTType.heic.identifier,
            UTType.heif.identifier,
            UTType.gif.identifier,
            UTType.webP.identifier,
            "public.image",
        ]
    }

    private func videoTypeIds() -> [String] {
        [
            UTType.movie.identifier,
            UTType.video.identifier,
            UTType.mpeg4Movie.identifier,
            UTType.quickTimeMovie.identifier,
            "public.movie",
            "public.video",
        ]
    }

    private func firstMatchingType(for provider: NSItemProvider, types: [String]) -> String? {
        for type in types where provider.hasItemConformingToTypeIdentifier(type) {
            return type
        }
        return nil
    }

    private static let skipCompressBelowBytes: Int64 = 8 * 1024 * 1024

    private static func compressVideo(at sourceUrl: URL, force: Bool = false) -> URL? {
        let attrs = try? FileManager.default.attributesOfItem(atPath: sourceUrl.path)
        let size = attrs?[.size] as? Int64 ?? 0
        if !force && size < skipCompressBelowBytes {
            return nil
        }

        let asset = AVURLAsset(url: sourceUrl)
        let presets = [
            AVAssetExportPreset1280x720,
            AVAssetExportPresetMediumQuality,
            AVAssetExportPreset960x540,
        ]
        for preset in presets {
            guard let session = AVAssetExportSession(asset: asset, presetName: preset) else {
                continue
            }

            let dest = FileManager.default.temporaryDirectory
                .appendingPathComponent("vcomp-\(UUID().uuidString).mp4")
            try? FileManager.default.removeItem(at: dest)

            session.outputURL = dest
            session.outputFileType = .mp4
            session.shouldOptimizeForNetworkUse = true

            let sem = DispatchSemaphore(value: 0)
            var result: URL?
            session.exportAsynchronously {
                if session.status == .completed {
                    result = dest
                } else {
                    try? FileManager.default.removeItem(at: dest)
                }
                sem.signal()
            }
            sem.wait()
            if let result {
                return result
            }
        }
        return nil
    }

    private func copyPickToTemp(
        sourceUrl: URL,
        isVideo: Bool,
        isFile: Bool = false
    ) -> [String: Any]? {
        let ext = sourceUrl.pathExtension.lowercased()
        let destExt: String
        if isFile {
            destExt = ext.isEmpty ? "bin" : ext
        } else if isVideo {
            destExt = ext.isEmpty ? "mov" : ext
        } else {
            destExt = ext.isEmpty ? "jpg" : ext
        }

        let dest = FileManager.default.temporaryDirectory
            .appendingPathComponent("pick-\(UUID().uuidString).\(destExt)")

        do {
            if FileManager.default.fileExists(atPath: dest.path) {
                try FileManager.default.removeItem(at: dest)
            }
            try FileManager.default.copyItem(at: sourceUrl, to: dest)

            let mime: String
            if isFile {
                mime = mimeForFileExtension(destExt)
            } else if isVideo {
                mime = destExt == "mp4" || destExt == "m4v" ? "video/mp4" : "video/quicktime"
            } else {
                switch destExt {
                case "png": mime = "image/png"
                case "gif": mime = "image/gif"
                case "webp": mime = "image/webp"
                case "heic", "heif": mime = "image/heic"
                default: mime = "image/jpeg"
                }
            }

            return [
                "path": dest.path,
                "mime": mime,
                "fileName": sourceUrl.lastPathComponent,
                "isFile": isFile,
                "size": (try? FileManager.default.attributesOfItem(atPath: dest.path))?[.size] as? Int ?? 0,
            ]
        } catch {
            return nil
        }
    }

    private func copyAndResolve(
        sourceUrl: URL,
        isVideo: Bool,
        isFile: Bool = false,
        completion: @escaping ([String: Any]?) -> Void
    ) {
        DispatchQueue.global(qos: .userInitiated).async {
            let dict = self.copyPickToTemp(sourceUrl: sourceUrl, isVideo: isVideo, isFile: isFile)
            DispatchQueue.main.async {
                completion(dict)
            }
        }
    }

    private func mimeForFileExtension(_ ext: String) -> String {
        switch ext {
        case "pdf": return "application/pdf"
        case "zip": return "application/zip"
        case "txt": return "text/plain"
        case "json": return "application/json"
        default: return "application/octet-stream"
        }
    }

    @objc func listGalleryAssets(_ call: CAPPluginCall) {
        let filter = call.getString("filter") ?? "all"
        let limit = max(1, min(call.getInt("limit") ?? 120, 500))
        let offset = max(0, call.getInt("offset") ?? 0)

        PHPhotoLibrary.requestAuthorization(for: .readWrite) { status in
            guard status == .authorized || status == .limited else {
                DispatchQueue.main.async { call.reject("Photo library access denied") }
                return
            }

            let options = PHFetchOptions()
            options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]

            let fetchResult: PHFetchResult<PHAsset>
            switch filter {
            case "photos":
                fetchResult = PHAsset.fetchAssets(with: .image, options: options)
            case "videos":
                fetchResult = PHAsset.fetchAssets(with: .video, options: options)
            default:
                fetchResult = PHAsset.fetchAssets(with: options)
            }

            var assets: [[String: Any]] = []
            let end = min(offset + limit, fetchResult.count)
            if offset < end {
                for index in offset..<end {
                    let asset = fetchResult.object(at: index)
                    assets.append([
                        "id": asset.localIdentifier,
                        "mediaType": asset.mediaType == .video ? "video" : "photo",
                        "duration": asset.duration,
                        "width": asset.pixelWidth,
                        "height": asset.pixelHeight,
                    ])
                }
            }

            DispatchQueue.main.async {
                call.resolve([
                    "assets": assets,
                    "total": fetchResult.count,
                ])
            }
        }
    }

    @objc func galleryThumbnail(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else {
            call.reject("id required")
            return
        }
        let size = max(80, min(call.getInt("size") ?? 240, 720))

        PHPhotoLibrary.requestAuthorization(for: .readWrite) { status in
            guard status == .authorized || status == .limited else {
                DispatchQueue.main.async { call.reject("Photo library access denied") }
                return
            }

            let fetch = PHAsset.fetchAssets(withLocalIdentifiers: [id], options: nil)
            guard let asset = fetch.firstObject else {
                DispatchQueue.main.async { call.reject("Asset not found") }
                return
            }

            let options = PHImageRequestOptions()
            options.deliveryMode = .highQualityFormat
            options.resizeMode = .fast
            options.isNetworkAccessAllowed = true
            options.version = .current
            let targetSize = CGSize(width: size, height: size)

            PHImageManager.default().requestImage(
                for: asset,
                targetSize: targetSize,
                contentMode: .aspectFill,
                options: options
            ) { image, _ in
                guard let image = image, let data = image.jpegData(compressionQuality: 0.82) else {
                    DispatchQueue.main.async { call.reject("Thumbnail failed") }
                    return
                }
                let dest = FileManager.default.temporaryDirectory
                    .appendingPathComponent("gthumb-\(UUID().uuidString).jpg")
                do {
                    try data.write(to: dest)
                    DispatchQueue.main.async {
                        call.resolve([
                            "path": dest.path,
                            "mime": "image/jpeg",
                        ])
                    }
                } catch {
                    DispatchQueue.main.async { call.reject("Thumbnail failed") }
                }
            }
        }
    }

    @objc func exportGalleryAssets(_ call: CAPPluginCall) {
        guard let ids = call.getArray("ids") as? [String], !ids.isEmpty else {
            call.reject("ids required")
            return
        }

        PHPhotoLibrary.requestAuthorization(for: .readWrite) { status in
            guard status == .authorized || status == .limited else {
                DispatchQueue.main.async { call.reject("Photo library access denied") }
                return
            }

            let fetch = PHAsset.fetchAssets(withLocalIdentifiers: ids, options: nil)
            var assetMap: [String: PHAsset] = [:]
            fetch.enumerateObjects { asset, _, _ in
                assetMap[asset.localIdentifier] = asset
            }
            let ordered = ids.compactMap { assetMap[$0] }

            var items: [[String: Any]] = []
            let group = DispatchGroup()
            let lock = NSLock()

            for asset in ordered {
                group.enter()
                self.exportGalleryAsset(asset) { dict in
                    if let dict = dict {
                        lock.lock()
                        items.append(dict)
                        lock.unlock()
                    }
                    group.leave()
                }
            }

            group.notify(queue: .main) {
                if items.isEmpty {
                    call.reject("Could not export assets")
                } else {
                    call.resolve(["items": items])
                }
            }
        }
    }

    private func exportGalleryAsset(_ asset: PHAsset, completion: @escaping ([String: Any]?) -> Void) {
        if asset.mediaType == .video {
            exportGalleryAssetResource(asset, completion: completion)
            return
        }
        exportGalleryPhotoWithAdjustments(asset, completion: completion)
    }

    /// Exports the rendered photo (markup, crop, filters from the Photos app), not the original file.
    private func exportGalleryPhotoWithAdjustments(_ asset: PHAsset, completion: @escaping ([String: Any]?) -> Void) {
        let options = PHImageRequestOptions()
        options.deliveryMode = .highQualityFormat
        options.isNetworkAccessAllowed = true
        options.version = .current
        options.resizeMode = .none

        var finished = false
        let finish: ([String: Any]?) -> Void = { dict in
            if finished { return }
            finished = true
            completion(dict)
        }

        PHImageManager.default().requestImageDataAndOrientation(for: asset, options: options) { data, dataUTI, _, info in
            if let cancelled = info?[PHImageCancelledKey] as? Bool, cancelled {
                finish(nil)
                return
            }
            if info?[PHImageErrorKey] != nil {
                self.exportGalleryAssetResource(asset, completion: finish)
                return
            }
            if let degraded = info?[PHImageResultIsDegradedKey] as? Bool, degraded {
                return
            }
            guard let data = data, !data.isEmpty else {
                self.exportGalleryAssetResource(asset, completion: finish)
                return
            }

            let (ext, mime) = self.mimeFromImageDataUTI(dataUTI)
            let dest = FileManager.default.temporaryDirectory
                .appendingPathComponent("gal-\(UUID().uuidString).\(ext)")

            if FileManager.default.fileExists(atPath: dest.path) {
                try? FileManager.default.removeItem(at: dest)
            }

            do {
                try data.write(to: dest)
                let attrs = try FileManager.default.attributesOfItem(atPath: dest.path)
                let size = attrs[.size] as? Int ?? data.count
                let resources = PHAssetResource.assetResources(for: asset)
                let originalName = resources.first(where: { $0.type == .photo || $0.type == .fullSizePhoto })?.originalFilename
                let fileName: String
                if let originalName = originalName, !originalName.isEmpty {
                    let base = (originalName as NSString).deletingPathExtension
                    fileName = "\(base).\(ext)"
                } else {
                    fileName = "photo.\(ext)"
                }
                finish([
                    "path": dest.path,
                    "mime": mime,
                    "fileName": fileName,
                    "size": size,
                    "isFile": false,
                ])
            } catch {
                self.exportGalleryAssetResource(asset, completion: finish)
            }
        }
    }

    private func mimeFromImageDataUTI(_ uti: String?) -> (String, String) {
        let lower = uti?.lowercased() ?? ""
        if lower.contains("heic") || lower.contains("heif") {
            return ("heic", "image/heic")
        }
        if lower.contains("png") {
            return ("png", "image/png")
        }
        if lower.contains("gif") {
            return ("gif", "image/gif")
        }
        if lower.contains("webp") {
            return ("webp", "image/webp")
        }
        return ("jpg", "image/jpeg")
    }

    private func exportGalleryAssetResource(_ asset: PHAsset, completion: @escaping ([String: Any]?) -> Void) {
        let resources = PHAssetResource.assetResources(for: asset)
        let resource = resources.first(where: { $0.type == .photo || $0.type == .fullSizePhoto })
            ?? resources.first(where: { $0.type == .video || $0.type == .fullSizeVideo })
            ?? resources.first
        guard let resource = resource else {
            completion(nil)
            return
        }

        let isVideo = asset.mediaType == .video
        let ext = (resource.originalFilename as NSString).pathExtension
        let destExt = ext.isEmpty ? (isVideo ? "mov" : "jpg") : ext
        let dest = FileManager.default.temporaryDirectory
            .appendingPathComponent("gal-\(UUID().uuidString).\(destExt)")

        if FileManager.default.fileExists(atPath: dest.path) {
            try? FileManager.default.removeItem(at: dest)
        }

        let options = PHAssetResourceRequestOptions()
        options.isNetworkAccessAllowed = true

        PHAssetResourceManager.default().writeData(for: resource, toFile: dest, options: options) { error in
            if error != nil {
                completion(nil)
                return
            }
            let attrs = try? FileManager.default.attributesOfItem(atPath: dest.path)
            let size = attrs?[.size] as? Int ?? 0
            let mime: String
            if isVideo {
                let lower = destExt.lowercased()
                mime = lower == "mp4" || lower == "m4v" ? "video/mp4" : "video/quicktime"
            } else {
                mime = "image/jpeg"
            }
            completion([
                "path": dest.path,
                "mime": mime,
                "fileName": resource.originalFilename,
                "size": size,
                "isFile": false,
            ])
        }
    }

    @objc func saveToGallery(_ call: CAPPluginCall) {
        guard let path = call.getString("path") else {
            call.reject("path required")
            return
        }
        let isVideo = call.getBool("isVideo") ?? false
        let fileUrl = URL(fileURLWithPath: path)

        guard FileManager.default.fileExists(atPath: path) else {
            call.reject("File not found")
            return
        }

        PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
            guard status == .authorized || status == .limited else {
                DispatchQueue.main.async { call.reject("Photo library permission denied") }
                return
            }

            PHPhotoLibrary.shared().performChanges({
                if isVideo {
                    PHAssetChangeRequest.creationRequestForAssetFromVideo(atFileURL: fileUrl)
                } else if let image = UIImage(contentsOfFile: path) {
                    PHAssetChangeRequest.creationRequestForAsset(from: image)
                }
            }) { success, error in
                DispatchQueue.main.async {
                    if success {
                        call.resolve()
                    } else {
                        call.reject(error?.localizedDescription ?? "Save failed")
                    }
                }
            }
        }
    }

    private func authorizationStatusValue(_ status: PHAuthorizationStatus) -> String {
        switch status {
        case .authorized:
            return "authorized"
        case .limited:
            return "limited"
        case .denied:
            return "denied"
        case .restricted:
            return "restricted"
        case .notDetermined:
            return "not_determined"
        @unknown default:
            return "denied"
        }
    }

    @objc func galleryAuthorizationStatus(_ call: CAPPluginCall) {
        let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        call.resolve(["status": authorizationStatusValue(status)])
    }

    @objc func requestGalleryAuthorization(_ call: CAPPluginCall) {
        PHPhotoLibrary.requestAuthorization(for: .readWrite) { status in
            DispatchQueue.main.async {
                call.resolve(["status": self.authorizationStatusValue(status)])
            }
        }
    }

    private func avAuthorizationStatusValue(_ status: AVAuthorizationStatus) -> String {
        switch status {
        case .authorized:
            return "authorized"
        case .denied:
            return "denied"
        case .restricted:
            return "restricted"
        case .notDetermined:
            return "not_determined"
        @unknown default:
            return "denied"
        }
    }

    @objc func cameraAuthorizationStatus(_ call: CAPPluginCall) {
        let status = AVCaptureDevice.authorizationStatus(for: .video)
        call.resolve(["status": avAuthorizationStatusValue(status)])
    }

    @objc func requestCameraAuthorization(_ call: CAPPluginCall) {
        let status = AVCaptureDevice.authorizationStatus(for: .video)
        if status == .notDetermined {
            AVCaptureDevice.requestAccess(for: .video) { granted in
                DispatchQueue.main.async {
                    let next = granted ? AVAuthorizationStatus.authorized : AVAuthorizationStatus.denied
                    call.resolve(["status": self.avAuthorizationStatusValue(next)])
                }
            }
            return
        }
        call.resolve(["status": avAuthorizationStatusValue(status)])
    }

    @objc func microphoneAuthorizationStatus(_ call: CAPPluginCall) {
        call.resolve(["status": microphoneAuthorizationStatusValue()])
    }

    @objc func getPermissionStatuses(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            call.resolve([
                "camera": self.avAuthorizationStatusValue(AVCaptureDevice.authorizationStatus(for: .video)),
                "microphone": self.microphoneAuthorizationStatusValue(),
                "photos": self.authorizationStatusValue(PHPhotoLibrary.authorizationStatus(for: .readWrite)),
            ])
        }
    }

    @objc func requestMicrophoneAuthorization(_ call: CAPPluginCall) {
        let session = AVAudioSession.sharedInstance()
        switch session.recordPermission {
        case .granted:
            call.resolve(["status": "authorized"])
        case .denied:
            call.resolve(["status": "denied"])
        case .undetermined:
            session.requestRecordPermission { granted in
                DispatchQueue.main.async {
                    call.resolve(["status": granted ? "authorized" : "denied"])
                }
            }
        @unknown default:
            call.resolve(["status": "denied"])
        }
    }

    private func microphoneAuthorizationStatusValue() -> String {
        switch AVAudioSession.sharedInstance().recordPermission {
        case .granted:
            return "authorized"
        case .denied:
            return "denied"
        case .undetermined:
            return "not_determined"
        @unknown default:
            return "denied"
        }
    }

    @objc func openAppSettings(_ call: CAPPluginCall) {
        guard let url = URL(string: UIApplication.openSettingsURLString) else {
            call.reject("Cannot open settings")
            return
        }
        DispatchQueue.main.async {
            UIApplication.shared.open(url, options: [:]) { success in
                if success {
                    call.resolve()
                } else {
                    call.reject("Cannot open settings")
                }
            }
        }
    }

    private func prepareAudioSessionForRecord() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetooth])
        try session.setActive(true)
    }

    @objc func startVoiceRecord(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let permission = AVAudioSession.sharedInstance().recordPermission
            if permission == .denied {
                call.reject("Microphone access denied")
                return
            }

            let start = {
                do {
                    try self.prepareAudioSessionForRecord()
                    let url = FileManager.default.temporaryDirectory
                        .appendingPathComponent("voice-\(UUID().uuidString).m4a")
                    let settings: [String: Any] = [
                        AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
                        AVSampleRateKey: 44100,
                        AVNumberOfChannelsKey: 1,
                        AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
                    ]
                    self.audioRecorder = try AVAudioRecorder(url: url, settings: settings)
                    self.audioRecorder?.isMeteringEnabled = true
                    guard self.audioRecorder?.record() == true else {
                        call.reject("Could not start recording")
                        return
                    }
                    self.voiceRecordUrl = url
                    self.voiceRecordStartedAt = Date()
                    call.resolve()
                } catch {
                    call.reject("Recording failed", nil, error)
                }
            }

            if permission == .undetermined {
                AVAudioSession.sharedInstance().requestRecordPermission { granted in
                    DispatchQueue.main.async {
                        if granted {
                            start()
                        } else {
                            call.reject("Microphone access denied")
                        }
                    }
                }
                return
            }

            start()
        }
    }

    @objc func stopVoiceRecord(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let recorder = self.audioRecorder else {
                call.reject("Not recording")
                return
            }
            recorder.stop()
            let durationMs = Int(Date().timeIntervalSince(self.voiceRecordStartedAt ?? Date()) * 1000)
            let path = self.voiceRecordUrl?.path ?? ""
            self.audioRecorder = nil
            self.voiceRecordStartedAt = nil
            call.resolve(["path": path, "durationMs": durationMs])
        }
    }

    @objc func cancelVoiceRecord(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.audioRecorder?.stop()
            if let url = self.voiceRecordUrl {
                try? FileManager.default.removeItem(at: url)
            }
            self.audioRecorder = nil
            self.voiceRecordUrl = nil
            self.voiceRecordStartedAt = nil
            call.resolve()
        }
    }
}
