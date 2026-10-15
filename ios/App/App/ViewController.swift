import UIKit
import Capacitor
import WebKit

class ViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()

        if #available(iOS 16.4, *) {
            webView?.isInspectable = true
        }
    }
}