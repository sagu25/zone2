"""
TARE — Grid Agent Scenarios (4 scenarios)

S1: Out-of-Hours       — High-impact action at 02:30, no maintenance window — TASYA + TARE + BARRIER
S2: Repeated Failures  — Same action fails 3x, TEMPEST detects unsafe pattern — TEMPEST + TARE + BARRIER
S3: Runaway Loop       — Automation bug fires same command at machine speed, TEMPEST detects,
                         TARE applies SAFETY HOLD automatically, no human approval needed
S4: Read-Only Breach   — Identity policy violation, KORAL + BARRIER only
"""
import time
import threading


def _end_scenario(engine, broadcast_fn, scenario_key, result, summary, caught_by=None):
    """Broadcast SCENARIO_END with outcome summary."""
    snap   = engine._snapshot()
    stats  = snap.get("stats", {})
    gw_log = snap.get("gateway_log", [])
    seen   = set()
    signals = []
    for entry in gw_log:
        for sig in entry.get("signals", []):
            s = sig.get("signal")
            if s and s not in seen:
                seen.add(s); signals.append(s)
    broadcast_fn({
        "type":      "SCENARIO_END",
        "scenario":  scenario_key,
        "result":    result,
        "summary":   summary,
        "caught_by": caught_by,
        "signals":   signals,
        "blocked":   stats.get("denied", 0),
        "allowed":   stats.get("allowed", 0),
        "total":     stats.get("total", 0),
    })


# ── Scenario 1 — Out-of-Hours High-Impact Attempt ─────────────────────────────

OOH_SEQUENCE = [
    ("GET_STATUS",   "BRK-110", "Z1"),   # read — allowed even at 02:30
    ("PULL_METRICS", "BRK-110", "Z1"),   # read — allowed
    ("OPEN_BREAKER", "BRK-110", "Z1"),   # HIGH-IMPACT — blocked, outside window
]

def run_out_of_hours_agent(engine, broadcast_fn):
    """
    Operator attempts a Zone-1 high-impact action at 02:30.
    No maintenance window, no emergency flag.
    TASYA checks time context → TARE downgrades → BARRIER blocks → ServiceNow + Approve UI.
    """
    def _run():
        broadcast_fn({
            "type":            "SCENARIO_START",
            "scenario":        "out_of_hours",
            "title":           "Out-of-Hours High-Impact Attempt",
            "description":     (
                "An operator attempts a Zone 1 control action at 02:30 AM. "
                "No maintenance window is active and no emergency flag has been raised. "
                "TASYA validates the time context, TARE decides the action is unsafe, "
                "BARRIER blocks execution and requests supervisor approval for a 15-minute window."
            ),
            "featured_agents": ["TASYA", "BARRIER"],
            "pipeline_label":  "Time-context enforcement only",
            "threat_level":    "HIGH",
        })

        broadcast_fn({"type": "CHAT_MESSAGE", "role": "system",
            "message": "GridOperator-Agent online — 02:30 local time. "
                       "Attempting routine Zone 1 maintenance. TARE monitoring..."})
        time.sleep(1.5)

        # Reads first — these go through normally
        for action, asset, zone in OOH_SEQUENCE[:2]:
            engine.check_out_of_hours_action(action, asset, zone, simulated_hour=2)
            time.sleep(1.2)

        broadcast_fn({"type": "CHAT_MESSAGE", "role": "system",
            "message": "Status checks complete. Proceeding to switch operation..."})
        time.sleep(1.0)

        # High-impact at 02:30 — this triggers OOH detection
        engine.check_out_of_hours_action("OPEN_BREAKER", "BRK-110", "Z1", simulated_hour=2)

        time.sleep(3)
        _end_scenario(engine, broadcast_fn, "out_of_hours", "caught",
            "Read operations were permitted — diagnostics are always allowed. "
            "The moment OPEN_BREAKER was attempted at 02:30 with no maintenance window, "
            "TASYA flagged the time context. TARE downgraded to diagnostics-only and "
            "requested supervisor approval. ServiceNow P2 incident raised automatically.",
            caught_by="TASYA (time context) → TARE → BARRIER")

    threading.Thread(target=_run, daemon=True).start()


# ── Scenario 2 — Repeated Failed Attempts ─────────────────────────────────────

def run_repeated_failures_agent(engine, broadcast_fn):
    """
    Agent retries the same blocked action 4 times without adjusting.
    TEMPEST detects unsafe persistence → TARE fires FREEZE → ServiceNow P1.
    """
    def _run():
        broadcast_fn({
            "type":            "SCENARIO_START",
            "scenario":        "repeated_failures",
            "title":           "Repeated Failed Attempts",
            "description":     (
                "An automation agent attempts OPEN_BREAKER on a Zone 3 asset. "
                "The action is blocked by BARRIER — the safety simulation precondition has not been met. "
                "The system stays NORMAL. Instead of adjusting, the agent retries the same command repeatedly. "
                "TEMPEST detects the unsafe persistence pattern and TARE fires a full FREEZE."
            ),
            "featured_agents": ["TEMPEST", "BARRIER"],
            "pipeline_label":  "Retry detection — no pipeline needed",
            "threat_level":    "HIGH",
        })

        broadcast_fn({"type": "CHAT_MESSAGE", "role": "system",
            "message": "AutomationAgent-7 online — executing scheduled Zone 3 switching task. "
                       "TARE monitoring..."})
        time.sleep(1.5)

        # Pre-condition: inject Zone 3 fault and activate safety interlock on BARRIER.
        # Engine stays NORMAL — the system looks clean. Only BARRIER knows the
        # simulation precondition has not been met. Mode changes only when TEMPEST fires.
        engine.inject_fault("Z3", "Feeder instability — safety simulation not yet completed")
        with engine._lock:
            engine.barrier.set_mode("INTERLOCK")
        broadcast_fn(engine._snapshot())

        broadcast_fn({"type": "CHAT_MESSAGE", "role": "system",
            "message": "Zone 3 safety interlock active — simulation precondition not met. "
                       "Agent attempting OPEN_BREAKER regardless..."})
        time.sleep(1.0)

        # Agent retries 4 times — TEMPEST fires on the 3rd failure
        for attempt in range(1, 5):
            broadcast_fn({"type": "CHAT_MESSAGE", "role": "system",
                "message": f"Attempt {attempt}/4: OPEN_BREAKER BRK-301 Z3..."})
            time.sleep(1.4)
            engine.process_command("OPEN_BREAKER", "BRK-301", "Z3",
                                   token="eyJhbGciOiJSUzI1NiJ9.TARE-MOCK-TOKEN")
            time.sleep(0.8)
            if attempt >= 3:
                time.sleep(1.5)  # Give TEMPEST time to fire on attempt 3

        time.sleep(4)
        _end_scenario(engine, broadcast_fn, "repeated_failures", "caught",
            "BARRIER blocked OPEN_BREAKER each time — safety interlock was active, simulation not run. "
            "A well-behaved agent would stop and investigate after one failure. "
            "This agent retried identically 3 times — TEMPEST flagged the unsafe persistence. "
            "TARE froze the system. P1 Critical incident raised. Likely cause: automation bug or misuse.",
            caught_by="TEMPEST (retry pattern) → TARE → BARRIER")

    threading.Thread(target=_run, daemon=True).start()


# ── Scenario 3 — Runaway Loop / Automation Bug ────────────────────────────────

def run_runaway_loop_agent(engine, broadcast_fn):
    """
    Automation agent enters a loop — valid credentials, valid command, insane rate.
    TEMPEST detects the loop pattern independently of KORAL/MAREA.
    TARE applies SAFETY HOLD automatically — no human approval needed.
    ServiceNow P1 incident auto-created.
    """
    def _run():
        broadcast_fn({
            "type":            "SCENARIO_START",
            "scenario":        "runaway_loop",
            "title":           "Runaway Loop — Automation Bug",
            "description":     (
                "An automation agent enters a runaway loop — firing the same request against "
                "the same asset repeatedly at machine speed. Credentials are valid. "
                "The commands are individually permitted. But the rate is a denial-of-service risk. "
                "TEMPEST detects the loop pattern and TARE applies a SAFETY HOLD immediately — "
                "no supervisor approval required. P1 Critical incident auto-created."
            ),
            "featured_agents": ["TEMPEST", "BARRIER"],
            "pipeline_label":  "Runtime safety — no planning pipeline needed",
            "threat_level":    "HIGH",
        })

        broadcast_fn({"type": "CHAT_MESSAGE", "role": "system",
            "message": "AutoScheduler-3 online — executing scheduled diagnostic sweep. "
                       "TARE monitoring session tempo..."})
        time.sleep(1.5)

        # Agent fires the same command rapidly — valid creds, valid command, wrong rate
        # Uses Z3 (agent's assigned zone) so MAREA doesn't flag OUT_OF_ZONE —
        # the threat here is rate/behaviour, not zone access.
        for i in range(8):
            if i == 0:
                broadcast_fn({"type": "CHAT_MESSAGE", "role": "system",
                    "message": "Agent issuing PULL_METRICS on FDR-301 — normal diagnostic read..."})
            time.sleep(0.35)   # ~170 requests/min — well above any operational baseline
            engine.process_command("PULL_METRICS", "FDR-301", "Z3",
                                   token="eyJhbGciOiJSUzI1NiJ9.TARE-MOCK-TOKEN")

        time.sleep(5)
        _end_scenario(engine, broadcast_fn, "runaway_loop", "caught",
            "Every individual command was valid — valid identity, valid target, permitted action. "
            "TEMPEST detected the rate anomaly: same request on FDR-301, 5+ times in 5 seconds. "
            "TARE applied SAFETY HOLD without waiting for supervisor approval — "
            "the denial-of-service risk was immediate. P1 Critical incident auto-raised.",
            caught_by="TEMPEST (loop pattern) → TARE → BARRIER")

    threading.Thread(target=_run, daemon=True).start()


# ── Scenario 4 — Read-Only Breach ─────────────────────────────────────────────

READONLY_SEQUENCE = [
    ("KORAL_AGENT", "GET_STATUS",   "Z3"),   # legitimate read
    ("KORAL_AGENT", "PULL_METRICS", "Z3"),   # legitimate read
    ("KORAL_AGENT", "OPEN_BREAKER", "Z3"),   # WRITE — policy violation
]


def run_readonly_write_agent(engine, broadcast_fn):
    """
    Read-only monitoring identity attempts a write operation.
    KORAL logs → TARE checks policy → BARRIER enforces READ_ONLY_DOWNGRADE → ServiceNow ticket.
    """
    def _run():
        broadcast_fn({
            "type":            "SCENARIO_START",
            "scenario":        "readonly_write",
            "title":           "Read-Only Breach — Identity Policy Violation",
            "description":     (
                "A read-only monitoring identity (KORAL_AGENT) starts normally — fetching "
                "status and pulling metrics. Then it suddenly attempts OPEN_BREAKER, a "
                "write/control operation outside its role. KORAL logs it, TARE checks the "
                "identity registry, BARRIER enforces READ_ONLY_DOWNGRADE, ServiceNow ticket raised."
            ),
            "featured_agents": ["KORAL", "BARRIER"],
            "pipeline_label":  "Identity policy only — Z2/Z1 not needed",
            "threat_level":    "HIGH",
        })

        broadcast_fn({"type": "CHAT_MESSAGE", "role": "system",
            "message": "KORAL_AGENT online — monitoring identity, read-only role. "
                       "Beginning normal telemetry reads. TARE watching identity behaviour..."})

        for principal, action, zone in READONLY_SEQUENCE:
            time.sleep(1.5)
            if action in ("GET_STATUS", "PULL_METRICS", "READ_TELEMETRY"):
                broadcast_fn({"type": "CHAT_MESSAGE", "role": "system",
                    "message": f"KORAL_AGENT: '{action}' on {zone} — read operation, within role."})
            else:
                broadcast_fn({"type": "CHAT_MESSAGE", "role": "system",
                    "message": f"KORAL_AGENT: attempting '{action}' on {zone} — "
                               "write/control operation for a read-only identity. TARE checking policy..."})
            engine.check_identity_policy(principal, action, zone)
            time.sleep(0.5)

        _end_scenario(engine, broadcast_fn, "readonly_write", "caught",
            "KORAL_AGENT performed two legitimate reads before issuing OPEN_BREAKER. "
            "TARE matched the action against the identity registry — role is READ_ONLY_MONITOR. "
            "BARRIER applied READ_ONLY_DOWNGRADE and blocked the command. "
            "ServiceNow incident raised automatically. No other agents needed.",
            caught_by="KORAL (identity log) → TARE (policy check) → BARRIER (READ_ONLY_DOWNGRADE)")

    threading.Thread(target=_run, daemon=True).start()
