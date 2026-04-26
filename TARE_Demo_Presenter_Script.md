# TARE Demo — Presenter Script
### Two-Person Skit Format · Security Incidents as Context

**Presenters**
- **SA** — Storyteller. Delivers the incident. Calm, factual, measured.
- **SB** — Reactor. Voices what the audience is thinking. Connects the dots.

**Runtime** — Opening skit ~3 min · Each scenario bridge ~60–90 sec · Total ~10 min of narration

---

---

## OPENING SKIT
### Before the demo begins

---

**SA:** Do you remember July 19th, 2024?

**SB:** The CrowdStrike thing?

**SA:** 8.5 million Windows machines. Blue screen. All at once. Across the world.

**SB:** Flights grounded. I remember seeing the airports — people sleeping on floors, departure boards completely blank.

**SA:** Delta cancelled over 7,000 flights. Not in a week. In three days. Hospitals postponed surgeries. 911 call centres went offline. The London Stock Exchange had outages. Banks couldn't process transactions. And here's the thing that gets me —

**SB:** It wasn't even an attack.

**SA:** It wasn't an attack. It was a software update. One file. Pushed automatically. No human approved it before it went live. A security tool — something installed on every machine specifically to *protect* those machines — took down more systems in one morning than most cyberattacks ever have.

**SB:** So the tool designed to protect became the threat.

**SA:** And nobody caught it in time because the update was trusted. Valid signature. Valid source. It passed every check. The problem wasn't the *identity* of the update — it was the *behaviour* of what happened after it ran.

**SB:** That feels familiar. Wasn't there something similar with the power grid? Ukraine?

**SA:** 2015. December. Attackers got inside the Ukrainian power grid — valid credentials, legitimate access. They sat there for *months*. Watching. Learning the systems. And then on one evening they flipped 30 substations offline simultaneously. 230,000 people lost power in the middle of winter.

**SB:** And again — they were already inside. Credentials were fine.

**SA:** Credentials were fine. They moved around like authorised users because they *were* authorised users — just not the right ones. By the time anyone noticed the behaviour was wrong, the damage was done.

**SB:** And then there was the one in Saudi Arabia — the refinery?

**SA:** TRITON. 2017. Attackers got into the safety instrumented systems — the last line of defence before a plant physically explodes. Their goal wasn't to steal data. It was to disable the safety systems and cause a catastrophic explosion. They were stopped — but only because their malware had a bug. Not because anyone detected the intrusion.

**SB:** So three completely different incidents. A software update. A power grid. An oil refinery. Different countries, different industries, different methods —

**SA:** Same root problem. Once something is inside — once it has valid access — nobody is watching what it actually *does*. The door check passed. What happens after the door opens is a blind spot.

**SB:** And that blind spot is only going to get bigger as AI agents start running these systems autonomously.

**SA:** When a human does something suspicious inside a network, at least there's a chance someone notices. When an AI agent with valid credentials starts behaving strangely at machine speed — thousands of commands in seconds — there's no human fast enough to catch it.

**SB:** So what does that blind spot look like for critical infrastructure today?

**SA:** That's exactly what we're going to show you.

---

### References — Opening Skit

| Incident | Year | Read More |
|---|---|---|
| CrowdStrike Falcon global outage | 2024 | https://en.wikipedia.org/wiki/2024_CrowdStrike_incident |
| Ukraine power grid cyberattack | 2015 | https://en.wikipedia.org/wiki/2015_Ukraine_power_grid_hack |
| TRITON/TRISIS safety system attack | 2017 | https://en.wikipedia.org/wiki/Triton_(malware) |

---
---

## SCENARIO 1 BRIDGE
### Out-of-Hours — Legitimate Agent, Wrong Time

---

**SA:** Knight Capital. August 2012. A trading firm in New York.

**SB:** The algorithm that lost $440 million in 45 minutes?

**SA:** Someone deployed new trading software. But on one of eight servers, an old piece of code — decommissioned, supposed to be switched off — was still active. The system went live. The old code ran alongside the new one.

**SB:** And nobody caught it because everything looked authorised?

**SA:** Valid system. Valid credentials. Running exactly as designed — just at completely the wrong time, with completely the wrong configuration. In 45 minutes, 4 million trades. $440 million gone. The firm collapsed within the week.

**SB:** So the first scenario we're running is that version — right system, wrong window?

**SA:** An agent doing exactly what it's supposed to do. Except at 2:30 in the morning, no maintenance window, no emergency flag. Watch what TARE does instead of just blocking it outright.

*→ Run Scenario 1*

---

### References — Scenario 1

| Incident | Year | Read More |
|---|---|---|
| Knight Capital Group trading loss | 2012 | https://en.wikipedia.org/wiki/Knight_Capital_Group |
| SEC investigation report | 2013 | https://www.sec.gov/litigation/admin/2013/34-70694.pdf |

---
---

## SCENARIO 2 BRIDGE
### Repeated Failures — Agent Keeps Retrying a Blocked Command

---

**SA:** 2003. Northeast United States. The biggest blackout in North American history. 55 million people lost power.

**SB:** What caused it?

**SA:** A software bug in an alarm system at an Ohio utility. A high-voltage line touched an overgrown tree and tripped. The alarm that should have fired — didn't. So the operators had no idea. The system tried to reroute power. That line tripped. Another reroute. Another trip. Every failure cascaded into the next one because nothing stopped to say — *this isn't working, stop trying the same thing.*

**SB:** It just kept retrying the same failed action.

**SA:** For over an hour. Each retry made it worse. By the time a human noticed, the cascade had already crossed four states and into Canada. And the original fault — one line, one tree — would have been a five-minute fix.

**SB:** So scenario two is that — an agent that hits a wall and just keeps hitting the same wall?

**SA:** Watch TEMPEST.

*→ Run Scenario 2*

---

### References — Scenario 2

| Incident | Year | Read More |
|---|---|---|
| Northeast blackout of 2003 | 2003 | https://en.wikipedia.org/wiki/Northeast_blackout_of_2003 |
| US–Canada Power Outage Task Force report | 2004 | https://www.energy.gov/sites/default/files/oeprod/DocumentsandMedia/BlackoutFinal-Web.pdf |

---
---

## SCENARIO 3 BRIDGE
### Runaway Loop — Machine Speed, No Exit Condition

---

**SA:** May 6th, 2010. 2:32 in the afternoon. The Dow Jones drops 1,000 points in four minutes.

**SB:** The Flash Crash.

**SA:** One algorithm started selling futures contracts to reduce risk. Other algorithms saw the selling and sold too. The first algorithm saw more selling and sold faster. Within four minutes, some individual stocks hit zero. Others hit $100,000. Trades that made no sense — executing at machine speed, millions of them, before any human could even read what was on their screen.

**SB:** And it wasn't an attack. It was just a loop with no exit condition.

**SA:** No malicious intent. No stolen credentials. Just an automated system doing exactly what it was told — with nothing watching the *rate* at which it was doing it. The market lost a trillion dollars in value before recovering twenty minutes later.

**SB:** And in a power grid that doesn't recover in twenty minutes.

**SA:** It doesn't recover at all. This scenario — a command firing at machine speed, five times in five seconds. Watch how fast TARE closes it.

*→ Run Scenario 3*

---

### References — Scenario 3

| Incident | Year | Read More |
|---|---|---|
| 2010 Flash Crash | 2010 | https://en.wikipedia.org/wiki/2010_Flash_Crash |
| SEC & CFTC joint report | 2010 | https://www.sec.gov/news/studies/2010/marketevents-report.pdf |

---
---

## SCENARIO 4 BRIDGE
### Read-Only Breach — Limited Access Used to Reach Critical Systems

---

**SA:** 2013. Target. 110 million customer records stolen. Credit cards, home addresses, names. The largest retail breach at that point in history.

**SB:** And they got in through an HVAC contractor?

**SA:** Fazio Mechanical. A small refrigeration company that had remote access to Target's systems — limited access, just to monitor heating and cooling. Attackers compromised Fazio, used those credentials to get onto Target's network, and then pivoted. Read-only contractor access. Full payment system access. Same credential.

**SB:** So they started with something harmless and used it to reach something catastrophic.

**SA:** And at no point did any system say — *wait, a refrigeration monitoring account should not be touching payment infrastructure.* The identity was valid. The access level was the problem. Nobody was checking whether the *type* of action matched the *role* of the identity.

**SB:** That's exactly this scenario.

**SA:** A read-only monitoring identity. Starts clean — fetching status, pulling metrics, everything allowed. Then it tries to open a breaker. Watch BARRIER.

*→ Run Scenario 4*

---

### References — Scenario 4

| Incident | Year | Read More |
|---|---|---|
| Target data breach | 2013 | https://en.wikipedia.org/wiki/Target_Corporation#2013_security_breach |
| US Senate Commerce Committee report | 2014 | https://www.commerce.senate.gov/services/files/24d3c229-4f2f-405d-b8db-a3a67f183883 |

---
---

## CLOSING

**SB:** Four scenarios. Four completely different attack types. And in every single one — the agent or the system had valid credentials.

**SA:** Not one of them was stopped at the door. Traditional identity and access management would have passed all four through. TARE caught every one of them on behaviour alone — post-grant, in real time, before anything reached the grid.

**SB:** And every one of those real incidents we talked about — Knight Capital, the Northeast blackout, the Flash Crash, Target — they all had one thing in common.

**SA:** Something with valid access did something it shouldn't. And nobody was watching what it did *after* it got in.

**SB:** TARE watches.

---
---

## QUICK REFERENCE — All Incidents

| # | Scenario | Real Incident | Year | Impact | Link |
|---|---|---|---|---|---|
| Opening | Context | CrowdStrike Falcon outage | 2024 | 8.5M devices, flights grounded, hospitals down | https://en.wikipedia.org/wiki/2024_CrowdStrike_incident |
| Opening | Context | Ukraine power grid attack | 2015 | 230,000 without power, mid-winter | https://en.wikipedia.org/wiki/2015_Ukraine_power_grid_hack |
| Opening | Context | TRITON safety system attack | 2017 | Safety systems disabled, near-explosion | https://en.wikipedia.org/wiki/Triton_(malware) |
| S1 | Out-of-Hours | Knight Capital trading loss | 2012 | $440M in 45 min, firm collapsed | https://en.wikipedia.org/wiki/Knight_Capital_Group |
| S2 | Repeated Failures | Northeast blackout | 2003 | 55M people, 4 states + Canada | https://en.wikipedia.org/wiki/Northeast_blackout_of_2003 |
| S3 | Runaway Loop | Flash Crash | 2010 | $1T lost in 4 min, Dow -1,000 pts | https://en.wikipedia.org/wiki/2010_Flash_Crash |
| S4 | Read-Only Breach | Target data breach | 2013 | 110M records, HVAC contractor pivot | https://en.wikipedia.org/wiki/Target_Corporation#2013_security_breach |

---

*Document prepared for TARE — Trusted Access Response Engine demo presentation.*
*All incidents are publicly documented. Links verified at time of writing — confirm before presenting.*
