import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const mid = url.searchParams.get("mid");

    if (!mid) {
      return NextResponse.json(
        { success: false, error: "请输入MID或B站主页链接" },
        { status: 400 }
      );
    }

    // Extract MID from URL if full Bilibili space URL is provided
    let cleanMid = mid.trim();
    if (cleanMid.includes("bilibili.com")) {
      const match = cleanMid.match(/space\.bilibili\.com\/(\d+)/);
      if (!match) {
        return NextResponse.json(
          { success: false, error: "无法从链接中提取MID，请确认链接格式为 space.bilibili.com/数字" },
          { status: 400 }
        );
      }
      cleanMid = match[1];
    }

    // Validate MID format (should be numeric, typical Bilibili UID is 5-12 digits)
    if (!/^\d{5,20}$/.test(cleanMid)) {
      return NextResponse.json(
        { success: false, error: "MID格式不正确，应为5-20位数字" },
        { status: 400 }
      );
    }

    // Format is valid - allow adding
    // The actual user info will be fetched during data collection
    return NextResponse.json({
      success: true,
      data: {
        mid: cleanMid,
        name: null,
        note: "请输入品牌名称后确认添加",
      },
    });
  } catch (error) {
    console.error("Error validating brand:", error);
    return NextResponse.json(
      { success: false, error: "验证失败，请稍后重试" },
      { status: 500 }
    );
  }
}
