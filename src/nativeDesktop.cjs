const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const NATIVE_KEYS = Object.freeze(['enter', 'tab', 'escape', 'backspace', 'space', 'up', 'down', 'left', 'right', 'home', 'end', 'pageup', 'pagedown', 'win', 'ctrl+a', 'ctrl+l', 'ctrl+f', 'alt+tab']);

function createNativeDesktop({ platform = process.platform, run = promisify(execFile) } = {}) {
  let scriptPromise;
  const invoke = async (payload, signal) => {
    if (platform !== 'win32') throw new Error('Native desktop input is available on Windows. Use the managed browser on this platform.');
    // Reading through Electron's fs also works inside the packaged ASAR. No
    // external script path or user-controlled PowerShell source is executed.
    scriptPromise ||= fs.readFile(path.join(__dirname, 'nativeDesktop.ps1'), 'utf8');
    const script = await scriptPromise;
    let stdout;
    try { ({ stdout } = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
      timeout: 15_000, windowsHide: true, signal, maxBuffer: 64 * 1024,
      env: { ...process.env, MIRROR_DESKTOP_INPUT: Buffer.from(JSON.stringify(payload), 'utf8').toString('base64') }
    })); } catch (error) {
      if (error.name === 'AbortError') throw error;
      let failure;
      try { failure = JSON.parse(error.stdout || ''); } catch {}
      throw new Error(failure?.error || 'The Windows desktop bridge could not run. Check that PowerShell is available.');
    }
    const result = JSON.parse(stdout.trim());
    if (result.error) throw new Error(result.error);
    return result;
  };
  return {
    supported: platform === 'win32',
    scrollFromGesture: (input, signal) => invoke({ ...input, op: 'gesture_scroll' }, signal),
    inspect: (signal) => invoke({ op: 'state' }, signal),
    perform: (input, signal) => invoke(input, signal)
  };
}

function nativeAction(input, observation, toPhysicalPoint) {
  const foreground = observation.foreground;
  if (!foreground?.id || !foreground?.processId) throw new Error('Inspect the current desktop before sending native input.');
  const action = String(input.action || '');
  const result = { op: action, expectedWindowId: foreground.id, expectedProcessId: foreground.processId, expectedBounds: foreground.bounds };
  if (['click', 'double_click', 'scroll'].includes(action)) {
    const x = Number(input.x); const y = Number(input.y);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= observation.width || y >= observation.height) {
      throw new Error('Choose a point inside the latest full-display screenshot.');
    }
    const bounds = observation.displayBounds;
    const point = toPhysicalPoint({ x: Math.round(bounds.x + x * bounds.width / observation.width), y: Math.round(bounds.y + y * bounds.height / observation.height) });
    result.x = point.x; result.y = point.y;
    if (action === 'scroll') {
      result.deltaY = Math.max(-900, Math.min(900, Math.trunc(Number(input.deltaY) || 0)));
      if (!result.deltaY) throw new Error('Give scroll a nonzero deltaY.');
    }
  } else if (action === 'type_text') {
    result.text = Array.from(String(input.text || '')).slice(0, 2000).join('');
    if (!result.text) throw new Error('There is no text to enter.');
  } else if (action === 'press_key') {
    result.key = String(input.key || '').toLowerCase();
    if (!NATIVE_KEYS.includes(result.key)) throw new Error(`Supported native keys: ${NATIVE_KEYS.join(', ')}.`);
  } else throw new Error('Native input supports click, double_click, scroll, type_text, and press_key.');
  return result;
}

function sameForeground(left, right) {
  return Boolean(left?.id && right?.id && left.id === right.id && left.processId === right.processId);
}

module.exports = { createNativeDesktop, nativeAction, sameForeground, NATIVE_KEYS };
