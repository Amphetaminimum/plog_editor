import Foundation
import CoreGraphics
import ImageIO
import Testing
import UniformTypeIdentifiers
@testable import PlogMacAppCore

struct NativeStorageStoreTests {
    @Test func storesKeyValuePayloadsUnderRoot() throws {
        let root = try temporaryRoot()
        defer { try? FileManager.default.removeItem(at: root) }
        let store = NativeStorageStore(root: root)

        _ = store.handle(["op": "set", "key": "plog_editor_docs_v1", "value": ["docs": [["id": "doc-1"]]]])
        let response = store.handle(["op": "get", "key": "plog_editor_docs_v1"])

        #expect(response["ok"] as? Bool == true)
        let value = response["value"] as? [String: Any]
        let docs = value?["docs"] as? [[String: Any]]
        #expect(docs?.first?["id"] as? String == "doc-1")
        #expect(FileManager.default.fileExists(atPath: root.appendingPathComponent("kv").path))
    }

    @Test func storesAndDeletesAssetsUnderRoot() throws {
        let root = try temporaryRoot()
        defer { try? FileManager.default.removeItem(at: root) }
        let store = NativeStorageStore(root: root)

        let encoded = Data("hello".utf8).base64EncodedString()
        _ = store.handle(["op": "setAsset", "key": "asset-1", "type": "text/plain", "data": encoded])
        let loaded = store.handle(["op": "getAsset", "key": "asset-1"])

        #expect(loaded["ok"] as? Bool == true)
        #expect(loaded["type"] as? String == "text/plain")
        #expect(loaded["data"] as? String == encoded)

        _ = store.handle(["op": "deleteAsset", "key": "asset-1"])
        let missing = store.handle(["op": "getAsset", "key": "asset-1"])
        #expect(missing["ok"] as? Bool == true)
        #expect(missing["data"] == nil)
    }

    @Test func normalizesHifAssetsToPngForWebDisplay() throws {
        let root = try temporaryRoot()
        defer { try? FileManager.default.removeItem(at: root) }
        let store = NativeStorageStore(root: root)
        let encodedPng = try makeTestPngData().base64EncodedString()

        let response = store.handle([
            "op": "normalizeImageAsset",
            "name": "sample.hif",
            "type": "application/octet-stream",
            "data": encodedPng,
        ])

        #expect(response["ok"] as? Bool == true)
        #expect(response["type"] as? String == "image/png")
        #expect(response["data"] as? String != nil)
    }

    private func temporaryRoot() throws -> URL {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        return root
    }

    private func makeTestPngData() throws -> Data {
        let bytes = Data([255, 0, 0, 255])
        guard
            let provider = CGDataProvider(data: bytes as CFData),
            let image = CGImage(
                width: 1,
                height: 1,
                bitsPerComponent: 8,
                bitsPerPixel: 32,
                bytesPerRow: 4,
                space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
                provider: provider,
                decode: nil,
                shouldInterpolate: false,
                intent: .defaultIntent
            )
        else {
            throw TestImageError.createFailed
        }

        let output = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(output, UTType.png.identifier as CFString, 1, nil) else {
            throw TestImageError.createFailed
        }
        CGImageDestinationAddImage(destination, image, nil)
        guard CGImageDestinationFinalize(destination) else {
            throw TestImageError.createFailed
        }
        return output as Data
    }

    private enum TestImageError: Error {
        case createFailed
    }
}
