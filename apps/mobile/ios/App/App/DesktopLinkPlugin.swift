import CoreBluetooth
import Capacitor

@objc(DesktopLinkPlugin)
public class DesktopLinkPlugin: CAPPlugin, CAPBridgedPlugin, CBCentralManagerDelegate, CBPeripheralDelegate {
    public let identifier = "DesktopLinkPlugin"
    public let jsName = "DesktopLink"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "connect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disconnect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "write", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isConnected", returnType: CAPPluginReturnPromise),
    ]

    private var central: CBCentralManager?
    private var peripheral: CBPeripheral?
    private var rxCharacteristic: CBCharacteristic?
    private var txCharacteristic: CBCharacteristic?
    private var pendingConnectCall: CAPPluginCall?
    private var serviceUuid = CBUUID(string: "C2C0D001-0000-4000-8000-0000C2C00001")
    private var rxUuid = CBUUID(string: "C2C0D002-0000-4000-8000-0000C2C00002")
    private var txUuid = CBUUID(string: "C2C0D003-0000-4000-8000-0000C2C00003")
    private var namePrefix = "Chat2Chat"

    @objc func connect(_ call: CAPPluginCall) {
        guard let service = call.getString("serviceUuid"),
              let rx = call.getString("rxUuid"),
              let tx = call.getString("txUuid") else {
            call.reject("serviceUuid, rxUuid and txUuid are required")
            return
        }
        serviceUuid = CBUUID(string: service)
        rxUuid = CBUUID(string: rx)
        txUuid = CBUUID(string: tx)
        namePrefix = call.getString("deviceNamePrefix") ?? "Chat2Chat"
        pendingConnectCall = call
        if central == nil {
            central = CBCentralManager(delegate: self, queue: .main)
        } else if central?.state == .poweredOn {
            startScan()
        }
    }

    @objc func disconnect(_ call: CAPPluginCall) {
        if let peripheral, let central {
            central.cancelPeripheralConnection(peripheral)
        }
        resetConnection()
        call.resolve()
    }

    @objc func write(_ call: CAPPluginCall) {
        guard let value = call.getString("value"),
              let peripheral,
              let rxCharacteristic else {
            call.reject("Not connected")
            return
        }
        let data = Data(value.utf8)
        peripheral.writeValue(data, for: rxCharacteristic, type: .withResponse)
        call.resolve()
    }

    @objc func isConnected(_ call: CAPPluginCall) {
        call.resolve(["connected": peripheral != nil && rxCharacteristic != nil && txCharacteristic != nil])
    }

    public func centralManagerDidUpdateState(_ central: CBCentralManager) {
        if central.state == .poweredOn, pendingConnectCall != nil {
            startScan()
        } else if central.state != .poweredOn, let call = pendingConnectCall {
            call.reject("Bluetooth is unavailable")
            pendingConnectCall = nil
        }
    }

    private func startScan() {
        guard let central else { return }
        central.stopScan()
        central.scanForPeripherals(withServices: [serviceUuid], options: [CBCentralManagerScanOptionAllowDuplicatesKey: false])
        DispatchQueue.main.asyncAfter(deadline: .now() + 20) { [weak self] in
            guard let self, self.pendingConnectCall != nil else { return }
            self.central?.stopScan()
            self.pendingConnectCall?.reject("Desktop not found over Bluetooth")
            self.pendingConnectCall = nil
        }
    }

    public func centralManager(
        _ central: CBCentralManager,
        didDiscover peripheral: CBPeripheral,
        advertisementData: [String: Any],
        rssi RSSI: NSNumber
    ) {
        let localName = (advertisementData[CBAdvertisementDataLocalNameKey] as? String) ?? peripheral.name ?? ""
        guard localName.contains(namePrefix) else { return }
        central.stopScan()
        self.peripheral = peripheral
        peripheral.delegate = self
        central.connect(peripheral, options: nil)
    }

    public func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        peripheral.discoverServices([serviceUuid])
    }

    public func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        pendingConnectCall?.reject(error?.localizedDescription ?? "Connection failed")
        pendingConnectCall = nil
        resetConnection()
    }

    public func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        resetConnection()
        notifyListeners("disconnect", data: [:])
    }

    public func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        guard error == nil, let service = peripheral.services?.first(where: { $0.uuid == serviceUuid }) else {
            pendingConnectCall?.reject(error?.localizedDescription ?? "Service not found")
            pendingConnectCall = nil
            return
        }
        peripheral.discoverCharacteristics([rxUuid, txUuid], for: service)
    }

    public func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        guard error == nil else {
            pendingConnectCall?.reject(error?.localizedDescription ?? "Characteristics not found")
            pendingConnectCall = nil
            return
        }
        for characteristic in service.characteristics ?? [] {
            if characteristic.uuid == rxUuid { rxCharacteristic = characteristic }
            if characteristic.uuid == txUuid {
                txCharacteristic = characteristic
                peripheral.setNotifyValue(true, for: characteristic)
            }
        }
        if rxCharacteristic != nil, txCharacteristic != nil {
            pendingConnectCall?.resolve([
                "connected": true,
                "deviceName": peripheral.name ?? "Desktop",
            ])
            pendingConnectCall = nil
        }
    }

    public func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        guard error == nil, let data = characteristic.value else { return }
        let value = String(data: data, encoding: .utf8) ?? ""
        notifyListeners("message", data: ["value": value])
    }

    private func resetConnection() {
        peripheral = nil
        rxCharacteristic = nil
        txCharacteristic = nil
    }
}
