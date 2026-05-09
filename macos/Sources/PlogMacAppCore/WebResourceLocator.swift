import Foundation

public enum WebResourceError: Error, Equatable {
    case missingResourceRoot
    case missingIndexHTML
}

public enum WebResourceLocator {
    public static func indexHTML(inResourceRoot resourceRoot: URL?) throws -> URL {
        guard let resourceRoot else {
            throw WebResourceError.missingResourceRoot
        }

        let index = resourceRoot
            .appendingPathComponent("Web", isDirectory: true)
            .appendingPathComponent("index.html", isDirectory: false)

        guard FileManager.default.fileExists(atPath: index.path) else {
            throw WebResourceError.missingIndexHTML
        }

        return index
    }
}
