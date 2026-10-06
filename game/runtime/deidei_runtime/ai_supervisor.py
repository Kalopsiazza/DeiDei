"""Bounded, correlated IPC to one owned model process; no Torch imports."""
import json
import os
from pathlib import Path
import queue
import signal
import subprocess
import threading
import time
from uuid import uuid4

from .worker_json import strict_object

LIMIT = 65536


class AIError(ValueError):
    def __init__(self, fatal=False):
        super().__init__("AI_UNAVAILABLE")
        self.fatal = fatal


class WindowsJob:
    """The kernel closes the runtime's handle on death and kills its AI member."""
    def __init__(self, process):
        self.handle = None
        if os.name != "nt":
            return
        import ctypes
        from ctypes import wintypes
        kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        class Basic(ctypes.Structure):
            _fields_ = [("ProcessTime", ctypes.c_int64), ("JobTime", ctypes.c_int64),
                        ("LimitFlags", wintypes.DWORD), ("MinimumWorkingSet", ctypes.c_size_t),
                        ("MaximumWorkingSet", ctypes.c_size_t), ("ActiveProcessLimit", wintypes.DWORD),
                        ("Affinity", ctypes.c_size_t), ("PriorityClass", wintypes.DWORD),
                        ("SchedulingClass", wintypes.DWORD)]
        class IO(ctypes.Structure):
            _fields_ = [(name, ctypes.c_uint64) for name in ("ReadOperationCount", "WriteOperationCount", "OtherOperationCount",
                        "ReadTransferCount", "WriteTransferCount", "OtherTransferCount")]
        class Extended(ctypes.Structure):
            _fields_ = [("Basic", Basic), ("Io", IO), ("ProcessMemoryLimit", ctypes.c_size_t),
                        ("JobMemoryLimit", ctypes.c_size_t), ("PeakProcessMemoryUsed", ctypes.c_size_t),
                        ("PeakJobMemoryUsed", ctypes.c_size_t)]
        kernel.CreateJobObjectW.argtypes = [ctypes.c_void_p, wintypes.LPCWSTR]
        kernel.CreateJobObjectW.restype = wintypes.HANDLE
        kernel.SetInformationJobObject.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD]
        kernel.AssignProcessToJobObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]
        kernel.CloseHandle.argtypes = [wintypes.HANDLE]
        handle = kernel.CreateJobObjectW(None, None)
        info = Extended(); info.Basic.LimitFlags = 0x2000  # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        if not handle:
            raise AIError(True)
        if not kernel.SetInformationJobObject(handle, 9, ctypes.byref(info), ctypes.sizeof(info)) or not kernel.AssignProcessToJobObject(handle, int(process._handle)):
            kernel.CloseHandle(handle)
            raise AIError(True)
        self.handle, self.kernel = handle, kernel

    def close(self):
        if self.handle is not None:
            self.kernel.CloseHandle(self.handle)
            self.handle = None


class AISupervisor:
    def __init__(self, command=None, *, cold_timeout=30.0, hot_timeout=0.75, clock=time.monotonic):
        self.generation = uuid4().hex
        self.clock, self.cold_timeout, self.hot_timeout = clock, cold_timeout, hot_timeout
        self.started = clock()
        self.state, self.process, self.job = "preparing", None, None
        self.cold_timer = None
        self.incoming = queue.Queue(maxsize=8)
        self.lock = threading.RLock()
        root = Path(__file__).resolve().parents[3]
        executable = os.environ.get("DEIDEI_AI_WORKER")
        python = os.environ.get("DEIDEI_AI_PYTHON")
        command = command or ([executable] if executable else
                              [python, "-I", str(root / "game/ai/worker-entry.py")] if python else None)
        if command is None:
            self.state = "failed"
            return
        env = {k: v for k, v in os.environ.items() if not k.startswith("PYTHON") and k not in ("DEIDEI_AI_WORKER", "DEIDEI_AI_PYTHON")}
        env.update(OMP_NUM_THREADS="1", MKL_NUM_THREADS="1", OPENBLAS_NUM_THREADS="1")
        try:
            self.process = subprocess.Popen([*command, self.generation], shell=False, stdin=subprocess.PIPE,
                         stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, cwd=root / "game/ai" if not executable else Path(executable).parent,
                         env=env, start_new_session=os.name != "nt")
            self.job = WindowsJob(self.process)
            threading.Thread(target=self._read, daemon=True, name="ai-json-reader").start()
            self.cold_timer = threading.Timer(cold_timeout, self.poll)
            self.cold_timer.daemon = True
            self.cold_timer.start()
        except (OSError, AIError):
            self.close("failed")

    def _read(self):
        while True:
            line = self.process.stdout.readline(LIMIT + 1)
            if not line or len(line) > LIMIT or not line.endswith(b"\n"):
                item = AIError(True)
            else:
                try:
                    item = json.loads(line.decode("utf-8"), object_pairs_hook=strict_object,
                                      parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))
                except (ValueError, UnicodeError, RecursionError):
                    item = AIError()
            try:
                self.incoming.put_nowait(item)
            except queue.Full:
                self.close("failed")
                return
            if isinstance(item, AIError) and item.fatal:
                return

    def poll(self):
        with self.lock:
            if self.state == "ready" and self.process.poll() is not None:
                self.close("failed")
            if self.state != "preparing":
                return self.state
            try:
                reply = self.incoming.get_nowait()
            except queue.Empty:
                if self.clock() - self.started >= self.cold_timeout or self.process is None or self.process.poll() is not None:
                    self.close("failed")
            else:
                if (isinstance(reply, dict) and type(reply.get("v")) is int
                        and reply == {"v": 1, "generation": self.generation, "type": "ready"}):
                    self.state = "ready"
                    if self.cold_timer:
                        self.cold_timer.cancel()
                else:
                    self.close("failed")
            return self.state

    def infer(self, expected, observation, mask):
        if self.poll() != "ready":
            raise AIError(True)
        decision_id = uuid4().hex
        request = {"v": 1, "generation": self.generation, "decision_id": decision_id,
                   "expected": expected, "observation": observation, "mask": mask}
        deadline = self.clock() + self.hot_timeout
        try:
            self.process.stdin.write((json.dumps(request, allow_nan=False, separators=(",", ":")) + "\n").encode())
            self.process.stdin.flush()
        except (OSError, ValueError):
            self.close("failed")
            raise AIError(True) from None
        while True:
            remaining = deadline - self.clock()
            if remaining <= 0:
                self.close("failed")
                raise AIError(True)
            try:
                reply = self.incoming.get(timeout=remaining)
            except queue.Empty:
                self.close("failed")
                raise AIError(True) from None
            if isinstance(reply, AIError):
                if reply.fatal:
                    self.close("failed")
                raise reply
            if not isinstance(reply, dict):
                raise AIError()
            # Replies from another generation, decision, turn or hash are discarded.
            if (reply.get("generation") != self.generation or reply.get("decision_id") != decision_id
                    or reply.get("expected") != expected):
                continue
            if set(reply) != {"v", "generation", "decision_id", "expected", "probabilities"} or type(reply["v"]) is not int or reply["v"] != 1:
                raise AIError()
            return reply["probabilities"]

    def close(self, state="cancelled"):
        with self.lock:
            self.state = state
            if self.cold_timer:
                self.cold_timer.cancel()
            if self.job:
                self.job.close()
            process = self.process
            if process and process.poll() is None:
                try:
                    if os.name == "nt":
                        process.kill()
                    else:
                        os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                try:
                    process.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    process.kill(); process.wait(timeout=2)
            if process:
                for stream in (process.stdin, process.stdout):
                    try:
                        stream.close()
                    except (OSError, ValueError):
                        pass
