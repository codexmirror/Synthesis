# Scan Information Architecture V1

Status: Accepted
Scope: Where reconnaissance information is presented, and the semantic grammar
of NodeScan object pages.
Normative owner of current implemented behavior: `docs/current/NETWORK_ACCESS.md`.


1. Information is presented where its subject belongs, not merely where the
   information originated.

2. Canonical ownership and presentation location are separate concerns.

   DeviceAccess and RemoteSession remain independent canonical gameplay state.
   Device pages are their natural presentation home but do not own that state.

3. Scan object pages follow the semantic grammar:

   IDENTITY / FACTS
   STATE / FINDINGS
   RELATIONSHIPS / CONTENT
   ACTIONS

   These are semantic categories, not mandatory visible panels.

4. Device pages present:
   - Device identity and observed facts
   - player relationship/current operating state relevant to the Device
   - known network relationships
   - known child Services
   - Device-level actions

5. Service pages present:
   - Service identity and observed facts
   - Service-specific findings
   - Service-specific actions
   - provenance of established DeviceAccess when the Service created that path

6. DeviceAccess and RemoteSession share one Device-page presentation slot.

   Canonical state remains:

   DeviceAccess
       +
   RemoteSession

   Presentation may compress this as:

   USER ACCESS
   CONNECT

   becoming:

   REMOTE SESSION
   USER · ACTIVE
   DISCONNECT

   An active Session visually supersedes passive Access presentation without
   deleting DeviceAccess.

7. Findings outrank the historical operation that produced them.

   Persistent Knowledge should not permanently compete visually with redundant
   completed-analysis output.

8. Historical operation results may remain available as secondary metadata or
   Process history where useful.

9. Specialized gameplay state belongs primarily to its specialized interface.

   Scan may summarize relevant object state, but deep Filesystem, Process,
   Firmware, logging, software, or other specialized interaction should remain
   with the interface that owns that interaction.

10. A new gameplay feature does not automatically create a new permanent Scan
    section.

11. Scan should remain a Known Space / object browser rather than becoming a
    universal interface for every system.

12. Contextual projection of one target's decision line is not an exception to
    9-11; it is their boundary, and it is not owned here.

    A Scan surface may project target-relevant canonical state and
    target-relevant operations from other domains where that is necessary to
    keep one line of action against one target coherent. The canonical owner of
    each projected concern is unchanged, and the specialized interface remains
    the place that subsystem is managed in general.

    That boundary, its player-facing rules, and the Target Workspace it exists
    for are owned by
    [`HACKING_AND_OBSERVATION_V1.md`](HACKING_AND_OBSERVATION_V1.md).
