import Foundation

public final class NativeStorageStore {
    private let root: URL
    private let kvDirectory: URL
    private let assetsDirectory: URL
    private let metadataDirectory: URL
    private let fileManager: FileManager

    public init(root: URL, fileManager: FileManager = .default) {
        self.root = root
        self.kvDirectory = root.appendingPathComponent("kv", isDirectory: true)
        self.assetsDirectory = root.appendingPathComponent("assets", isDirectory: true)
        self.metadataDirectory = root.appendingPathComponent("asset-metadata", isDirectory: true)
        self.fileManager = fileManager
    }

    public static func defaultRoot(fileManager: FileManager = .default) throws -> URL {
        let appSupport = try fileManager.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        return appSupport.appendingPathComponent("Plog", isDirectory: true)
    }

    public func handle(_ payload: [String: Any]) -> [String: Any] {
        do {
            guard let op = payload["op"] as? String else {
                throw NativeStorageError.invalidPayload
            }

            switch op {
            case "set":
                try setValue(payload["value"] ?? NSNull(), forKey: key(from: payload))
                return ok()
            case "get":
                return ok(value: try getValue(forKey: key(from: payload)) as Any)
            case "setAsset":
                try setAsset(payload)
                return ok()
            case "getAsset":
                return try getAsset(forKey: key(from: payload))
            case "deleteAsset":
                try deleteAsset(forKey: key(from: payload))
                return ok()
            default:
                throw NativeStorageError.unsupportedOperation(op)
            }
        } catch {
            return ["ok": false, "error": String(describing: error)]
        }
    }

    private func key(from payload: [String: Any]) throws -> String {
        guard let key = payload["key"] as? String, !key.isEmpty else {
            throw NativeStorageError.invalidPayload
        }
        return key
    }

    private func setValue(_ value: Any, forKey key: String) throws {
        try createDirectories()
        let data = try JSONSerialization.data(withJSONObject: value, options: [.prettyPrinted, .sortedKeys])
        try data.write(to: kvURL(forKey: key), options: .atomic)
    }

    private func getValue(forKey key: String) throws -> Any? {
        let url = kvURL(forKey: key)
        guard fileManager.fileExists(atPath: url.path) else {
            return nil
        }
        let data = try Data(contentsOf: url)
        return try JSONSerialization.jsonObject(with: data)
    }

    private func setAsset(_ payload: [String: Any]) throws {
        try createDirectories()
        let key = try key(from: payload)
        guard let encoded = payload["data"] as? String, let data = Data(base64Encoded: encoded) else {
            throw NativeStorageError.invalidPayload
        }

        try data.write(to: assetURL(forKey: key), options: .atomic)

        let metadata: [String: Any] = [
            "type": payload["type"] as? String ?? "application/octet-stream"
        ]
        let metadataData = try JSONSerialization.data(withJSONObject: metadata, options: [.prettyPrinted, .sortedKeys])
        try metadataData.write(to: assetMetadataURL(forKey: key), options: .atomic)
    }

    private func getAsset(forKey key: String) throws -> [String: Any] {
        let url = assetURL(forKey: key)
        guard fileManager.fileExists(atPath: url.path) else {
            return ok()
        }

        let data = try Data(contentsOf: url)
        let metadata = try readAssetMetadata(forKey: key)
        return [
            "ok": true,
            "data": data.base64EncodedString(),
            "type": metadata["type"] as? String ?? "application/octet-stream",
        ]
    }

    private func deleteAsset(forKey key: String) throws {
        try removeIfExists(assetURL(forKey: key))
        try removeIfExists(assetMetadataURL(forKey: key))
    }

    private func readAssetMetadata(forKey key: String) throws -> [String: Any] {
        let url = assetMetadataURL(forKey: key)
        guard fileManager.fileExists(atPath: url.path) else {
            return [:]
        }
        let data = try Data(contentsOf: url)
        return try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
    }

    private func createDirectories() throws {
        try fileManager.createDirectory(at: kvDirectory, withIntermediateDirectories: true)
        try fileManager.createDirectory(at: assetsDirectory, withIntermediateDirectories: true)
        try fileManager.createDirectory(at: metadataDirectory, withIntermediateDirectories: true)
    }

    private func removeIfExists(_ url: URL) throws {
        if fileManager.fileExists(atPath: url.path) {
            try fileManager.removeItem(at: url)
        }
    }

    private func kvURL(forKey key: String) -> URL {
        kvDirectory.appendingPathComponent(safeFilename(forKey: key)).appendingPathExtension("json")
    }

    private func assetURL(forKey key: String) -> URL {
        assetsDirectory.appendingPathComponent(safeFilename(forKey: key))
    }

    private func assetMetadataURL(forKey key: String) -> URL {
        metadataDirectory.appendingPathComponent(safeFilename(forKey: key)).appendingPathExtension("json")
    }

    private func safeFilename(forKey key: String) -> String {
        Data(key.utf8).base64EncodedString()
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "=", with: "")
    }

    private func ok(value: Any? = nil) -> [String: Any] {
        if let value {
            return ["ok": true, "value": value]
        }
        return ["ok": true]
    }
}

public enum NativeStorageError: Error, Equatable {
    case invalidPayload
    case unsupportedOperation(String)
}
