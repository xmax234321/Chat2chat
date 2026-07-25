import Foundation
import zlib

enum ZipWriterError: Error {
    case writeFailed
}

/// Minimal ZIP writer (stored / uncompressed entries).
enum ZipWriter {
    static func write(records: [(path: String, data: Data)], to destinationURL: URL) throws {
        var local = Data()
        var central = Data()
        var offset: UInt32 = 0

        for record in records.sorted(by: { $0.path < $1.path }) {
            let pathData = Data(record.path.utf8)
            let crc: uLong
            if record.data.isEmpty {
                crc = 0
            } else {
                crc = record.data.withUnsafeBytes { buffer in
                    crc32(0, buffer.bindMemory(to: Bytef.self).baseAddress, uInt(record.data.count))
                }
            }
            let size = UInt32(record.data.count)

            var header = Data()
            header.appendUInt32(0x04034b50)
            header.appendUInt16(20) // version needed
            header.appendUInt16(0)  // general purpose bit flag
            header.appendUInt16(0)  // compression method (stored)
            header.appendUInt16(0)  // last mod file time
            header.appendUInt16(0)  // last mod file date
            header.appendUInt32(UInt32(crc))
            header.appendUInt32(size)
            header.appendUInt32(size)
            header.appendUInt16(UInt16(pathData.count))
            header.appendUInt16(0)
            header.append(pathData)

            local.append(header)
            local.append(record.data)

            var cd = Data()
            cd.appendUInt32(0x02014b50)
            cd.appendUInt16(20) // version made by
            cd.appendUInt16(20) // version needed
            cd.appendUInt16(0)  // general purpose bit flag
            cd.appendUInt16(0)  // compression method (stored)
            cd.appendUInt16(0)  // last mod file time
            cd.appendUInt16(0)  // last mod file date
            cd.appendUInt32(UInt32(crc))
            cd.appendUInt32(size)
            cd.appendUInt32(size)
            cd.appendUInt16(UInt16(pathData.count))
            cd.appendUInt16(0)
            cd.appendUInt16(0)
            cd.appendUInt16(0)
            cd.appendUInt32(0)
            cd.appendUInt32(offset)
            cd.append(pathData)

            central.append(cd)
            offset += UInt32(header.count + record.data.count)
        }

        var archive = local
        archive.append(central)

        let end = Data()
            .appendingUInt32(0x06054b50)
            .appendingUInt16(0)
            .appendingUInt16(0)
            .appendingUInt16(UInt16(records.count))
            .appendingUInt16(UInt16(records.count))
            .appendingUInt32(UInt32(central.count))
            .appendingUInt32(offset)
            .appendingUInt16(0)

        archive.append(end)
        try archive.write(to: destinationURL, options: .atomic)
    }
}

private extension Data {
    mutating func appendUInt16(_ value: UInt16) {
        var le = value.littleEndian
        Swift.withUnsafeBytes(of: &le) { append(contentsOf: $0) }
    }

    mutating func appendUInt32(_ value: UInt32) {
        var le = value.littleEndian
        Swift.withUnsafeBytes(of: &le) { append(contentsOf: $0) }
    }

    func appendingUInt16(_ value: UInt16) -> Data {
        var copy = self
        copy.appendUInt16(value)
        return copy
    }

    func appendingUInt32(_ value: UInt32) -> Data {
        var copy = self
        copy.appendUInt32(value)
        return copy
    }
}
