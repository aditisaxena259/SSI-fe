'use client'

import { useState } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useConfig,
} from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { keccak256, stringToBytes } from 'viem'
import { contractConfig } from './contract'
import { trustRegistryConfig } from './trustRegistry'
import { interactionHubConfig } from './interactionHub'
import { uploadToIPFS } from './ipfs'
import { QRCodeCanvas } from 'qrcode.react'

export default function Home() {
  const { address } = useAccount()
  const config = useConfig()
  const { writeContractAsync } = useWriteContract()

  const { data: trustStatus } = useReadContract({
    ...trustRegistryConfig,
    functionName: "isTrusted",
    args: address ? [address] : undefined,
  })

  const { data, refetch } = useReadContract({
    ...contractConfig,
    functionName: 'getUserCredentials',
    args: address ? [address] : undefined,
  })

  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [year, setYear] = useState('')
  const [recipient, setRecipient] = useState('')
  const [claimReason, setClaimReason] = useState('')
  const [attestationText, setAttestationText] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleIssue() {
    if (!address) return

    const targetAddress =
      recipient && recipient.startsWith('0x')
        ? recipient
        : address

    try {
      setLoading(true)

      const credential = {
        name,
        type,
        year,
        issuedTo: targetAddress,
        timestamp: new Date().toISOString(),
      }

      const cid = await uploadToIPFS(credential)

      const hashValue = keccak256(
        stringToBytes(JSON.stringify(credential))
      )

      const txHash = await writeContractAsync({
        ...contractConfig,
        functionName: 'issueCredential',
        args: [targetAddress as `0x${string}`, hashValue, cid],
      })

      await waitForTransactionReceipt(config, { hash: txHash })
      await refetch()
      alert("Credential Issued")

    } finally {
      setLoading(false)
    }
  }

  async function handleClaimRequest() {
    if (!address || !recipient) return

    const txHash = await writeContractAsync({
      ...interactionHubConfig,
      functionName: 'createClaimRequest',
      args: [
        recipient as `0x${string}`,
        ["type", "year"],
        claimReason,
      ],
    })

    await waitForTransactionReceipt(config, { hash: txHash })
    alert("Claim Request Sent")
  }

  async function handleAttestation() {
    if (!address || !recipient) return

    const txHash = await writeContractAsync({
      ...interactionHubConfig,
      functionName: 'createAttestation',
      args: [
        recipient as `0x${string}`,
        attestationText,
      ],
    })

    await waitForTransactionReceipt(config, { hash: txHash })
    alert("Attestation Created")
  }

  return (
    <div className="p-10 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">
        NeuralHash SSI Dashboard
      </h1>

      <ConnectButton />

      {address && (
        <>
          <div className="mt-4 p-4 border rounded bg-gray-50">
            Trust Status:{" "}
            {trustStatus ? "Trusted ✅" : "Not Trusted ❌"}
          </div>

          {/* ISSUE CREDENTIAL */}
          <div className="mt-8 border p-6 rounded">
            <h2 className="text-xl font-semibold mb-4">
              Issue Credential
            </h2>

            <input
              className="border p-2 mb-3 w-full"
              placeholder="Recipient Address"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />

            <input
              className="border p-2 mb-3 w-full"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <input
              className="border p-2 mb-3 w-full"
              placeholder="Type"
              value={type}
              onChange={(e) => setType(e.target.value)}
            />

            <input
              className="border p-2 mb-3 w-full"
              placeholder="Year"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            />

            <button
              className="bg-black text-white px-4 py-2 rounded"
              onClick={handleIssue}
              disabled={loading}
            >
              Issue Credential
            </button>
          </div>

          {/* INTERACTION HUB */}
          <div className="mt-10 border p-6 rounded bg-gray-50">
            <h2 className="text-xl font-semibold mb-4">
              Interaction Hub
            </h2>

            <input
              className="border p-2 mb-3 w-full"
              placeholder="Target Wallet Address"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />

            <input
              className="border p-2 mb-3 w-full"
              placeholder="Claim Reason"
              value={claimReason}
              onChange={(e) => setClaimReason(e.target.value)}
            />

            <button
              className="bg-blue-600 text-white px-4 py-2 rounded mb-4"
              onClick={handleClaimRequest}
            >
              Send Claim Request
            </button>

            <input
              className="border p-2 mb-3 w-full"
              placeholder="Attestation Text"
              value={attestationText}
              onChange={(e) => setAttestationText(e.target.value)}
            />

            <button
              className="bg-green-600 text-white px-4 py-2 rounded"
              onClick={handleAttestation}
            >
              Create Attestation
            </button>
          </div>

          {/* CREDENTIAL LIST */}
          <div className="mt-10">
            <h2 className="text-xl font-semibold mb-4">
              Your Credentials
            </h2>

            {data?.map((cred: any, i: number) => (
              <div key={i} className="border p-4 mb-6 rounded">
                <p><strong>IPFS CID:</strong> {cred.ipfsCID}</p>
                <p><strong>Status:</strong> {cred.isValid ? "Active" : "Revoked"}</p>

                <div className="mt-6 flex flex-col items-center">
                  <QRCodeCanvas
                    value={
                      typeof window !== 'undefined'
                        ? `${window.location.origin}/verify?user=${address}&hash=${cred.credentialHash}`
                        : ''
                    }
                    size={150}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
