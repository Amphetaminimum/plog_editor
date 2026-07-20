export const DOCUMENT_SCHEMA_VERSION = 1;

export const DOCUMENT_COMMANDS = Object.freeze({
  INSERT: "block.insert",
  DELETE: "block.delete",
  MOVE: "block.move",
  UPDATE_CONTENT: "block.updateContent",
  UPDATE_STYLE: "block.updateStyle",
});

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function clampIndex(value, length) {
  const numeric = Number.isFinite(Number(value)) ? Number(value) : length;
  return Math.max(0, Math.min(length, Math.trunc(numeric)));
}

function requireBlockId(command) {
  const id = String(command?.id || command?.block?.id || "").trim();
  if (!id) throw new Error(`${command?.type || "document command"} requires a block id`);
  return id;
}

export function reduceDocumentBlocks(blocks, command) {
  const source = Array.isArray(blocks) ? blocks : [];
  if (!command || typeof command !== "object") throw new Error("document command must be an object");

  if (command.type === DOCUMENT_COMMANDS.INSERT) {
    const block = clone(command.block);
    const id = requireBlockId({ ...command, block });
    if (source.some((item) => item.id === id)) throw new Error(`block already exists: ${id}`);
    const index = clampIndex(command.index, source.length);
    const next = source.map(clone);
    next.splice(index, 0, block);
    return next;
  }

  if (command.type === DOCUMENT_COMMANDS.DELETE) {
    const id = requireBlockId(command);
    return source.filter((item) => item.id !== id).map(clone);
  }

  if (command.type === DOCUMENT_COMMANDS.MOVE) {
    const id = requireBlockId(command);
    const fromIndex = source.findIndex((item) => item.id === id);
    if (fromIndex < 0) return source.map(clone);
    const next = source.map(clone);
    const [block] = next.splice(fromIndex, 1);
    next.splice(clampIndex(command.toIndex, next.length), 0, block);
    return next;
  }

  if (command.type === DOCUMENT_COMMANDS.UPDATE_CONTENT) {
    const id = requireBlockId(command);
    const patch = clone(command.patch || {});
    return source.map((item) => {
      if (item.id !== id) return clone(item);
      const next = { ...clone(item), ...patch, style: clone(item.style || {}) };
      for (const key of command.unset || []) delete next[key];
      return next;
    });
  }

  if (command.type === DOCUMENT_COMMANDS.UPDATE_STYLE) {
    const id = requireBlockId(command);
    const patch = clone(command.patch || {});
    return source.map((item) => {
      if (item.id !== id) return clone(item);
      const style = { ...clone(item.style || {}), ...patch };
      for (const key of command.unset || []) delete style[key];
      return { ...clone(item), style };
    });
  }

  throw new Error(`unsupported document command: ${command.type || "unknown"}`);
}

export function executeDocumentCommand(blocks, command) {
  const source = Array.isArray(blocks) ? blocks : [];
  let inverse;

  if (command.type === DOCUMENT_COMMANDS.INSERT) {
    inverse = { type: DOCUMENT_COMMANDS.DELETE, id: requireBlockId(command) };
  } else if (command.type === DOCUMENT_COMMANDS.DELETE) {
    const id = requireBlockId(command);
    const index = source.findIndex((item) => item.id === id);
    if (index < 0) return { blocks: source.map(clone), changed: false, inverse: null };
    inverse = { type: DOCUMENT_COMMANDS.INSERT, index, block: clone(source[index]) };
  } else if (command.type === DOCUMENT_COMMANDS.MOVE) {
    const id = requireBlockId(command);
    const index = source.findIndex((item) => item.id === id);
    if (index < 0) return { blocks: source.map(clone), changed: false, inverse: null };
    inverse = { type: DOCUMENT_COMMANDS.MOVE, id, toIndex: index };
  } else if (command.type === DOCUMENT_COMMANDS.UPDATE_CONTENT) {
    const id = requireBlockId(command);
    const current = source.find((item) => item.id === id);
    if (!current) return { blocks: source.map(clone), changed: false, inverse: null };
    inverse = {
      type: DOCUMENT_COMMANDS.UPDATE_CONTENT,
      id,
      patch: Object.fromEntries(Object.keys(command.patch || {}).filter((key) => Object.hasOwn(current, key)).map((key) => [key, clone(current[key])])),
      unset: Object.keys(command.patch || {}).filter((key) => !Object.hasOwn(current, key)),
    };
  } else if (command.type === DOCUMENT_COMMANDS.UPDATE_STYLE) {
    const id = requireBlockId(command);
    const current = source.find((item) => item.id === id);
    if (!current) return { blocks: source.map(clone), changed: false, inverse: null };
    inverse = {
      type: DOCUMENT_COMMANDS.UPDATE_STYLE,
      id,
      patch: Object.fromEntries(Object.keys(command.patch || {}).filter((key) => Object.hasOwn(current.style || {}, key)).map((key) => [key, clone(current.style[key])])),
      unset: Object.keys(command.patch || {}).filter((key) => !Object.hasOwn(current.style || {}, key)),
    };
  } else {
    return { blocks: reduceDocumentBlocks(source, command), changed: true, inverse: null };
  }

  const next = reduceDocumentBlocks(source, command);
  return {
    blocks: next,
    changed: JSON.stringify(source) !== JSON.stringify(next),
    inverse,
  };
}

export function createDocumentSnapshot({ id, title, canvas, blocks }) {
  return {
    version: DOCUMENT_SCHEMA_VERSION,
    id: String(id || "document"),
    title: String(title || "Untitled Plog"),
    canvas: clone(canvas || {}),
    blocks: (Array.isArray(blocks) ? blocks : []).map(clone),
  };
}
