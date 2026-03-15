import { describe, expect, it } from "vitest";

import {
  createDevelopmentLogStream,
  formatDevelopmentLogLine,
} from "../../src/lib/logger/dev-logger.js";

describe("formatDevelopmentLogLine", () => {
  it("renders request summaries as readable single lines", () => {
    const line = formatDevelopmentLogLine(
      JSON.stringify({
        level: 30,
        time: Date.UTC(2026, 2, 15, 10, 4, 3, 125),
        msg: "request",
        reqId: "req-17",
        method: "GET",
        url: "/api/home/overview?date=2026-03-15",
        statusCode: 200,
        responseTimeMs: 18.4,
        remoteAddress: "127.0.0.1",
        userId: "user_123",
      }),
    );

    expect(line).toBe(
      "10:04:03.125 INFO  req-17 GET /api/home/overview?date=2026-03-15 -> 200 18.4ms user=user_123 ip=127.0.0.1\n",
    );
  });

  it("renders extra fields and error stacks on separate indented lines", () => {
    const line = formatDevelopmentLogLine(
      JSON.stringify({
        level: 50,
        time: Date.UTC(2026, 2, 15, 10, 5, 1, 9),
        msg: "scoring failed",
        reqId: "req-22",
        jobName: "daily-score-refresh",
        err: {
          type: "Error",
          message: "boom",
          stack: "Error: boom\n    at score (/workspace/server/src/jobs.ts:12:3)",
        },
      }),
    );

    expect(line).toContain("10:05:01.009 ERROR req-22 scoring failed");
    expect(line).toContain("  {\n    jobName: 'daily-score-refresh'\n  }");
    expect(line).toContain("  Error: boom\n      at score (/workspace/server/src/jobs.ts:12:3)");
  });
});

describe("createDevelopmentLogStream", () => {
  it("formats each json log line written to the stream", () => {
    const writes: string[] = [];
    const stream = createDevelopmentLogStream({
      write(chunk: string) {
        writes.push(chunk);
        return true;
      },
    });

    stream.write(
      `${JSON.stringify({
        level: 30,
        time: Date.UTC(2026, 2, 15, 10, 6, 44, 500),
        msg: "server listening at http://127.0.0.1:3000",
      })}\n${JSON.stringify({
        level: 40,
        time: Date.UTC(2026, 2, 15, 10, 6, 45, 0),
        msg: "request",
        reqId: "req-23",
        method: "POST",
        url: "/api/tasks",
        statusCode: 401,
        responseTimeMs: 7.1,
      })}\n`,
    );

    expect(writes).toEqual([
      "10:06:44.500 INFO  server listening at http://127.0.0.1:3000\n",
      "10:06:45.000 WARN  req-23 POST /api/tasks -> 401 7.1ms\n",
    ]);
  });
});
