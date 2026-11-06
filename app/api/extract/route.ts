import { NextResponse } from "next/server";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import { join } from "path";
import { pathToFileURL } from "url";
GlobalWorkerOptions.workerSrc = pathToFileURL(
  join(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs")
).href;



export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No PDF file provided." },
        { status: 400 }
      );
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are allowed." },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "PDF must be smaller than 10 MB." },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const pdf = await getDocument({
      data: new Uint8Array(buffer),
    }).promise;

    let extractedText = "";

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();

      const pageText = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");

      extractedText += `\n\nPage ${pageNumber}\n${pageText}`;
    }

    return NextResponse.json({
      success: true,
      pageCount: pdf.numPages,
      text: extractedText.trim(),
    });
  } catch (error) {
    console.error("PDF extraction error:", error);

    return NextResponse.json(
      { error: "Failed to extract text from the PDF." },
      { status: 500 }
    );
  }
}