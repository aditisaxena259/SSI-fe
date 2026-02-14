export const interactionHubConfig = {
  address: "0x329C75F53B2b85F83B85b123Fd98b93dDE6FE23a", // your deployed hub
  abi: [
    {
      name: "createClaimRequest",
      type: "function",
      stateMutability: "nonpayable",
      inputs: [
        { name: "target", type: "address" },
        { name: "fields", type: "string[]" },
        { name: "reason", type: "string" }
      ],
      outputs: []
    },
    {
      name: "fulfillClaimRequest",
      type: "function",
      stateMutability: "nonpayable",
      inputs: [{ name: "requestId", type: "uint256" }],
      outputs: []
    },
    {
      name: "createAttestation",
      type: "function",
      stateMutability: "nonpayable",
      inputs: [
        { name: "target", type: "address" },
        { name: "text", type: "string" }
      ],
      outputs: []
    }
  ]
} as const
