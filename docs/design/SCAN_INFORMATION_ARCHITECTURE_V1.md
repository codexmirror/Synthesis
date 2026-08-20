SCAN INFORMATION ARCHITECTURE V1

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