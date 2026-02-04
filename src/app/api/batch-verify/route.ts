/**
 * SSE Batch Verification Endpoint
 * Processes multiple labels in parallel with controlled concurrency
 * Streams results back as each completes
 */

import { NextRequest } from "next/server";
import { verifySingleLabel, SingleVerificationResult } from "@/lib/verify-single";
import type { ApplicationData } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300; // Allow up to 5 minutes for large batches (300 labels)

const MAX_BATCH_SIZE = 300;
const CONCURRENCY_LIMIT = 10; // Higher concurrency for large batches

interface BatchItem {
  id: string;
  fileName: string;
  imageBase64: string;
  mimeType: string;
}

interface SSEResultEvent {
  type: "result";
  id: string;
  fileName: string;
  result: SingleVerificationResult | null;
  error: string | null;
  index: number;
  total: number;
}

interface SSECompleteEvent {
  type: "complete";
  totalProcessed: number;
  totalTimeMs: number;
}

interface SSEErrorEvent {
  type: "error";
  error: string;
}

type SSEEvent = SSEResultEvent | SSECompleteEvent | SSEErrorEvent;

/**
 * Process tasks with controlled concurrency using semaphore pattern
 */
async function withConcurrencyLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
  onComplete: (result: T, index: number) => void
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;
  let completedCount = 0;

  async function runNext(): Promise<void> {
    while (nextIndex < tasks.length) {
      const currentIndex = nextIndex++;
      const result = await tasks[currentIndex]();
      results[currentIndex] = result;
      completedCount++;
      onComplete(result, currentIndex);
    }
  }

  // Start concurrent workers up to the limit
  const workers = Array(Math.min(limit, tasks.length))
    .fill(null)
    .map(() => runNext());

  await Promise.all(workers);
  return results;
}

export async function POST(request: NextRequest): Promise<Response> {
  const startTime = Date.now();

  // Parse form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid form data" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Get application data
  const applicationDataJson = formData.get("applicationData") as string | null;
  if (!applicationDataJson) {
    return new Response(
      JSON.stringify({ error: "No application data provided" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  let applicationData: ApplicationData;
  try {
    applicationData = JSON.parse(applicationDataJson);
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid application data JSON" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Collect all image files
  const batchItems: BatchItem[] = [];
  const entries = Array.from(formData.entries());

  for (const [key, value] of entries) {
    if (key.startsWith("image_") && value instanceof File) {
      const file = value;
      const id = key.replace("image_", "");

      // Validate file type
      if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
        continue;
      }

      // Convert to base64
      const buffer = await file.arrayBuffer();
      const imageBase64 = Buffer.from(buffer).toString("base64");

      batchItems.push({
        id,
        fileName: file.name,
        imageBase64,
        mimeType: file.type,
      });
    }
  }

  // Enforce batch size limit
  if (batchItems.length === 0) {
    return new Response(
      JSON.stringify({ error: "No valid images provided" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (batchItems.length > MAX_BATCH_SIZE) {
    return new Response(
      JSON.stringify({ error: `Maximum ${MAX_BATCH_SIZE} labels per batch. Received ${batchItems.length}.` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  const total = batchItems.length;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SSEEvent) => {
        const data = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      // Create verification tasks
      const tasks = batchItems.map((item, index) => async (): Promise<SSEResultEvent> => {
        const verifyResult = await verifySingleLabel(
          item.imageBase64,
          item.mimeType,
          applicationData
        );

        return {
          type: "result",
          id: item.id,
          fileName: item.fileName,
          result: verifyResult.success ? verifyResult.result : null,
          error: verifyResult.success ? null : verifyResult.error,
          index,
          total,
        };
      });

      try {
        // Process with concurrency limit, streaming results as they complete
        await withConcurrencyLimit(
          tasks,
          CONCURRENCY_LIMIT,
          (result) => send(result)
        );

        // Send completion event
        const completeEvent: SSECompleteEvent = {
          type: "complete",
          totalProcessed: total,
          totalTimeMs: Date.now() - startTime,
        };
        send(completeEvent);
      } catch (error) {
        const errorEvent: SSEErrorEvent = {
          type: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        };
        send(errorEvent);
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
