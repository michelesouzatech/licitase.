const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { z } from "npm:zod@3.25.76";
import mammoth from "npm:mammoth@1.12.0";
import { extractText, getDocumentProxy } from "npm:unpdf@0.12.1";

const requestSchema = z.object({
  fileBase64: z.string().min(1),
  fileName: z.string().min(1),
  fileType: z.string().min(1),
  title: z.string().nullable().optional(),
  solutionName: z.string().nullable().optional(),
  moduleName: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  fileSizeBytes: z.number().int().nonnegative().nullable().optional(),
});

function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function extractPdfText(data: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(data);
  const { text } = await extractText(pdf, { mergePages: true });
  return String(text ?? "").trim();
}

async function extractDocxText(data: Uint8Array): Promise<string> {
  const { value } = await mammoth.extractRawText({ arrayBuffer: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) });
  return String(value ?? "").trim();
}

async function extractFileText(fileType: string, data: Uint8Array): Promise<string> {
  switch (fileType.toLowerCase()) {
    case "pdf":
      return extractPdfText(data);
    case "txt":
      return new TextDecoder().decode(data).trim();
    case "docx":
      return extractDocxText(data);
    default:
      throw new Error("Tipo de arquivo não suportado");
  }
}

function normalizeWhitespace(text: string) {
  return text.replace(/\u0000/g, " ").replace(/\r/g, "").replace(/\t/g, " ").replace(/\n{3,}/g, "\n\n").replace(/[ ]{2,}/g, " ").trim();
}

function chunkText(text: string, chunkSize = 1200) {
  const paragraphs = text
    .split(/\n\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;

    if (candidate.length <= chunkSize) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
      current = "";
    }

    if (paragraph.length <= chunkSize) {
      current = paragraph;
      continue;
    }

    for (let i = 0; i < paragraph.length; i += chunkSize) {
      chunks.push(paragraph.slice(i, i + chunkSize));
    }
  }

  if (current) chunks.push(current);
  return chunks.slice(0, 200);
}

function buildSummary(text: string) {
  return text.slice(0, 500).replace(/\s+/g, " ").trim();
}

function base64ToArrayBuffer(base64: string) {
  const bytes = base64ToUint8Array(base64);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Configuração do backend incompleta" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { fileBase64, fileName, fileType, title, solutionName, moduleName, tags, fileSizeBytes } = parsed.data;
    const bytes = base64ToUint8Array(fileBase64);
    const extractedText = normalizeWhitespace(await extractFileText(fileType, bytes));
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
    const storagePath = `global/${Date.now()}-${safeName}`;

    if (!extractedText) {
      return new Response(JSON.stringify({ error: "Não foi possível extrair texto do arquivo enviado" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const summary = buildSummary(extractedText);

    const { error: storageError } = await supabase.storage
      .from("knowledge-base")
      .upload(storagePath, base64ToArrayBuffer(fileBase64), {
        upsert: false,
        contentType:
          fileType.toLowerCase() === "pdf"
            ? "application/pdf"
            : fileType.toLowerCase() === "docx"
              ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              : "text/plain",
      });

    if (storageError) {
      throw storageError;
    }

    const { data: insertedDoc, error: insertDocError } = await supabase
      .from("knowledge_documents")
      .insert({
        user_id: null,
        file_name: fileName,
        file_type: fileType.toLowerCase(),
        title: title ?? null,
        solution_name: solutionName ?? null,
        module_name: moduleName ?? null,
        tags,
        summary,
        extracted_text: extractedText,
        processing_status: "processed",
        storage_path: storagePath,
        file_size_bytes: fileSizeBytes ?? null,
      })
      .select("id")
      .single();

    if (insertDocError || !insertedDoc) {
      throw insertDocError ?? new Error("Falha ao registrar documento");
    }

    const chunks = chunkText(extractedText);
    if (chunks.length > 0) {
      const { error: chunkError } = await supabase.from("knowledge_chunks").insert(
        chunks.map((content, index) => ({
          user_id: null,
          document_id: insertedDoc.id,
          chunk_index: index,
          content,
          tags,
          solution_name: solutionName ?? null,
          module_name: moduleName ?? null,
        })),
      );

      if (chunkError) {
        await supabase.storage.from("knowledge-base").remove([storagePath]);
        await supabase.from("knowledge_documents").delete().eq("id", insertedDoc.id);
        throw chunkError;
      }
    }

    return new Response(JSON.stringify({ documentId: insertedDoc.id, chunkCount: chunks.length, summary }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao processar documento";
    console.error("process-knowledge-document error:", error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});