export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const base64File = buffer.toString('base64')

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `
You are a strict document classifier and extractor.
Identify document type: Driving License, Birth Certificate, Death Certificate, Marriage Certificate, School Marksheet, Hospital Bill
Extract: documentType, name, year
Return ONLY valid JSON: { "documentType": "", "name": "", "year": "" }
`,
            },
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: base64File,
              },
            },
          ],
        },
      ],
    })

    let text = result.response.text().trim()
    if (text.startsWith('```')) {
      text = text.replace(/```json|```/g, '').trim()
    }

    const parsed = JSON.parse(text)
    return NextResponse.json({ data: parsed })

  } catch (error: any) {
    console.error('SERVER ERROR:', error)
    return NextResponse.json(
      { error: error.message || 'Extraction failed', details: error },
      { status: 500 }
    )
  }
}
