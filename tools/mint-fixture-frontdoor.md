# Mint fixture frontdoor — prepared source, not launched

Executable entrypoint: `node tools/mint-fixture-frontdoor.js PRIVATE_CONFIG_JSON`.
The config must be an owned regular non-symlink 0600 file <=64 KiB:
`{bindIp,port:18196,nextOrigin:"http://127.0.0.1:18195",apiOrigin:"http://127.0.0.1:18131",actor,allowMutations,expiresAt,batchSecret}`.
`bindIp` must be the current verified Mint Tailscale IPv4 (planned
100.108.108.109). `expiresAt` is UTC epoch milliseconds with <=30-minute lifetime.
Anonymous is the operational default: explicitly use `actor:"anonymous"` and
`allowMutations:false`. Nonanonymous reader/other/admin map only to existing
fixtures 701/702/703; the existing bootstrap source checks those identities.
No user, permission, OAuth or account creation is performed. The nonanonymous
batch secret is a private random 64-character hex value, not supplied here.

Public entrypoint is `http://100.108.108.109:18196`; this document is no evidence
of listener availability or reachability from the user's machine. Owner must
verify actual Mint address/interface and port ownership before launch.

Next page/assets route only to pinned loopback 18195. Public /api/v1 GET,
/api/status and narrowly enumerated F1 /auth reads route only to existing
isolated API 18131. /auth/me is allowed but preference/token/history writes are
not. HEAD is served by an upstream GET with no response body, because bootstrap
allowedPath currently enumerates GET. Fixture selection is a server-side
x-f1-fixture-actor header sent only to API; external credentials and actor/forward
headers are stripped via an allowlist, including cookies/API/service tokens.
All private responses have private/no-store; upstream Set-Cookie is removed.
Only same-candidate-origin redirects are admitted. CONNECT/Upgrade, absolute
URLs, unknown authorities, traversal/encoded separators and real auth/users/
grants/jobs routes are rejected. No formal upstream fallback exists.

Every nonanonymous request must carry `x-f1-fixture-batch`, matched in constant
time against the short-lived config secret. Browser context must add this only
to the exact candidate origin; it is stripped before both upstreams, never
logged. The actor is fixed for the entire batch, never request-controlled.
Anonymous cannot turn on mutation. Opt-in nonanonymous mutation requires exact
Origin, batch authorization and no query string:

- POST /auth/tags/:tag/relations (app/src/tag-groups/submissions.ts)
- POST /auth/pictures/:tag/upload (app/src/pictures/routes.ts)
- PUT /auth/admin/tag-submissions/:id, admin only (submissions.ts)

The existing review route is PUT, not POST. No other method or arbitrary admin
mutation is enabled. Request cap is 8 MiB, matching bootstrap body() (tighter
than picture route's 15 MiB); whole exchange deadline is 10 seconds. Read-only
requests with bodies are rejected. Runtime app still applies its own CSRF,
rights, queue and isolated-database checks; this frontdoor does not fabricate a
successful avatar queue workflow when its worker is disabled.

Before launching, owner verifies strict repaired artifact inventory, ELF and
actual target-smoke receipts; original build/runtime must remain untouched.
Next environment wiring: TAG_API_ORIGIN=http://127.0.0.1:18131, PORT=18195,
HOSTNAME=127.0.0.1. Production standalone does not apply development rewrites;
frontdoor supplies browser same-origin API/auth routing. Next SSR direct API
reads are anonymous because fixture headers are attached only at frontdoor;
client session calls through /auth/me receive the fixed actor. No auth/OAuth
secrets are required or supplied by this document.

Owner alone runs current lease/kernel/shared-host resource and <=2 browser
checks, then optionally starts the service. Source/module imports and these
mock tests open no server or network connection. Existing browser capture proxy
still allows GET/HEAD only; it is intentionally not changed. Mutation browser
execution requires separately reviewed narrow proxy opt-in, never direct API
bypass. Source tests are not screenshot, interaction, review or mutation PASS.
Prepared code is uncommitted and undeployed until the root handoff records
otherwise. No runtime, browser, build, capture or download was executed here.

Source regression coverage uses only Readable/EventEmitter mocks and injected
upstream/timer callbacks, with no real listener. It covers actual handler body
forwarding, chunk cap, body-read expiration, failed synchronous audit writes,
async audit rejection, upstream/response failure and upload/client abortion.
Request and response Connection-nominated hop headers are removed; deny, close,
abort and stream error cancel deadlines and destroy upstream connections.
The bootstrap disabled queue's add() throws: proxying an upload API response
cannot establish image processing, review, or end-to-end workflow PASS.
Client network proxy remains GET/HEAD-only; it does not admit these mutations.

Next optimizer server-egress boundary: candidate bypasses production Fastify
image allowlist, so `/_next/image` is admitted only with exactly one url/w/q
parameter. `url` must be a canonical relative /favicons/[safe-name].png (optional
single safe v revision) or one of four known /pwa icon/maskable PNG paths with no
query. Width <=3840 and quality <=100 are bounded. Absolute/protocol-relative
URLs, Google/foreign/private hosts, encoded or double-encoded targets, duplicate
parameters, unknown auth/API images and traversal are rejected before Next.
This protects the server-side fetch boundary in addition to the browser proxy.
External image samples are honestly blocked, not replaced with a visual PASS.
Approved fixture API imagery through optimizer requires a separately reviewed
internal image pipe; this source does not enable it or bypass private actor
requirements. Ordinary approved API image GETs remain subject to their existing
fixture routes and authorization; optimizer admission is a narrower rule.

Candidate-only CSP overwrites incoming CSP on all frontdoor responses:
default/connect/script/font/media/manifest same-origin, inline Next script/style
permitted, image self/data/blob, object/frame/worker none, form/base self.
No Google or foreign host is permitted by this policy, including ordinary human
candidate browsing. This changes only candidate frontdoor headers, not APP or
production CSP. CSP is added defense and cannot replace the pre-launch network
proxy/context guards or actual raw network attempted/completed evidence.
