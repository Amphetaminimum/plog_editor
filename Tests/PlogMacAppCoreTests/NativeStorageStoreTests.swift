import Foundation
import Testing
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

    private func temporaryRoot() throws -> URL {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        return root
    }
}
