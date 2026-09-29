"""Job queue: heavy work never runs in a request handler (CLAUDE.md s4.1).

Two process pools, so a 70-image background recompute can never delay the
image the user just dropped:
  interactive  2 processes  user-triggered inference (tiles streamed)
  background   2 processes  cohort cache, thumbnails (no tile stream)

Processes, not threads: morphometry loops are pure Python and would hold the
GIL, freezing the asyncio loop that serves SSE and pan/zoom tile requests.

Worker -> server events travel through one multiprocessing Manager queue; a
forwarder thread hands them to the event loop, which appends them to the job's
history (so a late subscriber replays every tile) and fans them out to
subscribers. Rules (s4.2): FIFO per pool; a new job for the same image
supersedes (cancels) the old one; every job can be cancelled.
"""
from __future__ import annotations

import asyncio
import itertools
import json
import multiprocessing as mp
import os
import threading
import time
from concurrent.futures import ProcessPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path

STAGE_WEIGHT = {"S0": (0.0, 0.05), "S1": (0.05, 0.12), "S2": (0.12, 0.82),
                "S3": (0.82, 0.93), "S4": (0.93, 0.96), "S5": (0.96, 1.0)}
HISTORY_KEEP = 24          # finished interactive jobs whose event history is kept


def _warm() -> str:
    """Import the heavy libraries once per worker (the 'preload' of s4.3)."""
    import pipeline  # noqa: F401  (skimage, scipy, czifile)

    return os.getpid().__str__()


def _run_job(job_id, image_id, src, out_dir, q, flags, stream, tile_delay):
    """Write into a private staging folder; publish into out_dir only if this
    job was not cancelled/superseded, so a job that loses the race can never
    overwrite the output of the job that replaced it."""
    import shutil

    import pipeline

    def emit(ev):
        q.put((job_id, ev))

    stage = Path(out_dir) / f".staging-{job_id}"
    try:
        emit({"type": "started", "pid": os.getpid()})
        res = pipeline.run(image_id, src, stage, emit, lambda: flags.get(job_id, False),
                           stream_tiles=stream, tile_delay=tile_delay)
        (stage / "result.json").write_text(json.dumps(res), encoding="utf-8")
        if flags.get(job_id, False):
            raise pipeline.JobCancelled()
        for f in ("masks.png", "skeleton.png", "labels.png", "result.json"):  # result last
            os.replace(stage / f, Path(out_dir) / f)
        emit({"type": "result", "result": res})
        emit({"type": "done"})
    except pipeline.JobCancelled:
        emit({"type": "cancelled"})
    except Exception as e:  # reported to the UI, never swallowed
        emit({"type": "error", "message": f"{type(e).__name__}: {e}"})
    finally:
        shutil.rmtree(stage, ignore_errors=True)


def _run_prepare(image_id, src):
    import registry

    return registry.prepare(image_id, src)


@dataclass
class Job:
    id: str
    image_id: str
    priority: str
    state: str = "queued"            # queued | running | done | failed | cancelled
    progress: float = 0.0
    stage: str | None = None
    created: float = field(default_factory=time.time)
    started: float | None = None
    finished: float | None = None
    error: str | None = None
    tiles_done: int = 0
    tiles_total: int = 0
    events: list = field(default_factory=list)
    base: int = 0                     # id offset after trimming (event ids stay monotonic)
    subscribers: set = field(default_factory=set)
    future: object = None

    def summary(self) -> dict:
        return {"id": self.id, "image_id": self.image_id, "priority": self.priority,
                "state": self.state, "progress": round(self.progress, 4), "stage": self.stage,
                "created": self.created, "started": self.started, "finished": self.finished,
                "error": self.error, "tiles_done": self.tiles_done, "tiles_total": self.tiles_total}


class JobManager:
    def __init__(self, interactive_workers: int = 2, background_workers: int = 2,
                 tile_delay: float = 0.0):
        self.tile_delay = tile_delay
        self.n_workers = (interactive_workers, background_workers)
        self.jobs: dict[str, Job] = {}
        self.global_subs: set[asyncio.Queue] = set()
        self._ids = itertools.count(1)
        self.ready = False
        self.warm_ms: int | None = None
        self.on_finish = None            # callback(job) when a job reaches done

    # ------------------------------------------------------------- lifecycle
    def start(self, loop: asyncio.AbstractEventLoop) -> None:
        self.loop = loop
        self.manager = mp.Manager()
        self.q = self.manager.Queue()
        self.flags = self.manager.dict()
        self.pool_i = ProcessPoolExecutor(self.n_workers[0])
        self.pool_b = ProcessPoolExecutor(self.n_workers[1])
        threading.Thread(target=self._forward, daemon=True, name="job-forwarder").start()
        threading.Thread(target=self._warm_pools, daemon=True, name="warm").start()

    def _warm_pools(self) -> None:
        t = time.perf_counter()
        futs = [self.pool_i.submit(_warm) for _ in range(self.n_workers[0])]
        futs += [self.pool_b.submit(_warm) for _ in range(self.n_workers[1])]
        for f in futs:
            f.result()
        self.warm_ms = round((time.perf_counter() - t) * 1000)
        self.ready = True
        self.loop.call_soon_threadsafe(self._broadcast, {"type": "model", "state": "ready", "warm_ms": self.warm_ms})

    def shutdown(self) -> None:
        for j in self.jobs.values():
            if j.state in ("queued", "running"):
                self.flags[j.id] = True
        self.pool_i.shutdown(wait=False, cancel_futures=True)
        self.pool_b.shutdown(wait=False, cancel_futures=True)
        self.q.put((None, None))
        self.manager.shutdown()

    # ------------------------------------------------------------------ jobs
    def submit(self, image_id: str, src: str, out_dir: str, priority: str = "interactive") -> Job:
        # supersede: an interactive job replaces any active job of the same image
        for j in list(self.jobs.values()):
            if j.image_id == image_id and j.state in ("queued", "running"):
                if priority == "interactive" or j.priority == "background":
                    self.cancel(j.id, reason="superseded")
                else:
                    return j                     # background dup of an active job
        job = Job(id=f"j{next(self._ids)}", image_id=image_id, priority=priority)
        self.jobs[job.id] = job
        pool = self.pool_i if priority == "interactive" else self.pool_b
        stream = priority == "interactive"
        job.future = pool.submit(_run_job, job.id, image_id, str(src), str(out_dir),
                                 self.q, self.flags, stream, self.tile_delay if stream else 0.0)
        self._broadcast({"type": "job", "job": job.summary()})
        self._trim()
        return job

    def prepare(self, image_id: str, src: str, callback) -> None:
        fut = self.pool_b.submit(_run_prepare, image_id, str(src))
        fut.add_done_callback(lambda f: self.loop.call_soon_threadsafe(callback, f))

    def cancel(self, job_id: str, reason: str = "cancelled") -> bool:
        job = self.jobs.get(job_id)
        if not job or job.state not in ("queued", "running"):
            return False
        self.flags[job_id] = True
        if job.future is not None and job.future.cancel():   # never started
            self._on_event(job_id, {"type": "cancelled", "reason": reason})
        else:
            job.error = reason if reason != "cancelled" else None
        return True

    # ---------------------------------------------------------------- events
    def _forward(self) -> None:
        while True:
            try:
                job_id, ev = self.q.get()
            except (EOFError, OSError, BrokenPipeError):
                return
            if job_id is None:
                return
            self.loop.call_soon_threadsafe(self._on_event, job_id, ev)

    def _on_event(self, job_id: str, ev: dict) -> None:
        job = self.jobs.get(job_id)
        if not job or job.state in ("done", "failed", "cancelled"):
            return
        t = ev["type"]
        if t == "started":
            job.state, job.started = "running", time.time()
        elif t == "stage":
            job.stage = ev["stage"]
            lo, hi = STAGE_WEIGHT.get(ev["stage"], (job.progress, job.progress))
            job.progress = hi if ev["state"] == "done" else lo
        elif t in ("tile", "progress"):
            job.tiles_done, job.tiles_total = ev["i"] + 1, ev["n"]
            lo, hi = STAGE_WEIGHT["S2"]
            job.progress = lo + (hi - lo) * job.tiles_done / job.tiles_total
        elif t == "done":
            job.state, job.progress, job.finished = "done", 1.0, time.time()
            if self.on_finish:
                self.on_finish(job)
        elif t == "cancelled":
            job.state, job.finished = "cancelled", time.time()
            ev = {**ev, "reason": ev.get("reason") or job.error or "cancelled"}
        elif t == "error":
            job.state, job.finished, job.error = "failed", time.time(), ev["message"]
        idx = None
        if job.priority == "interactive" or t in ("result", "done", "error", "cancelled"):
            job.events.append(ev)
            idx = job.base + len(job.events)
        for q in list(job.subscribers):
            q.put_nowait((idx, ev))
        if t in ("started", "stage", "done", "cancelled", "error", "progress") or (t == "tile" and ev["i"] % 4 == 0):
            self._broadcast({"type": "job", "job": job.summary()})

    def _broadcast(self, ev: dict) -> None:
        for q in list(self.global_subs):
            q.put_nowait((None, ev))

    def broadcast_threadsafe(self, ev: dict) -> None:
        self.loop.call_soon_threadsafe(self._broadcast, ev)

    def subscribe(self, job: Job, last_id: int = 0) -> asyncio.Queue:
        """Replay history after last_id (the browser's Last-Event-ID on an SSE
        reconnect), so a reconnect never re-delivers tiles it already has."""
        q: asyncio.Queue = asyncio.Queue()
        q.put_nowait((None, {"type": "job", "job": job.summary()}))
        for k, ev in enumerate(job.events, start=job.base + 1):
            if k > last_id:
                q.put_nowait((k, ev))
        terminal = ("done", "error", "cancelled")
        if job.state in ("done", "failed", "cancelled") and not any(e["type"] in terminal for e in job.events):
            kind = {"done": "done", "failed": "error", "cancelled": "cancelled"}[job.state]
            q.put_nowait((None, {"type": kind, "message": job.error or ""}))
        job.subscribers.add(q)
        return q

    def _trim(self) -> None:
        done = [j for j in self.jobs.values() if j.state in ("done", "failed", "cancelled")]
        done.sort(key=lambda j: j.finished or 0)
        for j in done[:-HISTORY_KEEP]:
            # drop the heavy tile pixels, keep result + terminal event so a late
            # subscriber still ends cleanly
            if any(e["type"] == "tile" for e in j.events):
                kept = [e for e in j.events if e["type"] in ("result", "done", "error", "cancelled")]
                j.base += len(j.events) - len(kept)
                j.events = kept
        if len(self.jobs) > 400:
            for j in done[: len(self.jobs) - 400]:
                self.jobs.pop(j.id, None)
