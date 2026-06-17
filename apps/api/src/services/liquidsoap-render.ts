import { HARBOR_LEGACY_NOW_PLAYING, BROADCAST_INPUT_SWITCH_PATH } from "./playout-topology.js";
import type {
  EnvRef,
  PlayoutChannelTopology,
  PlayoutEditorialTier,
  PlayoutTopology,
} from "./playout-topology.js";

// ── Private Helpers ──

/** Escape a string for use in Liquidsoap string literals. */
const escLiq = (s: string): string => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

/** Render a runtime env reference as a Liquidsoap environment.get expression. */
const envGet = (ref: EnvRef): string =>
  `environment.get("${ref.envVar}", default="${escLiq(ref.default)}")`;

/**
 * Render the Liquidsoap source variable declarations for a single editorial tier.
 *
 * Returns an array of variable names that represent this tier's source(s) — for use
 * in the switch predicate list — and a block of Liquidsoap declarations to emit.
 *
 * The `queue` tier is the unified program source: it emits BOTH `${vid}_queue`
 * (operator request.queue) AND `${vid}_pool` (request.dynamic pool auto-fill), then
 * combines them as `${vid}_queue_program = fallback(track_sensitive=true, [queue, pool])`.
 * The `${vid}_queue_program` var is what participates in the readiness fallback switch.
 *
 * `${vid}_pool` is a `request.dynamic` that fetches the next least-recently-played
 * item by calling `/api/playout/channels/{id}/pool/next?secret=...` (implemented by
 * the control-service story). Until that endpoint exists, the pool source is not-ready
 * and the fallback falls through to silence — safe startup behavior.
 */
const renderTierSource = (
  t: PlayoutTopology,
  ch: PlayoutChannelTopology,
  tier: PlayoutEditorialTier,
  _tierIndex: number,
): { varName: string; declaration: string } => {
  const vid = ch.liqVar;
  switch (tier.type) {
    case "queue": {
      // Unified program source: operator queue + pool auto-fill.
      // ${vid}_queue = the operator's push queue (on_metadata webhook fires here
      //   for track-event POSTs + the /queue push + /skip endpoints target this).
      // ${vid}_pool = request.dynamic → fetches next LRP item from pool/next endpoint.
      //   Until the control-service endpoint exists, the dynamic returns null (not-ready)
      //   and the inner fallback silently skips to blank — correct startup behavior.
      // ${vid}_queue_program = fallback(track_sensitive=true, [queue, pool]):
      //   operator queue plays track-by-track; when empty, pool auto-fills.
      //   track_sensitive=true: a freshly-queued item is taken at the next track boundary
      //   ("switch over when ready" — the arm/take model).
      const queueVar = `${vid}_queue`;
      const poolVar = `${vid}_pool`;
      const programVar = `${vid}_queue_program`;
      const poolNextUrl = `http://\#{api_host}:\#{api_port}/api/playout/channels/${ch.id}/pool/next?secret=\#{callback_secret}`;
      const decls = [
        `${queueVar} = request.queue(id="${tier.queueId}")`,
        `${poolVar} = request.dynamic(fun() -> begin`,
        `  uri = http.get("${poolNextUrl}")`,
        `  if uri == "" then null() else request.create(uri) end`,
        `end)`,
        `${programVar} = fallback(track_sensitive=true, [${queueVar}, ${poolVar}])`,
      ].join("\n");
      return { varName: programVar, declaration: decls };
    }
    case "live": {
      // Live RTMP ingest for this channel. Each channel listens on its own stream path
      // on the broadcast input port; path is derived from the channel's srsStreamName.
      const varName = `${vid}_live_source`;
      return {
        varName,
        declaration: `${varName} = input.rtmp(listen=true, "rtmp://0.0.0.0:${t.broadcastInputPort}/live/${escLiq(ch.srsStreamName)}")`,
      };
    }
    case "channel-as-source": {
      // The referenced channel's _source variable — already defined earlier in the file
      // thanks to topological ordering enforced by buildPlayoutTopology.
      // No new declaration needed; just reference the existing variable.
      return {
        varName: tier.sourceLiqVar,
        declaration: "",
      };
    }
  }
};

/**
 * Render the Liquidsoap switch() expression for a channel's editorial tiers.
 *
 * AUTO mode: readiness fallback — all-true predicates in config order, highest priority
 * first. The queue tier additionally gates on `${vid}_armed()` so you can build the
 * queue while another source airs, then arm/take. The switch is:
 *   switch(track_sensitive=false, [
 *     ({ armed() }, queue_program),    # queue tier: armed gate
 *     ({ true }, live_source),         # live/carry tiers: always-ready predicate
 *     ({ true }, mksafe(blank()))      # infallible tail
 *   ])
 * This is a readiness fallback: the first READY (available) source wins. The queue
 * participates when armed; live participates when a stream is connected; carry
 * participates when the upstream channel has content. The mksafe tail ensures the
 * switch never has zero ready children.
 *
 * MANUAL mode: pin one source via `${vid}_manual` ref. A single-case switch with
 * the manual-indexed source, then the mksafe tail.
 *
 * Rejected: a live `priority` ref — "auto" with a priority ref conflates auto-selection
 * with manual selection and isn't self-running. The readiness fallback is self-running
 * by design (the unified editorial model, 2026-06-17).
 */
const renderSwitchPredicates = (
  ch: PlayoutChannelTopology,
  tierVarNames: string[],
): string => {
  const vid = ch.liqVar;

  if (ch.mode === "manual" && ch.manualTierIndex !== null) {
    const idx = ch.manualTierIndex;
    const pinnedVar = tierVarNames[idx] ?? "mksafe(blank())";
    const cases = [
      `  ({ true }, ${pinnedVar})`,
      `  ({ true }, mksafe(blank()))`,
    ];
    return `switch(track_sensitive=false, [\n${cases.join(",\n")}\n])`;
  }

  // AUTO mode: readiness fallback (all-true predicates = fallback semantics).
  // The queue tier gates additionally on armed so it can be built while another
  // source airs, then taken at the next track boundary.
  const cases = ch.tiers.map((tier, idx) => {
    const varName = tierVarNames[idx] ?? "mksafe(blank())";
    if (tier.type === "queue") {
      // Queue tier: participates only when armed
      return `  ({ ${vid}_armed() }, ${varName})`;
    }
    // Live and channel-as-source: always-ready predicate (readiness fallback)
    return `  ({ true }, ${varName})`;
  });
  cases.push(`  ({ true }, mksafe(blank()))`);
  return `switch(track_sensitive=false, [\n${cases.join(",\n")}\n])`;
};

/** Render the Liquidsoap block for a single playout channel. */
const renderChannelBlock = (t: PlayoutTopology, ch: PlayoutChannelTopology): string => {
  const vid = ch.liqVar;

  // ── Tier source declarations ──
  // Collect declarations + variable names for each tier.
  const tierDeclarations: string[] = [];
  const tierVarNames: string[] = [];
  for (let i = 0; i < ch.tiers.length; i++) {
    const tier = ch.tiers[i]!;
    const { varName, declaration } = renderTierSource(t, ch, tier, i);
    if (declaration !== "") tierDeclarations.push(declaration);
    tierVarNames.push(varName);
  }

  // ── Queue tier detection ──
  // Find the queue tier's _queue variable name for the on_metadata track-event webhook.
  // The queue tier renders as ${vid}_queue_program (the combined fallback), but the
  // on_metadata hook attaches to ${vid}_queue (the operator request.queue) so that
  // track events fire on operator-curated pushes.
  const queueTierIdx = ch.tiers.findIndex((tier) => tier.type === "queue");
  const queueWebhookVarName = queueTierIdx >= 0 ? `${vid}_queue` : null;

  // For a queue-only default channel (no explicit config → single queue tier at index 0),
  // initialize armed=true so the queue participates in the readiness fallback immediately —
  // behaviorally equivalent to the prior fallback([queue, blank]) default.
  // If the channel has multiple tiers (e.g. live + queue), start unarmed — the operator
  // explicitly arms the queue when they want it to take over.
  const initialArmed = ch.tiers.length === 1 && ch.tiers[0]?.type === "queue" ? "true" : "false";

  // ── Control refs ──
  // Initialized from persisted config (restart-agnostic: a restart re-renders these
  // init values from the stored config, so live mutations survive across restarts).
  // No priority ref — auto mode uses a readiness fallback, not a priority index.
  const modeInit = ch.mode;
  const manualInit = ch.manualTierIndex !== null ? ch.manualTierIndex : 0;

  // ── Switch predicates ──
  const switchExpr = renderSwitchPredicates(ch, tierVarNames);

  // ── Now-playing reads switch.selected() ──
  // Uses switch.selected() — NOT on_metadata — per position gotcha #1. on_metadata is
  // blind to mid-track re-selection; .selected() is the authoritative current-child query.
  // Returns a source-id label string (JSON-serializable; NOT the raw source object which
  // res.json cannot serialize) plus elapsed/remaining for UI progress tracking.

  // Queue webhook block (only emitted if a queue tier exists — attaches to ${vid}_queue,
  // NOT ${vid}_queue_program, so track events fire on operator-curated content only)
  const queueWebhookBlock = queueWebhookVarName
    ? `
${queueWebhookVarName}.on_metadata(synchronous=false, fun(m) -> begin
  u = m["s3_uri"]
  ${vid}_uri := if u == "" then m["filename"] else u end
  ${vid}_title := m["title"]
  ignore(http.post(
    headers=[("Content-Type", "application/json")],
    data='{"uri":"#{${vid}_uri()}","title":"#{${vid}_title()}"}',
    "http://#{api_host}:#{api_port}${ch.trackEventPath}?secret=#{callback_secret}"
  ))
end)`
    : "";

  return `
# ── Channel: ${escLiq(ch.name)} (playout) ──

${tierDeclarations.join("\n")}

${vid}_mode = ref("${modeInit}")
${vid}_manual = ref(${manualInit})
${vid}_armed = ref(${initialArmed})

${vid}_source = ${switchExpr}

${vid}_uri = ref("")
${vid}_title = ref("")${queueWebhookBlock}

output.url(url="rtmp://#{srs_host}:${t.srsRtmpPort}/live/${escLiq(ch.srsStreamName)}?key=#{playout_key}", enc, ${vid}_source)

harbor.http.register(port=${t.harborPort}, method="POST", "${ch.harborPaths.queue}", fun(req, res) -> begin
  ${queueWebhookVarName ?? `${vid}_queue`}.push.uri(req.body())
  res.data("queued")
end)

harbor.http.register(port=${t.harborPort}, method="POST", "${ch.harborPaths.skip}", fun(_req, res) -> begin
  ${vid}_source.skip()
  res.data("skipped")
end)

harbor.http.register(port=${t.harborPort}, method="GET", "${ch.harborPaths.nowPlaying}", fun(_req, res) -> begin
  e = ${vid}_source.elapsed()
  r = ${vid}_source.remaining()
  safe_elapsed = if e == infinity or e != e then -1. else e end
  safe_remaining = if r == infinity or r != r then -1. else r end
  selected_id = begin
    s = ${vid}_source.selected()
    if null.defined(s) then source.id(null.get(s)) else "(none)" end
  end
  res.json({
    uri = ${vid}_uri(),
    title = ${vid}_title(),
    elapsed = safe_elapsed,
    remaining = safe_remaining,
    selected = selected_id
  })
end)

harbor.http.register(port=${t.harborPort}, method="POST", "${ch.harborPaths.mode}", fun(req, res) -> begin
  secret = environment.get("PLAYOUT_CALLBACK_SECRET", default="")
  q = req.query
  if q["secret"] == secret and secret != "" then
    ${vid}_mode := req.body()
    res.data("ok")
  else
    res.status_code(401)
    res.data("unauthorized")
  end
end)

harbor.http.register(port=${t.harborPort}, method="POST", "${ch.harborPaths.arm}", fun(req, res) -> begin
  secret = environment.get("PLAYOUT_CALLBACK_SECRET", default="")
  q = req.query
  if q["secret"] == secret and secret != "" then
    ${vid}_armed := req.body() == "true"
    res.data("ok")
  else
    res.status_code(401)
    res.data("unauthorized")
  end
end)

harbor.http.register(port=${t.harborPort}, method="POST", "${ch.harborPaths.manual}", fun(req, res) -> begin
  secret = environment.get("PLAYOUT_CALLBACK_SECRET", default="")
  q = req.query
  if q["secret"] == secret and secret != "" then
    ${vid}_manual := int_of_string(req.body())
    res.data("ok")
  else
    res.status_code(401)
    res.data("unauthorized")
  end
end)
`;
};

// ── Public API ──

/**
 * Render the full playout.liq content from a topology document. Pure — the
 * topology is the only input; byte-identical output for identical topologies.
 *
 * Runtime values (stream key, hosts, secrets) render as environment.get
 * references resolved by Liquidsoap in its own container, never here.
 */
export const renderPlayoutLiq = (t: PlayoutTopology): string => {
  const channelBlocks = t.channels.map((ch) => renderChannelBlock(t, ch)).join("\n");

  return `# ── Auto-generated by S/NC Platform ──
# Do not edit manually — regenerated on channel create/delete.
# Static sections (logging, S3, encoding, health, S/NC TV) are preserved.

# ── Logging ──

log.stdout := true
log.file := false
log.level := 4

# ── S3 Protocol (Garage) ──

settings.protocol.aws.endpoint := ${envGet(t.env.awsEndpoint)}
settings.protocol.aws.region := ${envGet(t.env.awsRegion)}

# ── Config ──

playout_key = ${envGet(t.env.playoutKey)}
srs_host = ${envGet(t.env.srsHost)}
api_host = ${envGet(t.env.apiHost)}
api_port = ${envGet(t.env.apiPort)}
callback_secret = ${envGet(t.env.callbackSecret)}

# ── Encoding ──

enc = %ffmpeg(
  format="flv",
  %video(codec="libx264", preset="ultrafast", b="2500k", g="60"),
  %audio(codec="aac", b="256k")
)

settings.harbor.bind_addrs := ["0.0.0.0"]

# ── Health Check ──

harbor.http.register(port=${t.harborPort}, method="GET", "/health", fun(_req, res) -> begin
  res.data("ok")
end)

# ── Admin Control ──

harbor.http.register(port=${t.harborPort}, method="POST", "/admin/shutdown", fun(req, res) -> begin
  secret = ${envGet(t.env.callbackSecret)}
  q = req.query
  if q["secret"] == secret and secret != "" then
    res.data("shutting down")
    shutdown()
  else
    res.status_code(401)
    res.data("unauthorized")
  end
end)

# ── Playout Channels (generated from database) ──
${channelBlocks}
# ── S/NC TV (broadcast — static) ──

live_source = input.rtmp(listen=true, "rtmp://0.0.0.0:${t.broadcastInputPort}/live/stream")
snc_tv_queue = request.queue(id="${t.broadcast.queueId}")

# Input-switch telemetry: one transition per source, same order as the fallback list.
# Each transition posts the source name to the API so the live-state holder stays current.
# SPIKE NOTE: fallback(transitions=[...]) firing semantics in Liquidsoap 2.4 must be
# validated in the dev container before relying on these in production. The fallback plan
# (a thread.run is_ready() poller) is documented in bold-event-spine-publishers.md.
def notify_switch(name) =
  fun (_, b) -> begin
    ignore(http.post(
      headers=[("Content-Type", "application/json")],
      data='{"source":"#{name}"}',
      "http://#{api_host}:#{api_port}${BROADCAST_INPUT_SWITCH_PATH}?secret=#{callback_secret}"
    ))
    b
  end
end

snc_tv = fallback(track_sensitive=false,
  transitions=[notify_switch("live"), notify_switch("queue"), notify_switch("fallback"), notify_switch("blank")],
  [live_source, snc_tv_queue, ${t.broadcast.fallbackSourceVar}, mksafe(blank())])

snc_tv_uri = ref("")
snc_tv_title = ref("")
snc_tv.on_metadata(synchronous=false, fun(m) -> begin
  u = m["s3_uri"]
  snc_tv_uri := if u == "" then m["filename"] else u end
  snc_tv_title := m["title"]
end)

snc_tv_stream = ${envGet(t.env.sncTvStream)}
output.url(url="rtmp://#{srs_host}:${t.srsRtmpPort}/live/#{snc_tv_stream}?key=#{playout_key}", enc, snc_tv)

harbor.http.register(port=${t.harborPort}, method="GET", "${HARBOR_LEGACY_NOW_PLAYING}", fun(_req, res) -> begin
  e = snc_tv.elapsed()
  r = snc_tv.remaining()
  safe_elapsed = if e == infinity or e != e then -1. else e end
  safe_remaining = if r == infinity or r != r then -1. else r end
  res.json({
    uri = snc_tv_uri(),
    title = snc_tv_title(),
    elapsed = safe_elapsed,
    remaining = safe_remaining
  })
end)
`;
};
