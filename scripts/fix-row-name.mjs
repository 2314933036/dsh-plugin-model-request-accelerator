/**
 * Rewrite this plugin's row name in a profile patch from the patch-relative form an
 * older installer wrote to the absolute file URL the settings page can match.
 *
 * Why this exists. dsh normalizes a patch-relative `./plugins/...` name into a
 * `file://` URL when it composes the row, but `@deepseek-ai/dsh-config-editor` restates
 * the row's own, un-normalized name when it saves a config, and patch matching does not
 * normalize it back. So the write never matches the row: the override is skipped, the
 * row keeps its `config: {}`, and the page refuses with
 *
 *   Configuration for "model-request-accelerator" is overridden by a home patch or
 *   command-line overlay
 *
 * even though no home patch or command-line overlay exists. Naming the row with the
 * already-normalized URL makes that write match, which is what `install.sh` now writes
 * and what this script repairs an existing install to.
 *
 * Only that one line is rewritten, so comments, other rows and any config the settings
 * page already wrote survive byte for byte. Exit code 0 means a rewrite happened, 3
 * means the row was already named correctly, and 1 means the arguments or the file were
 * unusable.
 *
 * Usage: node fix-row-name.mjs <patch-file> <plugin-id> <file-url>
 */

import { readFileSync, writeFileSync } from "node:fs";

const [patchPath, pluginId, rowName] = process.argv.slice(2);
if (patchPath === undefined || pluginId === undefined || rowName === undefined) {
	process.stderr.write("usage: fix-row-name.mjs <patch-file> <plugin-id> <file-url>\n");
	process.exit(1);
}

/** The patch-relative name an earlier release of this installer wrote. */
const relativeName = `./plugins/${pluginId.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}/lib/index.js`;
const relative = new RegExp(`^(\\s*name:\\s*)(['"]?)${relativeName.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\2\\s*$`, "mu");

let text;
try {
	text = readFileSync(patchPath, "utf8");
} catch (error) {
	process.stderr.write(`fix-row-name: cannot read ${patchPath}: ${error.message}\n`);
	process.exit(1);
}

if (!relative.test(text)) {
	process.stderr.write(`fix-row-name: ${patchPath} already names the "${pluginId}" row with an absolute URL\n`);
	process.exit(3);
}

// A replacer function keeps `$` sequences in the URL from being read as replacement
// patterns, which a file URL can legitimately contain.
writeFileSync(patchPath, text.replace(relative, (_match, prefix) => `${prefix}'${rowName}'`), "utf8");
process.stderr.write(`fix-row-name: updated "${pluginId}" to ${rowName}\n`);
process.exit(0);
