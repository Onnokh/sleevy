// Presses a button in Device Hub by its accessibility description, e.g.
// `duoctl press Book`. The iPhone Duo posture (Closed / Book / Open) has no
// command-line control, only these toolbar buttons.
//
// Needs Accessibility access for the process that runs it.
//   duoctl dump           print labelled elements
//   duoctl press <label>  press the first button whose description equals <label>
import AppKit
import ApplicationServices

func attr(_ element: AXUIElement, _ name: String) -> String {
    var value: CFTypeRef?
    guard AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success, let value else { return "" }
    return "\(value)"
}

func children(_ element: AXUIElement) -> [AXUIElement] {
    var value: CFTypeRef?
    guard AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &value) == .success else { return [] }
    return (value as? [AXUIElement]) ?? []
}

/// Depth-first walk that stops as soon as `visit` returns true.
func walk(_ element: AXUIElement, depth: Int = 0, visit: (AXUIElement, Int) -> Bool) -> Bool {
    if visit(element, depth) { return true }
    guard depth < 40 else { return false }
    return children(element).contains { walk($0, depth: depth + 1, visit: visit) }
}

guard AXIsProcessTrusted() else {
    FileHandle.standardError.write("duoctl: no Accessibility access for this process\n".data(using: .utf8)!)
    exit(3)
}
guard let deviceHub = NSWorkspace.shared.runningApplications.first(where: { $0.localizedName == "Device Hub" || $0.localizedName == "DeviceHub" }) else {
    FileHandle.standardError.write("duoctl: Device Hub is not running\n".data(using: .utf8)!)
    exit(1)
}
let root = AXUIElementCreateApplication(deviceHub.processIdentifier)
let args = CommandLine.arguments

switch (args.count, args.dropFirst().first) {
case (2, "dump"):
    _ = walk(root) { element, depth in
        let desc = attr(element, kAXDescriptionAttribute), title = attr(element, kAXTitleAttribute)
        if !(desc + title).isEmpty {
            print(String(repeating: " ", count: depth) + "\(attr(element, kAXRoleAttribute)) title=\(title) desc=\(desc)")
        }
        return false
    }
case (3, "press"):
    let label = args[2]
    var pressed = false
    _ = walk(root) { element, _ in
        guard attr(element, kAXRoleAttribute) == kAXButtonRole, attr(element, kAXDescriptionAttribute) == label else { return false }
        pressed = AXUIElementPerformAction(element, kAXPressAction as CFString) == .success
        return true
    }
    if !pressed { FileHandle.standardError.write("duoctl: no button '\(label)'\n".data(using: .utf8)!) }
    exit(pressed ? 0 : 2)
default:
    print("usage: duoctl dump | duoctl press <label>")
    exit(64)
}
