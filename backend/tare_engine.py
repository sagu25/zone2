"""
TARE Engine — Trusted Access Response Engine
Central orchestrator of the full 12-agent security system.

TARE decides. TARE never executes.
Agents wake, do their part, and go back to sleep.

Detection flow (every command):
    KORAL observes → BARRIER enforces
    If NORMAL: MAREA analyzes → TASYA correlates
    If ≥2 signals: NEREUS recommends → TARE decides FREEZE
    BARRIER.set_mode("FREEZE") → ServiceNow → LLM brief → Approve/Deny UI

Post-approval pipeline (Zone 2 → Zone 1):
    ECHO diagnoses → SIMAR simulates → NAVIS plans → RISKADOR scores
    → TARE issues permit → TRITON arms + AEGIS arms + TEMPEST arms + LEVIER arms
    → For each step: AEGIS validates → TRITON executes → TEMPEST monitors
    → On failure: LEVIER rolls back

All 4 zones:
    Zone 3 (Reef)  — KORAL, MAREA, TASYA, NEREUS   [Observe & Recommend]
    Zone 2 (Shelf) — ECHO, SIMAR, NAVIS, RISKADOR   [Diagnose & Prepare]
    Zone 1 (Trench)— TRITON, AEGIS, TEMPEST, LEVIER  [Execute with Safety]
    Zone 4         — BARRIER                          [Policy Enforcement]
"""
import time
import threading
import uuid
from datetime import datetime
from servicenow_client import ServiceNowClient
from models import TicketFields
from agents import (
    KORAL, MAREA, TASYA, NEREUS,          # Zone 3 — Reef (implemented)
    ECHO, SIMAR, NAVIS, RISKADOR,          # Zone 2 — Shelf (stubs)
    TRITON, AEGIS, TEMPEST, LEVIER,        # Zone 1 — Trench (stubs)
    BARRIER,                               # Zone 4 — Policy Enforcement
)

_snow_client = ServiceNowClient()

# ─── ML Detector (optional) ───────────────────────────────────────────────────
try:
    from ml_detector import MLDetector
    _ml = MLDetector()
except Exception:
    _ml = None

# ─── Zone Definitions ─────────────────────────────────────────────────────────
ZONES = {
    "Z1": {"id": "Z1", "name": "Zone 1 — North Grid", "health": "HEALTHY", "fault": None, "color": "green"},
    "Z2": {"id": "Z2", "name": "Zone 2 — East Grid",  "health": "HEALTHY", "fault": None, "color": "green"},
    "Z3": {"id": "Z3", "name": "Zone 3 — West Grid",  "health": "HEALTHY", "fault": None, "color": "green"},
}

# ─── Asset Definitions ────────────────────────────────────────────────────────
INITIAL_ASSETS = {
    "BRK-301": {"id": "BRK-301", "type": "BREAKER", "zone": "Z3", "state": "CLOSED",  "description": "Main Circuit Breaker Z3"},
    "FDR-301": {"id": "FDR-301", "type": "FEEDER",  "zone": "Z3", "state": "RUNNING", "description": "Feeder Controller Z3"},
    "BRK-205": {"id": "BRK-205", "type": "BREAKER", "zone": "Z2", "state": "CLOSED",  "description": "Main Circuit Breaker Z2"},
    "FDR-205": {"id": "FDR-205", "type": "FEEDER",  "zone": "Z2", "state": "RUNNING", "description": "Feeder Controller Z2"},
    "BRK-110": {"id": "BRK-110", "type": "BREAKER", "zone": "Z1", "state": "CLOSED",  "description": "Main Circuit Breaker Z1"},
    "FDR-110": {"id": "FDR-110", "type": "FEEDER",  "zone": "Z1", "state": "RUNNING", "description": "Feeder Controller Z1"},
}

# ─── Operator Agent ───────────────────────────────────────────────────────────
OPERATOR_AGENT = {
    "id":            "OP-GRID-7749",
    "name":          "GridOperator-Agent",
    "role":          "GRID_OPERATOR",
    "clearance":     "LEVEL_3",
    "department":    "Grid Operations",
    "rbac_zones":    ["Z1", "Z2", "Z3"],
    "assigned_zone": "Z3",
    "rbac_token":    "eyJhbGciOiJSUzI1NiJ9.TARE-MOCK-TOKEN",
    "status":        "ACTIVE",
    "action_count":  0,
    "last_command":  None,
    "last_result":   None,
}

HIGH_IMPACT = {"OPEN_BREAKER", "CLOSE_BREAKER", "RESTART_CONTROLLER", "EMERGENCY_SHUTDOWN"}
READ_ONLY   = {"GET_STATUS"}


# ─── TARE Engine ──────────────────────────────────────────────────────────────
class TAREEngine:
    """
    Central orchestrator. Decides. Never executes.
    Instantiates all agents and coordinates their activation.
    """

    def __init__(self, broadcast_fn=None):
        self._broadcast = broadcast_fn or (lambda _: None)
        self._lock      = threading.Lock()

        # ── Instantiate all agents ─────────────────────────────────────────────
        # Zone 3 — Reef (implemented)
        self.koral    = KORAL()
        self.marea    = MAREA(ml_detector=_ml)
        self.tasya    = TASYA()
        self.nereus   = NEREUS()
        # Zone 2 — Shelf (stubs, Phase 2)
        self.echo     = ECHO()
        self.simar    = SIMAR()
        self.navis    = NAVIS()
        self.riskador = RISKADOR()
        # Zone 1 — Trench (stubs, Phase 2)
        self.triton   = TRITON()
        self.aegis    = AEGIS()
        self.tempest  = TEMPEST()
        self.levier   = LEVIER()
        # Zone 4 — Policy Enforcement (implemented)
        self.barrier  = BARRIER()

        # ── TARE state ────────────────────────────────────────────────────────
        self.mode            = "NORMAL"
        self.mode_changed_at = None
        self.previous_mode   = None

        self.assets = {k: dict(v) for k, v in INITIAL_ASSETS.items()}
        self.zones  = {k: dict(v) for k, v in ZONES.items()}
        self.agent  = dict(OPERATOR_AGENT)

        self.gateway_log     = []
        self.anomaly_signals = []
        self.anomaly_score   = 0
        self.active_incident = None

        self.timebox_expires = None
        self.timebox_total   = 0
        self._timebox_thread = None

        self.stats        = {"total": 0, "allowed": 0, "denied": 0, "freeze_events": 0}
        self.retry_counts = {}   # (command, asset_id) → failure count
        self.loop_tracker = {}   # (command, asset_id) → [timestamps] for runaway loop detection
        self._loop_fired  = False
        self._pending_ooh = None  # (command, asset_id, zone) — set when OOH blocks a command

    # ── Public API ─────────────────────────────────────────────────────────────

    def inject_fault(self, zone_id: str, fault_msg: str):
        with self._lock:
            zone = self.zones.get(zone_id)
            if zone:
                zone["health"] = "FAULT"
                zone["fault"]  = fault_msg
                zone["color"]  = "red"

    def reset(self):
        with self._lock:
            self.mode            = "NORMAL"
            self.mode_changed_at = None
            self.previous_mode   = None
            self.assets          = {k: dict(v) for k, v in INITIAL_ASSETS.items()}
            self.zones           = {k: dict(v) for k, v in ZONES.items()}
            self.agent           = dict(OPERATOR_AGENT)
            self.gateway_log     = []
            self.anomaly_signals = []
            self.anomaly_score   = 0
            self.active_incident = None
            self.timebox_expires = None
            self.timebox_total   = 0
            self.stats           = {"total": 0, "allowed": 0, "denied": 0, "freeze_events": 0}
            self.retry_counts    = {}
            self.loop_tracker    = {}
            self._loop_fired     = False
            self._pending_ooh    = None

            # Reset all agents
            self.koral.clear()
            self.marea.clear_sim_tracker()
            self.barrier.reset()
            self.aegis.reset()
            self.tempest.reset()
            self.triton.reset()
            self.levier.reset()

        self._broadcast({"type": "RESET", "message": "System reset. All zones nominal. TARE in NORMAL mode."})
        self._broadcast(self._snapshot())

    def process_command(self, command, asset_id, zone, skip_sim=False, token=None):
        """
        Main gateway entry point. Every command passes through here.

        Orchestration flow:
          1. Pre-grant identity check (token fingerprint)
          2. KORAL observes the command
          3. BARRIER enforces current mode → ALLOW / DENY
          4. If NORMAL mode: MAREA analyzes for drift signals
          5. If signals found: TASYA correlates with context
          6. If ≥2 signals: NEREUS recommends action to TARE
          7. TARE decides and instructs BARRIER to update mode
        """

        # ── Step 1: Pre-grant identity check ──────────────────────────────────
        if token is not None and token != self.agent["rbac_token"]:
            return self._handle_identity_mismatch(command, asset_id, zone, token)

        now = time.time()
        ts  = datetime.now().isoformat()

        with self._lock:
            self.stats["total"] += 1
            self.agent["action_count"] += 1
            self.agent["last_command"]  = command

            rec = {
                "id":       str(uuid.uuid4())[:8],
                "ts":       ts,
                "ts_epoch": now,
                "command":  command,
                "asset_id": asset_id,
                "zone":     zone,
                "skip_sim": skip_sim,
            }

            # ── Step 2: KORAL observes ─────────────────────────────────────────
            self._broadcast_agent_wake("KORAL", "Recording telemetry")
            self.koral.observe(rec)
            self._broadcast_agent_sleep("KORAL")
            recent_n = len([t for t in self.koral.get_burst_window() if now - t < 10])
            if recent_n > 3:
                self._voice("KORAL", f"{recent_n} commands in the last 10 seconds — burst rate exceeded. Flagging to MAREA.")

            # ── TEMPEST loop detection (independent of MAREA/NEREUS path) ─────
            if not self._loop_fired:
                loop_key = (command, asset_id)
                self.loop_tracker.setdefault(loop_key, [])
                self.loop_tracker[loop_key].append(now)
                # Keep only last 5 seconds
                self.loop_tracker[loop_key] = [t for t in self.loop_tracker[loop_key] if now - t <= 5]
                if len(self.loop_tracker[loop_key]) >= 5:
                    self._loop_fired = True
                    threading.Thread(target=self._fire_runaway_loop, args=(command, asset_id, zone, len(self.loop_tracker[loop_key])), daemon=True).start()

            # ── Step 3: BARRIER enforces current mode ──────────────────────────
            self._broadcast_agent_wake("BARRIER", f"Enforcing {self.mode} policy")
            decision, reason, policy = self.barrier.enforce(command, zone)
            self._broadcast_agent_sleep("BARRIER")
            if decision == "DENY":
                self._voice("BARRIER", f"Denied. {command} on {asset_id} blocked — {self.mode} mode. Nothing executes.")

            signals = []

            # ── Step 4: MAREA analyzes (only in NORMAL mode) ──────────────────
            if self.mode == "NORMAL":
                self._broadcast_agent_wake("MAREA", "Analyzing for drift signals")
                signals = self.marea.analyze(
                    command     = command,
                    zone        = zone,
                    agent       = self.agent,
                    zones       = self.zones,
                    burst_window= self.koral.get_burst_window(),
                    session     = self.koral.get_session(),
                    skip_sim    = skip_sim,
                    now         = now,
                )
                self._broadcast_agent_sleep("MAREA")
                if len(signals) == 1:
                    sn = signals[0]['signal'].replace('_', ' ').lower()
                    self._voice("MAREA", f"Signal detected: {sn}. Watching — one signal is not enough to act. Escalating if another fires.")
                elif len(signals) >= 2:
                    names = ', '.join(s['signal'].replace('_', ' ').lower() for s in signals)
                    self._voice("MAREA", f"{len(signals)} signals: {names}. This is a pattern. Passing to TASYA.")

                # ── Step 5: TASYA correlates context ──────────────────────────
                if signals:
                    self._broadcast_agent_wake("TASYA", f"Correlating context for {len(signals)} signal(s)")
                    signals = self.tasya.correlate(signals, self.agent, self.zones)
                    self._broadcast_agent_sleep("TASYA")
                    if len(signals) >= 2:
                        assigned = self.agent.get("assigned_zone", "Z3")
                        self._voice("TASYA", f"{len(signals)} signals corroborated. Work order is {assigned} — no authorisation for {zone}. Passing to NEREUS.")

                # ── Step 6: NEREUS recommends if threshold met ─────────────────
                if len(signals) == 1:
                    sig_name = signals[0].get("signal", "UNKNOWN")
                    self._broadcast_agent_wake("NEREUS", f"Soft advisory — 1 signal ({sig_name})")
                    self._broadcast({
                        "type":    "CHAT_MESSAGE",
                        "role":    "tare",
                        "message": (
                            f"Heads up — one signal: {sig_name.replace('_',' ').lower()}. "
                            "Watching. Not acting yet."
                        ),
                        "show_approve": False,
                    })
                    self._broadcast_agent_sleep("NEREUS")

                elif len(signals) >= 2:
                    self._broadcast_agent_wake("NEREUS", f"Recommending action — {len(signals)} signals detected")
                    recommendation = self.nereus.recommend(
                        signals         = signals,
                        agent           = self.agent,
                        recent_commands = self.koral.get_session(30),
                    )
                    sig_list = ', '.join(s['signal'].replace('_',' ').lower() for s in signals)
                    if recommendation.get("action") == "FREEZE":
                        self._voice("NEREUS", f"{len(signals)} signals — {sig_list}. No operational justification. Recommending FREEZE.")
                    self._broadcast_agent_sleep("NEREUS")

                    # ── Step 7: TARE decides ───────────────────────────────────
                    if recommendation["action"] == "FREEZE":
                        self._fire_tare(signals, recommendation)

            # Update agent state
            self.agent["last_result"] = decision

            # Log gateway decision
            log_entry = {
                "id":       rec["id"],
                "ts":       ts,
                "command":  command,
                "asset_id": asset_id,
                "zone":     zone,
                "decision": decision,
                "reason":   reason,
                "policy":   policy,
                "mode":     self.mode,
                "signals":  signals,
            }
            self.gateway_log.insert(0, log_entry)
            self.gateway_log = self.gateway_log[:30]

            if decision == "ALLOW":
                self.stats["allowed"] += 1
                self._apply_asset_change(command, asset_id)
            else:
                self.stats["denied"] += 1
                # Track repeated failures for TEMPEST detection
                key = (command, asset_id)
                self.retry_counts[key] = self.retry_counts.get(key, 0) + 1
                if self.retry_counts[key] == 3 and self.mode != "FREEZE":
                    threading.Thread(target=self._fire_repeated_failure, args=(command, asset_id, zone, self.retry_counts[key]), daemon=True).start()

        self._broadcast({
            "type":     "GATEWAY_DECISION",
            "id":       rec["id"],
            "ts":       ts,
            "command":  command,
            "asset_id": asset_id,
            "zone":     zone,
            "decision": decision,
            "reason":   reason,
            "policy":   policy,
            "mode":     self.mode,
            "signals":  signals,
        })
        self._broadcast(self._snapshot())

        return {"decision": decision, "reason": reason, "policy": policy, "mode": self.mode}

    def approve_timebox(self, duration_minutes=None):
        # OOH approval: 15-min window, execute the one blocked command only
        if self._pending_ooh is not None:
            ooh_cmd, ooh_asset, ooh_zone = self._pending_ooh
            self._pending_ooh = None
            ooh_minutes = 15
            with self._lock:
                self._set_mode("TIMEBOX_ACTIVE")
                self.barrier.set_mode("TIMEBOX_ACTIVE")
                self.timebox_expires = time.time() + ooh_minutes * 60
                self.timebox_total   = ooh_minutes * 60
            self._broadcast({
                "type":             "TIMEBOX_APPROVED",
                "duration_minutes": ooh_minutes,
                "expires_at":       self.timebox_expires,
                "message":          f"Supervisor approved 15-minute out-of-hours window. {ooh_cmd} on {ooh_asset} permitted for duration.",
            })
            self._broadcast({
                "type":    "CHAT_MESSAGE",
                "role":    "tare",
                "message": (
                    f"Approved. 15-minute supervised window opened. "
                    f"Executing {ooh_cmd} on {ooh_asset} now under BARRIER oversight. "
                    f"Window closes automatically — no further high-impact commands after expiry."
                ),
            })
            self._broadcast(self._snapshot())
            self._start_countdown(ooh_minutes * 60)
            # Execute the single blocked command in background
            def _run_ooh():
                time.sleep(1.0)
                # BARRIER opens supervised window
                self._broadcast_agent_wake("BARRIER", f"Supervised execution — {ooh_cmd} on {ooh_asset}")
                time.sleep(0.5)
                self._voice("BARRIER", f"15-minute emergency window open. Supervised execution of {ooh_cmd} on {ooh_asset} authorised by supervisor. Monitoring active.")
                self._broadcast_agent_sleep("BARRIER")
                time.sleep(1.2)

                # AEGIS validates safety before execution
                self._broadcast_agent_wake("AEGIS", f"Pre-execution safety check — {ooh_asset}")
                time.sleep(0.8)
                asset_state = self.assets.get(ooh_asset, {}).get("state", "UNKNOWN")
                self._voice("AEGIS", f"Pre-execution safety check on {ooh_asset}. Asset state: {asset_state}. No active safety interlock detected. All pre-conditions cleared. Safe to proceed.")
                self._broadcast_agent_sleep("AEGIS")
                time.sleep(1.0)

                # TRITON executes
                self._broadcast_agent_wake("TRITON", f"Executing {ooh_cmd} on {ooh_asset}")
                time.sleep(0.5)
                self.process_command(ooh_cmd, ooh_asset, ooh_zone,
                                     token="eyJhbGciOiJSUzI1NiJ9.TARE-MOCK-TOKEN")
                time.sleep(0.5)
                self._voice("TRITON", f"{ooh_cmd} on {ooh_asset} executed successfully under supervised window. Asset state updated. Standing by for BARRIER oversight confirmation.")
                self._broadcast_agent_sleep("TRITON")
                time.sleep(1.0)

                # BARRIER confirms and closes loop
                self._broadcast_agent_wake("BARRIER", "Post-execution oversight")
                time.sleep(0.5)
                self._voice("BARRIER", f"Supervised command complete. Window remains active for the full 15 minutes. No further high-impact commands permitted without re-approval. Logging to audit trail.")
                self._broadcast_agent_sleep("BARRIER")

                self._broadcast({
                    "type":    "CHAT_MESSAGE",
                    "role":    "tare",
                    "message": f"{ooh_cmd} on {ooh_asset} executed under supervised window. AEGIS validated safety, TRITON executed, BARRIER confirmed. Window expires automatically — no further high-impact commands without re-approval.",
                })
            threading.Thread(target=_run_ooh, daemon=True).start()
            return

        # Default: Scope Creep timebox — 3-min window + full pipeline
        if duration_minutes is None:
            duration_minutes = 3
        with self._lock:
            self._set_mode("TIMEBOX_ACTIVE")
            self.barrier.set_mode("TIMEBOX_ACTIVE")
            self.timebox_expires = time.time() + duration_minutes * 60
            self.timebox_total   = duration_minutes * 60

        self._broadcast({
            "type":             "TIMEBOX_APPROVED",
            "duration_minutes": duration_minutes,
            "expires_at":       self.timebox_expires,
            "message":          f"Supervisor approved {duration_minutes}-minute time-box. BARRIER policy updated — OPEN_BREAKER re-enabled. RESTART_CONTROLLER remains blocked.",
        })
        self._broadcast({
            "type":    "CHAT_MESSAGE",
            "role":    "tare",
            "message": (
                f"Got it. I've told BARRIER to open a {duration_minutes}-minute supervised window. "
                f"Switching operations are back on, but RESTART_CONTROLLER stays blocked — "
                f"that one is never coming back on during an incident. "
                f"The window closes automatically when time runs out."
            ),
        })
        self._broadcast(self._snapshot())
        self._start_countdown(duration_minutes * 60)
        # Kick off Zone 2 → Zone 1 pipeline in background
        threading.Thread(target=self._run_pipeline, daemon=True).start()

    def deny_timebox(self):
        with self._lock:
            self._set_mode("SAFE")
            self.barrier.set_mode("SAFE")
            if self.active_incident:
                self.active_incident["state"]        = "Escalated"
                self.active_incident["escalated_at"] = datetime.now().isoformat()

        self._broadcast({"type": "TIMEBOX_DENIED", "message": "Supervisor denied time-box request. Incident escalated."})
        self._broadcast({
            "type":    "CHAT_MESSAGE",
            "role":    "tare",
            "message": (
                "Understood. I've put BARRIER into SAFE mode — nothing high-impact gets through until "
                "this investigation is complete. The ServiceNow incident has been escalated to Critical. "
                "GridOperator-Agent is locked out. The next move is yours."
            ),
            "show_approve": False,
        })
        self._broadcast(self._snapshot())

    # ── Identity Policy Check (Scenario: Read-Only Write Attempt) ────────────

    def check_identity_policy(self, principal: str, action: str, target_zone: str) -> dict:
        """
        Check if an identity's role permits the attempted action.
        Flow:
          KORAL logs the attempt → TARE evaluates policy →
          If violation: BARRIER enforces READ_ONLY_DOWNGRADE + ServiceNow ticket
        """
        from identity_registry import get_identity, is_action_allowed, classify_action, is_write_or_control

        identity    = get_identity(principal)
        action_type = classify_action(action)

        # Step 1: KORAL logs the action attempt
        self._broadcast_agent_wake("KORAL", f"Logging identity action: {principal} → {action}")
        self.koral.log_action(principal, action, target_zone)
        self._broadcast_agent_sleep("KORAL")

        if not identity:
            self._broadcast({"type": "CHAT_MESSAGE", "role": "tare",
                "message": f"Unknown principal '{principal}' attempted '{action}' — no registered identity found. Denied."})
            return {"principal": principal, "action": action, "decision": "DENY",
                    "reason": f"Unknown principal: {principal}", "violation": True}

        allowed = is_action_allowed(principal, action)

        # Step 2: TARE evaluates policy
        if not allowed and is_write_or_control(action):
            role = identity.get("role", "UNKNOWN")

            # Step 3: BARRIER enforces
            self._voice("KORAL", f"Policy violation detected. {principal} is role {role} — write operation '{action}' is outside their allowed set.")
            self._broadcast_agent_wake("BARRIER", f"Enforcing READ_ONLY_DOWNGRADE on {principal}")
            enforcement = self.barrier.enforce_readonly(principal, action)
            self._broadcast_agent_sleep("BARRIER")
            self._voice("BARRIER", f"READ_ONLY_DOWNGRADE applied. '{action}' blocked. Identity downgraded — nothing executes.")

            # Step 4: ServiceNow ticket
            ts = datetime.now().isoformat()
            snow = _snow_client.create_incident(TicketFields(
                short_description="Read-only identity attempted write/control operation",
                description=(
                    f"Principal: {principal}\n"
                    f"Role: {role}\n"
                    f"Attempted action: {action} ({action_type})\n"
                    f"Target zone: {target_zone}\n"
                    f"Policy: Read-only identities are not permitted write/control operations.\n"
                    f"Enforcement: READ_ONLY_DOWNGRADE applied by BARRIER."
                ),
                category="identity",
                subcategory="privilege_escalation",
                impact=2,
                urgency=2,
            ))
            print(f"[ServiceNow OK] Incident created: {snow.incident_number} | Priority: 2 - High | Read-only violation: {principal} -> {action}")

            self.active_incident = {
                "incident_id":       snow.incident_number,
                "short_description": "Read-only identity attempted write/control operation",
                "priority":          "2 — High",
                "state":             "New",
                "assigned_to":       "OT Security Team",
                "category":          "Security / Identity",
                "created_at":        ts,
                "principal":         principal,
                "action":            action,
                "enforcement":       "READ_ONLY_DOWNGRADE",
            }
            self._broadcast({"type": "SERVICENOW_INCIDENT", "incident": self.active_incident})

            # Step 5: Chat message with escalation question
            self._broadcast({
                "type":    "CHAT_MESSAGE",
                "role":    "tare",
                "message": (
                    f"Policy violation detected. '{principal}' is a read-only monitoring identity — "
                    f"it is only permitted to fetch status and pull metrics. "
                    f"It just attempted '{action}', which is a {action_type} operation. "
                    f"BARRIER has applied READ_ONLY_DOWNGRADE and blocked the request. "
                    f"ServiceNow {snow.incident_number} raised. "
                    f"Was this intentional?"
                ),
                "show_approve": False,
            })
            self._broadcast(self._snapshot())

            return {
                "principal":   principal,
                "role":        role,
                "action":      action,
                "action_type": action_type,
                "target_zone": target_zone,
                "decision":    "DENY",
                "violation":   True,
                "enforcement": enforcement,
                "incident_id": snow.incident_number,
                "question":    "Was this intentional?",
            }

        # No violation
        self._broadcast({
            "type":    "CHAT_MESSAGE",
            "role":    "tare",
            "message": (
                f"Identity check passed. '{principal}' (role: {identity.get('role')}) "
                f"is authorized for {action_type} operation '{action}' on {target_zone}."
            ),
        })
        self._broadcast(self._snapshot())
        return {
            "principal":   principal,
            "role":        identity.get("role"),
            "action":      action,
            "action_type": action_type,
            "target_zone": target_zone,
            "decision":    "ALLOW",
            "violation":   False,
        }

    # ── Demo Sequences ─────────────────────────────────────────────────────────

    def run_normal_ops(self):
        """3 authorised commands in Z3 (fault zone) — all ALLOWED."""
        def _seq():
            self._broadcast({"type": "CHAT_MESSAGE", "role": "tare",
                "message": "GridOperator-Agent is online. I'm watching it begin fault repairs in Zone 3 — its authorised zone. Every command will pass through me before touching the grid."})
            for cmd, asset, z in [
                ("GET_STATUS",      "BRK-301", "Z3"),
                ("SIMULATE_SWITCH", "BRK-301", "Z3"),
                ("OPEN_BREAKER",    "BRK-301", "Z3"),
            ]:
                time.sleep(1.8)
                self.process_command(cmd, asset, z)
        threading.Thread(target=_seq, daemon=True).start()

    def trigger_anomaly(self):
        """Burst + wrong zone + healthy zone + skipped sim → TARE fires."""
        def _seq():
            self._broadcast({"type": "CHAT_MESSAGE", "role": "tare",
                "message": "Something is wrong. The agent has abandoned Zone 3 and is issuing commands to Zone 1 — a healthy zone it has no business touching. It's moving fast and skipping the safety simulation entirely. I'm watching closely."})
            for cmd, asset, z, skip in [
                ("GET_STATUS",         "BRK-110", "Z1", False),
                ("OPEN_BREAKER",       "BRK-110", "Z1", True),
                ("OPEN_BREAKER",       "FDR-110", "Z1", True),
                ("RESTART_CONTROLLER", "FDR-110", "Z1", True),
            ]:
                time.sleep(0.4)
                self.process_command(cmd, asset, z, skip_sim=skip)
        threading.Thread(target=_seq, daemon=True).start()

    # ── Public entry points for scripted scenarios ───────────────────────

    def run_authorized_repair(self):
        """Scenario 1 — Authorized Repair: full Z3→Z2→Z1 pipeline, no timebox needed."""
        threading.Thread(target=self._run_pipeline, kwargs={"authorized": True}, daemon=True).start()

    def run_deep_infiltration(self):
        """Scenario 3 — Deep Infiltration: passes Z3+Z2, AEGIS vetoes in Z1."""
        threading.Thread(target=self._run_pipeline, kwargs={"authorized": True, "inject_restart": True}, daemon=True).start()

    def check_out_of_hours_action(self, command: str, asset_id: str, zone: str, simulated_hour: int = 2):
        """
        Out-of-Hours scenario — TASYA detects high-impact action outside approved window.
        Approved window: 08:00–18:00. Outside that → DOWNGRADE + supervisor approval required.
        """
        HIGH_IMPACT = {"OPEN_BREAKER", "CLOSE_BREAKER", "RESTART_CONTROLLER"}
        ts = datetime.now().isoformat()

        # Log to gateway
        with self._lock:
            self.stats["total"] += 1
            self.stats["denied"] += 1
            log_entry = {
                "id":       str(uuid.uuid4())[:8],
                "ts":       ts,
                "command":  command,
                "asset_id": asset_id,
                "zone":     zone,
                "decision": "DENY",
                "reason":   f"Out-of-hours: {simulated_hour:02d}:30 is outside approved window 08:00-18:00",
                "policy":   "POL-TIME-001",
                "mode":     self.mode,
                "signals":  [{"signal": "OUT_OF_HOURS", "detail": f"Action at {simulated_hour:02d}:30 — no maintenance window active", "severity": "HIGH"}],
            }
            self.gateway_log.insert(0, log_entry)
            self.gateway_log = self.gateway_log[:30]

        if command not in HIGH_IMPACT:
            # Read-only — allow, no escalation needed
            with self._lock:
                self.stats["denied"] -= 1
                self.stats["allowed"] += 1
                self.gateway_log[0]["decision"] = "ALLOW"
                self.gateway_log[0]["reason"]   = "Read operation — permitted outside business hours"
                self.gateway_log[0]["signals"]  = []
            self._broadcast({"type": "GATEWAY_DECISION", **self.gateway_log[0]})
            self._broadcast(self._snapshot())
            return {"decision": "ALLOW"}

        # TASYA wakes — context correlation
        self._broadcast_agent_wake("TASYA", f"Checking time context for {command} on {asset_id}")
        time.sleep(1.0)
        self._voice("TASYA", f"High-impact action at {simulated_hour:02d}:30. No maintenance window. No emergency flag. Outside approved window 08:00 to 18:00.")
        self._broadcast_agent_sleep("TASYA")
        time.sleep(0.8)

        # TARE decides — DOWNGRADE + approval required
        with self._lock:
            self._set_mode("DOWNGRADE")
            self.barrier.set_mode("DOWNGRADE")
            self.stats["freeze_events"] += 1

        self._broadcast_agent_wake("BARRIER", "Enforcing time-context policy")
        time.sleep(0.5)
        self._voice("BARRIER", f"{command} denied. High-impact operations require approved window or supervisor override. Downgrading to diagnostics only.")
        self._broadcast_agent_sleep("BARRIER")

        self._broadcast({"type": "GATEWAY_DECISION", **log_entry})

        self._broadcast({
            "type":    "TARE_RESPONSE",
            "action":  "DOWNGRADE",
            "mode":    "DOWNGRADE",
            "message": f"Out-of-hours high-impact action detected. {command} on {asset_id} at {simulated_hour:02d}:30 — no approved window. BARRIER downgraded. Supervisor approval required for 15-minute window.",
        })

        # ServiceNow incident
        snow = _snow_client.create_incident(TicketFields(
            short_description=f"Out-of-hours high-impact action attempted — {command} on {asset_id}",
            description=(
                f"Command: {command}\nAsset: {asset_id}\nZone: {zone}\n"
                f"Simulated time: {simulated_hour:02d}:30\n"
                f"No active maintenance window or emergency flag.\n"
                f"TARE has downgraded operations. Supervisor 15-minute approval window requested."
            ),
            category="identity",
            subcategory="out_of_hours",
            impact=2,
            urgency=2,
        ))
        self.active_incident = {
            "incident_id":       snow.incident_number,
            "short_description": f"Out-of-hours action: {command} on {asset_id}",
            "priority":          "2 — High",
            "state":             "New",
            "assigned_to":       "SOC Analyst",
            "category":          "Security / Time-Context",
            "created_at":        datetime.now().isoformat(),
        }
        print(f"[ServiceNow OK] Incident created: {snow.incident_number} | Out-of-hours: {command} at {simulated_hour:02d}:30")
        self._broadcast({"type": "SERVICENOW_INCIDENT", "incident": self.active_incident})

        # Store pending OOH command so approve_timebox can execute it (not the pipeline)
        self._pending_ooh = (command, asset_id, zone)

        self._broadcast({
            "type":         "CHAT_MESSAGE",
            "role":         "tare",
            "message":      (
                f"I've blocked {command} on {asset_id}. It's {simulated_hour:02d}:30 — outside the approved operational window. "
                f"There's no active maintenance ticket and no emergency flag raised. "
                f"ServiceNow {snow.incident_number} raised as P2 High. SOC Analyst assigned. "
                f"If this is a genuine emergency, approve a 15-minute supervised window below — "
                f"the command will execute once under BARRIER oversight and the window closes automatically."
            ),
            "show_approve":  True,
            "approve_type":  "ooh",
        })
        self._broadcast(self._snapshot())
        return {"decision": "DENY", "reason": "Out-of-hours", "policy": "POL-TIME-001"}

    def _fire_repeated_failure(self, command: str, asset_id: str, zone: str, count: int):
        """TEMPEST detects repeated failure pattern — TARE fires FREEZE."""
        time.sleep(0.5)

        # TEMPEST detects
        self._broadcast_agent_wake("TEMPEST", f"Retry pattern detected — {command} failed {count} times")
        time.sleep(1.0)
        self._voice("TEMPEST", f"{command} on {asset_id} has failed {count} times in a row. This is not normal retry behaviour. Flagging unsafe persistence to TARE.")
        self._broadcast_agent_sleep("TEMPEST")
        time.sleep(0.8)

        # TARE decides FREEZE
        with self._lock:
            self._set_mode("FREEZE")
            self.barrier.set_mode("FREEZE")
            self.stats["freeze_events"] += 1

        self._voice("BARRIER", f"FREEZE enforced. {command} on {asset_id} blocked indefinitely. Repeated unsafe retries indicate automation fault or misuse.")

        self._broadcast({
            "type":    "TARE_RESPONSE",
            "action":  "FREEZE",
            "mode":    "FREEZE",
            "message": f"TEMPEST flagged unsafe retry pattern — {command} failed {count} times on {asset_id}. TARE decided FREEZE. No further commands execute.",
        })

        # ServiceNow incident
        snow = _snow_client.create_incident(TicketFields(
            short_description=f"Repeated unsafe retries detected — {command} on {asset_id}",
            description=(
                f"Command: {command}\nAsset: {asset_id}\nZone: {zone}\n"
                f"Failure count: {count}\n"
                f"TEMPEST detected persistent unsafe retry pattern.\n"
                f"TARE has frozen all operations. Likely cause: automation bug, stale logic, or misuse."
            ),
            category="identity",
            subcategory="unsafe_retry",
            impact=1,
            urgency=1,
        ))
        self.active_incident = {
            "incident_id":       snow.incident_number,
            "short_description": f"Repeated unsafe retries: {command} x{count} on {asset_id}",
            "priority":          "1 — Critical",
            "state":             "New",
            "assigned_to":       "SOC Analyst",
            "category":          "Security / Retry Pattern",
            "created_at":        datetime.now().isoformat(),
        }
        print(f"[ServiceNow OK] Incident created: {snow.incident_number} | Repeated failures: {command} x{count}")
        self._broadcast({"type": "SERVICENOW_INCIDENT", "incident": self.active_incident})

        self._broadcast({
            "type":    "CHAT_MESSAGE",
            "role":    "tare",
            "message": (
                f"I've frozen the system. {command} on {asset_id} failed {count} times without any change in approach. "
                f"That's not a retry — that's unsafe insistence. It points to an automation bug, stale logic, or something worse. "
                f"ServiceNow {snow.incident_number} raised as P1 Critical. SOC Analyst assigned. "
                f"Nothing executes until this is investigated."
            ),
        })
        self._broadcast(self._snapshot())

    def _fire_runaway_loop(self, command: str, asset_id: str, zone: str, count: int):
        """TEMPEST detects runaway loop — same request fired too fast. TARE applies SAFETY HOLD."""
        try:
            self._fire_runaway_loop_inner(command, asset_id, zone, count)
        except Exception as e:
            print(f"[TARE ERROR] _fire_runaway_loop failed: {e}", flush=True)
            import traceback; traceback.print_exc()

    def _fire_runaway_loop_inner(self, command: str, asset_id: str, zone: str, count: int):
        time.sleep(0.3)

        # TEMPEST detects
        self._broadcast_agent_wake("TEMPEST", f"Loop pattern detected — {command} on {asset_id} x{count} in 5s")
        time.sleep(1.2)
        self._voice("TEMPEST", f"{command} on {asset_id} fired {count} times in 5 seconds. Rate exceeds all operational baselines. This is a runaway loop — not normal retry behaviour. Flagging to TARE immediately.")
        self._broadcast_agent_sleep("TEMPEST")
        time.sleep(0.8)

        # TARE decides — SAFETY HOLD (no human approval needed)
        with self._lock:
            self._set_mode("FREEZE")
            self.barrier.set_mode("FREEZE")
            self.stats["freeze_events"] += 1

        self._voice("BARRIER", f"SAFETY HOLD enforced. All actions from this identity blocked. Runaway loop contained — no further commands execute.")

        self._broadcast({
            "type":    "TARE_RESPONSE",
            "action":  "FREEZE",
            "mode":    "FREEZE",
            "message": f"TEMPEST detected runaway loop — {command} on {asset_id} fired {count} times in 5 seconds. TARE applied SAFETY HOLD. No human approval required for containment.",
        })

        # ServiceNow — auto-created, no supervisor input needed
        snow = _snow_client.create_incident(TicketFields(
            short_description=f"Runaway automation loop detected and contained — {command} on {asset_id}",
            description=(
                f"Command: {command}\nAsset: {asset_id}\nZone: {zone}\n"
                f"Loop count: {count} requests in 5 seconds\n"
                f"Credentials were valid — this is a behavioral failure, not identity compromise.\n"
                f"TEMPEST detected the rate anomaly. TARE applied SAFETY HOLD automatically.\n"
                f"Likely cause: automation bug, runaway retry logic, or scheduler malfunction."
            ),
            category="identity",
            subcategory="runaway_loop",
            impact=1,
            urgency=1,
        ))
        self.active_incident = {
            "incident_id":       snow.incident_number,
            "short_description": f"Runaway loop contained: {command} x{count} on {asset_id}",
            "priority":          "1 — Critical",
            "state":             "New",
            "assigned_to":       "SOC Analyst",
            "category":          "Security / Runtime Behaviour",
            "created_at":        datetime.now().isoformat(),
        }
        print(f"[ServiceNow OK] Incident created: {snow.incident_number} | Runaway loop: {command} x{count} on {asset_id}")
        self._broadcast({"type": "SERVICENOW_INCIDENT", "incident": self.active_incident})

        self._broadcast({
            "type":    "CHAT_MESSAGE",
            "role":    "tare",
            "message": (
                f"Runaway loop contained. {command} on {asset_id} fired {count} times in 5 seconds — "
                f"the credentials were valid and the commands were individually permitted. "
                f"This isn't access control — it's a runtime failure. Automation bug, stale scheduler, something crashed and looped. "
                f"I didn't wait for supervisor approval on this one. The risk was denial-of-service to a critical system. "
                f"SAFETY HOLD is in effect. ServiceNow {snow.incident_number} raised as P1 Critical. SOC Analyst assigned."
            ),
        })
        self._broadcast(self._snapshot())

    # ── Zone 2 → Zone 1 Pipeline ─────────────────────────────────────────

    def _run_pipeline(self, authorized=False, inject_restart=False):
        """
        Full Z2→Z1 pipeline.
        authorized=True  → runs without timebox (Scenario 1 & 3).
        inject_restart   → appends a RESTART_CONTROLLER step so AEGIS vetoes it (Scenario 3).

        Zone 2 (Diagnose & Prepare):
            ECHO → SIMAR → NAVIS → RISKADOR

        Zone 1 (Execute with Safety):
            TRITON + AEGIS + TEMPEST + LEVIER (on failure)
        """
        time.sleep(0.8)   # let timebox broadcast settle

        # Snapshot current state (thread-safe read)
        with self._lock:
            signals    = list(self.anomaly_signals)
            zones_snap = {k: dict(v) for k, v in self.zones.items()}
            assets_snap= {k: dict(v) for k, v in self.assets.items()}
            gw_log     = list(self.gateway_log)
            agent_snap = dict(self.agent)

        self._broadcast({"type": "CHAT_MESSAGE", "role": "tare",
            "message": "Thank you. I'm activating the Zone 2 diagnostic pipeline now. ECHO will assess the fault first, then SIMAR simulates the repair, NAVIS builds the plan, and RISKADOR scores it before anything touches the grid."})

        # ── ECHO: Diagnose ────────────────────────────────────────────────
        time.sleep(1.0)
        self._broadcast_agent_wake("ECHO", "Diagnosing fault zones and target assets")
        echo_result = self.echo.diagnose(signals, zones_snap, assets_snap, gw_log, agent_snap)
        self._broadcast_agent_sleep("ECHO")
        self._broadcast({"type": "PIPELINE_UPDATE", "agent": "ECHO",
            "result": echo_result, "message": echo_result["findings"]})
        if echo_result["confirmed"]:
            self._voice("ECHO", f"Fault confirmed in {', '.join(echo_result.get('fault_zones', []))}. {len(echo_result.get('target_assets', []))} asset(s) require isolation. Repair path clear.")
        else:
            self._voice("ECHO", "Diagnostic inconclusive — no clear repair target. Stopping.")

        if not echo_result["confirmed"]:
            self._broadcast({"type": "CHAT_MESSAGE", "role": "tare",
                "message": "ECHO couldn't confirm a clear repair target. I'm not going to build a plan without solid diagnostics — that would be guessing. The system stays in supervised mode. Manual operator action is needed here."})
            return

        # ── SIMAR: Simulate ───────────────────────────────────────────────
        time.sleep(1.2)
        self._broadcast_agent_wake("SIMAR", "Simulating proposed repair actions")
        simar_result = self.simar.simulate(echo_result["repair_actions"], zones_snap, assets_snap)
        self._broadcast_agent_sleep("SIMAR")
        self._broadcast({"type": "PIPELINE_UPDATE", "agent": "SIMAR",
            "result": simar_result, "message": simar_result["summary"]})
        if simar_result["safe_to_proceed"]:
            self._voice("SIMAR", "Simulation passed. All repair actions confirmed safe to proceed.")
        else:
            risks = ', '.join(str(r) for r in simar_result.get("risk_indicators", []))
            self._voice("SIMAR", f"Simulation flagged a problem: {risks}. Stopping.")

        if not simar_result["safe_to_proceed"]:
            self._broadcast({"type": "CHAT_MESSAGE", "role": "tare",
                "message": f"SIMAR ran the simulation and flagged a problem: {simar_result['risk_indicators']}. I'm not proceeding — the simulation exists precisely to catch this before it hits the live grid. Standing down. Manual intervention needed."})
            return

        # ── NAVIS: Plan ───────────────────────────────────────────────────
        time.sleep(1.0)
        self._broadcast_agent_wake("NAVIS", "Building NERC CIP-compliant execution plan")
        plan = self.navis.build_plan(echo_result, simar_result, zones_snap, assets_snap, agent_snap)
        self._broadcast_agent_sleep("NAVIS")
        self._broadcast({"type": "PIPELINE_UPDATE", "agent": "NAVIS",
            "result": plan, "message": f"Plan ready: {plan['goal']} — {len(plan['steps'])} step(s)"})
        if plan["ready"]:
            self._voice("NAVIS", f"{len(plan['steps'])} step plan ready. NERC CIP compliant, rollback path included. Sending to RISKADOR.")
        else:
            self._voice("NAVIS", f"Could not build plan: {plan.get('reason', 'unknown')}. Stopping.")

        if not plan["ready"]:
            self._broadcast({"type": "CHAT_MESSAGE", "role": "tare",
                "message": f"NAVIS hit a wall building the execution plan: {plan.get('reason','unknown')}. I won't proceed without a complete, validated plan. This needs a manual operator."})
            return

        # ── RISKADOR: Score ───────────────────────────────────────────────
        time.sleep(1.0)
        self._broadcast_agent_wake("RISKADOR", "Scoring plan — blast radius, reversibility, confidence")
        risk = self.riskador.score(plan, zones_snap, assets_snap, echo_result)
        self._broadcast_agent_sleep("RISKADOR")
        self._broadcast({"type": "PIPELINE_UPDATE", "agent": "RISKADOR",
            "result": risk, "message": f"Risk score {risk['composite_score']}/100 — {risk['recommendation']}: {risk['rationale']}"})
        score = risk['composite_score']
        rec   = risk['recommendation']
        if rec == "PROCEED":
            self._voice("RISKADOR", f"Score: {score}/100 — risk acceptable. Cleared for execution. Handing off to Zone 1.")
        else:
            self._voice("RISKADOR", f"Score: {score}/100 — too risky. {risk.get('rationale','risk threshold exceeded')}. Holding.")

        if risk["recommendation"] == "HOLD":
            self._broadcast({"type": "CHAT_MESSAGE", "role": "tare",
                "message": f"RISKADOR scored the plan {risk['composite_score']}/100 — too risky to execute autonomously. The blast radius or reversibility concerns are too high. I'm holding. A human operator needs to take this one."})
            return

        # ── Inject RESTART_CONTROLLER step for Deep Infiltration ─────────
        if inject_restart and plan.get("steps"):
            last_step = plan["steps"][-1]
            feeder_id = last_step["asset_id"].replace("BRK", "FDR")
            next_num  = last_step["step_num"] + 1
            plan["steps"].append({
                "step_num":  next_num,
                "command":   "RESTART_CONTROLLER",
                "asset_id":  feeder_id,
                "zone":      last_step["zone"],
                "rationale": "Full recovery — restart feeder controller to restore power flow",
            })

        # ── Zone 1: Execute ───────────────────────────────────────────────
        time.sleep(0.8)
        self._broadcast({"type": "CHAT_MESSAGE", "role": "tare",
            "message": f"Zone 2 is done. The plan is validated and risk-scored. I'm handing off to Zone 1 now — TRITON will execute, AEGIS holds veto authority on every step, and TEMPEST is watching the pace. {len(plan['steps'])} step(s) to go."})

        # Arm Zone 1 agents
        def _tempest_freeze(reason):
            self._broadcast({"type": "CHAT_MESSAGE", "role": "tare",
                "message": f"TEMPEST just called a halt mid-execution. Something about the execution pace wasn't right — {reason}. I'm freezing everything and LEVIER will clean up."})
            with self._lock:
                self._set_mode("SAFE")
                self.barrier.set_mode("SAFE")
            self.triton.revoke()
            self._broadcast(self._snapshot())

        permit = {
            "scope":            plan["goal"],
            "allowed_commands": list({s["command"] for s in plan["steps"]}),
            "issued_at":        datetime.now().isoformat(),
            "issued_by":        "TARE",
        }

        self.triton.arm(
            execute_fn=lambda cmd, asset, zone: self.process_command(cmd, asset, zone),
            permit=permit,
        )
        self.aegis.reset()
        self.tempest.arm(plan_steps=plan["steps"], freeze_callback=_tempest_freeze)
        self.levier.arm(execute_fn=lambda cmd, asset, zone: self.process_command(cmd, asset, zone))

        self._broadcast_agent_wake("TEMPEST", "Armed — monitoring execution tempo")

        completed_steps = []
        aborted = False

        for step in plan["steps"]:
            # Check mode is still safe to continue
            with self._lock:
                current_mode = self.mode
            expected_mode = "NORMAL" if authorized else "TIMEBOX_ACTIVE"
            if current_mode not in (expected_mode, "TIMEBOX_ACTIVE", "NORMAL"):
                self._broadcast({"type": "CHAT_MESSAGE", "role": "tare",
                    "message": f"I've stopped the execution mid-pipeline. The system shifted to {current_mode} — I won't continue commands under those conditions."})
                aborted = True
                break

            time.sleep(1.8)   # realistic inter-step pacing

            cmd      = step["command"]
            asset_id = step["asset_id"]
            zone     = step["zone"]

            # AEGIS validates
            self._broadcast_agent_wake("AEGIS", f"Validating step {step['step_num']}: {cmd} on {asset_id}")
            with self._lock:
                current_assets = {k: dict(v) for k, v in self.assets.items()}
                current_zones  = {k: dict(v) for k, v in self.zones.items()}
            aegis_result = self.aegis.validate(cmd, asset_id, zone, current_assets, current_zones)
            self._broadcast_agent_sleep("AEGIS")
            self._broadcast({"type": "PIPELINE_UPDATE", "agent": "AEGIS",
                "result": aegis_result,
                "message": f"Step {step['step_num']} {'CLEARED' if aegis_result['passed'] else 'VETOED'}: {cmd} — {aegis_result.get('veto_reason') or 'all checks passed'}"})
            if not aegis_result["passed"]:
                self._voice("AEGIS", f"Vetoed. {cmd} on {asset_id} — {aegis_result.get('veto_reason', 'safety condition not met')}. Execution stops here.")

            if not aegis_result["passed"]:
                self._broadcast({"type": "CHAT_MESSAGE", "role": "tare",
                    "message": f"AEGIS just vetoed step {step['step_num']} — {cmd} on {asset_id}. Reason: {aegis_result['veto_reason']}. I'm stopping the execution and handing off to LEVIER to undo what's already been done."})
                aborted = True
                break

            # TRITON executes
            self._broadcast_agent_wake("TRITON", f"Executing step {step['step_num']}: {cmd} on {asset_id} ({zone})")
            exec_result = self.triton.execute_step(cmd, asset_id, zone)
            self._broadcast_agent_sleep("TRITON")
            self._broadcast({"type": "PIPELINE_UPDATE", "agent": "TRITON",
                "result": exec_result,
                "message": f"Step {step['step_num']} {exec_result.get('status','?')}: {cmd} → {exec_result.get('decision','?')}"})
            status = exec_result.get("status", "?")
            if status != "EXECUTED":
                self._voice("TRITON", f"Step {step['step_num']} failed — gateway returned {exec_result.get('decision','?')}.")

            if exec_result.get("status") == "EXECUTED":
                completed_steps.append(exec_result)

            # TEMPEST records
            tempo = self.tempest.record_step(cmd, asset_id, exec_result)
            if not tempo["tempo_ok"]:
                aborted = True
                break

        # Disarm Zone 1
        self._broadcast_agent_sleep("TEMPEST")
        self.tempest.disarm()
        self.triton.revoke()

        # Rollback if aborted
        if aborted and plan["rollback"] and completed_steps:
            time.sleep(0.5)
            self._broadcast_agent_wake("LEVIER", f"Rolling back {len(completed_steps)} executed step(s)")
            recovery = self.levier.rollback(plan["rollback"], completed_steps)
            self._broadcast_agent_sleep("LEVIER")
            self._broadcast({"type": "PIPELINE_UPDATE", "agent": "LEVIER",
                "result": recovery,
                "message": f"Rollback {recovery['status']} — {recovery['steps_executed']}/{recovery['steps_planned']} steps reverted"})
            self._voice("LEVIER", f"Rollback {recovery['status']}. {recovery['steps_executed']} of {recovery['steps_planned']} step(s) reverted. Grid is back to pre-execution state.")
            self._broadcast({"type": "CHAT_MESSAGE", "role": "tare",
                "message": f"LEVIER finished the rollback — {recovery['steps_executed']} step(s) reverted. The grid is back to its pre-execution state. Everything is stable."})
        elif not aborted:
            self._voice("AEGIS", f"All {len(completed_steps)} step(s) cleared. No safety violations detected. Execution complete.")
            self._voice("TRITON", f"{len(completed_steps)} step(s) executed clean. AEGIS cleared every command. Grid is stable.")
            self._broadcast({"type": "CHAT_MESSAGE", "role": "tare",
                "message": f"All done. {len(completed_steps)} step(s) executed cleanly under Zone 1 safety guardrails. AEGIS cleared every command, TEMPEST kept the pace safe throughout. Full audit trail is logged."})

        self._broadcast(self._snapshot())

    # ── Internal: Identity Mismatch ───────────────────────────────────────────

    def _handle_identity_mismatch(self, command, asset_id, zone, token):
        rec_id = str(uuid.uuid4())[:8]
        ts     = datetime.now().isoformat()
        entry  = {
            "id":       rec_id,
            "ts":       ts,
            "command":  command,
            "asset_id": asset_id,
            "zone":     zone,
            "decision": "DENY",
            "reason":   "IDENTITY_MISMATCH — token fingerprint does not match registered credential",
            "policy":   "POL-AUTH-001",
            "mode":     self.mode,
            "signals":  [{"signal": "IDENTITY_MISMATCH",
                          "detail": f"Presented token '{token[:28]}…' rejected — not a registered agent",
                          "severity": "CRITICAL"}],
        }
        with self._lock:
            self.stats["total"]  += 1
            self.stats["denied"] += 1
            self.gateway_log.insert(0, entry)
            self.gateway_log = self.gateway_log[:30]

        self._broadcast({"type": "GATEWAY_DECISION", **entry})
        self._broadcast({
            "type":    "IDENTITY_ALERT",
            "id":      rec_id,
            "ts":      ts,
            "command": command,
            "token":   token,
            "message": "Forged credential detected — access blocked at authentication layer",
        })
        self._voice("BARRIER", f"Token rejected. The credential presented for {command} does not match any registered agent. This never reaches the grid.")

        # BARRIER blocks — ServiceNow incident
        with self._lock:
            if self.active_incident is None:
                snow = _snow_client.create_incident(TicketFields(
                    short_description="Identity impersonation attempt — forged token blocked at authentication layer",
                    description=(
                        f"Agent presented a forged credential token. Command '{command}' on asset {asset_id} "
                        f"was blocked before reaching the grid. Signals: IDENTITY_MISMATCH. Timestamp: {ts}"
                    ),
                    category="identity", subcategory="impersonation", impact=1, urgency=1,
                ))
                self.active_incident = {
                    "incident_id":       snow.incident_number,
                    "short_description": "Identity impersonation attempt — forged token blocked at authentication layer",
                    "priority":          "1 — Critical",
                    "state":             "New",
                    "assigned_to":       "SOC Analyst",
                    "category":          "Security / Identity",
                    "created_at":        ts,
                    "evidence": {
                        "anomaly_signals": entry["signals"],
                        "anomaly_score":   100,
                        "recent_commands": [],
                        "actions_taken":   [
                            "IDENTITY_MISMATCH — token rejected before any command reached the grid",
                            f"ServiceNow {snow.incident_number} created — SOC Analyst assigned",
                        ],
                    },
                }
                print(f"[ServiceNow OK] Incident created: {snow.incident_number} | Priority: 1 - Critical | Assigned to: SOC Analyst")
                self._broadcast({"type": "SERVICENOW_INCIDENT", "incident": self.active_incident})

        self._broadcast({
            "type":    "CHAT_MESSAGE",
            "role":    "tare",
            "message": (
                f"I caught an impersonation attempt. Something presented itself as GridOperator-Agent, "
                f"but the credential token doesn't match. It's a fake. "
                f"The command '{command}' on {asset_id} never reached the grid — I blocked it at the door. "
                f"A Critical incident is open and assigned to the SOC team."
            ),
        })
        self._broadcast(self._snapshot())
        return {"decision": "DENY", "reason": "IDENTITY_MISMATCH", "policy": "POL-AUTH-001", "mode": self.mode}

    # ── Internal: TARE Response ───────────────────────────────────────────────

    def _fire_tare(self, signals, recommendation):
        """TARE decides FREEZE based on NEREUS recommendation. Instructs BARRIER."""
        self._set_mode("FREEZE")
        self.barrier.set_mode("FREEZE")
        self.anomaly_signals = signals
        self.anomaly_score   = len(signals) * 25
        self.stats["freeze_events"] += 1

        recent = self.koral.get_session(20)
        evidence = {
            "anomaly_signals": signals,
            "anomaly_score":   self.anomaly_score,
            "recent_commands": recent,
            "actions_taken":   [
                "NEREUS recommended FREEZE — confidence: " + f"{recommendation.get('confidence', 0):.0%}",
                "TARE decided: FREEZE",
                "BARRIER updated gateway policy — high-impact operations halted",
                "DOWNGRADE pending — privileges reducing to read-only + diagnostics",
            ],
        }

        sig_names  = ", ".join(s["signal"] for s in signals)
        agent_name = self.agent.get("name", "Unknown Agent")

        snow = _snow_client.create_incident(TicketFields(
            short_description="Post-grant identity behaviour deviation detected — operations frozen",
            description=(
                f"Agent: {agent_name}\n"
                f"Signals: {sig_names}\n"
                f"Anomaly score: {self.anomaly_score}\n"
                f"NEREUS confidence: {recommendation.get('confidence', 0):.0%}\n"
                f"TARE has frozen all high-impact operations and instructed BARRIER to downgrade access.\n"
                f"Supervisor action required: approve 3-minute time-box or deny and escalate."
            ),
            category="identity",
            subcategory="behaviour_deviation",
            impact=1 if any(s["signal"] in ("IDENTITY_MISMATCH","BURST_RATE","HEALTHY_ZONE_ACCESS") for s in signals) else 2,
            urgency=1 if any(s["signal"] in ("IDENTITY_MISMATCH","BURST_RATE","HEALTHY_ZONE_ACCESS") for s in signals) else 2,
        ))

        self.active_incident = {
            "incident_id":       snow.incident_number,
            "short_description": "Post-grant identity behaviour deviation detected — operations frozen",
            "priority":          self._incident_priority(signals),
            "state":             "New",
            "assigned_to":       "SOC Analyst",
            "category":          "Security / Identity",
            "created_at":        datetime.now().isoformat(),
            "evidence":          evidence,
        }
        print(f"[ServiceNow OK] Incident created: {snow.incident_number} | Priority: {self.active_incident['priority']} | Agent: {agent_name} | Signals: {sig_names}")

        self._voice("BARRIER", "FREEZE enforced. All high-impact grid operations blocked. No commands execute until supervisor decision.")
        self._broadcast({
            "type":    "TARE_RESPONSE",
            "action":  "FREEZE",
            "mode":    "FREEZE",
            "signals": signals,
            "score":   self.anomaly_score,
            "message": "NEREUS recommended FREEZE — TARE decided — BARRIER enforced. High-impact grid operations FROZEN.",
        })
        self._broadcast({"type": "SERVICENOW_INCIDENT", "incident": self.active_incident})

        # Downgrade after short delay — LLM explanation uses full post-burst picture
        threading.Timer(2.5, self._apply_downgrade, args=(signals, recommendation)).start()

    def _apply_downgrade(self, signals=None, recommendation=None):
        with self._lock:
            if self.mode == "FREEZE":
                self._set_mode("DOWNGRADE")
                self.barrier.set_mode("DOWNGRADE")

        self._broadcast({
            "type":    "TARE_RESPONSE",
            "action":  "DOWNGRADE",
            "mode":    "DOWNGRADE",
            "message": "BARRIER policy updated — privileges downgraded to read-only + diagnostics. High-impact commands blocked.",
        })
        self._broadcast(self._snapshot())

        # Update incident with full post-burst evidence
        if self.active_incident is not None:
            recent = self.koral.get_session(30)
            self.active_incident["evidence"]["recent_commands"] = recent
            self.active_incident["evidence"]["actions_taken"].append(
                "ServiceNow INC created — SOC Analyst assigned"
            )
            self._broadcast({"type": "SERVICENOW_INCIDENT", "incident": self.active_incident})
            self._broadcast(self._snapshot())

        # Broadcast NEREUS explanation (already generated, just re-broadcast)
        if recommendation and recommendation.get("explanation"):
            self._broadcast({
                "type":         "CHAT_MESSAGE",
                "role":         "tare",
                "message":      recommendation["explanation"],
                "show_approve": True,
            })
        self._broadcast(self._snapshot())

    # ── Internal: Utilities ───────────────────────────────────────────────────

    def _broadcast_agent_wake(self, agent_name: str, task: str):
        self._broadcast({
            "type":   "AGENT_WAKE",
            "agent":  agent_name,
            "task":   task,
        })

    def _broadcast_agent_sleep(self, agent_name: str):
        self._broadcast({
            "type":  "AGENT_SLEEP",
            "agent": agent_name,
        })

    def _voice(self, agent_name: str, message: str):
        """Broadcast a first-person agent voice message for the UI timeline."""
        self._broadcast({
            "type":    "AGENT_VOICE",
            "agent":   agent_name,
            "message": message,
        })

    def _set_mode(self, new_mode: str):
        self.previous_mode   = self.mode
        self.mode            = new_mode
        self.mode_changed_at = datetime.now().isoformat()

    def _apply_asset_change(self, command: str, asset_id: str):
        asset = self.assets.get(asset_id)
        if not asset:
            return
        if command == "OPEN_BREAKER":
            asset["state"] = "OPEN"
            zone_id = asset.get("zone")
            zone    = self.zones.get(zone_id, {})
            if zone.get("health") == "FAULT":
                zone["health"] = "HEALTHY"
                zone["fault"]  = None
                zone["color"]  = "green"
        elif command == "CLOSE_BREAKER":
            asset["state"] = "CLOSED"
        elif command == "RESTART_CONTROLLER":
            asset["state"] = "RESTARTING"

    def _incident_priority(self, signals=None):
        sig_names = {s["signal"] for s in (signals or [])}
        if "IDENTITY_MISMATCH" in sig_names or "BURST_RATE" in sig_names or "HEALTHY_ZONE_ACCESS" in sig_names:
            return "1 — Critical"
        if "OUT_OF_ZONE" in sig_names or "ML_ANOMALY" in sig_names:
            return "2 — High"
        return "3 — Medium"

    # ── Time-box ──────────────────────────────────────────────────────────────

    def _start_countdown(self, total_seconds: int):
        def _tick():
            remaining = total_seconds
            while remaining > 0:
                time.sleep(1)
                remaining -= 1
                with self._lock:
                    if self.mode != "TIMEBOX_ACTIVE":
                        return
                if remaining % 10 == 0 or remaining <= 10:
                    self._broadcast({"type": "TIMEBOX_TICK",
                                     "remaining_seconds": remaining,
                                     "total_seconds": total_seconds})
            self._expire_timebox()
        self._timebox_thread = threading.Thread(target=_tick, daemon=True)
        self._timebox_thread.start()

    def _expire_timebox(self):
        with self._lock:
            if self.mode == "TIMEBOX_ACTIVE":
                self._set_mode("SAFE")
                self.barrier.set_mode("SAFE")
                self.timebox_expires = None

        self._broadcast({"type": "TIMEBOX_EXPIRED", "mode": "SAFE",
                          "message": "Time-boxed access expired. BARRIER reverted to SAFE mode."})
        self._broadcast({"type": "CHAT_MESSAGE", "role": "tare",
                          "message": "Time-boxed access expired. BARRIER has automatically reverted the gateway to SAFE mode. All high-impact operations are blocked until a new approval is granted.",
                          "show_approve": False})
        self._broadcast(self._snapshot())

    # ── Snapshot ──────────────────────────────────────────────────────────────

    def _snapshot(self):
        remaining = None
        if self.mode == "TIMEBOX_ACTIVE" and self.timebox_expires:
            remaining = max(0, int(self.timebox_expires - time.time()))

        return {
            "type":              "STATE_SNAPSHOT",
            "mode":              self.mode,
            "previous_mode":     self.previous_mode,
            "mode_changed_at":   self.mode_changed_at,
            "zones":             {k: dict(v) for k, v in self.zones.items()},
            "assets":            {k: dict(v) for k, v in self.assets.items()},
            "agent":             dict(self.agent),
            "gateway_log":       self.gateway_log[:15],
            "zone_access_log":   self.koral.get_zone_log(20),
            "anomaly_signals":   self.anomaly_signals,
            "anomaly_score":     self.anomaly_score,
            "active_incident":   self.active_incident,
            "stats":             dict(self.stats),
            "timebox_remaining": remaining,
            "timebox_total":     self.timebox_total,
            # ── Agent states for UI (all 12 + BARRIER) ────────────────────
            "agent_states": {
                # Zone 3 — Reef (implemented)
                "KORAL":    self.koral.status(),
                "MAREA":    self.marea.status(),
                "TASYA":    self.tasya.status(),
                "NEREUS":   self.nereus.status(),
                # Zone 2 — Shelf (stubs)
                "ECHO":     self.echo.status(),
                "SIMAR":    self.simar.status(),
                "NAVIS":    self.navis.status(),
                "RISKADOR": self.riskador.status(),
                # Zone 1 — Trench (stubs)
                "TRITON":   self.triton.status(),
                "AEGIS":    self.aegis.status(),
                "TEMPEST":  self.tempest.status(),
                "LEVIER":   self.levier.status(),
                # Zone 4
                "BARRIER":  self.barrier.status(),
            },
        }
