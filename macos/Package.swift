// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "Plog",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(name: "Plog", targets: ["Plog"]),
        .library(name: "PlogMacAppCore", targets: ["PlogMacAppCore"])
    ],
    targets: [
        .executableTarget(
            name: "Plog",
            dependencies: ["PlogMacAppCore"]
        ),
        .target(name: "PlogMacAppCore"),
        .testTarget(
            name: "PlogMacAppCoreTests",
            dependencies: ["PlogMacAppCore"]
        )
    ]
)
