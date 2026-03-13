import AppKit
import AVFoundation
import CoreGraphics
import CoreMedia
import Dispatch
import Foundation
import ScreenCaptureKit

enum RecorderError: Error {
    case usage(String)
    case invalidArgument(String)
    case screenRecordingPermissionDenied
    case missingWindowID(UInt32)
    case invalidWindowFrame
    case noFramesCaptured
    case writerFailed(String)
}

extension RecorderError: LocalizedError {
    var errorDescription: String? {
        switch self {
        case .usage(let text):
            return text
        case .invalidArgument(let message):
            return message
        case .screenRecordingPermissionDenied:
            return "Screen Recording permission was not granted."
        case .missingWindowID(let id):
            return "No capturable on-screen window found for id \(id)."
        case .invalidWindowFrame:
            return "Target window has an invalid frame size."
        case .noFramesCaptured:
            return "No frames were captured. Check Screen Recording permission and window visibility."
        case .writerFailed(let message):
            return "Video writer failed: \(message)"
        }
    }
}

struct RecordOptions {
    var windowID: UInt32
    var outputPath: String
    var durationSeconds: Double
    var fps: Int
    var showCursor: Bool
}

enum Command {
    case list
    case record(RecordOptions)
}

final class WindowMovieWriter {
    private let writer: AVAssetWriter
    private let input: AVAssetWriterInput
    private let adaptor: AVAssetWriterInputPixelBufferAdaptor
    private var sessionStarted = false
    private let lock = NSLock()

    init(outputURL: URL, width: Int, height: Int, fps: Int) throws {
        let fileManager = FileManager.default
        let parent = outputURL.deletingLastPathComponent()
        try fileManager.createDirectory(at: parent, withIntermediateDirectories: true)

        if fileManager.fileExists(atPath: outputURL.path) {
            try fileManager.removeItem(at: outputURL)
        }

        writer = try AVAssetWriter(outputURL: outputURL, fileType: .mp4)

        let settings: [String: Any] = [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: width,
            AVVideoHeightKey: height,
            AVVideoCompressionPropertiesKey: [
                AVVideoAverageBitRateKey: width * height * max(fps, 1),
                AVVideoMaxKeyFrameIntervalKey: max(fps, 1)
            ]
        ]

        input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
        input.expectsMediaDataInRealTime = true

        adaptor = AVAssetWriterInputPixelBufferAdaptor(
            assetWriterInput: input,
            sourcePixelBufferAttributes: [
                kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32BGRA),
                kCVPixelBufferWidthKey as String: width,
                kCVPixelBufferHeightKey as String: height
            ]
        )

        guard writer.canAdd(input) else {
            throw RecorderError.writerFailed("cannot add video input")
        }

        writer.add(input)
    }

    func append(sampleBuffer: CMSampleBuffer) {
        guard let imageBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else {
            return
        }

        lock.lock()
        defer { lock.unlock() }

        if writer.status == .failed || writer.status == .cancelled {
            return
        }

        if writer.status == .unknown {
            writer.startWriting()
        }

        let pts = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
        if !sessionStarted {
            writer.startSession(atSourceTime: pts)
            sessionStarted = true
        }

        if input.isReadyForMoreMediaData {
            _ = adaptor.append(imageBuffer, withPresentationTime: pts)
        }
    }

    func finish() throws {
        lock.lock()
        let writerStatus = writer.status
        if writerStatus != .unknown {
            input.markAsFinished()
        }
        lock.unlock()

        if writerStatus == .unknown {
            throw RecorderError.noFramesCaptured
        }

        let semaphore = DispatchSemaphore(value: 0)
        writer.finishWriting {
            semaphore.signal()
        }
        semaphore.wait()

        if writer.status != .completed {
            throw RecorderError.writerFailed(writer.error?.localizedDescription ?? "unknown failure")
        }
    }

}

final class StreamOutput: NSObject, SCStreamOutput {
    private let writer: WindowMovieWriter

    init(writer: WindowMovieWriter) {
        self.writer = writer
    }

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of outputType: SCStreamOutputType) {
        guard outputType == .screen else {
            return
        }
        writer.append(sampleBuffer: sampleBuffer)
    }
}

enum MacOSWindowRecorder {
    private static var retainedOutputs: [StreamOutput] = []

    static func run() async throws {
        let command = try parseCommand(arguments: Array(CommandLine.arguments.dropFirst()))
        switch command {
        case .list:
            try await listWindows()
        case .record(let options):
            try ensureScreenRecordingAccess()
            try await recordWindow(options: options)
        }
    }

    private static func ensureScreenRecordingAccess() throws {
        if CGPreflightScreenCaptureAccess() {
            return
        }

        if !CGRequestScreenCaptureAccess() {
            throw RecorderError.screenRecordingPermissionDenied
        }
    }

    private static func parseCommand(arguments: [String]) throws -> Command {
        guard let subcommand = arguments.first else {
            throw RecorderError.usage(usageText)
        }

        switch subcommand {
        case "-h", "--help", "help":
            throw RecorderError.usage(usageText)
        case "list":
            return .list
        case "record":
            return .record(try parseRecordOptions(arguments: Array(arguments.dropFirst())))
        default:
            throw RecorderError.invalidArgument("Unknown command: \(subcommand)\n\n\(usageText)")
        }
    }

    private static func parseRecordOptions(arguments: [String]) throws -> RecordOptions {
        var windowID: UInt32?
        var outputPath = "window-recording-\(timestamp()).mp4"
        var durationSeconds = 30.0
        var fps = 30
        var showCursor = true

        var index = 0
        while index < arguments.count {
            let arg = arguments[index]

            func nextValue() throws -> String {
                let nextIndex = index + 1
                guard nextIndex < arguments.count else {
                    throw RecorderError.invalidArgument("Missing value for \(arg).")
                }
                index = nextIndex
                return arguments[nextIndex]
            }

            switch arg {
            case "--window-id":
                let value = try nextValue()
                guard let parsedID = UInt32(value) else {
                    throw RecorderError.invalidArgument("Invalid --window-id value: \(value)")
                }
                windowID = parsedID

            case "--out":
                outputPath = try nextValue()

            case "--duration":
                let value = try nextValue()
                guard let parsedDuration = Double(value), parsedDuration > 0 else {
                    throw RecorderError.invalidArgument("Invalid --duration value: \(value)")
                }
                durationSeconds = parsedDuration

            case "--fps":
                let value = try nextValue()
                guard let parsedFPS = Int(value), parsedFPS > 0 else {
                    throw RecorderError.invalidArgument("Invalid --fps value: \(value)")
                }
                fps = parsedFPS

            case "--show-cursor":
                let value = try nextValue().lowercased()
                switch value {
                case "1", "true", "yes":
                    showCursor = true
                case "0", "false", "no":
                    showCursor = false
                default:
                    throw RecorderError.invalidArgument("Invalid --show-cursor value: \(value)")
                }

            case "-h", "--help":
                throw RecorderError.usage(usageText)

            default:
                throw RecorderError.invalidArgument("Unknown flag: \(arg)")
            }

            index += 1
        }

        guard let resolvedWindowID = windowID else {
            throw RecorderError.invalidArgument("Missing required argument: --window-id")
        }

        return RecordOptions(
            windowID: resolvedWindowID,
            outputPath: outputPath,
            durationSeconds: durationSeconds,
            fps: fps,
            showCursor: showCursor
        )
    }

    private static func listWindows() async throws {
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)

        let windows = content.windows
            .filter { window in
                !(window.title ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            }
            .sorted { lhs, rhs in
                let lhsApp = lhs.owningApplication?.applicationName ?? ""
                let rhsApp = rhs.owningApplication?.applicationName ?? ""
                if lhsApp != rhsApp {
                    return lhsApp < rhsApp
                }

                let lhsTitle = lhs.title ?? ""
                let rhsTitle = rhs.title ?? ""
                return lhsTitle < rhsTitle
            }

        print("window_id\tapp\twidth\theight\ttitle")
        for window in windows {
            let appName = sanitizeTSV(window.owningApplication?.applicationName ?? "Unknown")
            let title = sanitizeTSV(window.title ?? "")
            print("\(window.windowID)\t\(appName)\t\(Int(window.frame.width))\t\(Int(window.frame.height))\t\(title)")
        }
    }

    private static func recordWindow(options: RecordOptions) async throws {
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
        guard let window = content.windows.first(where: { $0.windowID == options.windowID }) else {
            throw RecorderError.missingWindowID(options.windowID)
        }

        let width = Int(window.frame.width)
        let height = Int(window.frame.height)
        guard width > 0, height > 0 else {
            throw RecorderError.invalidWindowFrame
        }

        let outputURL = URL(fileURLWithPath: options.outputPath)

        let filter = SCContentFilter(desktopIndependentWindow: window)
        let config = SCStreamConfiguration()
        config.width = width
        config.height = height
        config.minimumFrameInterval = CMTime(value: 1, timescale: CMTimeScale(max(options.fps, 1)))
        config.showsCursor = options.showCursor
        config.capturesAudio = false
        config.queueDepth = 8
        config.pixelFormat = kCVPixelFormatType_32BGRA

        let writer = try WindowMovieWriter(
            outputURL: outputURL,
            width: width,
            height: height,
            fps: options.fps
        )

        let streamOutput = StreamOutput(writer: writer)
        let streamQueue = DispatchQueue(label: "openwork.window-recorder.stream")

        retainedOutputs.append(streamOutput)
        defer {
            retainedOutputs.removeAll { $0 === streamOutput }
        }

        let stream = SCStream(filter: filter, configuration: config, delegate: nil)
        try stream.addStreamOutput(streamOutput, type: .screen, sampleHandlerQueue: streamQueue)

        let appName = window.owningApplication?.applicationName ?? "Unknown"
        let title = window.title ?? "Untitled"
        print("recording window \(options.windowID) [\(appName): \(title)] for \(options.durationSeconds)s")

        try await stream.startCapture()
        let nanoseconds = UInt64(options.durationSeconds * 1_000_000_000)
        try await Task.sleep(nanoseconds: nanoseconds)
        try await stream.stopCapture()

        try writer.finish()
        print("saved \(outputURL.path)")
    }

    private static func timestamp() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyyMMdd-HHmmss"
        return formatter.string(from: Date())
    }

    private static func sanitizeTSV(_ value: String) -> String {
        value
            .replacingOccurrences(of: "\t", with: " ")
            .replacingOccurrences(of: "\n", with: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static var usageText: String {
        """
        macos-window-recorder

        Usage:
          macos-window-recorder list
          macos-window-recorder record --window-id <id> [--out <file.mp4>] [--duration <seconds>] [--fps <n>] [--show-cursor <0|1>]

        Examples:
          macos-window-recorder list
          macos-window-recorder record --window-id 1234 --out /tmp/openwork-artifacts/videos/flow.mp4 --duration 45 --fps 30 --show-cursor 1
        """
    }
}

Task {
    do {
        try await MacOSWindowRecorder.run()
        exit(0)
    } catch {
        if let recorderError = error as? RecorderError,
           case .usage(let text) = recorderError {
            print(text)
            exit(0)
        }

        fputs("error: \(error.localizedDescription)\n", stderr)
        fputs("hint: grant Screen Recording permission in System Settings > Privacy & Security > Screen Recording.\n", stderr)
        exit(1)
    }
}

NSApplication.shared.setActivationPolicy(.prohibited)

dispatchMain()
