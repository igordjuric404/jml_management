import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";

function searchParamsToFilters(searchParams: URLSearchParams): Record<string, unknown> {
  const filters: Record<string, unknown> = {};
  searchParams.forEach((value, key) => {
    filters[key] = value;
  });
  return filters;
}

export async function GET(req: NextRequest) {
  try {
    const filters = searchParamsToFilters(req.nextUrl.searchParams);
    const provider = getProvider();
    const data = await provider.listArtifacts(Object.keys(filters).length > 0 ? filters : undefined);
    return NextResponse.json({ status: "success", data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const provider = getProvider();
    const data = await provider.remediateArtifacts(body.docnames);
    return NextResponse.json({ status: "success", data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
