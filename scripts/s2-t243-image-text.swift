import AppKit
import Foundation
import Vision

guard CommandLine.arguments.count == 2,
      let image = NSImage(contentsOfFile: CommandLine.arguments[1]),
      let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
  fputs("STOP_S2_T243_IMAGE_UNREADABLE\n", stderr)
  exit(1)
}
let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = false
request.recognitionLanguages = ["zh-Hant", "en-US"]
let handler = VNImageRequestHandler(cgImage: cgImage)
do {
  try handler.perform([request])
  for observation in request.results ?? [] {
    if let candidate = observation.topCandidates(1).first {
      print(candidate.string)
    }
  }
} catch {
  fputs("STOP_S2_T243_IMAGE_TEXT_UNAVAILABLE\n", stderr)
  exit(1)
}
