import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function fail(label, message, file) {
  const error = new Error(`${label} ${message}: ${file}`);
  error.code = "PROTECTED_FILE_INVALID";
  throw error;
}

function descriptorRoot(dirFd, label, parent) {
  const candidates = [`/proc/self/fd/${dirFd}`, `/dev/fd/${dirFd}`];
  const root = candidates.find((candidate) => fs.existsSync(candidate));
  if (!root) fail(label, "requires directory-fd addressing support", parent);
  let actual;
  try { actual = fs.realpathSync(root); }
  catch { fail(label, "cannot resolve its pinned parent directory", parent); }
  if (actual !== path.resolve(parent)) fail(label, "parent directory changed or resolves through a symlink", parent);
  return root;
}

/**
 * Read authority bytes through a pinned parent directory and a no-follow leaf.
 * The descriptor-root equality check rejects existing symlink components and a
 * parent replacement before the pin; a later rename cannot redirect the child
 * open because it is addressed through the already-open directory descriptor.
 */
export function readProtectedFileSync(file, {
  label = "protected file",
  ownerOnly = true,
  privateOnly = false,
  protectParent = true,
} = {}) {
  const absolute = path.resolve(file);
  const parent = path.dirname(absolute);
  let dirFd;
  let fileFd;
  try {
    dirFd = fs.openSync(parent, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | (fs.constants.O_DIRECTORY || 0));
    const parentInfo = fs.fstatSync(dirFd);
    if (!parentInfo.isDirectory()) fail(label, "parent is not a directory", parent);
    if (protectParent && typeof process.getuid === "function" && parentInfo.uid !== process.getuid()) fail(label, "parent is not owned by the current principal", parent);
    if (protectParent && (parentInfo.mode & 0o022) !== 0) fail(label, "parent is group/world writable", parent);
    const fdRoot = descriptorRoot(dirFd, label, parent);
    const anchored = path.join(fdRoot, path.basename(absolute));
    fileFd = fs.openSync(anchored, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    const info = fs.fstatSync(fileFd);
    if (!info.isFile()) fail(label, "must be a regular file", absolute);
    if (ownerOnly && typeof process.getuid === "function" && info.uid !== process.getuid()) fail(label, "is not owned by the current principal", absolute);
    if (privateOnly && (info.mode & 0o077) !== 0) fail(label, "must be mode 0600 or stricter", absolute);
    if (!privateOnly && (info.mode & 0o022) !== 0) fail(label, "must not be group/world writable", absolute);
    return { absolute, bytes: fs.readFileSync(fileFd), stat: info, parentStat: parentInfo };
  } catch (error) {
    if (error?.code === "PROTECTED_FILE_INVALID") throw error;
    if (error?.code === "ELOOP") fail(label, "must not be a symlink", absolute);
    const wrapped = new Error(`${label} is unreadable or ineligible: ${absolute} (${error.code || error.message})`);
    wrapped.code = error?.code || "PROTECTED_FILE_INVALID";
    throw wrapped;
  } finally {
    if (fileFd !== undefined) fs.closeSync(fileFd);
    if (dirFd !== undefined) fs.closeSync(dirFd);
  }
}
