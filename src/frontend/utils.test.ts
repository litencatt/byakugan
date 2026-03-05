import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  formatTokens,
  formatElapsed,
  orgRepo,
  shortenPath,
  mergeByDir,
} from "./utils.js";
import type { ClaudeProcess } from "../types.js";

function makeProc(overrides: Partial<ClaudeProcess> = {}): ClaudeProcess {
  return {
    pid: 1000,
    projectName: "test",
    projectDir: "/Users/user/projects/test",
    cpuPercent: 0,
    memPercent: 0,
    status: "idle",
    stat: "S",
    elapsedTime: "0:00",
    elapsedSeconds: 0,
    currentTask: null,
    openFiles: [],
    gitBranch: null,
    gitCommonDir: null,
    modelName: null,
    prUrl: null,
    prTitle: null,
    editorApp: null,
    isMcpBridge: false,
    containers: [],
    ...overrides,
  };
}

describe("escapeHtml", () => {
  it("エスケープ不要の文字列をそのまま返す", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });

  it("& をエスケープする", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("< と > をエスケープする", () => {
    expect(escapeHtml("<div>")).toBe("&lt;div&gt;");
  });

  it('" をエスケープする', () => {
    expect(escapeHtml('say "hello"')).toBe("say &quot;hello&quot;");
  });

  it("複合パターンをエスケープする", () => {
    expect(escapeHtml('<a href="x&y">test</a>')).toBe(
      "&lt;a href=&quot;x&amp;y&quot;&gt;test&lt;/a&gt;"
    );
  });
});

describe("formatTokens", () => {
  it("1000未満はそのまま返す", () => {
    expect(formatTokens(0)).toBe("0");
    expect(formatTokens(999)).toBe("999");
  });

  it("1000以上は k 表記", () => {
    expect(formatTokens(1000)).toBe("1k");
    expect(formatTokens(1500)).toBe("2k");
    expect(formatTokens(999999)).toBe("1000k");
  });

  it("1000000以上は M 表記", () => {
    expect(formatTokens(1000000)).toBe("1.0M");
    expect(formatTokens(1500000)).toBe("1.5M");
    expect(formatTokens(10000000)).toBe("10.0M");
  });
});

describe("formatElapsed", () => {
  it("60秒未満は秒表示", () => {
    expect(formatElapsed(0)).toBe("0s");
    expect(formatElapsed(59)).toBe("59s");
  });

  it("60秒以上3600秒未満は分秒表示（秒は0埋め）", () => {
    expect(formatElapsed(60)).toBe("1m 00s");
    expect(formatElapsed(65)).toBe("1m 05s");
    expect(formatElapsed(183)).toBe("3m 03s");
    expect(formatElapsed(3599)).toBe("59m 59s");
  });

  it("3600秒以上は時分表示（分は0埋め）", () => {
    expect(formatElapsed(3600)).toBe("1h 00m");
    expect(formatElapsed(3660)).toBe("1h 01m");
    expect(formatElapsed(3960)).toBe("1h 06m");
    expect(formatElapsed(7200)).toBe("2h 00m");
  });
});

describe("orgRepo", () => {
  it("gitCommonDir がある場合は .git を除いた最後2セグメントを返す", () => {
    expect(orgRepo("/path/to/project", "/path/to/project/.git")).toBe("to/project");
  });

  it("gitCommonDir がある場合（ホスティング構成）", () => {
    expect(orgRepo("/path/hosting/muu/ws6", "/path/hosting/muu/.git")).toBe("hosting/muu");
  });

  it("gitCommonDir がない場合は projectDir の最後2セグメントを返す", () => {
    expect(orgRepo("/Users/user/projects/org/repo", null)).toBe("org/repo");
  });

  it("gitCommonDir が空文字の場合は projectDir を使う", () => {
    expect(orgRepo("/Users/user/projects/org/repo", "")).toBe("org/repo");
  });

  it("projectDir も gitCommonDir もない場合は空文字を返す", () => {
    expect(orgRepo(null, null)).toBe("");
    expect(orgRepo(undefined, undefined)).toBe("");
  });

  it("先頭スラッシュのみのパスは空+ディレクトリ名を返す", () => {
    // "/singledir".split("/") = ["", "singledir"] — 2要素なので "/singledir" になる
    expect(orgRepo("/singledir", null)).toBe("/singledir");
  });
});

describe("shortenPath", () => {
  it("/Users/<user>/ を ~/ に置換する", () => {
    expect(shortenPath("/Users/alice/projects/myapp")).toBe("~/projects/myapp");
  });

  it("ネストされたパスも正しく置換する", () => {
    expect(shortenPath("/Users/bob/work/org/repo")).toBe("~/work/org/repo");
  });

  it("/Users/ 以外は変換しない", () => {
    expect(shortenPath("/home/user/projects")).toBe("/home/user/projects");
  });

  it("null/undefined は空文字を返す", () => {
    expect(shortenPath(null)).toBe("");
    expect(shortenPath(undefined)).toBe("");
    expect(shortenPath("")).toBe("");
  });

  it("/Users/<user> でサブディレクトリなしはそのまま返す", () => {
    expect(shortenPath("/Users/alice")).toBe("/Users/alice");
  });
});

describe("mergeByDir", () => {
  it("同じ projectDir のプロセスをマージする", () => {
    const p1 = makeProc({ pid: 1, projectDir: "/proj/a", status: "idle" });
    const p2 = makeProc({ pid: 2, projectDir: "/proj/a", status: "idle" });
    const result = mergeByDir([p1, p2]);
    expect(result).toHaveLength(1);
    expect(result[0].primary.pid).toBe(2); // 大きい pid が primary (idle同士)
    expect(result[0].extras).toHaveLength(1);
  });

  it("異なる projectDir は別エントリになる", () => {
    const p1 = makeProc({ pid: 1, projectDir: "/proj/a" });
    const p2 = makeProc({ pid: 2, projectDir: "/proj/b" });
    const result = mergeByDir([p1, p2]);
    expect(result).toHaveLength(2);
  });

  it("working ステータスが primary になる", () => {
    const idle = makeProc({ pid: 1, projectDir: "/proj/a", status: "idle" });
    const working = makeProc({ pid: 2, projectDir: "/proj/a", status: "working" });
    const result = mergeByDir([idle, working]);
    expect(result[0].primary.status).toBe("working");
    expect(result[0].extras[0].status).toBe("idle");
  });

  it("同一プロセスが1件のみの場合は extras が空", () => {
    const p = makeProc({ pid: 1, projectDir: "/proj/a" });
    const result = mergeByDir([p]);
    expect(result).toHaveLength(1);
    expect(result[0].primary).toBe(p);
    expect(result[0].extras).toHaveLength(0);
  });

  it("projectDir が null のプロセスは pid をキーにする", () => {
    const p1 = makeProc({ pid: 1, projectDir: null });
    const p2 = makeProc({ pid: 2, projectDir: null });
    const result = mergeByDir([p1 as ClaudeProcess, p2 as ClaudeProcess]);
    expect(result).toHaveLength(2);
  });

  it("空配列は空配列を返す", () => {
    expect(mergeByDir([])).toEqual([]);
  });
});
