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
import { uploadToIPFS } from './ipfs'
import { QRCodeCanvas } from 'qrcode.react'
import { trustRegistryConfig } from './trustRegistry'


export default function Home() {
  const { address } = useAccount()
  const { data: trustStatus, isLoading: trustLoading } = useReadContract({
  ...trustRegistryConfig,
  functionName: "isTrusted",
  args: address ? [address] : undefined,
})

  const config = useConfig()

  const { data, refetch } = useReadContract({
    ...contractConfig,
    functionName: 'getUserCredentials',
    args: address ? [address] : undefined,
  })

  const { writeContractAsync } = useWriteContract()

  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [year, setYear] = useState('')
  const [recipient, setRecipient] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  // ---------------- EXTRACT ----------------

  async function handleExtract() {
    if (!file) {
      alert('Upload a PDF first')
      return
    }

    try {
      setLoading(true)

      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/extract', {
        method: 'POST',
        body: formData,
      })

      const result = await res.json()

      if (result.error) {
        throw new Error(result.error)
      }

      if (!result.data) {
        alert('Extraction failed')
        return
      }

      // Auto-fill extracted values
      setName(result.data.name ?? '')
      setType(result.data.documentType ?? '')
      setYear(result.data.year ?? '')
      
      alert('Data extracted successfully!')

    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Extraction error')
    } finally {
      setLoading(false)
    }
  }

  // ---------------- ISSUE ----------------

  async function handleIssue() {
    if (!address) return

    // Address to issue credential to (defaults to self if empty)
    const targetAddress = (recipient && recipient.startsWith('0x')) 
      ? recipient as `0x${string}`
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
        args: [targetAddress, hashValue, cid],
      })

      await waitForTransactionReceipt(config, { hash: txHash })

      setName('')
      setType('')
      setYear('')
      setRecipient('')
      setFile(null)

      // Only refresh list if we issued to ourselves
      if (targetAddress === address) {
        await refetch()
      }
      
      alert(`Credential successfully issued to ${targetAddress.slice(0, 6)}...${targetAddress.slice(-4)}`)
    } catch (err) {
      console.error(err)
      alert('Error issuing credential')
    } finally {
      setLoading(false)
    }
  }

  // ---------------- REVOKE ----------------

  async function handleRevoke(credentialHash: `0x${string}`) {
    if (!address) return

    try {
      setLoading(true)

      const txHash = await writeContractAsync({
        ...contractConfig,
        functionName: 'revokeCredential',
        args: [address, credentialHash],
      })

      await waitForTransactionReceipt(config, { hash: txHash })

      await refetch()
      alert('Credential Revoked Successfully')
    } catch (err) {
      console.error(err)
      alert('Revoke Failed')
    } finally {
      setLoading(false)
    }
  }

  // ---------------- UI ----------------

  return (
    <div className="p-10 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">
        NeuralHash SSI Dashboard
      </h1>

      <ConnectButton />
      {address && (
      <div className="mt-4 p-4 border rounded bg-gray-50">
        <p className="text-sm font-semibold">Trust Registry Test</p>
        {trustLoading ? (
          <p>Checking trust status...</p>
        ) : (
          <p>
            Trust Status:{" "}
            {trustStatus ? (
              <span className="text-green-600 font-bold">Trusted ✅</span>
            ) : (
              <span className="text-red-600 font-bold">Not Trusted ❌</span>
            )}
          </p>
        )}
      </div>
    )}


      {address && (
        <>
          {/* ISSUE FORM */}
          <div className="mt-8 border p-6 rounded">
            <h2 className="text-xl font-semibold mb-4">
              Issue Credential
            </h2>

            {/* 🔥 PDF Upload & Extract */}
            <div className="mb-6 p-4 bg-gray-50 rounded border border-dashed border-gray-400">
              <p className="text-sm font-bold mb-2">Auto-fill from PDF:</p>
              <input
                type="file"
                accept="application/pdf"
                className="block w-full text-sm text-slate-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-violet-50 file:text-violet-700
                  hover:file:bg-violet-100
                  mb-3"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setFile(e.target.files[0])
                  }
                }}
              />
              <button
                className="bg-purple-600 text-white px-4 py-2 rounded text-sm w-full hover:bg-purple-700 transition"
                onClick={handleExtract}
                disabled={loading || !file}
              >
                {loading ? 'Extracting...' : 'Extract Data from PDF'}
              </button>
            </div>

            <h3 className="text-lg font-medium mb-2">Credential Details</h3>

            {/* Recipient Input (Optional) */}
            <label className="block text-sm text-gray-700 mb-1">
              Recipient Address (Optional)
            </label>
            <input
              className="border p-2 mb-3 w-full font-mono text-sm"
              placeholder={`e.g. 0x123... (Defaults to you)`}
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
              placeholder="Type (Degree, License...)"
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
              {loading ? 'Processing...' : 'Issue Credential'}
            </button>
          </div>

          {/* CREDENTIALS */}
          <div className="mt-10">
            <h2 className="text-xl font-semibold mb-4">
              Your Credentials
            </h2>

            {data && data.length === 0 && (
              <p>No credentials issued yet.</p>
            )}

            {data?.map((cred: any, i: number) => (
              <div key={i} className="border p-4 mb-6 rounded">
                <p>
                  <strong>IPFS CID:</strong>{' '}
                  <a
                    href={`https://gateway.pinata.cloud/ipfs/${cred.ipfsCID}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    {cred.ipfsCID}
                  </a>
                </p>

                <p>
                  <strong>Issuer:</strong> {cred.issuer}
                </p>

                <p>
                  <strong>Status:</strong>{' '}
                  {cred.isValid ? 'Active' : 'Revoked'}
                </p>

                <p>
                  <strong>Issued At:</strong>{' '}
                  {new Date(
                    Number(cred.issuedAt) * 1000
                  ).toLocaleString()}
                </p>

                {/* 🔴 REVOKE BUTTON */}
                {cred.isValid && cred.issuer === address && (
                  <button
                    className="bg-red-600 text-white px-3 py-1 mt-4 rounded"
                    onClick={() =>
                      handleRevoke(cred.credentialHash)
                    }
                    disabled={loading}
                  >
                    {loading
                      ? 'Processing...'
                      : 'Revoke Credential'}
                  </button>
                )}

                {/* 🟢 QR CODE */}
                <div className="mt-6 flex flex-col items-center">
                  <p className="mb-2 text-sm text-gray-600">
                    Scan to Verify
                  </p>
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