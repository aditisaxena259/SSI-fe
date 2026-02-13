'use client'

import { useState, useEffect } from 'react'
import { readContract } from 'wagmi/actions'
import { useConfig } from 'wagmi'
import { keccak256, stringToBytes } from 'viem'
import { useSearchParams } from 'next/navigation'
import { contractConfig } from '../contract'

export default function VerifyPage() {
  const config = useConfig()
  const searchParams = useSearchParams()

  const userParam = searchParams.get('user')
  const hashParam = searchParams.get('hash')

  const [disclosedData, setDisclosedData] = useState<Record<string, any> | null>(null)
  const [inputAddress, setInputAddress] = useState('')
  const [credentials, setCredentials] = useState<any[]>([])
  const [verificationResult, setVerificationResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // ---------------- AUTO FILL ADDRESS ----------------
  useEffect(() => {
    if (userParam) {
      setInputAddress(userParam)
    }
  }, [userParam])

  // ---------------- FETCH CREDENTIALS ----------------
  async function fetchCredentials(addressToFetch?: string) {
    const address = addressToFetch || inputAddress
    if (!address) return

    try {
      setLoading(true)
      setDisclosedData(null)
      setVerificationResult(null)

      const data = await readContract(config, {
        ...contractConfig,
        functionName: 'getUserCredentials',
        args: [address as `0x${string}`],
      })

      const creds = data as any[]
      setCredentials(creds)

      // Auto verify if hash present in URL
      if (hashParam) {
        const index = creds.findIndex(
          (cred) => cred.credentialHash === hashParam
        )

        if (index !== -1) {
          await verifyCredential(index, creds)
        }
      }

    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // ---------------- AUTO FETCH ----------------
  useEffect(() => {
    if (inputAddress) {
      fetchCredentials(inputAddress)
    }
  }, [inputAddress])

  // ---------------- VERIFY INTEGRITY ----------------
  async function verifyCredential(
    index: number,
    credsOverride?: any[]
  ) {
    const creds = credsOverride || credentials
    const cred = creds[index]

    if (!cred.isValid) {
      setVerificationResult('❌ Credential Revoked')
      return
    }

    try {
      const res = await fetch(
        `https://gateway.pinata.cloud/ipfs/${cred.ipfsCID}`
      )

      const json = await res.json()

      const recomputedHash = keccak256(
        stringToBytes(JSON.stringify(json))
      )

      if (recomputedHash === cred.credentialHash) {
        setVerificationResult('✅ Credential Verified (Authentic)')
      } else {
        setVerificationResult('❌ Credential Tampered')
      }

    } catch (err) {
      console.error(err)
      setVerificationResult('❌ Failed to fetch IPFS document')
    }
  }

  // ---------------- DYNAMIC SELECTIVE DISCLOSURE ----------------
  async function selectiveDisclosure(index: number) {
    const cred = credentials[index]

    try {
      const res = await fetch(
        `https://gateway.pinata.cloud/ipfs/${cred.ipfsCID}`
      )

      const json = await res.json()

      // Support both old format and new format
      const credentialData = json.credential || json

      // Remove internal/system fields
      const filteredEntries = Object.entries(credentialData).filter(
        ([key]) =>
          key !== 'issuedTo' &&
          key !== 'timestamp'
      )

      const dynamicFields: Record<string, any> = {}

      filteredEntries.forEach(([key, value]) => {
        dynamicFields[key] = value
      })

      setDisclosedData(dynamicFields)

    } catch (err) {
      console.error(err)
    }
  }

  // ---------------- UI ----------------
  return (
    <div className="p-10 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">
        Public Credential Verification
      </h1>

      <input
        className="border p-2 w-full mb-4"
        placeholder="Enter Wallet Address"
        value={inputAddress}
        onChange={(e) => setInputAddress(e.target.value)}
      />

      <button
        className="bg-black text-white px-4 py-2 rounded mb-6"
        onClick={() => fetchCredentials()}
        disabled={loading}
      >
        {loading ? 'Fetching...' : 'Fetch Credentials'}
      </button>

      {credentials.length === 0 && !loading && (
        <p>No credentials found.</p>
      )}

      {credentials.map((cred: any, index: number) => (
        <div key={index} className="border p-4 mb-4 rounded">
          <p><strong>IPFS CID:</strong> {cred.ipfsCID}</p>
          <p><strong>Issuer:</strong> {cred.issuer}</p>
          <p><strong>Status:</strong> {cred.isValid ? 'Active' : 'Revoked'}</p>

          <div className="mt-3 flex gap-3">
            <button
              className="bg-blue-600 text-white px-3 py-1 rounded"
              onClick={() => verifyCredential(index)}
            >
              Verify Integrity
            </button>

            <button
              className="bg-green-600 text-black px-3 py-1 rounded"
              onClick={() => selectiveDisclosure(index)}
            >
              Selective Disclosure
            </button>
          </div>
        </div>
      ))}

      {verificationResult && (
        <div className="mt-6 text-xl font-semibold">
          {verificationResult}
        </div>
      )}

      {/* 🔐 DYNAMIC DISCLOSURE DISPLAY */}
      {disclosedData && (
        <div className="mt-6 border p-4 rounded text-black bg-gray-100">
          <h3 className="font-semibold mb-2">
            Selectively Disclosed Information
          </h3>

          {Object.entries(disclosedData).map(([key, value]) => (
            <div
              key={key}
              className="flex justify-between border-b py-1"
            >
              <span className="font-medium capitalize">
                {key}
              </span>
              <span>{String(value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
