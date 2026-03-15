import { inspect } from "node:util";

import type { FastifyInstance } from "fastify";

import type { AppEnv } from "../../app/env.js";

const REDACTED_LOG_PATHS = [
  "req.headers.cookie",
  "req.headers.authorization",
  "res.headers.set-cookie",
];

const KNOWN_LOG_KEYS = new Set([
  "level",
  "time",
  "pid",
  "hostname",
  "msg",
  "reqId",
  "method",
  "url",
  "statusCode",
  "responseTime",
  "responseTimeMs",
  "remoteAddress",
  "userId",
  "req",
  "res",
  "err",
]);

interface LogEntry {
  level?: number | string;
  time?: number | string;
  pid?: number;
  hostname?: string;
  msg?: string;
  reqId?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  responseTime?: number;
  responseTimeMs?: number;
  remoteAddress?: string;
  userId?: string | null;
  req?: {
    method?: string;
    url?: string;
    remoteAddress?: string;
  };
  res?: {
    statusCode?: number;
  };
  err?: {
    type?: string;
    message?: string;
    stack?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface LoggerStreamDestination {
  write(message: string): void;
}

export function createLoggerOptions(env: AppEnv) {
  const isProduction = env.NODE_ENV === "production";

  return {
    level: isProduction ? "info" : "debug",
    redact: {
      paths: REDACTED_LOG_PATHS,
    },
    ...(isProduction ? {} : { stream: createDevelopmentLogStream() }),
  };
}

export function registerDevelopmentRequestLogging(app: FastifyInstance, env: AppEnv) {
  if (env.NODE_ENV === "production") {
    return;
  }

  app.addHook("onResponse", async (request, reply) => {
    const payload = {
      reqId: request.id,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTimeMs: roundDuration(reply.elapsedTime),
      remoteAddress: request.ip,
      userId: request.auth.userId,
    };

    if (reply.statusCode >= 500) {
      request.log.error(payload, "request");
      return;
    }

    if (reply.statusCode >= 400) {
      request.log.warn(payload, "request");
      return;
    }

    request.log.info(payload, "request");
  });
}

export function createDevelopmentLogStream(
  destination: Pick<NodeJS.WritableStream, "write"> = process.stdout,
): LoggerStreamDestination {
  return {
    write(chunk: string) {
      for (const line of chunk.split("\n")) {
        if (!line.trim()) {
          continue;
        }

        destination.write(formatDevelopmentLogLine(line));
      }
    },
  };
}

export function formatDevelopmentLogLine(rawLine: string): string {
  const line = rawLine.trim();

  if (!line) {
    return "";
  }

  let entry: LogEntry;

  try {
    entry = JSON.parse(line) as LogEntry;
  } catch {
    return `${line}\n`;
  }

  const summary = formatSummary(entry);
  const details = formatExtraFields(entry);
  const error = formatError(entry.err);

  return [summary, details, error].filter(Boolean).join("\n") + "\n";
}

function formatSummary(entry: LogEntry) {
  const parts = [formatTimestamp(entry.time), padLevel(formatLevel(entry.level))];
  const message = formatMessage(entry);

  if (message) {
    parts.push(message);
  }

  return parts.join(" ").trimEnd();
}

function formatMessage(entry: LogEntry) {
  const reqId = typeof entry.reqId === "string" ? entry.reqId : "";
  const method = getMethod(entry);
  const url = getUrl(entry);
  const statusCode = getStatusCode(entry);
  const responseTimeMs = getResponseTime(entry);
  const remoteAddress = getRemoteAddress(entry);
  const userId = typeof entry.userId === "string" ? entry.userId : "";

  if (method && url && typeof statusCode === "number") {
    const parts = [];

    if (reqId) {
      parts.push(reqId);
    }

    parts.push(`${method} ${url} -> ${statusCode}`);

    if (typeof responseTimeMs === "number") {
      parts.push(`${formatDuration(responseTimeMs)}ms`);
    }

    if (userId) {
      parts.push(`user=${userId}`);
    }

    if (remoteAddress) {
      parts.push(`ip=${remoteAddress}`);
    }

    return parts.join(" ");
  }

  if (method && url) {
    const parts = [];

    if (reqId) {
      parts.push(reqId);
    }

    parts.push(`${method} ${url}`);

    if (remoteAddress) {
      parts.push(`ip=${remoteAddress}`);
    }

    return parts.join(" ");
  }

  const parts = [];

  if (reqId) {
    parts.push(reqId);
  }

  if (typeof entry.msg === "string" && entry.msg.trim().length > 0) {
    parts.push(entry.msg.trim());
  }

  return parts.join(" ");
}

function formatExtraFields(entry: LogEntry) {
  const extras = Object.fromEntries(
    Object.entries(entry).filter(([key, value]) => {
      if (KNOWN_LOG_KEYS.has(key)) {
        return false;
      }

      return value !== undefined && value !== null;
    }),
  );

  if (Object.keys(extras).length === 0) {
    return "";
  }

  return indent(inspect(extras, { depth: 5, compact: false, breakLength: 120, sorted: true }));
}

function formatError(error: LogEntry["err"]) {
  if (!error) {
    return "";
  }

  const headerParts = [error.type, error.message].filter((part): part is string => Boolean(part && part.length > 0));
  const header = headerParts.join(": ");
  const lines: string[] = [];

  if (typeof error.stack === "string" && error.stack.trim().length > 0) {
    const stack = error.stack.trim();

    if (!header || stack.startsWith(header)) {
      lines.push(stack);
    } else {
      lines.push(header, stack);
    }
  } else {
    if (header) {
      lines.push(header);
    }

    const extras = Object.fromEntries(
      Object.entries(error).filter(([key, value]) => key !== "type" && key !== "message" && key !== "stack" && value !== undefined),
    );

    if (Object.keys(extras).length > 0) {
      lines.push(inspect(extras, { depth: 5, compact: false, breakLength: 120, sorted: true }));
    }
  }

  if (lines.length === 0) {
    return "";
  }

  return indent(lines.join("\n"));
}

function formatTimestamp(value: LogEntry["time"]) {
  if (typeof value === "number") {
    return new Date(value).toISOString().slice(11, 23);
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);

    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString().slice(11, 23);
    }
  }

  return "--:--:--.---";
}

function formatLevel(level: LogEntry["level"]) {
  if (typeof level === "string") {
    return level.toUpperCase();
  }

  switch (level) {
    case 10:
      return "TRACE";
    case 20:
      return "DEBUG";
    case 30:
      return "INFO";
    case 40:
      return "WARN";
    case 50:
      return "ERROR";
    case 60:
      return "FATAL";
    default:
      return "LOG";
  }
}

function padLevel(level: string) {
  return level.padEnd(5, " ");
}

function getMethod(entry: LogEntry) {
  return entry.method ?? entry.req?.method;
}

function getUrl(entry: LogEntry) {
  return entry.url ?? entry.req?.url;
}

function getStatusCode(entry: LogEntry) {
  return entry.statusCode ?? entry.res?.statusCode;
}

function getResponseTime(entry: LogEntry) {
  const value = entry.responseTimeMs ?? entry.responseTime;

  return typeof value === "number" ? value : undefined;
}

function getRemoteAddress(entry: LogEntry) {
  return entry.remoteAddress ?? entry.req?.remoteAddress;
}

function roundDuration(value: number) {
  return Number(value.toFixed(value >= 100 ? 0 : 1));
}

function formatDuration(value: number) {
  return value >= 100 ? value.toFixed(0) : value.toFixed(1);
}

function indent(value: string) {
  return value
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}
