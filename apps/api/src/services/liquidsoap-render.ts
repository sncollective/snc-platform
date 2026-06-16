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
 * Render the Liquidsoap source variable declaration for a single editorial tier.
 *
 * Returns the variable name that represents this tier (for use in the switch predicate list),
 * and a block of Liquidsoap declarations to emit before the switch.
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
      // request.queue: the armed, manually-ordered queue for this channel.
      // The _queue var is also used for on_metadata track-event webhook, so it is
      // always declared even if the queue tier is the only tier (degenerate case).
      const varName = `${vid}_queue`;
      return {
        varName,
        declaration: `${varName} = request.queue(id="${tier.queueId}")`,
      };
    }
    case "pool": {
      // Pool: channel_content items auto-rotated via request.queue.
      // The poolQueueId carries the pool queue identifier from topology.
      // NOTE: pool vs queue queueId are the same string in the default topology (both
      // map to `channel-<uuid>`); real pool configs will use a distinct poolQueueId.
      // Rendered as a separate variable so the switch can reference them independently.
      const varName = `${vid}_pool_source`;
      return {
        varName,
        declaration: `${varName} = request.queue(id="${tier.poolQueueId}")`,
      };
    }
    case "live": {
      // Live RTMP ingest for this channel. Each channel listens on its own stream path
      // on the broadcast input port; path is derived from the channel's srsStreamName.
      // NOTE: per-channel live ingest URL is not yet carried in PlayoutEditorialTier;
      // the broadcastInputPort + srsStreamName is the provisional derivation. A future
      // topology extension should carry a `liveIngestUrl` field when live tiers are
      // configured in practice (parked — no live tier in current test scenarios).
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
 * Render the Liquidsoap switch() predicate list for a channel's editorial tiers.
 *
 * AUTO mode: priority-ordered predicates — tier 0 is highest priority.
 *   Each tier predicate checks `${vid}_priority() == <index>` AND (for the queue tier)
 *   that the queue is armed. The arm ref gates the queue tier specifically; for other
 *   tier types the predicate simply checks the priority index.
 *
 * MANUAL mode: a single predicate that is always true pins the manualTierIndex tier.
 *   All other tiers are effectively shadowed.
 *
 * Always ends with `({ true }, mksafe(blank()))` — the infallible ready tail. This
 * guarantees `${vid}_source.is_ready()` is always true and the output never goes dead.
 *
 * Behavioral-equivalence note: for a queue-only channel in AUTO mode (the current
 * default — one tier at index 0, `{ type: "queue" }`), the switch resolves to:
 *   switch(track_sensitive=false, [
 *     ({ ${vid}_armed() and ${vid}_priority() == 0 }, ${vid}_queue),
 *     ({ true }, mksafe(blank()))
 *   ])
 * When `${vid}_armed` is initialized to `true` for a queue-only channel (see below),
 * and priority is 0, this is equivalent to `fallback([queue, mksafe(blank())])`:
 * the queue plays whenever it is ready (a request.queue with pending items is_ready),
 * else blank. The arm ref is the semantically correct gate — queue plays when armed.
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

  // AUTO mode: build priority-ordered predicates (index 0 = highest priority).
  // The queue tier (if present) requires arm=true; other tiers just check priority index.
  const cases = ch.tiers.map((tier, idx) => {
    const varName = tierVarNames[idx] ?? "mksafe(blank())";
    if (tier.type === "queue") {
      // Queue tier: armed AND priority matches
      return `  ({ ${vid}_armed() and ${vid}_priority() == ${idx} }, ${varName})`;
    }
    // All other tier types: just match on priority index
    return `  ({ ${vid}_priority() == ${idx} }, ${varName})`;
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
  // Find the queue tier's variable name (for on_metadata track-event webhook).
  const queueTierIdx = ch.tiers.findIndex((tier) => tier.type === "queue");
  const queueVarName = queueTierIdx >= 0 ? (tierVarNames[queueTierIdx] ?? null) : null;
  const queueTier = queueTierIdx >= 0 ? ch.tiers[queueTierIdx] : null;

  // For a queue-only default channel (no explicit config → single queue tier at index 0),
  // initialize armed=true so the switch behaves equivalently to fallback([queue, blank]):
  // the queue plays whenever it has items (is_ready), else the mksafe tail fires.
  // If the channel has multiple tiers, start unarmed — the operator explicitly arms the queue.
  const initialArmed = ch.tiers.length === 1 && ch.tiers[0]?.type === "queue" ? "true" : "false";

  // ── Control refs ──
  // Initialized from persisted config (restart-agnostic: a restart re-renders these
  // init values from the stored config, so live mutations survive across restarts).
  const modeInit = ch.mode;
  const priorityInit = ch.manualTierIndex !== null ? ch.manualTierIndex : 0;

  // ── Switch predicates ──
  const switchExpr = renderSwitchPredicates(ch, tierVarNames);

  // ── Now-playing reads switch.selected() ──
  // Uses switch.selected() — NOT on_metadata — per position gotcha #1. on_metadata is
  // blind to mid-track re-selection; .selected() is the authoritative current-child query.
  // The on_metadata webhook (track-event POST) stays for the API live-state holder;
  // now-playing introspection reads selected state directly.

  // Queue webhook block (only emitted if a queue tier exists)
  const queueWebhookBlock =
    queueVarName && queueTier && queueTier.type === "queue"
      ? `
${queueVarName}.on_metadata(synchronous=false, fun(m) -> begin
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
${vid}_priority = ref(${priorityInit})
${vid}_armed = ref(${initialArmed})

${vid}_source = ${switchExpr}

${vid}_uri = ref("")
${vid}_title = ref("")${queueWebhookBlock}

output.url(url="rtmp://#{srs_host}:${t.srsRtmpPort}/live/${escLiq(ch.srsStreamName)}?key=#{playout_key}", enc, ${vid}_source)

harbor.http.register(port=${t.harborPort}, method="POST", "${ch.harborPaths.queue}", fun(req, res) -> begin
  ${queueVarName ?? `${vid}_queue`}.push.uri(req.body())
  res.data("queued")
end)

harbor.http.register(port=${t.harborPort}, method="POST", "${ch.harborPaths.skip}", fun(_req, res) -> begin
  ${vid}_source.skip()
  res.data("skipped")
end)

harbor.http.register(port=${t.harborPort}, method="GET", "${ch.harborPaths.nowPlaying}", fun(_req, res) -> begin
  selected = ${vid}_source.selected()
  res.json({
    uri = ${vid}_uri(),
    title = ${vid}_title(),
    selected = selected
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

harbor.http.register(port=${t.harborPort}, method="POST", "${ch.harborPaths.priority}", fun(req, res) -> begin
  secret = environment.get("PLAYOUT_CALLBACK_SECRET", default="")
  q = req.query
  if q["secret"] == secret and secret != "" then
    ${vid}_priority := int_of_string(req.body())
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
