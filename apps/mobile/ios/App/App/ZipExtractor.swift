import Foundation

enum ZipExtractorError: Error {
    case invalidArchive
    case unsupportedCompression
}

/// Reads ZIP archives with stored (uncompressed) entries only.
enum ZipExtractor {
    static func extract(zipURL: URL, to destinationURL: URL) throws {
        let data = try Data(contentsOf: zipURL)
        if try extract(data: data, to: destinationURL, legacyHeader: false) {
            return
        }
        if try extract(data: data, to: destinationURL, legacyHeader: true) {
            return
        }
        throw ZipExtractorError.invalidArchive
    }

    @discardableResult
    private static func extract(data: Data, to destinationURL: URL, legacyHeader: Bool) throws -> Bool {
        let fileManager = FileManager.default
        try fileManager.createDirectory(at: destinationURL, withIntermediateDirectories: true)

        let sizeOffset = legacyHeader ? 14 : 18
        let nameLengthOffset = legacyHeader ? 22 : 26
        let extraLengthOffset = legacyHeader ? 24 : 28
        let nameStartOffset = legacyHeader ? 26 : 30

        var offset = 0
        var foundBackupJson = false

        while offset + nameStartOffset <= data.count {
            let signature = data.readUInt32(at: offset)
            if signature != 0x04034b50 { break }

            let compression = data.readUInt16(at: offset + 8)
            let compressedSize = Int(data.readUInt32(at: offset + sizeOffset))
            let uncompressedSize = Int(data.readUInt32(at: offset + sizeOffset + 4))
            let nameLength = Int(data.readUInt16(at: offset + nameLengthOffset))
            let extraLength = Int(data.readUInt16(at: offset + extraLengthOffset))
            let nameStart = offset + nameStartOffset
            let nameEnd = nameStart + nameLength
            guard nameEnd <= data.count else { return false }

            let relativePath = String(data: data.subdata(in: nameStart..<nameEnd), encoding: .utf8) ?? ""
            let dataStart = nameEnd + extraLength
            let dataEnd = dataStart + compressedSize
            guard dataEnd <= data.count else { return false }

            if compression != 0 {
                throw ZipExtractorError.unsupportedCompression
            }
            if uncompressedSize != compressedSize {
                return false
            }

            let fileData = data.subdata(in: dataStart..<dataEnd)
            let outURL = destinationURL.appendingPathComponent(relativePath)
            try fileManager.createDirectory(at: outURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            try fileData.write(to: outURL, options: .atomic)

            if relativePath == "backup.json" {
                foundBackupJson = true
            }

            offset = dataEnd
        }

        return foundBackupJson
    }
}

private extension Data {
    func readUInt16(at offset: Int) -> UInt16 {
        guard offset + 2 <= count else { return 0 }
        return subdata(in: offset..<(offset + 2)).withUnsafeBytes { $0.load(as: UInt16.self).littleEndian }
    }

    func readUInt32(at offset: Int) -> UInt32 {
        guard offset + 4 <= count else { return 0 }
        return subdata(in: offset..<(offset + 4)).withUnsafeBytes { $0.load(as: UInt32.self).littleEndian }
    }
}
