# Mint F1 Linux runtime selection

Source/mock implementation only. No candidate has been copied, built, probed or
loaded by this change. An independently reviewed OPS snapshot and the actual
current Mint readiness/global slot/held kernel lock are still required.

`deriveRuntimePackage` creates an exclusive sibling of the install/build tree;
no existing tree or artifact is deleted or overwritten. It checks fixed APP
677a0c793eeda0c4d850c81ac574c95508d08e0a, both pinned lockfiles and BUILD_ID.
Only the lock-pinned onnxruntime-node 1.30.0 package's exact `bin/napi-v6`
layout is supported: darwin/arm64, linux/arm64, linux/x64, win32/arm64,
win32/x64. The runtime retains linux/x64 and records the foreign entries'
paths, hashes and reasons. Unknown versions/layouts fail closed. Other vendors
are not silently filtered; their ELF requirements must still pass review.

`.npm-cache`, `.home`, the private execution input, mutable guard audit and old
absolute-path working-tree manifest are explicitly excluded with path/hash
records. Directory hashes use bottom-up direct-child Merkle records; every edge
is processed once rather than rescanning each subtree. Original audit/input/cache files remain in the build tree. Environment
files are refused. Internal relative file symlinks are preserved; links escaping
the artifact or targeting excluded content are refused. Copies are exclusive
and checked against the selected source hashes. A failed copy leaves its partial
new directory for diagnosis and never publishes the selection receipt.

The selection receipt binds the original inventory, APP and BUILD_ID. A derived
legacy manifest points standalone/app source/data at the new runtime root and
records original manifest provenance; it cannot serve from the old working tree.
Final artifact inventory and full readelf version/dynamic evidence are produced
by execution under the same global lock before final publication. Selection does
not prove target native loading: native/SM target smoke, UI and deployment remain
pending. Root alone owns future actual execution.
