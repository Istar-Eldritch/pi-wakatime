/**
 * WakaTime Extension for Pi
 *
 * Tracks coding activity with WakaTime when using pi coding agent.
 * Uses the wakatime-cli for heartbeats, which handles rate limiting,
 * offline queueing, and API communication.
 *
 * Tracks:
 * - Files read/written/edited by the agent
 * - Session activity (turns, thinking time)
 * - Project detection from cwd
 * - Language detection from file extensions
 * - AI line changes for write/edit operations
 *
 * Requirements:
 * - wakatime-cli installed (~/.wakatime/wakatime-cli)
 * - WakaTime API key configured (~/.wakatime.cfg)
 *
 * Configuration via ~/.pi/agent/settings.json:
 * {
 *   "wakatime": {
 *     "enabled": true,
 *     "trackFiles": true,
 *     "trackSessions": true,
 *     "category": "ai coding",
 *     "cliPath": "~/.wakatime/wakatime-cli"
 *   }
 * }
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { execFile } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";

// Language mapping for common extensions
const LANGUAGE_MAP: Record<string, string> = {
	ts: "TypeScript",
	tsx: "TypeScript",
	js: "JavaScript",
	jsx: "JavaScript",
	mjs: "JavaScript",
	cjs: "JavaScript",
	py: "Python",
	rb: "Ruby",
	rs: "Rust",
	go: "Go",
	java: "Java",
	kt: "Kotlin",
	kts: "Kotlin",
	scala: "Scala",
	c: "C",
	h: "C",
	cpp: "C++",
	cc: "C++",
	cxx: "C++",
	hpp: "C++",
	hxx: "C++",
	cs: "C#",
	fs: "F#",
	fsx: "F#",
	swift: "Swift",
	m: "Objective-C",
	mm: "Objective-C++",
	php: "PHP",
	pl: "Perl",
	pm: "Perl",
	lua: "Lua",
	r: "R",
	jl: "Julia",
	ex: "Elixir",
	exs: "Elixir",
	erl: "Erlang",
	hrl: "Erlang",
	hs: "Haskell",
	lhs: "Haskell",
	ml: "OCaml",
	mli: "OCaml",
	clj: "Clojure",
	cljs: "ClojureScript",
	cljc: "Clojure",
	dart: "Dart",
	zig: "Zig",
	nim: "Nim",
	v: "V",
	cr: "Crystal",
	d: "D",
	pas: "Pascal",
	pp: "Pascal",
	f90: "Fortran",
	f95: "Fortran",
	f03: "Fortran",
	asm: "Assembly",
	s: "Assembly",
	sh: "Shell",
	bash: "Shell",
	zsh: "Shell",
	fish: "Fish",
	ps1: "PowerShell",
	psm1: "PowerShell",
	bat: "Batch",
	cmd: "Batch",
	sql: "SQL",
	html: "HTML",
	htm: "HTML",
	css: "CSS",
	scss: "SCSS",
	sass: "Sass",
	less: "Less",
	styl: "Stylus",
	vue: "Vue",
	svelte: "Svelte",
	astro: "Astro",
	json: "JSON",
	jsonc: "JSON with Comments",
	json5: "JSON5",
	yaml: "YAML",
	yml: "YAML",
	toml: "TOML",
	ini: "INI",
	cfg: "INI",
	conf: "Config",
	xml: "XML",
	xsl: "XSLT",
	xslt: "XSLT",
	md: "Markdown",
	mdx: "MDX",
	rst: "reStructuredText",
	tex: "TeX",
	latex: "LaTeX",
	bib: "BibTeX",
	txt: "Text",
	csv: "CSV",
	tsv: "TSV",
	dockerfile: "Docker",
	docker: "Docker",
	makefile: "Makefile",
	cmake: "CMake",
	gradle: "Gradle",
	groovy: "Groovy",
	tf: "Terraform",
	tfvars: "Terraform",
	hcl: "HCL",
	nix: "Nix",
	proto: "Protocol Buffer",
	graphql: "GraphQL",
	gql: "GraphQL",
	prisma: "Prisma",
	sol: "Solidity",
	vy: "Vyper",
	move: "Move",
	wasm: "WebAssembly",
	wat: "WebAssembly",
};

interface WakaTimeConfig {
	enabled: boolean;
	trackFiles: boolean;
	trackSessions: boolean;
	category: string;
	cliPath: string;
}

interface HeartbeatOptions {
	entity: string;
	entityType?: "file" | "app" | "domain";
	category?: string;
	language?: string;
	project?: string;
	branch?: string;
	isWrite?: boolean;
	aiLineChanges?: number;
	plugin?: string;
}

export default function (pi: ExtensionAPI) {
	// Default configuration
	const defaultConfig: WakaTimeConfig = {
		enabled: true,
		trackFiles: true,
		trackSessions: true,
		category: "ai coding",
		cliPath: path.join(os.homedir(), ".wakatime", "wakatime-cli"),
	};

	let config: WakaTimeConfig = { ...defaultConfig };
	let currentModel: string | undefined;
	let currentProject: string | undefined;
	let currentBranch: string | undefined;
	let cliAvailable = false;

	// Load config from settings
	function loadConfig(ctx: { cwd: string }) {
		try {
			const settingsPath = path.join(os.homedir(), ".pi", "agent", "settings.json");
			if (fs.existsSync(settingsPath)) {
				const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
				if (settings.wakatime) {
					config = { ...defaultConfig, ...settings.wakatime };
				}
			}
		} catch {
			// Use defaults
		}

		// Expand ~ in cliPath
		if (config.cliPath.startsWith("~")) {
			config.cliPath = path.join(os.homedir(), config.cliPath.slice(1));
		}

		// Check if CLI exists
		cliAvailable = fs.existsSync(config.cliPath);

		// Detect project from cwd
		currentProject = path.basename(ctx.cwd);

		// Try to detect git branch
		try {
			const gitDir = findGitDir(ctx.cwd);
			if (gitDir) {
				const headPath = path.join(gitDir, "HEAD");
				if (fs.existsSync(headPath)) {
					const head = fs.readFileSync(headPath, "utf-8").trim();
					if (head.startsWith("ref: refs/heads/")) {
						currentBranch = head.replace("ref: refs/heads/", "");
					}
				}
			}
		} catch {
			// No git branch
		}
	}

	// Find .git directory
	function findGitDir(startDir: string): string | null {
		let dir = startDir;
		while (dir !== path.dirname(dir)) {
			const gitDir = path.join(dir, ".git");
			if (fs.existsSync(gitDir)) {
				// Handle both regular .git dir and worktree .git file
				const stat = fs.statSync(gitDir);
				if (stat.isDirectory()) {
					return gitDir;
				} else if (stat.isFile()) {
					// .git file pointing to worktree
					const content = fs.readFileSync(gitDir, "utf-8").trim();
					if (content.startsWith("gitdir: ")) {
						return content.slice(8);
					}
				}
			}
			dir = path.dirname(dir);
		}
		return null;
	}

	// Get language from file extension
	function getLanguage(filePath: string): string | undefined {
		const ext = path.extname(filePath).slice(1).toLowerCase();
		if (ext && LANGUAGE_MAP[ext]) {
			return LANGUAGE_MAP[ext];
		}

		// Handle special filenames
		const basename = path.basename(filePath).toLowerCase();
		if (basename === "dockerfile" || basename.startsWith("dockerfile.")) {
			return "Docker";
		}
		if (basename === "makefile" || basename === "gnumakefile") {
			return "Makefile";
		}
		if (basename === "cmakelists.txt" || basename.endsWith(".cmake")) {
			return "CMake";
		}
		if (basename === ".gitignore" || basename === ".gitattributes") {
			return "Git Config";
		}
		if (basename === ".env" || basename.startsWith(".env.")) {
			return "Environment";
		}

		return ext || undefined;
	}

	// Count lines in content
	function countLines(content: string): number {
		return content.split("\n").length;
	}

	// Send heartbeat via wakatime-cli
	function sendHeartbeat(opts: HeartbeatOptions) {
		if (!config.enabled || !cliAvailable) {
			return;
		}

		const args: string[] = [];

		// Entity (file path or app name)
		args.push("--entity", opts.entity);

		// Entity type
		if (opts.entityType) {
			args.push("--entity-type", opts.entityType);
		}

		// Category (default: "ai coding")
		args.push("--category", opts.category || config.category);

		// Language
		if (opts.language) {
			args.push("--language", opts.language);
		}

		// Project
		if (opts.project || currentProject) {
			args.push("--project", opts.project || currentProject!);
		}

		// Branch
		if (opts.branch || currentBranch) {
			args.push("--alternate-branch", opts.branch || currentBranch!);
		}

		// Write flag
		if (opts.isWrite) {
			args.push("--write");
		}

		// AI line changes
		if (opts.aiLineChanges && opts.aiLineChanges > 0) {
			args.push("--ai-line-changes", String(opts.aiLineChanges));
		}

		// Plugin identifier
		const plugin = opts.plugin || `pi-coding-agent/1.0.0${currentModel ? ` ${currentModel}` : ""}`;
		args.push("--plugin", plugin);

		// Execute async, ignore errors
		execFile(config.cliPath, args, { timeout: 10000 }, (error) => {
			if (error && process.env.DEBUG) {
				console.error("[wakatime] heartbeat failed:", error.message);
			}
		});
	}

	// Track session start
	pi.on("session_start", async (_event, ctx) => {
		loadConfig(ctx);

		if (!cliAvailable) {
			if (ctx.hasUI) {
				ctx.ui.notify("WakaTime CLI not found at " + config.cliPath, "warning");
			}
			return;
		}

		if (!config.enabled) {
			return;
		}

		// Send initial heartbeat for session
		if (config.trackSessions) {
			sendHeartbeat({
				entity: ctx.cwd,
				entityType: "app",
				category: config.category,
			});
		}
	});

	// Track model changes
	pi.on("model_select", async (event, _ctx) => {
		currentModel = `${event.model.provider}/${event.model.id}`;
	});

	// Track turn activity
	pi.on("turn_start", async (_event, ctx) => {
		if (!config.enabled || !config.trackSessions) {
			return;
		}

		sendHeartbeat({
			entity: ctx.cwd,
			entityType: "app",
			category: config.category,
		});
	});

	// Track file operations
	pi.on("tool_result", async (event, ctx) => {
		if (!config.enabled || !config.trackFiles) {
			return;
		}

		const toolName = event.toolName;

		// Only track file operations
		if (!["read", "write", "edit"].includes(toolName)) {
			return;
		}

		// Get file path from input
		const filePath = event.input?.path as string | undefined;
		if (!filePath) {
			return;
		}

		// Resolve to absolute path
		const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(ctx.cwd, filePath);

		// Skip if file doesn't exist (for reads that failed)
		if (toolName === "read" && !fs.existsSync(absolutePath)) {
			return;
		}

		// Calculate line changes for write/edit
		let aiLineChanges: number | undefined;
		if (toolName === "write") {
			const content = event.input?.content as string | undefined;
			if (content) {
				aiLineChanges = countLines(content);
			}
		} else if (toolName === "edit") {
			const oldText = event.input?.oldText as string | undefined;
			const newText = event.input?.newText as string | undefined;
			if (oldText && newText) {
				const oldLines = countLines(oldText);
				const newLines = countLines(newText);
				aiLineChanges = Math.abs(newLines - oldLines) || 1; // At least 1 line changed
			}
		}

		sendHeartbeat({
			entity: absolutePath,
			entityType: "file",
			language: getLanguage(absolutePath),
			isWrite: toolName !== "read",
			aiLineChanges,
		});
	});

	// Track session end
	pi.on("session_shutdown", async (_event, ctx) => {
		if (!config.enabled || !config.trackSessions) {
			return;
		}

		// Final heartbeat
		sendHeartbeat({
			entity: ctx.cwd,
			entityType: "app",
			category: config.category,
		});
	});

	// Register command to check status
	pi.registerCommand("wakatime", {
		description: "Show WakaTime integration status",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) return;

			const status: string[] = [];

			if (!cliAvailable) {
				status.push("❌ CLI not found: " + config.cliPath);
				status.push("   Install from: https://wakatime.com/terminal");
			} else {
				status.push("✓ CLI found: " + config.cliPath);
			}

			status.push("");
			status.push("Configuration:");
			status.push(`  Enabled: ${config.enabled}`);
			status.push(`  Track files: ${config.trackFiles}`);
			status.push(`  Track sessions: ${config.trackSessions}`);
			status.push(`  Category: ${config.category}`);

			status.push("");
			status.push("Current session:");
			status.push(`  Project: ${currentProject || "(none)"}`);
			status.push(`  Branch: ${currentBranch || "(none)"}`);
			status.push(`  Model: ${currentModel || "(none)"}`);

			ctx.ui.notify(status.join("\n"), "info");
		},
	});

	// Register command to toggle tracking
	pi.registerCommand("wakatime-toggle", {
		description: "Toggle WakaTime tracking on/off",
		handler: async (_args, ctx) => {
			config.enabled = !config.enabled;

			if (ctx.hasUI) {
				ctx.ui.notify(`WakaTime tracking ${config.enabled ? "enabled" : "disabled"}`, "info");
			}
		},
	});
}
