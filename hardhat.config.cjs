require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: { optimizer: { enabled: true, runs: 200 } }
  },
  networks: {
    polygon: {
      url: "https://polygon-rpc.com",
      chainId: 137,
      accounts: ["0x18f7cabdfe8631974de317fbb3d4597a9686f519590df44d2b4fb4d292e9d21c"],
    },
    polygonAmoy: {
      url: "https://polygon-amoy.drpc.org",
      chainId: 80002,
      accounts: ["0x18f7cabdfe8631974de317fbb3d4597a9686f519590df44d2b4fb4d292e9d21c"],
    }
  },
  etherscan: {
    apiKey: {
      polygon: "",
      polygonAmoy: "",
    },
    customChains: [
      {
        network: "polygonAmoy",
        chainId: 80002,
        urls: {
          apiURL: "https://api-amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com"
        }
      }
    ]
  }
};