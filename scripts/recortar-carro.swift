// Recorta o objeto principal de uma foto, usando o Vision do próprio macOS —
// o mesmo motor por trás do "remover fundo" do Preview.
//
// Nada sai da máquina: sem serviço externo, sem chave de API, sem upload de
// foto de cliente para terceiros.
//
//   swift recortar.swift entrada.jpg saida.png

import Foundation
import Vision
import CoreImage
import AppKit

let args = CommandLine.arguments
guard args.count >= 3 else {
    FileHandle.standardError.write("uso: recortar.swift <entrada> <saida.png>\n".data(using: .utf8)!)
    exit(2)
}

let inURL = URL(fileURLWithPath: args[1])
let outURL = URL(fileURLWithPath: args[2])

guard let ciImage = CIImage(contentsOf: inURL) else {
    FileHandle.standardError.write("não consegui ler a imagem\n".data(using: .utf8)!)
    exit(1)
}

let handler = VNImageRequestHandler(ciImage: ciImage, options: [:])
let request = VNGenerateForegroundInstanceMaskRequest()

do {
    try handler.perform([request])
} catch {
    FileHandle.standardError.write("Vision falhou: \(error)\n".data(using: .utf8)!)
    exit(1)
}

guard let observation = request.results?.first, !observation.allInstances.isEmpty else {
    FileHandle.standardError.write("nenhum objeto em primeiro plano encontrado\n".data(using: .utf8)!)
    exit(3)
}

// `allInstances` traz cada objeto separado. Pedimos TODOS de uma vez: num
// anúncio de carro o veículo costuma ser detectado em mais de uma instância
// (carroceria e rodas, por exemplo), e ficar só com a primeira devolveria
// meio carro.
let masked = try observation.generateMaskedImage(
    ofInstances: observation.allInstances,
    from: handler,
    croppedToInstancesExtent: true
)

let context = CIContext()
let ci = CIImage(cvPixelBuffer: masked)

guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
      let png = context.pngRepresentation(of: ci, format: .RGBA8, colorSpace: colorSpace)
else {
    FileHandle.standardError.write("não consegui gerar o PNG\n".data(using: .utf8)!)
    exit(1)
}

try png.write(to: outURL)
print("recortado: \(Int(ci.extent.width))x\(Int(ci.extent.height)) — \(observation.allInstances.count) instância(s)")
