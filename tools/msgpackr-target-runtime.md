# msgpackr-extract 3.0.4 Node24/glibc target runtime (prepare-only)

`planTargetRuntime(input, io?, inventory?)` checks the original `.native-runtime-r2`
and exclusive sibling `source + '.target-runtime'`. It pins inventory
5bfc700a09b63d8144f77df8aa6e65f36f783c9d2296b0643de6979b5eb9c714,
APP 677a0c793eeda0c4d850c81ac574c95508d08e0a, BUILD_ID
PmjYScQDDoJKBr43SLkhd, Node ABI137/x64/glibc, exact package/lock 3.0.4 and
four-binding layout. Only three exact root-package files are excluded:
node.abi115.glibc.node, node.abi115.musl.node, node.napi.musl.node.
The exact node.napi.glibc.node remains. Hash/reason audit is retained for each
excluded ELF; there is no generic glob or removal of unknown files/layouts.
`validateMsgpackrSelection(entries, lock, packageJson)` is a pure validator.

`prepareMsgpackrTargetRuntime(input, dependencies)` copies to a newly created
exclusive destination; it never removes, overwrites or mutates the original
runtime. Failures retain the partial new tree. All retained bytes/modes/symlinks
are compared, and only root manifest plus new selection audit may differ.
Absolute standaloneWeb/appSource/appData root manifest paths are rebased into
the new artifact. Existing provenance/repair receipts remain unchanged.

Mandatory synchronous callbacks: verifyOriginal(root, identity) verifies the
entire original (including excluded mint-artifact bytes) and trusted Git/source
receipt; assertLock(phase), assertKernel(phase), currentGuard({phase,
estimatedAdditionalGiB:4}) validate actual held lease/kernel/current service,
load, disk and global slots. Explicit false and thenables are rejected, not silently passed; the strict
verifyElfProof validator follows the same synchronous fail-closed contract. Each
copy has a fresh gate; final original verification/hash is followed by another
prepared-return gate. The parent wrapper must monitor long operations in its
own guarded low-priority process group and provide real, fresh callbacks.

New inventory, complete strict collectElfProof and verifyElfProof are generated
for the entire derivative. No old SM/Mint native smoke is reusable after the
inventory changes. Returned artifact/elf are prepared in memory only, with
manifestPublished:false, deployEligible:false, pending-new-target-loader.
No mint-artifact.json is written. Parent controller alone publishes after worker
completion, fresh probes, checksum binding and final full validation. This
helper never invokes a native loader, build, download, network, service or
browser and produces no native-green receipt.

Dependency io/inventory/plan/createManifest/collectElfProof/verifyElfProof hooks
are only for memory-only tests; production must use defaults plus reviewed
synchronous guard/provenance callbacks. Tests and source review are not actual
target loader success. At preparation, no runtime derivation was executed,
no source commit was created and nothing was deployed.
