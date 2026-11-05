// Python 3 in the browser via Pyodide (downloaded from jsDelivr the first time, ~10 MB).
// Programs are stopped after PY_LIMIT seconds because nothing else can interrupt Pyodide.
export const PY_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
export const PY_LIMIT = 10;
const GUARD = [
  'import sys, time',
  '_koal_deadline = [1e18]',
  'def _koal_arm(sec=10):',
  '    _koal_deadline[0] = time.time() + sec',
  'def _koal_trace(frame, event, arg):',
  '    if event == "line" and time.time() > _koal_deadline[0]:',
  '        _koal_deadline[0] = 1e18',
  '        raise KeyboardInterrupt("KOAL-99 stopped this program after 10 seconds")',
  '    return _koal_trace',
  'sys.settrace(_koal_trace)',
].join('\n');

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Py = any;
let ready: Promise<Py> | null = null;
let loaded = false;

export const pyLoaded = () => loaded;

export function loadPy(): Promise<Py> {
  if (ready) return ready;
  ready = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = PY_URL + 'pyodide.js';
    s.onload = async () => {
      try {
        const py = await (window as any).loadPyodide({ indexURL: PY_URL });
        py.runPython(GUARD);
        loaded = true;
        res(py);
      } catch (e) {
        ready = null;
        rej(e);
      }
    };
    s.onerror = () => {
      ready = null;
      rej(new Error('Could not download Python. Are you online?'));
    };
    document.head.appendChild(s);
  });
  return ready;
}

export function armPy(py: Py) {
  try {
    py.globals.get('_koal_arm')(PY_LIMIT);
  } catch {
    /* ignore */
  }
}

/** Point Python's stdout/stderr/stdin at the given printers. */
export function wirePy(py: Py, out: (s: string) => void, err: (s: string) => void) {
  py.setStdout({ batched: out });
  py.setStderr({ batched: (s: string) => { if (!s.includes('/lib/python312.zip/code.py')) err(s); } });
  py.setStdin({
    stdin: () => {
      const v = window.prompt('Python is asking for input:');
      armPy(py);
      return v == null ? undefined : v;
    },
  });
}

export const pyError = (e: unknown) => String((e as Error)?.message ?? e).trim().split('\n').slice(-8).join('\n');
