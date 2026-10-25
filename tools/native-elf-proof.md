# Native compatibility: Mint 2.39 to SM 2.41

A pre-build host receipt must carry an independently reviewed
`mint-f1-native-policy-v1` policy: strategy
`elf-requirements-and-sm-target-smoke`, `buildAllowed: true`, the real review
receipt ID, and a `maxGlibcRequired` ceiling of `2.39`. This authorizes candidate
preparation only. Mint and SM must both be Linux with matching architecture and
Node native ABI; their libc version strings need not be identical. Neither
receipt generation nor system upgrades are performed by these tools.

The artifact remains `prepared` / `pending-native-target-smoke`, with
`nativeAbiVerified: false`, `deployEligible: false`, and pending independent UI
review. Execution review is never copied into a native compatibility claim.
The builder reports BUILD_ID and artifact inventory hash and releases its common
build lock. No deployment occurs.

Inventory classifies actual file bytes. `collectElfProof` invokes read-only
`readelf --file-header` / `--version-info` / `--dynamic` for **every** ELF regular file, checks
its checksum before and after inspection, checks architecture and captures GLIBC
version requirements (not exported version definitions), DT_NEEDED, SONAME,
RPATH and RUNPATH. Search paths must stay inside the artifact; internal
$ORIGIN paths are recorded, and outside absolute/ambiguous token paths are
rejected. Raw readelf output digests bind that inventory. A GLIBC ceiling alone
never establishes that the other dynamic libraries are available; actual target
loading remains mandatory. Requirements above
2.39, unknown requirements, non-ELF `.node`, missing/empty evidence, incomplete
inventory or foreign architecture fail closed. Vendor packages containing unused
foreign native binaries must be handled by a separately reviewed Linux packaging
step; they are never silently excluded from this evidence.

After transferring the exact candidate, the single authorized run owner may
invoke `runTargetNativeSmoke` locally on isolated SM. First use the existing
artifact verifier with the independently pinned APP/source receipt. The smoke
helper confirms actual SM machine ID, Linux architecture, Node ABI and libc,
checks every regular-file checksum, and uses a sanitized low-priority child to
load all `.node` files plus sharp and onnxruntime-node. It starts no app, reads no
`.env`, uses no DB credentials and sends no production requests. It is loader
validation, not model inference, image processing or candidate UI approval.

The smoke receipt binds the artifact inventory hash, ELF-proof hash, actual
runtime identity and loaded native file hashes. Store that receipt outside the
candidate tree. `nativeEligibility` requires both complete ELF evidence and the
actual target-load receipt; it reports native eligibility separately and leaves
UI/deployment approval pending. No source-preparation test invokes a real
readelf, native loader, SSH connection or build.

GLIBC tokens are parsed in full; unknown suffixes/tokens fail closed. The known
`GLIBC_ABI_DT_RELR` token is retained and mapped to a minimum of 2.36, based on
[glibc 2.36 NEWS](https://sourceware.org/pipermail/glibc-cvs/2022q2/078146.html)
and [binutils' GLIBC ABI tag handling](https://sourceware.org/pipermail/binutils-cvs/2024-January/063794.html). This mapping does not replace
the actual SM isolated native loader test.
