# Sharp 0.35.5 runtime RPATH derivation (source-only)

`repairSharpRuntime(input, dependencies)` has no CLI or implicit authorization.
It copies a verified original `.runtime` into an exclusive same-parent
`.native-runtime`; no original file is changed, removed, or rebuilt. Failure
retains the partial new tree. No smoke, target service, capture, download or
publication is run, and every return has `deployEligible: false` and
`manifestPublished: false`. The helper is prepare-only.

Input: `{ source, destination, originalInventorySha256, identity }`. Optional
`bindingPaths`/`originalRpath` must equal the exported exact reviewed constants.
The three fixed Sharp x64 0.35.5 bindings require the pinned original SHA and
DT_RPATH (not RUNPATH); only the first libvips directory is retained.

Mandatory trusted dependencies: `verifyOriginal(root, identity)` must verify
Git/source receipts and the original runtime (including excluded artifact
manifest bytes); `assertLock(phase)`, `assertKernel(phase)`, and
`currentGuard({phase, estimatedAdditionalGiB:4})` must verify a held shared lock,
actual compatible kernel/runtime, current service/load/disk/concurrency gates.
Owner must run the entire wrapper in a dedicated guarded low-priority group;
these synchronous callbacks do not themselves reserve an atomic global slot or
provide monitoring while copying/patching commands block.

`providePatchelf()` returns `{path,sha256,version,provenance}` from the separately
reviewed Ubuntu portable provider. `verifyToolProof(provenance)` must verify its
signed Ubuntu chain/receipt, not merely return true. This module checks actual
tool bytes and `patchelf --version` equals 0.18.0 immediately before use.
Invocation uses args, never shell interpolation:
`--force-rpath --set-rpath $ORIGIN/../../sharp-libvips-linux-x64/lib FILE`.

Readelf snapshots preserve architecture, NEEDED, SONAME, version requirements,
dynamic symbols and text bytes; tag or invariant changes fail. All libvips
entries and exact libvips-cpp.so.8.18.7 resolve inside the derived artifact.
Only the three bindings, root manifest and repair receipt may differ in the
inventory. New manifest paths use the new root; new artifact inventory and
strict full-artifact collectElfProof are recomputed, with old target smoke
invalidated. Raw readelf snapshot hashes and binding pre/post SHA are retained.
`artifact` and `elf` are returned in memory; the helper never writes
`mint-artifact.json`. After final original-source hashes, `prepared-return`
rechecks lock/kernel/current guards. The parent controller is the sole publisher
and must await worker completion, fresh probes, input/source checksum binding
and full validation before an exclusive final manifest write. Root manifest and
repair receipt in the new tree remain partial preparation artifacts, not PASS.

`io/run/inventory/snapshot/hash/createManifest/collectElfProof/verifyElfProof`
are injectable for memory-only mock tests. Production must use the default
implementations; test overrides and no-op guard/proof callbacks are not a valid
operational adapter. Independent source review and real owner wrapper are
required before execution. Current module/tests are source preparation only.
