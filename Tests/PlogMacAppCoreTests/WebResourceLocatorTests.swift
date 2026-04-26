import Foundation
import Testing
@testable import PlogMacAppCore

struct WebResourceLocatorTests {
    @Test func findsBundledIndexHTMLUnderWebResourceDirectory() throws {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let webRoot = root.appendingPathComponent("Web", isDirectory: true)
        try FileManager.default.createDirectory(at: webRoot, withIntermediateDirectories: true)
        let index = webRoot.appendingPathComponent("index.html")
        try "<!doctype html>".write(to: index, atomically: true, encoding: .utf8)
        defer {
            try? FileManager.default.removeItem(at: root)
        }

        let located = try WebResourceLocator.indexHTML(inResourceRoot: root)

        #expect(located == index)
    }

    @Test func throwsWhenBundledIndexHTMLIsMissing() {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try? FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer {
            try? FileManager.default.removeItem(at: root)
        }

        do {
            _ = try WebResourceLocator.indexHTML(inResourceRoot: root)
            Issue.record("Expected missingIndexHTML to be thrown")
        } catch {
            #expect(error as? WebResourceError == .missingIndexHTML)
        }
    }
}
