> Current operator route: direct Mint-to-SM strict SSH is available and is the default.
> This optional SM-origin relay is historical fallback source only; it has not been executed.

# Specific Root-authorized SM-origin relay

Default execution transport remains strict direct SSH. Only an explicitly
reviewed `mint-f1-sm-relay-v1` receipt selecting `sm-origin-relay` and the exact
`root-2026-10-13-sm-origin-relay` authorization enables this adapter. It cannot
claim or acquire the Mint slot currently held by another owner.

The SM owner collects actual SM load, `/home` free bytes, local SM build count
and the three fixed end-to-end homepage samples after babysit acknowledges the
slot. `createRelayPayload` checks the actual producer machine ID and attaches a
source measurement receipt. The operator may copy it using the **existing
trusted SM→Mint owner SSH alias**, privately and atomically. This module invokes
no SSH, creates no key, changes no permissions and performs no probes.

Mint receives only a private owner-only regular JSON file in a private directory.
`readRelay` checks actual Mint machine ID, the reviewed existing channel receipt,
SM producer/measurement IDs, source receipt, content hash, complete numeric
metrics and age at most 30 seconds. Source remains `observedHost: SM`,
`measuredFromMachineId: SM` and `transport: sm-origin-relay`; the log never claims
Mint directly probed SM. The content SHA256 is integrity evidence, **not a
signature**. Authentication relies on the independently reviewed existing owner
SSH/private-file boundary.

Missing, stale, modified, public, wrong-owner, substituted or invalid data pauses
the candidate. No cached success or Mint-local metrics stand in for SM. Mint's
own disk/load/build checks remain separate. The source/receiver tests use mocked
machine identity and JSON files; no transfer, SSH or actual measurement runs.
