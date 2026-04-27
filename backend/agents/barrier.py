"""
BARRIER — Policy Enforcement Agent (Zone 4)

The only agent that can ALLOW or DENY commands at the gateway.
TARE decides what mode to set. BARRIER enforces it — no interpretation, no judgment.

TARE instructs: barrier.set_mode("FREEZE")
Gateway calls:  barrier.enforce(command, zone) → (ALLOW/DENY, reason, policy_id)

Identity enforcement:
  barrier.enforce_readonly(principal, action) → blocks read-only identity that attempted write

Never analyzes behavior. Never creates incidents. Only enforces the mode it is given.
"""
from datetime import datetime

READ_ONLY   = {"GET_STATUS"}
DIAG_CMDS   = {"SIMULATE_SWITCH"}
HIGH_IMPACT = {"OPEN_BREAKER", "CLOSE_BREAKER", "RESTART_CONTROLLER", "EMERGENCY_SHUTDOWN"}


class BARRIER:
    NAME = "BARRIER"
    ZONE = "Zone 4"
    ROLE = "Policy Enforcement Agent"
    DESCRIPTION = "Enforces TARE's mode decisions at the command gateway. The sole ALLOW/DENY authority."

    def __init__(self):
        self._mode               = "NORMAL"
        self._active             = False
        self._blocked_identities = set()    # principals blocked due to role violation
        self._enforcement_log    = []       # identity enforcement history

    # ── Public API ─────────────────────────────────────────────────────────────

    @property
    def active(self) -> bool:
        return self._active

    @property
    def mode(self) -> str:
        return self._mode

    def set_mode(self, mode: str) -> None:
        """
        TARE instructs BARRIER to change its enforcement mode.
        Instantly takes effect — all subsequent enforce() calls use the new mode.
        """
        self._mode = mode

    def enforce(self, command: str, zone: str = None) -> tuple:
        """
        Evaluate a command against the current enforcement mode.
        Returns (decision, reason, policy_id).
        Wakes on call, sleeps immediately after returning.
        """
        self._active = True
        result       = self._evaluate(command, zone)
        self._active = False
        return result

    def enforce_readonly(self, principal: str, action: str) -> dict:
        """
        Block a read-only identity that attempted a write/control action.
        Adds the principal to the blocked set and logs the enforcement.
        """
        self._active = True
        self._blocked_identities.add(principal)
        result = {
            "principal":   principal,
            "action":      action,
            "decision":    "DENY",
            "enforcement": "READ_ONLY_DOWNGRADE",
            "reason":      (f"Identity '{principal}' is read-only. "
                            f"Write/control operation '{action}' is not permitted."),
            "policy_id":   "POL-IDENTITY-001",
            "timestamp":   datetime.now().isoformat(),
        }
        self._enforcement_log.append(result)
        self._active = False
        return result

    def is_blocked(self, principal: str) -> bool:
        """Return True if the principal has been blocked due to a role violation."""
        return principal in self._blocked_identities

    def get_enforcement_log(self, n: int = 20) -> list:
        """Return last N identity enforcement log entries."""
        return self._enforcement_log[-n:]

    def reset(self) -> None:
        self._mode               = "NORMAL"
        self._blocked_identities = set()
        self._enforcement_log    = []

    # ── Enforcement Logic ──────────────────────────────────────────────────────

    def _evaluate(self, command: str, zone: str) -> tuple:
        m = self._mode

        if m == "NORMAL":
            if command == "RESTART_CONTROLLER":
                return ("DENY",
                        "RESTART_CONTROLLER not in RBAC claims",
                        "POL-RBAC-001")
            return ("ALLOW",
                    "Within RBAC and baseline policy",
                    "POL-NORMAL-001")

        elif m == "INTERLOCK":
            if command in HIGH_IMPACT:
                return ("DENY",
                        "Safety interlock active — run SIMULATE_SWITCH before high-impact operations",
                        "POL-INTERLOCK-001")
            return ("ALLOW",
                    "Safety interlock active — read and diagnostic operations permitted",
                    "POL-INTERLOCK-002")

        elif m == "FREEZE":
            if command in READ_ONLY:
                return ("ALLOW",
                        "Read-only permitted during FREEZE",
                        "POL-FREEZE-002")
            return ("DENY",
                    "SAFETY HOLD ACTIVE — high-impact operations frozen by TARE",
                    "POL-FREEZE-001")

        elif m == "DOWNGRADE":
            if command in (READ_ONLY | DIAG_CMDS):
                return ("ALLOW",
                        "Diagnostics and simulation permitted in DOWNGRADE",
                        "POL-DOWN-001")
            return ("DENY",
                    "DOWNGRADE mode — operational commands restricted",
                    "POL-DOWN-002")

        elif m == "TIMEBOX_ACTIVE":
            if command == "RESTART_CONTROLLER":
                return ("DENY",
                        "RESTART_CONTROLLER permanently blocked — not in time-box scope",
                        "POL-TIMEBOX-002")
            if command in HIGH_IMPACT:
                return ("ALLOW",
                        "TIME-BOX ACTIVE — within supervisor-approved window",
                        "POL-TIMEBOX-001")
            return ("ALLOW",
                    "TIME-BOX ACTIVE — within approved window",
                    "POL-TIMEBOX-001")

        elif m == "SAFE":
            if command in READ_ONLY:
                return ("ALLOW",
                        "Safe mode — read-only permitted",
                        "POL-SAFE-001")
            return ("DENY",
                    "Safe mode — awaiting operator review before resuming operations",
                    "POL-SAFE-002")

        return ("DENY", "Unknown enforcement mode", "POL-ERR-001")

    def status(self) -> dict:
        return {
            "name":               self.NAME,
            "zone":               self.ZONE,
            "role":               self.ROLE,
            "description":        self.DESCRIPTION,
            "active":             self._active,
            "mode":               self._mode,
            "blocked_identities": list(self._blocked_identities),
            "enforcement_count":  len(self._enforcement_log),
        }
