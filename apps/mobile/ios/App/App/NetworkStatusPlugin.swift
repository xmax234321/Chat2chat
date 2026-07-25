import Capacitor
import CoreTelephony
import Network

@objc(NetworkStatusPlugin)
public class NetworkStatusPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NetworkStatusPlugin"
    public let jsName = "NetworkStatus"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getCellularDataStatus", returnType: CAPPluginReturnPromise),
    ]

    private let cellularData = CTCellularData()
    private var cellularState: CTCellularDataRestrictedState = .restrictedStateUnknown
    private var pendingCellularResolvers: [(String) -> Void] = []
    private var cellularTimeoutScheduled = false

    public override func load() {
        super.load()
        cellularState = cellularData.restrictedState
        cellularData.cellularDataRestrictionDidUpdateNotifier = { [weak self] state in
            guard let self = self else { return }
            self.cellularState = state
            guard state != .restrictedStateUnknown else { return }
            self.flushCellularResolvers(with: self.cellularStatusString(state))
        }
    }

    private func cellularStatusString(_ state: CTCellularDataRestrictedState) -> String {
        switch state {
        case .notRestricted:
            return "authorized"
        case .restricted:
            return "denied"
        case .restrictedStateUnknown:
            return "unknown"
        @unknown default:
            return "unknown"
        }
    }

    private func flushCellularResolvers(with status: String) {
        let resolvers = pendingCellularResolvers
        pendingCellularResolvers.removeAll()
        cellularTimeoutScheduled = false
        resolvers.forEach { $0(status) }
    }

    private func resolveCellularStatus(timeout: TimeInterval = 1.5, completion: @escaping (String) -> Void) {
        let immediate = cellularData.restrictedState
        if immediate != .restrictedStateUnknown {
            cellularState = immediate
            completion(cellularStatusString(immediate))
            return
        }

        pendingCellularResolvers.append(completion)

        guard !cellularTimeoutScheduled else { return }
        cellularTimeoutScheduled = true
        DispatchQueue.main.asyncAfter(deadline: .now() + timeout) { [weak self] in
            guard let self = self else { return }
            let latest = self.cellularData.restrictedState
            self.cellularState = latest
            self.flushCellularResolvers(with: self.cellularStatusString(latest))
        }
    }

    @objc func getCellularDataStatus(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.resolveCellularStatus { status in
                call.resolve(["status": status])
            }
        }
    }

    @objc func getStatus(_ call: CAPPluginCall) {
        let monitor = NWPathMonitor()
        let queue = DispatchQueue(label: "chat2chat-network-status")
        monitor.pathUpdateHandler = { [weak self] path in
            monitor.cancel()
            guard let self = self else { return }
            let wifi = path.usesInterfaceType(.wifi) || path.usesInterfaceType(.wiredEthernet)
            let cellular = path.usesInterfaceType(.cellular)
            let online = path.status == .satisfied
            self.resolveCellularStatus { status in
                DispatchQueue.main.async {
                    call.resolve([
                        "online": online,
                        "wifi": wifi,
                        "cellular": cellular,
                        "cellularRestricted": status == "denied",
                        "cellularStatus": status,
                    ])
                }
            }
        }
        monitor.start(queue: queue)
    }
}
