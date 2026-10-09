// Finder Quick Look (space bar) preview for Markdown files.
// Shows dist/quicklook/index.html (built from src/quicklook) in a WKWebView and hands it the file text.
import Cocoa
import QuickLookUI
import WebKit

@objc(PreviewViewController)
final class PreviewViewController: NSViewController, QLPreviewingController, WKNavigationDelegate {
    private var webView: WKWebView!
    private var pending: (markdown: String, completion: (Error?) -> Void)?

    override func loadView() {
        let config = WKWebViewConfiguration()
        webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 900, height: 700), configuration: config)
        webView.navigationDelegate = self
        webView.autoresizingMask = [.width, .height]
        view = webView
    }

    func preparePreviewOfFile(at url: URL, completionHandler handler: @escaping (Error?) -> Void) {
        let data: Data
        do {
            data = try Data(contentsOf: url)
        } catch {
            handler(error)
            return
        }
        guard let page = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "preview") else {
            handler(CocoaError(.fileNoSuchFile))
            return
        }
        pending = (String(decoding: data, as: UTF8.self), handler)
        webView.loadFileURL(page, allowingReadAccessTo: page.deletingLastPathComponent())
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard let job = pending else { return }
        pending = nil
        // JSON-encode the text so any content is a safe JS string literal
        guard let json = try? JSONSerialization.data(withJSONObject: [job.markdown]),
              let literal = String(data: json, encoding: .utf8) else {
            job.completion(CocoaError(.fileReadCorruptFile))
            return
        }
        webView.evaluateJavaScript("window.muduckRender(\(literal)[0])") { _, _ in
            job.completion(nil)
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        finishWithError(error)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        finishWithError(error)
    }

    private func finishWithError(_ error: Error) {
        pending?.completion(error)
        pending = nil
    }

    // The preview page must never navigate away: web links open in the browser, the rest is ignored.
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard action.navigationType == .linkActivated, let url = action.request.url else {
            decisionHandler(.allow)
            return
        }
        if let scheme = url.scheme?.lowercased(), ["http", "https", "mailto"].contains(scheme) {
            NSWorkspace.shared.open(url)
        }
        decisionHandler(.cancel)
    }
}
