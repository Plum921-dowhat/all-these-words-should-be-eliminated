import { NextResponse } from "next/server";

// 容器健康检查端点（docker-compose.yml 中 web 服务的 healthcheck 使用）。
// 故意不访问数据库：健康检查只确认 Web 进程存活，避免与业务故障耦合。
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true });
}
