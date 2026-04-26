import AppKit
import PlogMacAppCore
import WebKit

final class NativeStorageBridge: NSObject, WKScriptMessageHandler {
    private let store: NativeStorageStore
    private weak var webView: WKWebView?

    init(store: NativeStorageStore) {
        self.store = store
    }

    func attach(to webView: WKWebView) {
        self.webView = webView
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard
            let body = message.body as? [String: Any],
            let requestId = body["id"] as? String,
            let payload = body["payload"] as? [String: Any]
        else {
            return
        }

        let response = store.handle(payload)
        guard
            let responseData = try? JSONSerialization.data(withJSONObject: response),
            let responseJSON = String(data: responseData, encoding: .utf8)
        else {
            return
        }

        let callback = "window.__plogNativeStorageResolve(\(Self.jsStringLiteral(requestId)), \(responseJSON));"
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript(callback)
        }
    }

    private static func jsStringLiteral(_ value: String) -> String {
        let data = try? JSONSerialization.data(withJSONObject: [value])
        let encoded = data.flatMap { String(data: $0, encoding: .utf8) } ?? "[\"\"]"
        return String(encoded.dropFirst().dropLast())
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    private var window: NSWindow?
    private var activeDownloads: [WKDownload] = []
    private var nativeStorageBridge: NativeStorageBridge?

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        createMainMenu()
        openMainWindow()
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    private func openMainWindow() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
        do {
            let storageRoot = try NativeStorageStore.defaultRoot()
            let bridge = NativeStorageBridge(store: NativeStorageStore(root: storageRoot))
            let userContentController = WKUserContentController()
            userContentController.add(bridge, name: "plogNativeStorage")
            userContentController.addUserScript(WKUserScript(
                source: Self.nativeStorageBootstrapScript,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            ))
            configuration.userContentController = userContentController
            nativeStorageBridge = bridge
        } catch {
            showStartupError(error)
            return
        }

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        nativeStorageBridge?.attach(to: webView)

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1440, height: 960),
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        window.title = "Plog"
        window.minSize = NSSize(width: 1040, height: 720)
        window.center()
        window.contentView = webView
        window.makeKeyAndOrderFront(nil)
        self.window = window

        do {
            let indexURL = try WebResourceLocator.indexHTML(inResourceRoot: Bundle.main.resourceURL)
            let webRoot = indexURL.deletingLastPathComponent()
            webView.loadFileURL(indexURL, allowingReadAccessTo: webRoot)
        } catch {
            showStartupError(error)
        }
    }

    private static let nativeStorageBootstrapScript = """
    (() => {
      const pending = new Map();
      window.__plogNativeStorageResolve = (id, response) => {
        const entry = pending.get(id);
        if (!entry) return;
        pending.delete(id);
        entry.resolve(response);
      };
      window.plogNativeStorage = {
        request(payload) {
          return new Promise((resolve, reject) => {
            const id = `${Date.now()}-${Math.random()}`;
            pending.set(id, { resolve, reject });
            window.webkit.messageHandlers.plogNativeStorage.postMessage({ id, payload });
          });
        }
      };
    })();
    """

    private func showStartupError(_ error: Error) {
        let alert = NSAlert()
        alert.messageText = "Plog could not load its bundled web app."
        alert.informativeText = String(describing: error)
        alert.alertStyle = .critical
        alert.runModal()
        NSApp.terminate(nil)
    }

    private func createMainMenu() {
        let mainMenu = NSMenu()

        let appMenuItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(
            withTitle: "Quit Plog",
            action: #selector(NSApplication.terminate(_:)),
            keyEquivalent: "q"
        )
        appMenuItem.submenu = appMenu
        mainMenu.addItem(appMenuItem)

        let editMenuItem = NSMenuItem()
        let editMenu = NSMenu(title: "Edit")
        editMenu.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "Z")
        editMenu.addItem(NSMenuItem.separator())
        editMenu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editMenuItem.submenu = editMenu
        mainMenu.addItem(editMenuItem)

        NSApp.mainMenu = mainMenu
    }

    func webView(
        _ webView: WKWebView,
        runOpenPanelWith parameters: WKOpenPanelParameters,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping ([URL]?) -> Void
    ) {
        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.beginSheetModal(for: window ?? NSApp.keyWindow ?? NSWindow()) { response in
            completionHandler(response == .OK ? panel.urls : nil)
        }
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        preferences: WKWebpagePreferences,
        decisionHandler: @escaping (WKNavigationActionPolicy, WKWebpagePreferences) -> Void
    ) {
        if navigationAction.shouldPerformDownload {
            decisionHandler(.download, preferences)
        } else {
            decisionHandler(.allow, preferences)
        }
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        activeDownloads.append(download)
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        activeDownloads.append(download)
        download.delegate = self
    }

    func download(
        _ download: WKDownload,
        decideDestinationUsing response: URLResponse,
        suggestedFilename: String,
        completionHandler: @escaping (URL?) -> Void
    ) {
        let panel = NSSavePanel()
        panel.nameFieldStringValue = suggestedFilename
        panel.beginSheetModal(for: window ?? NSApp.keyWindow ?? NSWindow()) { result in
            completionHandler(result == .OK ? panel.url : nil)
        }
    }

    func downloadDidFinish(_ download: WKDownload) {
        activeDownloads.removeAll { $0 === download }
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        activeDownloads.removeAll { $0 === download }
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
